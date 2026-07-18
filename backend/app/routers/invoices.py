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
    AdvancePaymentCreate,
    ApplyCreditRequest,
    ApplyLateFeesRequest,
    BillOwnerRequest,
    CommunityDocument,
    CreditEntry,
    CreditRefundRequest,
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
    VoidPaymentRequest,
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


_MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun",
     "jul", "aug", "sep", "oct", "nov", "dec"])}


def period_month_year(period: str) -> tuple[int | None, int | None]:
    """Best-effort parse of a period label ("Jul 2026", "July 2026",
    "2026-07") into (month, year); (None, None) when unparseable."""
    p = period.strip().lower()
    parts = p.replace("-", " ").replace("/", " ").split()
    month = year = None
    for token in parts:
        if token[:3] in _MONTHS:
            month = _MONTHS[token[:3]]
        elif token.isdigit():
            n = int(token)
            if n >= 1900:
                year = n
            elif 1 <= n <= 12 and month is None:
                month = n
    return month, year


async def active_tenants(db: Any, community_id: str) -> dict[str, dict]:
    """apartment_id -> tenant user, for every apartment with an active
    tenant on the whitelist (role or switchable roles include tenant)."""
    out: dict[str, dict] = {}
    tenants = await db.users.find(
        {"community_id": community_id,
         "$or": [{"role": "tenant"}, {"roles": "tenant"}]}
    ).to_list(1000)
    for t in tenants:
        apts = set(t.get("apartment_ids") or [])
        if t.get("apartment_id"):
            apts.add(t["apartment_id"])
        if t.get("account_id"):
            acct = await db.accounts.find_one({"id": t["account_id"]})
            if acct:
                apts.update(acct.get("apartment_ids", []))
        for a in apts:
            out.setdefault(a, t)
    return out


async def stamp_invoice_parties(
    db: Any,
    invoice: Invoice,
    *,
    tenant_map: dict[str, dict] | None = None,
    request_from_tenant: bool = False,
) -> Invoice:
    """Fill the responsibility/recipient/occupancy/billing-period fields on
    a new invoice. The owner is ALWAYS the responsible party; only the
    payment request may be routed to an active tenant."""
    apt = await db.apartments.find_one(
        {"id": invoice.apartment_id, "community_id": invoice.community_id}
    )
    owner_ids = (apt or {}).get("owner_ids") or []
    invoice.responsible_owner_id = owner_ids[0] if owner_ids else None
    if tenant_map is None:
        tenant_map = await active_tenants(db, invoice.community_id)
    tenant = tenant_map.get(invoice.apartment_id)
    invoice.apartment_occupancy_status = "rented" if tenant else "owner_occupied"
    if request_from_tenant and tenant:
        invoice.payment_request_recipient_type = "tenant"
        invoice.payment_request_recipient_id = tenant["id"]
    else:
        # No active tenant (or not requested): the request stays with the owner.
        invoice.payment_request_recipient_type = "owner"
        invoice.payment_request_recipient_id = invoice.responsible_owner_id
    invoice.billing_period_month, invoice.billing_period_year = period_month_year(
        invoice.period
    )
    return invoice


async def resolve_payer(
    db: Any, community_id: str, apartment_id: str, body: Any, actor: User
) -> dict:
    """Normalize the payer/collection fields of a payment-like request.
    Fills the payer name from the referenced user, defaults the collector
    to the recording manager, and validates tenant/owner references."""
    payer_name = (body.payer_name or "").strip()
    if body.payer_entity_id and not payer_name:
        payer = await db.users.find_one(
            {"id": body.payer_entity_id, "community_id": community_id}
        )
        if payer is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Payer not found")
        payer_name = payer["name"]
    if not payer_name and body.payer_type == "owner":
        apt = await db.apartments.find_one(
            {"id": apartment_id, "community_id": community_id}
        )
        owner_ids = (apt or {}).get("owner_ids") or []
        if owner_ids:
            owner = await db.users.find_one({"id": owner_ids[0]})
            payer_name = owner["name"] if owner else ""
    return {
        "payer_type": body.payer_type,
        "payer_entity_id": body.payer_entity_id,
        "payer_name": payer_name,
        "collected_by": body.collected_by or actor.id,
        "notes": body.notes,
    }


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
    await stamp_invoice_parties(db, invoice)
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
    tenant_map = await active_tenants(db, user.community_id)
    tenant_wanted = set(body.tenant_recipients or [])
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
        await stamp_invoice_parties(
            db, invoice, tenant_map=tenant_map,
            request_from_tenant=apt["id"] in tenant_wanted,
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
    await stamp_invoice_parties(db, invoice)
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
        # Late fee follows its parent's payment-request routing.
        await stamp_invoice_parties(
            db, fee,
            request_from_tenant=inv.get("payment_request_recipient_type") == "tenant",
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
    # Re-routing the payment request to the tenant requires an active tenant;
    # routing back to owner re-resolves the owner snapshot. Liability never moves.
    if updates.get("payment_request_recipient_type") == "tenant":
        current = await db.invoices.find_one(
            {"id": invoice_id, "community_id": user.community_id}
        )
        if current is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        tenant = (await active_tenants(db, user.community_id)).get(
            current["apartment_id"]
        )
        if tenant is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="This apartment has no active tenant on the whitelist",
            )
        updates.setdefault("payment_request_recipient_id", tenant["id"])
        updates["apartment_occupancy_status"] = "rented"
    elif updates.get("payment_request_recipient_type") == "owner":
        current = await db.invoices.find_one(
            {"id": invoice_id, "community_id": user.community_id}
        )
        if current:
            updates.setdefault(
                "payment_request_recipient_id", current.get("responsible_owner_id")
            )
    if "period" in updates:
        month, year = period_month_year(updates["period"])
        updates["billing_period_month"] = month
        updates["billing_period_year"] = year
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
    """Record money received against an invoice. The payer may be the owner,
    the current tenant (paid on behalf of the owner), or anyone else — the
    payment always settles the OWNER's invoice and ledger. Paying more than
    the outstanding balance banks the excess as an advance credit on the
    owner's account, with the payer identity preserved."""
    invoice = await db.invoices.find_one(
        {"id": body.invoice_id, "community_id": user.community_id}
    )
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if body.amount <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Amount must be positive"
        )
    outstanding = round(invoice["amount"] - invoice["paid_amount"], 2)
    if outstanding <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already paid — record an advance payment instead",
        )
    payer = await resolve_payer(
        db, user.community_id, invoice["apartment_id"], body, user
    )
    applied = min(body.amount, outstanding)
    excess = round(body.amount - applied, 2)
    now = datetime.now(timezone.utc).isoformat()
    payment = Payment(
        community_id=user.community_id,
        apartment_id=invoice["apartment_id"],
        ledger=invoice.get("ledger", "community"),
        **{**body.model_dump(), "amount": applied},
        created_at=now,
        created_by=user.id,
    )
    payment.payer_type = payer["payer_type"]
    payment.payer_entity_id = payer["payer_entity_id"]
    payment.payer_name = payer["payer_name"]
    payment.collected_by = payer["collected_by"]
    payment.collection_date = body.collection_date or body.date
    await db.payments.insert_one(payment.model_dump())
    if excess > 0:
        credit = CreditEntry(
            community_id=user.community_id,
            apartment_id=invoice["apartment_id"],
            amount=excess,
            remaining=excess,
            reference=body.reference or f"Overpayment ({body.method})",
            date=body.date,
            created_by=user.id,
            payer_type=payer["payer_type"],
            payer_entity_id=payer["payer_entity_id"],
            payer_name=payer["payer_name"],
            collected_by=payer["collected_by"],
            notes=f"Overpayment on {invoice['description']}",
        )
        await db.credits.insert_one(credit.model_dump())
        await record_audit(
            db, user, "create", "credits", credit.id,
            {"apartment_id": credit.apartment_id, "amount": excess,
             "payer_type": credit.payer_type, "payer_name": credit.payer_name,
             "reason": "overpayment"},
        )
    await _recompute(db, invoice)
    await record_audit(
        db, user, "create", "payments", payment.id,
        {"invoice_id": invoice["id"], "amount": applied, "method": body.method,
         "payer_type": payment.payer_type, "payer_name": payment.payer_name,
         "collected_by": payment.collected_by, "excess_credit": excess},
    )
    # A third-party payer who is a portal member gets their receipt in-app.
    if (
        payment.payer_entity_id
        and payment.payer_type != "owner"
        and payment.payer_entity_id != user.id
    ):
        await notify_user(
            db, user.community_id, payment.payer_entity_id,
            f"Receipt: your payment of Rs {applied:,.0f} toward "
            f"{invoice['description']} ({invoice['period']}) was recorded on "
            f"behalf of the apartment owner",
            "invoice", href="/payments",
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


@router.post(
    "/payments/{payment_id}/void", response_model=Payment, dependencies=[Writer]
)
async def void_payment(
    payment_id: str, db: DB, user: CurrentUser,
    body: VoidPaymentRequest | None = None,
) -> Payment:
    """Void a posted payment instead of editing or deleting it — the row
    stays in the collection (with who/when/why) but counts nowhere. To
    correct a mistake: void, then record the replacement payment."""
    payment = await db.payments.find_one(
        {"id": payment_id, "community_id": user.community_id, "status": "confirmed"}
    )
    if payment is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No confirmed payment to void"
        )
    reason = (body.reason if body else "").strip()
    now = datetime.now(timezone.utc).isoformat()
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "voided", "voided_at": now, "voided_by": user.id,
                  "void_reason": reason}},
    )
    invoice = await db.invoices.find_one({"id": payment["invoice_id"]})
    if invoice:
        await _recompute(db, invoice)
    await record_audit(
        db, user, "update", "payments", payment_id,
        {"voided": True, "reason": reason, "amount": payment["amount"],
         "invoice_id": payment["invoice_id"]},
    )
    return Payment.model_validate(await db.payments.find_one({"id": payment_id}))


@router.post(
    "/payments/advance",
    response_model=CreditEntry,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def record_advance_payment(
    body: AdvancePaymentCreate, db: DB, user: CurrentUser
) -> CreditEntry:
    """Money received BEFORE its invoice exists (e.g. a tenant paying next
    month's HOA fee early). Held as an unapplied credit on the owner's
    account — the payer identity travels with it, and once the invoice is
    generated the manager applies it via POST /payments/apply-credit."""
    apt = await db.apartments.find_one(
        {"id": body.apartment_id, "community_id": user.community_id}
    )
    if apt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    if body.amount <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Amount must be positive"
        )
    payer = await resolve_payer(db, user.community_id, body.apartment_id, body, user)
    credit = CreditEntry(
        community_id=user.community_id,
        apartment_id=body.apartment_id,
        amount=body.amount,
        remaining=body.amount,
        source="advance",
        reference=body.reference or f"Advance payment ({body.method})",
        date=body.date,
        created_by=user.id,
        payer_type=payer["payer_type"],
        payer_entity_id=payer["payer_entity_id"],
        payer_name=payer["payer_name"],
        collected_by=payer["collected_by"],
        notes=body.notes,
    )
    await db.credits.insert_one(credit.model_dump())
    await record_audit(
        db, user, "create", "credits", credit.id,
        {"apartment_id": body.apartment_id, "amount": body.amount,
         "source": "advance", "method": body.method,
         "payer_type": credit.payer_type, "payer_name": credit.payer_name,
         "collected_by": credit.collected_by},
    )
    if credit.payer_entity_id and credit.payer_entity_id != user.id:
        await notify_user(
            db, user.community_id, credit.payer_entity_id,
            f"Receipt: your advance payment of Rs {body.amount:,.0f} for "
            f"Apt {body.apartment_id.replace('apt-', '')} is held on the "
            f"owner's account and will settle the next invoice",
            "invoice", href="/payments",
        )
    return credit


@router.post(
    "/credits/{credit_id}/refund", response_model=CreditEntry, dependencies=[Writer]
)
async def refund_credit(
    credit_id: str, db: DB, user: CurrentUser,
    body: CreditRefundRequest | None = None,
) -> CreditEntry:
    """Return an unapplied credit to the person who funded it (the preserved
    payer — a tenant's advance goes back to the tenant, never silently to
    the owner). Records the refund; the money movement itself is offline."""
    entry = await db.credits.find_one(
        {"id": credit_id, "community_id": user.community_id,
         "status": "confirmed", "remaining": {"$gt": 0}}
    )
    if entry is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="No refundable credit"
        )
    note = (body.note if body else "").strip()
    now = datetime.now(timezone.utc).isoformat()
    await db.credits.update_one(
        {"id": credit_id},
        {"$set": {"status": "refunded", "remaining": 0, "refunded_at": now,
                  "refunded_by": user.id, "refund_note": note}},
    )
    await record_audit(
        db, user, "update", "credits", credit_id,
        {"refunded": True, "amount": entry["remaining"], "note": note,
         "refund_to_payer_type": entry.get("payer_type", "owner"),
         "refund_to_payer_name": entry.get("payer_name", ""),
         "refund_to_payer_entity_id": entry.get("payer_entity_id")},
    )
    if entry.get("payer_entity_id") and entry["payer_entity_id"] != user.id:
        await notify_user(
            db, user.community_id, entry["payer_entity_id"],
            f"Your unapplied payment of Rs {entry['remaining']:,.0f} is being "
            f"refunded to you" + (f" — {note}" if note else ""),
            "invoice", href="/payments",
        )
    return CreditEntry.model_validate(await db.credits.find_one({"id": credit_id}))


REPORTER_ROLES = ("owner", "tenant")


async def resolve_reported_payer(
    db: Any, user: User, apartment_id: str,
    payer_type: str | None, payer_name: str,
    tenant_map: dict[str, dict] | None = None,
) -> dict:
    """Payer of an owner/tenant-reported claim. Defaults to the reporter;
    an owner may declare their tenant (resolved from the whitelist) or a
    named third party as the one who actually paid."""
    self_type = "tenant" if user.role == "tenant" else "owner"
    if payer_type is None or payer_type == self_type:
        return {"payer_type": self_type, "payer_entity_id": user.id,
                "payer_name": user.name}
    if payer_type == "tenant":
        if tenant_map is None:
            tenant_map = await active_tenants(db, user.community_id)
        tenant = tenant_map.get(apartment_id)
        if tenant:
            return {"payer_type": "tenant", "payer_entity_id": tenant["id"],
                    "payer_name": tenant["name"]}
        name = payer_name.strip()
        if not name:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="No tenant on the whitelist for this apartment — give the payer's name",
            )
        return {"payer_type": "tenant", "payer_entity_id": None, "payer_name": name}
    if payer_type == "owner":
        # A tenant reporting that the owner actually paid.
        apt = await db.apartments.find_one(
            {"id": apartment_id, "community_id": user.community_id}
        )
        owner_ids = (apt or {}).get("owner_ids") or []
        owner = await db.users.find_one({"id": owner_ids[0]}) if owner_ids else None
        return {"payer_type": "owner",
                "payer_entity_id": (owner or {}).get("id"),
                "payer_name": (owner or {}).get("name", payer_name.strip() or "Owner")}
    name = payer_name.strip()
    if not name:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Give the payer's name"
        )
    return {"payer_type": "other", "payer_entity_id": None, "payer_name": name}


def payer_note(payer: dict) -> str:
    """' (paid by X on behalf of the owner)' suffix for manager notifications."""
    if payer["payer_type"] == "owner":
        return ""
    kind = " — tenant" if payer["payer_type"] == "tenant" else ""
    return f" (paid by {payer['payer_name']}{kind}, on behalf of the owner)"


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
    # The reporter may name the actual payer (their tenant, someone else) —
    # the invoice stays the owner's receivable either way.
    payer = await resolve_reported_payer(
        db, user, invoice["apartment_id"], body.payer_type, body.payer_name
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
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by=user.id,
        **payer,
        **{**body.model_dump(exclude={"payer_type", "payer_name"}),
           "amount": min(body.amount, outstanding)},
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
            **payer,
        )
        await db.credits.insert_one(credit.model_dump())
    await record_audit(
        db, user, "create", "payments", payment.id,
        {"invoice_id": invoice["id"], "amount": body.amount,
         "excess_credit": excess, "status": "pending",
         "payer_type": payer["payer_type"], "payer_name": payer["payer_name"]},
    )
    await _notify_managers(
        db, user.community_id,
        f"{user.name} reported a payment of Rs {body.amount:,.0f} "
        + (f"(incl. Rs {excess:,.0f} advance) " if excess > 0 else "")
        + f"({body.method}, ref {body.reference or 'n/a'})"
        + payer_note(payer)
        + " — please confirm",
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
            detail="Managers record payments directly via POST /payments",
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
    # The claimed payer resolves per apartment (an account's flats can have
    # different tenants); the whole batch shares one declared payer type.
    # Resolved up front so a validation error never leaves a partial batch.
    tenant_map = await active_tenants(db, user.community_id)
    payer_by_apt = {
        apt_id: await resolve_reported_payer(
            db, user, apt_id, body.payer_type, body.payer_name,
            tenant_map=tenant_map,
        )
        for apt_id in {i["apartment_id"] for i in open_invs}
    }
    remaining = body.amount
    portions: list[dict] = []
    last_payer: dict | None = None
    for inv in open_invs:
        if remaining <= 0:
            break
        payer = payer_by_apt[inv["apartment_id"]]
        last_payer = payer
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
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by=user.id,
            **payer,
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
            **(last_payer or {"payer_type": "owner", "payer_entity_id": user.id,
                              "payer_name": user.name}),
        )
        await db.credits.insert_one(credit.model_dump())
    await record_audit(
        db, user, "create", "payments", batch_id,
        {"batch": True, "total": body.amount, "portions": len(portions),
         "excess_credit": excess, "method": body.method, "status": "pending",
         **({"payer_type": last_payer["payer_type"],
             "payer_name": last_payer["payer_name"]} if last_payer else {})},
    )
    await _notify_managers(
        db, user.community_id,
        f"{user.name} reported one payment of Rs {body.amount:,.0f} covering "
        f"{len(portions)} invoice{'s' if len(portions) > 1 else ''}"
        + (f" (+ Rs {excess:,.0f} advance)" if excess > 0 else "")
        + f" ({body.method}, ref {body.reference or 'n/a'})"
        + (payer_note(last_payer) if last_payer else "")
        + " — please confirm",
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
    # The confirming manager is the one who received the money.
    collector = {
        "collected_by": payment.get("collected_by") or user.id,
        "collection_date": payment.get("collection_date") or payment["date"],
    }
    excess = round(payment["amount"] - max(outstanding, 0), 2)
    if excess > 0:
        if outstanding > 0:
            await db.payments.update_one(
                {"id": payment["id"]},
                {"$set": {"status": "confirmed", "amount": outstanding, **collector}},
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
            # The banked excess keeps the original payer's identity.
            payer_type=payment.get("payer_type", "owner"),
            payer_entity_id=payment.get("payer_entity_id"),
            payer_name=payment.get("payer_name", ""),
        )
        await db.credits.insert_one(credit.model_dump())
        await record_audit(
            db, user, "create", "credits", credit.id,
            {"apartment_id": credit.apartment_id, "amount": excess,
             "from_payment": payment["id"], "reason": "invoice already covered"},
        )
    else:
        await db.payments.update_one(
            {"id": payment["id"]}, {"$set": {"status": "confirmed", **collector}}
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


@router.get("/payments/migration-report")
async def payment_migration_report(db: DB, user: CurrentUser) -> dict:
    """Report of migration 008's payer reclassification for this community:
    payments re-attributed to tenants, and rows needing manual review."""
    if user.role not in (*WRITE_ROLES, "auditor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Managers/auditors only")
    doc = await db.migration_reports.find_one({"id": "m008"}) or {"entries": []}
    entries = [
        e for e in doc.get("entries", [])
        if e.get("community_id") == user.community_id
    ]
    return {"id": "m008", "title": doc.get("title", ""), "entries": entries}


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
    # The applied payments inherit the credit's funder — a tenant's advance
    # stays attributed to the tenant when it lands on an invoice. Mixed-
    # funder pools fall back to "other"/"Multiple payers".
    to_consume: list[dict] = []
    _left = amount
    for e in entries:
        if _left <= 0:
            break
        to_consume.append(e)
        _left -= min(_left, e["remaining"])
    funders = {
        (e.get("payer_type", "owner"), e.get("payer_name", ""),
         e.get("payer_entity_id"))
        for e in to_consume
    }
    if len(funders) == 1:
        f_type, f_name, f_id = next(iter(funders))
    else:
        f_type, f_name, f_id = "other", "Multiple payers", None
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
            payer_type=f_type,
            payer_entity_id=f_id,
            payer_name=f_name,
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by=user.id,
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
