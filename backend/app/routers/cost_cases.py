"""Cost cases — one complete financial event (bore well repair, lift fix…).

The case is a lean parent: work orders, expenses and assessment invoices
link back via cost_case_id, and every money total is computed live from
those children so nothing can drift. Draft expenses are vendor bills under
review and never count as spend."""

import asyncio
import calendar
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    FINANCE_READ_ROLES,
    WRITE_ROLES,
    AssessmentRequest,
    CostCase,
    CostCaseClose,
    CostCaseCreate,
    Expense,
    Invoice,
    MaintenanceRequest,
    Payment,
    WorkOrder,
)

router = APIRouter(prefix="/cost-cases", tags=["cost-cases"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))
FinanceReader = Depends(require_roles(*FINANCE_READ_ROLES))


async def _children(db: Any, case_id: str) -> tuple[list, list, list, list]:
    work_orders, expenses, invoices = await asyncio.gather(
        db.work_orders.find({"cost_case_id": case_id}).to_list(1000),
        db.expenses.find({"cost_case_id": case_id}).to_list(1000),
        db.invoices.find({"cost_case_id": case_id}).to_list(1000),
    )
    inv_ids = [i["id"] for i in invoices]
    payments = (
        await db.payments.find({"invoice_id": {"$in": inv_ids}}).to_list(1000)
        if inv_ids
        else []
    )
    return work_orders, expenses, invoices, payments


def _summary(case: dict, work_orders: list, expenses: list, invoices: list) -> dict:
    posted = [e for e in expenses if e.get("status", "posted") == "posted"]
    drafts = [e for e in expenses if e.get("status", "posted") == "draft"]
    billed = sum(i["amount"] for i in invoices)
    collected = sum(i.get("paid_amount", 0) for i in invoices)
    actual = sum(e["amount"] for e in posted)
    estimated = case.get("approved_budget") or sum(
        w.get("estimate") or 0 for w in work_orders
    )
    return {
        "estimatedCost": estimated,
        "approvedBudget": case.get("approved_budget"),
        "actualCost": actual,  # posted expenses only
        "draftBills": len(drafts),
        "draftBillAmount": sum(e["amount"] for e in drafts),
        "billedToOwners": billed,
        "collectedFromOwners": collected,
        "outstandingFromOwners": billed - collected,
        "reserveFunded": max(0.0, actual - collected),
        "surplusCollected": max(0.0, collected - actual) if actual > 0 else 0.0,
        "awaitingVendorBill": collected > 0 and actual == 0 and not drafts,
    }


@router.get("", dependencies=[FinanceReader])
async def list_cost_cases(db: DB, user: CurrentUser) -> list[dict]:
    """Community-transparent, like expenses — every member sees the cases."""
    cases = await db.cost_cases.find({"community_id": user.community_id}).to_list(1000)
    out = []
    for case in sorted(cases, key=lambda c: c.get("created_date", ""), reverse=True):
        wos, expenses, invoices, _ = await _children(db, case["id"])
        out.append(
            {**CostCase.model_validate(case).model_dump(by_alias=True),
             "summary": _summary(case, wos, expenses, invoices)}
        )
    return out


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Writer])
async def create_cost_case(body: CostCaseCreate, db: DB, user: CurrentUser) -> dict:
    wo = None
    if body.work_order_id:
        wo = await db.work_orders.find_one(
            {"id": body.work_order_id, "community_id": user.community_id}
        )
        if wo is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
        if wo.get("cost_case_id"):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Work order already belongs to a cost case",
            )
    mr_id = body.maintenance_request_id or (wo or {}).get("maintenance_request_id")
    if mr_id:
        mr = await db.maintenance_requests.find_one(
            {"id": mr_id, "community_id": user.community_id}
        )
        if mr is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail="Maintenance request not found"
            )
    case = CostCase(
        community_id=user.community_id,
        title=body.title.strip(),
        description=body.description,
        approved_budget=body.approved_budget,
        funding_method=body.funding_method,
        maintenance_request_id=mr_id,
        created_by=user.id,
        created_date=date.today().isoformat(),
    )
    await db.cost_cases.insert_one(case.model_dump())
    if wo is None:
        # Symmetric automation: a standalone case gets its job record too.
        auto_wo = WorkOrder(
            community_id=user.community_id,
            title=case.title,
            description="Opened automatically with the cost case.",
            estimate=case.approved_budget,
            reported_date=case.created_date,
            assigned_to=user.id,
            maintenance_request_id=mr_id,
            cost_case_id=case.id,
            timeline=[{"stage": "Reported", "date": case.created_date,
                       "note": f"Created with cost case by {user.name}"}],
        )
        await db.work_orders.insert_one(auto_wo.model_dump())
        await record_audit(db, user, "create", "work_orders", auto_wo.id,
                           {"auto": "cost_case_created"})
    if wo:
        # Adopting a work order pulls its existing money links into the case.
        await db.work_orders.update_one(
            {"id": wo["id"]}, {"$set": {"cost_case_id": case.id}}
        )
        await db.expenses.update_many(
            {"work_order_id": wo["id"], "community_id": user.community_id},
            {"$set": {"cost_case_id": case.id}},
        )
        await db.invoices.update_many(
            {"work_order_id": wo["id"], "community_id": user.community_id},
            {"$set": {"cost_case_id": case.id}},
        )
    await record_audit(db, user, "create", "cost_cases", case.id, {"title": case.title})
    wos, expenses, invoices, _ = await _children(db, case.id)
    return {**case.model_dump(by_alias=True), "summary": _summary(case.model_dump(), wos, expenses, invoices)}


@router.get("/{case_id}", dependencies=[FinanceReader])
async def get_cost_case(case_id: str, db: DB, user: CurrentUser) -> dict:
    case = await db.cost_cases.find_one(
        {"id": case_id, "community_id": user.community_id}
    )
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    wos, expenses, invoices, payments = await _children(db, case_id)
    mr = (
        await db.maintenance_requests.find_one({"id": case["maintenance_request_id"]})
        if case.get("maintenance_request_id")
        else None
    )

    # Chronological story: operational + financial events in one line.
    timeline: list[dict] = [
        {"date": case.get("created_date", ""), "kind": "case",
         "label": f"Cost case opened: {case['title']}"}
    ]
    if mr:
        timeline.append({"date": mr["created_date"], "kind": "maintenance",
                         "label": f"Maintenance request: {mr['title']}"})
    for w in wos:
        for ev in w.get("timeline", []):
            timeline.append({"date": ev["date"], "kind": "work_order",
                             "label": f"{w['title']} — {ev['stage']}"
                             + (f" ({ev['note']})" if ev.get("note") else "")})
    # Who did what — from the audit trail (create/post events per expense).
    audit = await db.audit_log.find(
        {"entity": "expenses", "entity_id": {"$in": [e["id"] for e in expenses]}}
    ).to_list(1000)
    actor: dict[str, str] = {}
    for a in sorted(audit, key=lambda a: a["timestamp"]):
        if a["action"] == "create" or a.get("details", {}).get("status") == "posted":
            actor[a["entity_id"]] = a.get("user_name", "")
    for e in expenses:
        state = e.get("status", "posted")
        who = actor.get(e["id"])
        timeline.append({"date": e["paid_date"], "kind": "expense",
                         "label": f"{'Vendor bill (draft)' if state == 'draft' else 'Expense posted'}: "
                         f"{e['description']} — Rs {e['amount']:,.0f}"
                         + (f" (by {who})" if who else "")})
    for p in payments:
        if p.get("status", "confirmed") == "confirmed":
            timeline.append({"date": p["date"], "kind": "payment",
                             "label": f"Owner payment Rs {p['amount']:,.0f} ({p['method']})"})
    timeline.sort(key=lambda t: t["date"])

    credits, credits_applied = await _apartment_credits(db, case_id, expenses, invoices)

    def dump(model: Any, docs: list) -> list:
        return [model.model_validate(d).model_dump(by_alias=True) for d in docs]

    return {
        **CostCase.model_validate(case).model_dump(by_alias=True),
        "summary": _summary(case, wos, expenses, invoices),
        "maintenanceRequest": (
            MaintenanceRequest.model_validate(mr).model_dump(by_alias=True) if mr else None
        ),
        "workOrders": dump(WorkOrder, wos),
        "expenses": dump(Expense, expenses),
        "invoices": dump(Invoice, invoices),
        "payments": dump(Payment, payments),
        "timeline": timeline,
        "credits": credits,
        "creditsApplied": credits_applied,
    }


def _shift_months(iso: str, months: int) -> str:
    """ISO date shifted forward by N months, clamped to month length."""
    d = date.fromisoformat(iso)
    total = d.month - 1 + months
    year, month = d.year + total // 12, total % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1])).isoformat()


def _split_amount(total: float, parts: int) -> list[float]:
    """Whole-rupee installments; the last one absorbs the remainder."""
    base = int(total // parts)
    amounts = [float(base)] * parts
    amounts[-1] = float(total - base * (parts - 1))
    return amounts


@router.post("/{case_id}/assessments", status_code=status.HTTP_201_CREATED, dependencies=[Writer])
async def generate_assessments(
    case_id: str, body: AssessmentRequest, db: DB, user: CurrentUser
) -> dict:
    """Create owner assessment invoices for this case from explicit
    per-apartment allocations. Idempotent: apartments that already hold an
    invoice for this case+period are skipped, so re-submitting is safe."""
    from app.notification_service import enqueue_for_apartment_owners
    from app.routers.invoices import compute_status, with_apartment

    case = await db.cost_cases.find_one(
        {"id": case_id, "community_id": user.community_id}
    )
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    if case.get("status") == "closed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Cost case is closed")
    allocations = [a for a in body.allocations if a.amount > 0]
    if not allocations:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="At least one allocation required"
        )
    apt_ids = [a.apartment_id for a in allocations]
    if len(set(apt_ids)) != len(apt_ids):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Duplicate apartment in allocations"
        )
    found = await db.apartments.count_documents(
        {"id": {"$in": apt_ids}, "community_id": user.community_id}
    )
    if found != len(apt_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown apartment in allocations")

    description = body.description.strip() or case["title"]
    wos = await db.work_orders.find({"cost_case_id": case_id}).to_list(10)
    wo_id = wos[0]["id"] if wos else None
    created, skipped, new_apts = 0, 0, []
    for alloc in allocations:
        n = max(1, min(24, int(alloc.installments)))
        parts = _split_amount(alloc.amount, n)
        made_any = False
        for i, part in enumerate(parts):
            # Installments carry distinct periods ("Jul 2026 - 2/3") so the
            # apartment+case+period idempotency key still holds.
            period = body.period if n == 1 else f"{body.period} - {i + 1}/{n}"
            exists = await db.invoices.find_one(
                {"community_id": user.community_id, "apartment_id": alloc.apartment_id,
                 "cost_case_id": case_id, "period": period}
            )
            if exists:
                skipped += 1
                continue
            due = _shift_months(body.due_date, i)
            invoice = Invoice(
                community_id=user.community_id,
                apartment_id=alloc.apartment_id,
                period=period,
                description=with_apartment(description, alloc.apartment_id),
                amount=part,
                due_date=due,
                status=compute_status(part, 0, due),
                work_order_id=wo_id,
                cost_case_id=case_id,
            )
            await db.invoices.insert_one(invoice.model_dump())
            created += 1
            made_any = True
        if made_any:
            new_apts.append((alloc.apartment_id, alloc.amount))
    await record_audit(
        db, user, "create", "invoices", f"assessment:{case_id}:{body.period}",
        {"created": created, "skipped": skipped,
         "total": sum(a.amount for a in allocations)},
    )
    await asyncio.gather(*(
        enqueue_for_apartment_owners(
            db,
            community_id=user.community_id,
            apartment_id=apt_id,
            event_type="invoice_created",
            title="New Assessment",
            message=f"Sent by {user.display_name}. {description} — {body.period}: Rs {amount:,.0f} due {body.due_date}. View details: https://community.rajmanda.com/invoices",
            payload={"period": body.period, "amount": amount, "cost_case_id": case_id},
            exclude_user_id=user.id,
            actor_user=user,
        )
        for apt_id, amount in new_apts
    ))
    return {"created": created, "skipped": skipped}


async def _apartment_credits(
    db: Any, case_id: str, expenses: list, invoices: list
) -> tuple[dict[str, float], dict[str, float]]:
    """(remaining credit, already applied) per apartment: paid beyond the
    proportional share of actual posted cost, minus Credit payments that
    settled this case."""
    credits: dict[str, float] = {}
    applied: dict[str, float] = {}
    actual = sum(e["amount"] for e in expenses if e.get("status", "posted") == "posted")
    if actual <= 0 or not invoices:
        return credits, applied
    settles = await db.payments.find({"settles_cost_case_id": case_id}).to_list(1000)
    for pmt in settles:
        applied[pmt["apartment_id"]] = applied.get(pmt["apartment_id"], 0) + pmt["amount"]
    weight = lambda i: i.get("original_amount") or i["amount"]  # noqa: E731
    total_w = sum(weight(i) for i in invoices) or 1
    by_apt: dict[str, list[dict]] = {}
    for i in invoices:
        by_apt.setdefault(i["apartment_id"], []).append(i)
    for apt, rows in by_apt.items():
        target = round(actual * sum(weight(i) for i in rows) / total_w)
        paid = sum(i.get("paid_amount", 0) for i in rows)
        remaining = paid - target - applied.get(apt, 0)
        if remaining > 0:
            credits[apt] = remaining
    return credits, applied


@router.post("/{case_id}/apply-credit", dependencies=[Writer])
async def apply_credit(
    case_id: str, body: dict, db: DB, user: CurrentUser
) -> dict:
    """Settle an apartment's over-collection: records a Credit payment on
    their oldest open invoice OUTSIDE this case, linked back so the case
    badge flips to applied. Repeatable until the credit is exhausted."""
    from app.routers.invoices import compute_status as _cs  # noqa: F401
    from app.models import Payment

    apartment_id = body.get("apartmentId") or body.get("apartment_id")
    if not apartment_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="apartmentId required")
    case = await db.cost_cases.find_one(
        {"id": case_id, "community_id": user.community_id}
    )
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    _, expenses, invoices, _ = await _children(db, case_id)
    credits, _applied = await _apartment_credits(db, case_id, expenses, invoices)
    remaining = credits.get(apartment_id, 0)
    if remaining <= 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No unapplied credit for this apartment"
        )
    case_inv_ids = {i["id"] for i in invoices}
    open_invs = await db.invoices.find(
        {"community_id": user.community_id, "apartment_id": apartment_id,
         "ledger": {"$in": [None, "community"]}}
    ).to_list(1000)
    open_invs = sorted(
        (i for i in open_invs
         if i["id"] not in case_inv_ids and i["amount"] - i.get("paid_amount", 0) > 0),
        key=lambda i: i["due_date"],
    )
    if not open_invs:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="No open invoice to apply the credit to — generate their next invoice first",
        )
    target_inv = open_invs[0]
    amount = min(remaining, target_inv["amount"] - target_inv.get("paid_amount", 0))
    payment = Payment(
        community_id=user.community_id,
        invoice_id=target_inv["id"],
        apartment_id=apartment_id,
        amount=amount,
        date=date.today().isoformat(),
        method="Credit",
        reference=f"Credit — {case['title']}",
        ledger=target_inv.get("ledger", "community"),
        settles_cost_case_id=case_id,
    )
    await db.payments.insert_one(payment.model_dump())
    from app.routers.invoices import _recompute
    await _recompute(db, target_inv)
    await record_audit(
        db, user, "create", "payments", payment.id,
        {"credit_from_case": case_id, "apartment_id": apartment_id,
         "amount": amount, "applied_to": target_inv["id"]},
    )
    from app.notification_service import enqueue_for_apartment_owners
    await enqueue_for_apartment_owners(
        db, community_id=user.community_id, apartment_id=apartment_id,
        event_type="credit_applied",
        title="Credit Applied",
        message=(f"Applied by {user.display_name}. Rs {amount:,.0f} from "
                 f"'{case['title']}' has been credited to your "
                 f"{target_inv.get('period', '')} invoice. View: https://community.rajmanda.com/invoices"),
        payload={"cost_case_id": case_id, "amount": amount,
                 "invoice_id": target_inv["id"]},
        exclude_user_id=user.id, actor_user=user,
    )
    return {"applied": amount, "toInvoice": target_inv["id"],
            "remainingCredit": remaining - amount}


@router.post("/{case_id}/adjust-assessments", dependencies=[Writer])
async def adjust_assessments_to_actual(
    case_id: str, db: DB, user: CurrentUser
) -> dict:
    """One tap after the vendor bill posts: every apartment's assessed total
    is recalculated to its proportional share of the ACTUAL posted cost.
    Paid money is never touched — an invoice can't drop below what was
    already received (the excess surfaces as per-apartment surplus for a
    credit/refund). Unpaid zero-remainder invoices are removed. Idempotent.
    """
    case = await db.cost_cases.find_one(
        {"id": case_id, "community_id": user.community_id}
    )
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    if case.get("status") == "closed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Cost case is closed")
    return await perform_adjustment(db, user, case)


async def perform_adjustment(db: Any, user: Any, case: dict) -> dict:
    """Core adjust-to-actual (shared with work-order completion)."""
    from app.routers.invoices import compute_status

    case_id = case["id"]
    _, expenses, invoices, _ = await _children(db, case_id)
    actual = sum(
        e["amount"] for e in expenses if e.get("status", "posted") == "posted"
    )
    if actual <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No posted expense yet — post the vendor bill first",
        )
    total_billed = sum(i["amount"] for i in invoices)
    if not invoices or sum(i.get("original_amount") or i["amount"] for i in invoices) <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No assessments to adjust")

    by_apt: dict[str, list[dict]] = {}
    for inv in invoices:
        by_apt.setdefault(inv["apartment_id"], []).append(inv)

    # Proportions come from the ORIGINAL allocation weights (falling back
    # to current amounts on first run) so repeated adjustments are stable.
    def weight(inv: dict) -> float:
        return inv.get("original_amount") or inv["amount"]

    total_weight = sum(weight(i) for i in invoices)
    targets: dict[str, float] = {}
    apts = sorted(by_apt)
    for apt in apts:
        apt_weight = sum(weight(i) for i in by_apt[apt])
        targets[apt] = round(actual * apt_weight / total_weight)
    drift = round(actual) - sum(targets.values())
    if apts:
        targets[apts[0]] += drift

    adjusted, deleted, surplus_by_apt = 0, 0, {}
    old_totals = {apt: sum(i["amount"] for i in by_apt[apt]) for apt in apts}
    new_totals: dict[str, float] = {}
    for apt in apts:
        remaining = targets[apt]
        rows = sorted(by_apt[apt], key=lambda i: i["due_date"])
        for inv in rows:
            paid = inv.get("paid_amount", 0)
            new_amount = max(paid, min(inv["amount"], remaining))
            if inv is rows[-1] and remaining > new_amount and paid <= new_amount:
                new_amount = max(paid, remaining)  # actual > billed: last row grows
            remaining -= new_amount
            new_totals[apt] = new_totals.get(apt, 0) + new_amount
            if new_amount == 0 and paid == 0:
                await db.invoices.delete_one({"id": inv["id"]})
                deleted += 1
                continue
            if new_amount != inv["amount"]:
                await db.invoices.update_one(
                    {"id": inv["id"]},
                    {"$set": {"amount": new_amount,
                              "original_amount": weight(inv),
                              "status": compute_status(new_amount, paid, inv["due_date"])}},
                )
                adjusted += 1
        apt_paid = sum(i.get("paid_amount", 0) for i in rows)
        if apt_paid > targets[apt]:
            surplus_by_apt[apt] = apt_paid - targets[apt]

    await record_audit(
        db, user, "update", "invoices", f"adjust-to-actual:{case_id}",
        {"actual": actual, "previous_billed": total_billed,
         "adjusted": adjusted, "deleted": deleted, "surplus": surplus_by_apt},
    )
    # Owners hear about their change — nobody discovers a reopened invoice
    # by surprise.
    from app.notification_service import enqueue_for_apartment_owners

    async def _notify(apt: str, delta: float) -> None:
        if delta > 0:
            msg = (f"Update from {user.display_name}. The final cost for "
                   f"'{case['title']}' came in higher — your share increased by "
                   f"Rs {delta:,.0f} and is now due. View: https://community.rajmanda.com/invoices")
        else:
            msg = (f"Good news from {user.display_name}. The final cost for "
                   f"'{case['title']}' came in lower — your share reduced by "
                   f"Rs {-delta:,.0f}. View: https://community.rajmanda.com/invoices")
        await enqueue_for_apartment_owners(
            db, community_id=user.community_id, apartment_id=apt,
            event_type="invoice_adjusted",
            title="Invoice Adjusted",
            message=msg,
            payload={"cost_case_id": case_id, "delta": delta},
            exclude_user_id=user.id, actor_user=user,
        )

    deltas = {apt: new_totals.get(apt, 0) - old_totals.get(apt, 0) for apt in apts}
    await asyncio.gather(*(
        _notify(apt, d) for apt, d in deltas.items() if d != 0
    ))
    return {"adjusted": adjusted, "deleted": deleted, "actual": actual,
            "surplusByApartment": surplus_by_apt}


@router.post("/{case_id}/close", dependencies=[Writer])
async def close_cost_case(
    case_id: str, body: CostCaseClose, db: DB, user: CurrentUser
) -> dict:
    case = await db.cost_cases.find_one(
        {"id": case_id, "community_id": user.community_id}
    )
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    wos, expenses, invoices, _ = await _children(db, case_id)
    summary = _summary(case, wos, expenses, invoices)
    blockers = []
    if summary["draftBills"] > 0:
        blockers.append(f"{summary['draftBills']} vendor bill(s) still in draft — post or void them")
    if summary["awaitingVendorBill"]:
        blockers.append("money was collected but no vendor expense is posted")
    if summary["outstandingFromOwners"] > 0:
        blockers.append(f"Rs {summary['outstandingFromOwners']:,.0f} still outstanding from owners")
    if blockers and not body.force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot close: " + "; ".join(blockers),
        )
    await db.cost_cases.update_one(
        {"id": case_id},
        {"$set": {"status": "closed", "closed_date": date.today().isoformat(),
                  "close_note": body.note}},
    )
    await record_audit(
        db, user, "update", "cost_cases", case_id,
        {"status": "closed", "forced": bool(blockers and body.force),
         "note": body.note, "blockers_overridden": blockers if body.force else []},
    )
    return {"closed": True, "forced": bool(blockers and body.force)}


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer])
async def delete_cost_case(case_id: str, db: DB, user: CurrentUser) -> None:
    """Only empty cases delete — anything holding money (expenses or
    invoices) must be closed instead, preserving the ledger. Linked work
    orders without money of their own are removed with it (cascade)."""
    case = await db.cost_cases.find_one(
        {"id": case_id, "community_id": user.community_id}
    )
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    wos, expenses, invoices, _ = await _children(db, case_id)
    if expenses or invoices:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cost case holds expenses/invoices — close it instead of deleting",
        )
    for w in wos:
        await db.work_orders.delete_one({"id": w["id"]})
        await record_audit(db, user, "delete", "work_orders", w["id"],
                           {"cascade_from_cost_case": case_id})
    await db.cost_cases.delete_one({"id": case_id})
    await record_audit(db, user, "delete", "cost_cases", case_id)


@router.post("/{case_id}/reopen", dependencies=[Writer])
async def reopen_cost_case(case_id: str, db: DB, user: CurrentUser) -> dict:
    result = await db.cost_cases.update_one(
        {"id": case_id, "community_id": user.community_id, "status": "closed"},
        {"$set": {"status": "open", "closed_date": None}},
    )
    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No closed cost case")
    await record_audit(db, user, "update", "cost_cases", case_id, {"status": "open"})
    return {"reopened": True}
