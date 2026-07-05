"""Invoice and payment write operations (M2)."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    ApplyLateFeesRequest,
    GenerateInvoicesRequest,
    Invoice,
    InvoiceCreate,
    InvoiceUpdate,
    Payment,
    PaymentCreate,
    PaymentReport,
)
from app.notify import notify_user

router = APIRouter(tags=["invoices"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


def with_apartment(description: str, apartment_id: str) -> str:
    """Bake the apartment into the stored description so every surface
    (UI, PDFs, CSV, notifications) shows what the invoice is for."""
    if "apt" in description.lower():
        return description
    return f"{description} - Apt {apartment_id.replace('apt-', '')}"


def compute_status(amount: float, paid: float, due_date: str) -> str:
    if paid >= amount:
        return "paid"
    if paid > 0:
        return "partial"
    return "overdue" if due_date < date.today().isoformat() else "due"


async def _recompute(db: Any, invoice: dict) -> dict:
    payments = await db.payments.find({"invoice_id": invoice["id"]}).to_list(1000)
    # Pending (owner-reported, unconfirmed) payments never count.
    paid = sum(
        p["amount"] for p in payments if p.get("status", "confirmed") == "confirmed"
    )
    new_status = compute_status(invoice["amount"], paid, invoice["due_date"])
    await db.invoices.update_one(
        {"id": invoice["id"]}, {"$set": {"paid_amount": paid, "status": new_status}}
    )
    return await db.invoices.find_one({"id": invoice["id"]})


@router.post(
    "/invoices",
    response_model=Invoice,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_invoice(body: InvoiceCreate, db: DB, user: CurrentUser) -> Invoice:
    apt = await db.apartments.find_one(
        {"id": body.apartment_id, "community_id": user.community_id}
    )
    if apt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    data = body.model_dump()
    data["description"] = with_apartment(data["description"], body.apartment_id)
    invoice = Invoice(
        community_id=user.community_id,
        status=compute_status(body.amount, 0, body.due_date),
        **data,
    )
    await db.invoices.insert_one(invoice.model_dump())
    await record_audit(db, user, "create", "invoices", invoice.id)
    return invoice


@router.post("/invoices/generate", dependencies=[Writer])
async def generate_invoices(
    body: GenerateInvoicesRequest, db: DB, user: CurrentUser
) -> dict:
    """Generate one invoice per apartment for a period — all apartments by
    default, or only `apartment_ids` when provided. Idempotent: apartments
    that already have an invoice with this description+period are skipped,
    so re-running (or a future Cloud Scheduler hook) is safe."""
    community = await db.communities.find_one({"id": user.community_id})
    amount = body.amount if body.amount is not None else community.get(
        "monthly_maintenance", 3500
    )
    apartment_query: dict = {"community_id": user.community_id}
    if body.apartment_ids is not None:
        apartment_query["id"] = {"$in": body.apartment_ids}
    apartments = await db.apartments.find(apartment_query).to_list(1000)
    if body.apartment_ids is not None and not apartments:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="No matching apartments"
        )
    created = 0
    for apt in apartments:
        labeled = with_apartment(body.description, apt["id"])
        exists = await db.invoices.find_one(
            {
                "community_id": user.community_id,
                "apartment_id": apt["id"],
                "period": body.period,
                # Old rows may carry the unlabeled description — match both.
                "description": {"$in": [body.description, labeled]},
            }
        )
        if exists:
            continue
        invoice = Invoice(
            community_id=user.community_id,
            apartment_id=apt["id"],
            period=body.period,
            description=labeled,
            amount=amount,
            due_date=body.due_date,
            status=compute_status(amount, 0, body.due_date),
        )
        await db.invoices.insert_one(invoice.model_dump())
        created += 1
    await record_audit(
        db, user, "create", "invoices", f"bulk:{body.period}", {"created": created}
    )
    return {"created": created, "skipped": len(apartments) - created}


@router.post("/invoices/apply-late-fees", dependencies=[Writer])
async def apply_late_fees(
    body: ApplyLateFeesRequest, db: DB, user: CurrentUser
) -> dict:
    """Create a late-fee invoice for each overdue invoice of the period
    (skipping ones that already have a late fee)."""
    overdue = await db.invoices.find(
        {
            "community_id": user.community_id,
            "period": body.period,
            "status": "overdue",
            "parent_invoice_id": None,
        }
    ).to_list(1000)
    created = 0
    for inv in overdue:
        exists = await db.invoices.find_one({"parent_invoice_id": inv["id"]})
        if exists:
            continue
        fee = Invoice(
            community_id=user.community_id,
            apartment_id=inv["apartment_id"],
            period=body.period,
            description=with_apartment(f"Late Fee — {body.period}", inv["apartment_id"]),
            amount=body.amount,
            due_date=body.due_date,
            status=compute_status(body.amount, 0, body.due_date),
            parent_invoice_id=inv["id"],
        )
        await db.invoices.insert_one(fee.model_dump())
        created += 1
    await record_audit(
        db, user, "create", "invoices", f"late-fees:{body.period}", {"created": created}
    )
    return {"created": created}


@router.patch("/invoices/{invoice_id}", response_model=Invoice, dependencies=[Writer])
async def update_invoice(
    invoice_id: str, body: InvoiceUpdate, db: DB, user: CurrentUser
) -> Invoice:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    invoice = await db.invoices.find_one_and_update(
        {"id": invoice_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    invoice = await _recompute(db, invoice)
    await record_audit(db, user, "update", "invoices", invoice_id, updates)
    return Invoice.model_validate(invoice)


@router.delete(
    "/invoices/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Writer],
)
async def delete_invoice(invoice_id: str, db: DB, user: CurrentUser) -> None:
    if await db.payments.find_one({"invoice_id": invoice_id}):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Invoice has payments — reverse them first",
        )
    result = await db.invoices.delete_one(
        {"id": invoice_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    await record_audit(db, user, "delete", "invoices", invoice_id)


@router.post(
    "/payments",
    response_model=Payment,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def record_payment(body: PaymentCreate, db: DB, user: CurrentUser) -> Payment:
    invoice = await db.invoices.find_one(
        {"id": body.invoice_id, "community_id": user.community_id}
    )
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if body.amount <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Amount must be positive"
        )
    outstanding = invoice["amount"] - invoice["paid_amount"]
    if body.amount > outstanding:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Amount exceeds outstanding balance ({outstanding})",
        )
    payment = Payment(
        community_id=user.community_id,
        apartment_id=invoice["apartment_id"],
        ledger=invoice.get("ledger", "community"),
        **body.model_dump(),
    )
    await db.payments.insert_one(payment.model_dump())
    await _recompute(db, invoice)
    await record_audit(
        db, user, "create", "payments", payment.id,
        {"invoice_id": invoice["id"], "amount": body.amount, "method": body.method},
    )
    return payment


@router.delete(
    "/payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Writer],
)
async def reverse_payment(payment_id: str, db: DB, user: CurrentUser) -> None:
    payment = await db.payments.find_one(
        {"id": payment_id, "community_id": user.community_id}
    )
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Payment not found")
    await db.payments.delete_one({"id": payment_id})
    invoice = await db.invoices.find_one({"id": payment["invoice_id"]})
    if invoice:
        await _recompute(db, invoice)
    await record_audit(db, user, "delete", "payments", payment_id)


REPORTER_ROLES = ("owner", "tenant")


async def _notify_managers(db: Any, community_id: str, text: str, exclude: str) -> None:
    managers = await db.users.find(
        {"community_id": community_id,
         "role": {"$in": ["property_manager", "community_admin"]}}
    ).to_list(100)
    for m in managers:
        if m["id"] != exclude:
            await notify_user(db, community_id, m["id"], text, "invoice", href="/payments")


@router.post(
    "/payments/report",
    response_model=Payment,
    status_code=status.HTTP_201_CREATED,
)
async def report_payment(body: PaymentReport, db: DB, user: CurrentUser) -> Payment:
    """Owner claims an offline payment; it stays pending (not counted) until
    the manager confirms."""
    if user.role not in REPORTER_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Managers record payments directly via POST /payments",
        )
    apt_ids = user.apartment_ids or ([user.apartment_id] if user.apartment_id else [])
    invoice = await db.invoices.find_one(
        {"id": body.invoice_id, "community_id": user.community_id,
         "apartment_id": {"$in": apt_ids}}
    )
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    outstanding = invoice["amount"] - invoice["paid_amount"]
    if body.amount <= 0 or body.amount > outstanding:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Amount must be between 1 and the outstanding {outstanding}",
        )
    if await db.payments.find_one(
        {"invoice_id": invoice["id"], "status": "pending", "reported_by": user.id}
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="You already reported a payment for this invoice — awaiting confirmation",
        )
    payment = Payment(
        community_id=user.community_id,
        apartment_id=invoice["apartment_id"],
        status="pending",
        reported_by=user.id,
        ledger=invoice.get("ledger", "community"),
        **body.model_dump(),
    )
    await db.payments.insert_one(payment.model_dump())
    await record_audit(
        db, user, "create", "payments", payment.id,
        {"invoice_id": invoice["id"], "amount": body.amount, "status": "pending"},
    )
    await _notify_managers(
        db, user.community_id,
        f"{user.name} reported a payment of Rs {body.amount:,.0f} "
        f"({body.method}, ref {body.reference or 'n/a'}) — please confirm",
        user.id,
    )
    return payment


@router.post("/payments/{payment_id}/confirm", response_model=Payment, dependencies=[Writer])
async def confirm_payment(payment_id: str, db: DB, user: CurrentUser) -> Payment:
    payment = await db.payments.find_one(
        {"id": payment_id, "community_id": user.community_id, "status": "pending"}
    )
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No pending payment")
    result = await db.payments.find_one_and_update(
        {"id": payment_id}, {"$set": {"status": "confirmed"}}, return_document=True
    )
    invoice = await db.invoices.find_one({"id": payment["invoice_id"]})
    if invoice:
        await _recompute(db, invoice)
    await record_audit(db, user, "update", "payments", payment_id, {"status": "confirmed"})
    if payment.get("reported_by"):
        await notify_user(
            db, user.community_id, payment["reported_by"],
            f"Your payment of Rs {payment['amount']:,.0f} was confirmed", "invoice",
            href="/invoices",
        )
    return Payment.model_validate(result)


@router.post("/payments/{payment_id}/reject", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer])
async def reject_payment(payment_id: str, db: DB, user: CurrentUser) -> None:
    payment = await db.payments.find_one(
        {"id": payment_id, "community_id": user.community_id, "status": "pending"}
    )
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No pending payment")
    await db.payments.delete_one({"id": payment_id})
    await record_audit(db, user, "delete", "payments", payment_id, {"rejected": True})
    if payment.get("reported_by"):
        await notify_user(
            db, user.community_id, payment["reported_by"],
            f"Your reported payment of Rs {payment['amount']:,.0f} could not be "
            f"verified — please contact the property manager", "invoice",
            href="/invoices",
        )
