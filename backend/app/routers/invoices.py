"""Invoice and payment write operations (M2)."""

import asyncio
from datetime import date, datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status

from app import storage
from app.audit import record_audit
from app.core.security import CurrentUser, owned_community_ids, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    AllocatePaymentRequest,
    ApplyCreditRequest,
    ApplyLateFeesRequest,
    BillOwnerRequest,
    CommunityDocument,
    CreditEntry,
    GenerateInvoicesRequest,
    Invoice,
    InvoiceCreate,
    InvoiceUpdate,
    Payment,
    PaymentBatchReport,
    PaymentCreate,
    PaymentRejection,
    PaymentReport,
    RejectPaymentRequest,
    User,
    new_id,
)
from app.routers.documents import doc_file_type
from app.notify import notify_user
from app.notification_service import (
    enqueue_for_apartment_owners,
    enqueue_notification,
)

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
    # Enqueue WhatsApp notification for apartment owners.
    await enqueue_for_apartment_owners(
        db,
        community_id=user.community_id,
        apartment_id=body.apartment_id,
        event_type="invoice_created",
        title="New Invoice",
        message=f"Sent by {user.display_name}. Invoice {invoice.description}: Rs {body.amount:,.0f} due {body.due_date}. View details: https://community.rajmanda.com/invoices",
        payload={"invoice_id": invoice.id, "amount": body.amount},
        exclude_user_id=user.id,
        actor_user=user,
    )
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
    # Assessment invoices inherit the work order's cost case automatically.
    cost_case_id = body.cost_case_id
    if body.work_order_id and not cost_case_id:
        wo = await db.work_orders.find_one(
            {"id": body.work_order_id, "community_id": user.community_id}
        )
        cost_case_id = (wo or {}).get("cost_case_id")
    # Explicit per-apartment allocations trump amount/apartment_ids.
    alloc_amounts: dict[str, float] = {}
    if body.allocations:
        alloc_amounts = {
            a.apartment_id: a.amount for a in body.allocations if a.amount > 0
        }
    wanted_ids = list(alloc_amounts) if alloc_amounts else body.apartment_ids
    apartment_query: dict = {"community_id": user.community_id}
    if wanted_ids is not None:
        apartment_query["id"] = {"$in": wanted_ids}
    apartments = await db.apartments.find(apartment_query).to_list(1000)
    if wanted_ids is not None and not apartments:
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
        apt_amount = alloc_amounts.get(apt["id"], amount)
        invoice = Invoice(
            community_id=user.community_id,
            apartment_id=apt["id"],
            period=body.period,
            description=labeled,
            amount=apt_amount,
            due_date=body.due_date,
            status=compute_status(apt_amount, 0, body.due_date),
            work_order_id=body.work_order_id,
            cost_case_id=cost_case_id,
        )
        await db.invoices.insert_one(invoice.model_dump())
        created += 1
    await record_audit(
        db, user, "create", "invoices", f"bulk:{body.period}", {"created": created}
    )
    # Enqueue WhatsApp notifications for each apartment that got an invoice.
    # Fan-outs run in parallel: sequentially this is O(apartments × users)
    # DB round-trips, which times out proxies on high-latency dev links.
    if created > 0:
        apt_query_for_notif: dict = {"community_id": user.community_id}
        if wanted_ids is not None:
            apt_query_for_notif["id"] = {"$in": wanted_ids}
        apts_for_notif = await db.apartments.find(apt_query_for_notif).to_list(1000)
        await asyncio.gather(*(
            enqueue_for_apartment_owners(
                db,
                community_id=user.community_id,
                apartment_id=apt["id"],
                event_type="invoice_created",
                title="New Invoice",
                message=f"Sent by {user.display_name}. {body.description} — {body.period}: Rs {alloc_amounts.get(apt['id'], amount):,.0f} due {body.due_date}. View details: https://community.rajmanda.com/invoices",
                payload={"period": body.period, "amount": alloc_amounts.get(apt["id"], amount)},
                exclude_user_id=user.id,
                actor_user=user,
            )
            for apt in apts_for_notif
        ))
    return {"created": created, "skipped": len(apartments) - created}


@router.post(
    "/invoices/bill-owner",
    response_model=Invoice,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def bill_owner(body: BillOwnerRequest, db: DB, user: CurrentUser) -> Invoice:
    """Itemized reimbursement invoice — money the manager spent on a specific
    flat (electricity, paperwork, repairs) and collects personally. Never
    touches community funds (ledger="reimbursement")."""
    apt = await db.apartments.find_one(
        {"id": body.apartment_id, "community_id": user.community_id}
    )
    if apt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    items = [i for i in body.line_items if i.description.strip() and i.amount > 0]
    if not items:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="At least one line item required"
        )
    total = sum(i.amount for i in items)
    invoice = Invoice(
        community_id=user.community_id,
        apartment_id=body.apartment_id,
        period=body.period,
        description=with_apartment(body.description, body.apartment_id),
        amount=total,
        due_date=body.due_date,
        status=compute_status(total, 0, body.due_date),
        ledger="reimbursement",
        line_items=items,
    )
    await db.invoices.insert_one(invoice.model_dump())
    await record_audit(
        db, user, "create", "invoices", invoice.id,
        {"ledger": "reimbursement", "total": total, "items": len(items)},
    )
    # Notify everyone whose account (or legacy link) covers this apartment.
    recipients: set[str] = set()
    async for u in db.users.find({"community_id": user.community_id}):
        apts = set()
        if u.get("account_id"):
            acct = await db.accounts.find_one({"id": u["account_id"]})
            if acct:
                apts.update(acct.get("apartment_ids", []))
        if u.get("apartment_id"):
            apts.add(u["apartment_id"])
        if body.apartment_id in apts and u["id"] != user.id:
            recipients.add(u["id"])
    for rid in recipients:
        await notify_user(
            db, user.community_id, rid,
            f"{user.name} billed Rs {total:,.0f} for {invoice.description}",
            "invoice", href="/invoices",
        )
    # Enqueue WhatsApp notification for apartment owners.
    await enqueue_for_apartment_owners(
        db,
        community_id=user.community_id,
        apartment_id=body.apartment_id,
        event_type="invoice_created",
        title="Itemized Bill",
        message=f"Billed by {user.display_name}. Itemized charge Rs {total:,.0f} for {invoice.description}. View details: https://community.rajmanda.com/invoices",
        payload={"invoice_id": invoice.id, "amount": total, "ledger": "reimbursement"},
        exclude_user_id=user.id,
        actor_user=user,
    )
    return invoice


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
    apartment_ids: list[str] = []
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
        if inv["apartment_id"] not in apartment_ids:
            apartment_ids.append(inv["apartment_id"])
    await record_audit(
        db, user, "create", "invoices", f"late-fees:{body.period}", {"created": created}
    )
    # apartmentIds lets the caller scope a supporting receipt to exactly the
    # charged apartments (who was late is not community-wide information).
    return {"created": created, "apartmentIds": apartment_ids}


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


@router.post(
    "/invoices/{invoice_id}/receipt",
    response_model=CommunityDocument,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def attach_receipt(
    invoice_id: str,
    file: UploadFile,
    db: DB,
    user: CurrentUser,
    title: Annotated[str, Form()] = "",
) -> CommunityDocument:
    """Attach a paper receipt (photo or PDF) supporting an invoice. Stored as
    a document scoped to the invoice's apartment, so only that apartment's
    owners (and managers) can see it."""
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "community_id": user.community_id}
    )
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    data = await file.read()
    if len(data) > storage.MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Max 10 MB")
    file_type = doc_file_type(file.content_type)
    doc = CommunityDocument(
        community_id=user.community_id,
        title=title.strip()
        or f"Receipt — {invoice['description']} ({invoice['period']})",
        category="Receipts",
        uploaded_date=date.today().isoformat(),
        size_kb=max(1, len(data) // 1024),
        file_type=file_type,  # type: ignore[arg-type]
        uploaded_by=user.id,
        apartment_ids=[invoice["apartment_id"]],
        invoice_id=invoice_id,
    )
    path = f"{user.community_id}/documents/{doc.id}/v1-{file.filename or 'receipt'}"
    storage.upload_object(path, data, file.content_type or "application/octet-stream")
    doc.path = path
    await db.documents.insert_one(doc.model_dump())
    await record_audit(
        db, user, "create", "documents", doc.id,
        {"title": doc.title, "invoice_id": invoice_id},
    )
    return doc


@router.delete(
    "/invoices/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Writer],
)
async def delete_invoice(
    invoice_id: str, db: DB, user: CurrentUser, cascade: bool = False
) -> None:
    """Without cascade, an invoice with payments is protected (409). With
    cascade=true the caller has confirmed deleting the payments too."""
    query = {"id": invoice_id, "community_id": {"$in": owned_community_ids(user)}}

    invoice = await db.invoices.find_one(query)
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        
    # Prevent property managers from deleting paid off invoices
    is_paid_off = invoice.get("status") == "paid" or invoice.get("paid_amount", 0) >= invoice.get("amount", 0)
    if is_paid_off and user.role == "property_manager":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Property managers are not allowed to delete paid off invoices",
        )

    linked = await db.payments.count_documents({"invoice_id": invoice_id})
    if linked and not cascade:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Invoice has payments — reverse them first",
        )
    if linked:
        await db.payments.delete_many({"invoice_id": invoice_id})
        await record_audit(
            db, user, "delete", "payments", f"cascade:{invoice_id}", {"count": linked}
        )
    await db.invoices.delete_one(query)
    await record_audit(
        db, user, "delete", "invoices", invoice_id,
        {"cascaded_payments": linked} if linked else None,
    )


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


@router.post(
    "/payments/allocate",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def allocate_payment(
    body: AllocatePaymentRequest, db: DB, user: CurrentUser
) -> dict:
    """Split one received amount across the given invoices, oldest due date
    first — one Payment per invoice portion, same method/date/reference."""
    if body.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    invoices = await db.invoices.find(
        {"id": {"$in": body.invoice_ids}, "community_id": user.community_id}
    ).to_list(200)
    if len(invoices) != len(set(body.invoice_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    open_invs = sorted(
        (i for i in invoices if i["amount"] - i["paid_amount"] > 0),
        key=lambda i: i["due_date"],
    )
    if not open_invs:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="These invoices are already paid"
        )
    remaining = body.amount
    applied = []
    for inv in open_invs:
        if remaining <= 0:
            break
        portion = min(remaining, inv["amount"] - inv["paid_amount"])
        payment = Payment(
            community_id=user.community_id,
            invoice_id=inv["id"],
            apartment_id=inv["apartment_id"],
            amount=portion,
            date=body.date,
            method=body.method,
            reference=body.reference,
            ledger=inv.get("ledger", "community"),
        )
        await db.payments.insert_one(payment.model_dump())
        await _recompute(db, inv)
        applied.append({"invoiceId": inv["id"], "apartmentId": inv["apartment_id"], "amount": portion})
        remaining -= portion
    # Money received beyond the combined outstanding is held as advance
    # credit for the newest-due invoice's apartment (confirmed immediately —
    # the manager IS the confirmation).
    excess = round(remaining, 2)
    if excess > 0:
        credit = CreditEntry(
            community_id=user.community_id,
            apartment_id=open_invs[-1]["apartment_id"],
            amount=excess,
            remaining=excess,
            reference=body.reference or f"Overpayment ({body.method})",
            date=body.date,
            created_by=user.id,
        )
        await db.credits.insert_one(credit.model_dump())
        await record_audit(
            db, user, "create", "credits", credit.id,
            {"apartment_id": credit.apartment_id, "amount": excess},
        )
    await record_audit(
        db, user, "create", "payments", f"allocate:{body.reference or body.date}",
        {"total": body.amount, "portions": len(applied),
         "excess_credit": excess, "method": body.method},
    )
    return {"applied": applied, "total": body.amount, "excessCredit": excess}


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
    if body.amount <= 0 or outstanding <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Amount must be positive and the invoice still open",
        )
    if await db.payments.find_one(
        {"invoice_id": invoice["id"], "status": "pending", "reported_by": user.id}
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="You already reported a payment for this invoice — awaiting confirmation",
        )
    # Paying more than owed is fine — the excess is held as advance credit
    # (pending until the manager confirms the money arrived).
    excess = round(body.amount - outstanding, 2)
    batch_id = new_id("payb") if excess > 0 else None
    payment = Payment(
        community_id=user.community_id,
        apartment_id=invoice["apartment_id"],
        status="pending",
        reported_by=user.id,
        ledger=invoice.get("ledger", "community"),
        batch_id=batch_id,
        **{**body.model_dump(), "amount": min(body.amount, outstanding)},
    )
    await db.payments.insert_one(payment.model_dump())
    if excess > 0:
        credit = CreditEntry(
            community_id=user.community_id,
            apartment_id=invoice["apartment_id"],
            amount=excess,
            remaining=excess,
            status="pending",
            reference=body.reference or f"Overpayment ({body.method})",
            date=body.date,
            created_by=user.id,
            batch_id=batch_id,
        )
        await db.credits.insert_one(credit.model_dump())
    await record_audit(
        db, user, "create", "payments", payment.id,
        {"invoice_id": invoice["id"], "amount": body.amount,
         "excess_credit": excess, "status": "pending"},
    )
    await _notify_managers(
        db, user.community_id,
        f"{user.name} reported a payment of Rs {body.amount:,.0f} "
        + (f"(incl. Rs {excess:,.0f} advance) " if excess > 0 else "")
        + f"({body.method}, ref {body.reference or 'n/a'}) — please confirm",
        user.id,
    )
    return payment


@router.post(
    "/payments/report-batch",
    status_code=status.HTTP_201_CREATED,
)
async def report_payment_batch(
    body: PaymentBatchReport, db: DB, user: CurrentUser
) -> dict:
    """Owner claims ONE transfer paid several invoices. The amount is split
    oldest due date first into one PENDING Payment per invoice — identical
    rows to reporting each invoice individually — linked by a shared batch id
    so the manager can confirm or reject the whole claim in one action."""
    if user.role not in REPORTER_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Managers record payments directly via POST /payments/allocate",
        )
    if body.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    if not body.invoice_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Select at least one invoice")
    apt_ids = user.apartment_ids or ([user.apartment_id] if user.apartment_id else [])
    invoices = await db.invoices.find(
        {"id": {"$in": body.invoice_ids}, "community_id": user.community_id,
         "apartment_id": {"$in": apt_ids}}
    ).to_list(200)
    if len(invoices) != len(set(body.invoice_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    already = await db.payments.find_one(
        {"invoice_id": {"$in": body.invoice_ids}, "status": "pending",
         "reported_by": user.id}
    )
    if already:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="You already reported a payment for one of these invoices — awaiting confirmation",
        )
    open_invs = sorted(
        (i for i in invoices if i["amount"] - i["paid_amount"] > 0),
        key=lambda i: i["due_date"],
    )
    if not open_invs:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="These invoices are already paid"
        )

    batch_id = new_id("payb")
    remaining = body.amount
    portions: list[dict] = []
    for inv in open_invs:
        if remaining <= 0:
            break
        portion = min(remaining, inv["amount"] - inv["paid_amount"])
        payment = Payment(
            community_id=user.community_id,
            invoice_id=inv["id"],
            apartment_id=inv["apartment_id"],
            amount=portion,
            date=body.date,
            method=body.method,
            reference=body.reference,
            status="pending",
            reported_by=user.id,
            ledger=inv.get("ledger", "community"),
            batch_id=batch_id,
        )
        await db.payments.insert_one(payment.model_dump())
        portions.append({"invoiceId": inv["id"], "paymentId": payment.id, "amount": portion})
        remaining -= portion
    # Anything beyond the combined outstanding is held as advance credit
    # (pending until the manager confirms the money actually arrived).
    excess = round(remaining, 2)
    if excess > 0:
        credit = CreditEntry(
            community_id=user.community_id,
            # Credit sticks to the newest-due invoice's apartment (the one
            # "closest to the present" for multi-apartment accounts).
            apartment_id=open_invs[-1]["apartment_id"],
            amount=excess,
            remaining=excess,
            status="pending",
            reference=body.reference or f"Overpayment ({body.method})",
            date=body.date,
            created_by=user.id,
            batch_id=batch_id,
        )
        await db.credits.insert_one(credit.model_dump())
    await record_audit(
        db, user, "create", "payments", batch_id,
        {"batch": True, "total": body.amount, "portions": len(portions),
         "excess_credit": excess, "method": body.method, "status": "pending"},
    )
    await _notify_managers(
        db, user.community_id,
        f"{user.name} reported one payment of Rs {body.amount:,.0f} covering "
        f"{len(portions)} invoice{'s' if len(portions) > 1 else ''}"
        + (f" (+ Rs {excess:,.0f} advance)" if excess > 0 else "")
        + f" ({body.method}, ref {body.reference or 'n/a'}) — please confirm",
        user.id,
    )
    return {"batchId": batch_id, "applied": portions, "total": body.amount,
            "excessCredit": excess}


async def _confirm_capped(db: Any, user: User, payment: dict) -> dict:
    """Confirm a pending payment WITHOUT ever overshooting its invoice.

    Between report and confirm the invoice may have received other money
    (applied credit, a second claimant's payment). Whatever no longer fits
    is banked as advance credit — funds never silently disappear into an
    over-paid invoice."""
    invoice = await db.invoices.find_one({"id": payment["invoice_id"]})
    outstanding = (
        round(invoice["amount"] - invoice["paid_amount"], 2) if invoice
        else payment["amount"]
    )
    excess = round(payment["amount"] - max(outstanding, 0), 2)
    if excess > 0:
        if outstanding > 0:
            await db.payments.update_one(
                {"id": payment["id"]},
                {"$set": {"status": "confirmed", "amount": outstanding}},
            )
            payment = {**payment, "status": "confirmed", "amount": outstanding}
        else:
            # Nothing left to pay — the whole payment becomes credit.
            await db.payments.delete_one({"id": payment["id"]})
            payment = {**payment, "status": "confirmed", "amount": 0}
        ref = payment.get("reference") or ""
        credit = CreditEntry(
            community_id=user.community_id,
            apartment_id=payment["apartment_id"],
            amount=excess,
            remaining=excess,
            reference="Overpayment on confirm" + (f" ({ref})" if ref else ""),
            date=date.today().isoformat(),
            created_by=user.id,
        )
        await db.credits.insert_one(credit.model_dump())
        await record_audit(
            db, user, "create", "credits", credit.id,
            {"apartment_id": credit.apartment_id, "amount": excess,
             "from_payment": payment["id"], "reason": "invoice already covered"},
        )
    else:
        await db.payments.update_one(
            {"id": payment["id"]}, {"$set": {"status": "confirmed"}}
        )
        payment = {**payment, "status": "confirmed"}
    if invoice:
        await _recompute(db, invoice)
    return payment


@router.post("/payments/{payment_id}/confirm", response_model=Payment, dependencies=[Writer])
async def confirm_payment(payment_id: str, db: DB, user: CurrentUser) -> Payment:
    payment = await db.payments.find_one(
        {"id": payment_id, "community_id": user.community_id, "status": "pending"}
    )
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No pending payment")
    if payment.get("batch_id"):
        # One transfer either arrived or it didn't — batches are decided
        # whole via /payments/batch/{id}/confirm|reject.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="This payment is part of one reported transfer — confirm or reject the whole batch",
        )
    result = await _confirm_capped(db, user, payment)
    await record_audit(db, user, "update", "payments", payment_id, {"status": "confirmed"})
    if payment.get("reported_by"):
        await notify_user(
            db, user.community_id, payment["reported_by"],
            f"Your payment of Rs {payment['amount']:,.0f} was confirmed", "invoice",
            href="/invoices",
        )
    # Enqueue WhatsApp notification for payment received.
    if payment.get("reported_by"):
        reporter = await db.users.find_one({"id": payment["reported_by"], "community_id": user.community_id})
        if reporter and reporter.get("phone"):
            await enqueue_notification(
                db,
                community_id=user.community_id,
                recipient_type=reporter.get("role", "owner"),
                recipient_name=reporter["name"],
                recipient_phone=reporter.get("phone"),
                recipient_user_id=reporter["id"],
                channel="whatsapp",
                event_type="payment_received",
                title="Payment Confirmed",
                message=f"Confirmed by {user.display_name}. Your payment of Rs {payment['amount']:,.0f} has been confirmed. View details: https://community.rajmanda.com/invoices",
                payload={"payment_id": payment_id, "amount": payment["amount"]},
                actor_user=user,
            )
    return Payment.model_validate(result)


async def _record_rejection(
    db: Any, user: User, payment: dict, reason: str
) -> None:
    """Persist the bounce on the invoice so the owner sees why (the
    notification alone scrolls away)."""
    rejection = PaymentRejection(
        community_id=user.community_id,
        invoice_id=payment["invoice_id"],
        apartment_id=payment["apartment_id"],
        amount=payment["amount"],
        reason=reason,
        rejected_by=user.id,
        reporter_id=payment.get("reported_by"),
        date=datetime.now(timezone.utc).isoformat(),
    )
    await db.payment_rejections.insert_one(rejection.model_dump())


async def _notify_rejection(
    db: Any, user: User, reporter_id: str, text: str, reason: str
) -> None:
    """Tell the owner their claim was rejected — in-app and on WhatsApp."""
    await notify_user(db, user.community_id, reporter_id, text, "invoice",
                      href="/invoices")
    reporter = await db.users.find_one(
        {"id": reporter_id, "community_id": user.community_id}
    )
    if reporter and reporter.get("phone"):
        await enqueue_notification(
            db,
            community_id=user.community_id,
            recipient_type=reporter.get("role", "owner"),
            recipient_name=reporter["name"],
            recipient_phone=reporter.get("phone"),
            recipient_user_id=reporter["id"],
            channel="whatsapp",
            event_type="payment_rejected",
            title="Payment Could Not Be Verified",
            message=(f"From {user.display_name}: {text} "
                     f"View: https://community.rajmanda.com/invoices"),
            payload={"reason": reason},
            actor_user=user,
        )


@router.post("/payments/{payment_id}/reject", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer])
async def reject_payment(
    payment_id: str, db: DB, user: CurrentUser,
    body: RejectPaymentRequest | None = None,
) -> None:
    payment = await db.payments.find_one(
        {"id": payment_id, "community_id": user.community_id, "status": "pending"}
    )
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No pending payment")
    if payment.get("batch_id"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="This payment is part of one reported transfer — confirm or reject the whole batch",
        )
    reason = (body.reason if body else "").strip()
    await db.payments.delete_one({"id": payment_id})
    await _record_rejection(db, user, payment, reason)
    await record_audit(
        db, user, "delete", "payments", payment_id,
        {"rejected": True, "reason": reason},
    )
    if payment.get("reported_by"):
        await _notify_rejection(
            db, user, payment["reported_by"],
            f"Your reported payment of Rs {payment['amount']:,.0f} could not be "
            f"verified — {reason or 'please contact the property manager'}",
            reason,
        )


@router.post("/payments/batch/{batch_id}/confirm", dependencies=[Writer])
async def confirm_payment_batch(batch_id: str, db: DB, user: CurrentUser) -> dict:
    """Confirm every pending payment reported in one batch — each portion
    goes through the same per-invoice recompute as an individual confirm.
    Any pending advance credit from the batch becomes spendable."""
    pending = await db.payments.find(
        {"batch_id": batch_id, "community_id": user.community_id, "status": "pending"}
    ).to_list(200)
    if not pending:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No pending payments in this batch")
    total = 0.0
    for p in pending:
        # Capped: anything that no longer fits its invoice (money arrived
        # through another path meanwhile) is banked as advance credit.
        confirmed = await _confirm_capped(db, user, p)
        total += confirmed["amount"]
    credits = await db.credits.find(
        {"batch_id": batch_id, "status": "pending"}
    ).to_list(10)
    credit_total = sum(c["remaining"] for c in credits)
    if credits:
        await db.credits.update_many(
            {"batch_id": batch_id, "status": "pending"},
            {"$set": {"status": "confirmed"}},
        )
    await record_audit(
        db, user, "update", "payments", batch_id,
        {"batch_confirmed": len(pending), "total": total, "credit": credit_total},
    )
    reporter_id = pending[0].get("reported_by")
    if reporter_id:
        grand = total + credit_total
        note = (
            f"Your payment of Rs {grand:,.0f} covering {len(pending)} "
            f"invoice{'s' if len(pending) > 1 else ''} was confirmed"
            + (f" (Rs {credit_total:,.0f} held as advance credit)" if credit_total > 0 else "")
        )
        await notify_user(db, user.community_id, reporter_id, note, "invoice", href="/invoices")
        reporter = await db.users.find_one(
            {"id": reporter_id, "community_id": user.community_id}
        )
        if reporter and reporter.get("phone"):
            await enqueue_notification(
                db,
                community_id=user.community_id,
                recipient_type=reporter.get("role", "owner"),
                recipient_name=reporter["name"],
                recipient_phone=reporter.get("phone"),
                recipient_user_id=reporter["id"],
                channel="whatsapp",
                event_type="payment_received",
                title="Payment Confirmed",
                message=(f"Confirmed by {user.display_name}. {note}. "
                         f"View details: https://community.rajmanda.com/invoices"),
                payload={"batch_id": batch_id, "amount": grand},
                actor_user=user,
            )
    return {"confirmed": len(pending), "total": total, "creditConfirmed": credit_total}


@router.post(
    "/payments/batch/{batch_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Writer],
)
async def reject_payment_batch(
    batch_id: str, db: DB, user: CurrentUser,
    body: RejectPaymentRequest | None = None,
) -> None:
    """Reject every pending payment in a batch (and its pending credit)."""
    pending = await db.payments.find(
        {"batch_id": batch_id, "community_id": user.community_id, "status": "pending"}
    ).to_list(200)
    if not pending:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No pending payments in this batch")
    reason = (body.reason if body else "").strip()
    total = sum(p["amount"] for p in pending)
    await db.payments.delete_many(
        {"batch_id": batch_id, "community_id": user.community_id, "status": "pending"}
    )
    for p in pending:
        await _record_rejection(db, user, p, reason)
    # All-or-none: a rejected claim never mints credit.
    await db.credits.delete_many({"batch_id": batch_id, "status": "pending"})
    await record_audit(
        db, user, "delete", "payments", batch_id,
        {"batch_rejected": len(pending), "total": total, "reason": reason},
    )
    reporter_id = pending[0].get("reported_by")
    if reporter_id:
        await _notify_rejection(
            db, user, reporter_id,
            f"Your reported payment of Rs {total:,.0f} covering {len(pending)} "
            f"invoice{'s' if len(pending) > 1 else ''} could not be verified — "
            f"{reason or 'please contact the property manager'}",
            reason,
        )


@router.get("/payments/rejections", response_model=list[PaymentRejection])
async def list_payment_rejections(db: DB, user: CurrentUser) -> list[PaymentRejection]:
    """Rejected payment claims, newest first. Owners see their own
    apartments'; managers/auditors see the whole community's."""
    query: dict = {"community_id": user.community_id}
    if user.role in REPORTER_ROLES:
        apt_ids = user.apartment_ids or ([user.apartment_id] if user.apartment_id else [])
        query["apartment_id"] = {"$in": apt_ids}
    docs = await db.payment_rejections.find(query).to_list(1000)
    docs.sort(key=lambda d: d["date"], reverse=True)
    return [PaymentRejection.model_validate(d) for d in docs]


# ---------- Advance credits (money received beyond what was owed) ----------


CREDIT_VIEW_ROLES = ("owner", "tenant", "property_manager", "community_admin",
                     "auditor", "super_admin")


@router.get("/credits", response_model=list[CreditEntry])
async def list_credits(db: DB, user: CurrentUser) -> list[CreditEntry]:
    """Advance credit entries. Owners see their own apartments' credits;
    managers/auditors see the whole community's."""
    if user.role not in CREDIT_VIEW_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No credit access")
    query: dict = {"community_id": user.community_id}
    if user.role in REPORTER_ROLES:
        apt_ids = user.apartment_ids or ([user.apartment_id] if user.apartment_id else [])
        query["apartment_id"] = {"$in": apt_ids}
    docs = await db.credits.find(query).to_list(1000)
    docs.sort(key=lambda d: d["date"])
    return [CreditEntry.model_validate(d) for d in docs]


@router.post("/payments/apply-credit", status_code=status.HTTP_201_CREATED)
async def apply_advance_credit(
    body: ApplyCreditRequest, db: DB, user: CurrentUser
) -> dict:
    """Spend an apartment's advance credit on its open invoices, oldest due
    first. Books confirmed Credit-method payments immediately — no manager
    confirmation needed, the money is already with the community. Owners may
    apply their own apartments' credit; managers anyone's."""
    if user.role in REPORTER_ROLES:
        apt_ids = user.apartment_ids or ([user.apartment_id] if user.apartment_id else [])
        if body.apartment_id not in apt_ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your apartment")
        # The family's credit is theirs, not one flat's — pool the source
        # across every apartment the caller holds.
        source_apts = apt_ids
    elif user.role in WRITE_ROLES:
        # Managers: pool across the account owning the target apartment.
        account = await db.accounts.find_one(
            {"community_id": user.community_id, "apartment_ids": body.apartment_id}
        )
        source_apts = account["apartment_ids"] if account else [body.apartment_id]
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Read-only role")

    entries = await db.credits.find(
        {"community_id": user.community_id,
         "apartment_id": {"$in": source_apts},
         "status": "confirmed", "remaining": {"$gt": 0}}
    ).to_list(1000)
    entries.sort(key=lambda e: e["date"])  # FIFO across the whole account
    balance = round(sum(e["remaining"] for e in entries), 2)
    if balance <= 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No advance credit available"
        )

    inv_query: dict = {
        "community_id": user.community_id, "apartment_id": body.apartment_id,
    }
    if body.invoice_ids:
        inv_query["id"] = {"$in": body.invoice_ids}
    invoices = await db.invoices.find(inv_query).to_list(1000)
    if body.invoice_ids and len(invoices) != len(set(body.invoice_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    # Skip invoices with a pending reported claim — applying credit there
    # would double-cover them the moment the claim is confirmed.
    claimed = {
        p["invoice_id"]
        for p in await db.payments.find(
            {"community_id": user.community_id,
             "apartment_id": body.apartment_id, "status": "pending"}
        ).to_list(1000)
    }
    open_invs = sorted(
        (i for i in invoices
         if i["amount"] - i["paid_amount"] > 0 and i["id"] not in claimed),
        key=lambda i: i["due_date"],
    )
    outstanding = round(sum(i["amount"] - i["paid_amount"] for i in open_invs), 2)
    if not open_invs:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="No open invoice to apply the credit to — the credit stays banked",
        )

    usable = min(balance, outstanding)
    amount = body.amount if body.amount is not None else usable
    if amount <= 0 or round(amount, 2) > usable:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Amount must be between 1 and {usable:,.0f} "
                   f"(credit {balance:,.0f}, outstanding {outstanding:,.0f})",
        )

    today = date.today().isoformat()
    remaining = amount
    portions: list[dict] = []
    for inv in open_invs:
        if remaining <= 0:
            break
        portion = min(remaining, inv["amount"] - inv["paid_amount"])
        payment = Payment(
            community_id=user.community_id,
            invoice_id=inv["id"],
            apartment_id=body.apartment_id,
            amount=portion,
            date=today,
            method="Credit",
            reference="Advance credit",
            ledger=inv.get("ledger", "community"),
        )
        await db.payments.insert_one(payment.model_dump())
        await _recompute(db, inv)
        portions.append({"invoiceId": inv["id"], "amount": portion})
        remaining -= portion

    # Consume the credit entries FIFO.
    consume = amount
    for e in entries:
        if consume <= 0:
            break
        take = min(consume, e["remaining"])
        await db.credits.update_one(
            {"id": e["id"]}, {"$set": {"remaining": round(e["remaining"] - take, 2)}}
        )
        consume -= take

    await record_audit(
        db, user, "create", "payments", f"apply-credit:{body.apartment_id}",
        {"apartment_id": body.apartment_id, "amount": amount,
         "portions": len(portions)},
    )
    if user.role in WRITE_ROLES:
        # Manager applied it — tell the apartment's people.
        await enqueue_for_apartment_owners(
            db, community_id=user.community_id, apartment_id=body.apartment_id,
            event_type="credit_applied",
            title="Advance Credit Applied",
            message=(f"Applied by {user.display_name}. Rs {amount:,.0f} of your "
                     f"advance credit was applied to your dues. "
                     f"View: https://community.rajmanda.com/invoices"),
            payload={"apartment_id": body.apartment_id, "amount": amount},
            exclude_user_id=user.id, actor_user=user,
        )
    else:
        await _notify_managers(
            db, user.community_id,
            f"{user.name} applied Rs {amount:,.0f} of advance credit to "
            f"{len(portions)} invoice{'s' if len(portions) > 1 else ''}",
            user.id,
        )
    return {
        "applied": amount,
        "portions": portions,
        "remainingCredit": round(balance - amount, 2),
    }
