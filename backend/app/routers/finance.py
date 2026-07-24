"""Read endpoints for the financial module (Phase 1: read-only).

Scoping rules:
- owners/tenants see invoices and payments for their own apartment only;
- managers, community admins and auditors see everything in their community;
- expenses, reserve fund, monthly finance and the community summary are
  visible to every member (PRD transparency requirement).
"""

import asyncio
import calendar
import re
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    CommunitySummary,
    Expense,
    ExpenseCreate,
    ExpenseUpdate,
    Invoice,
    MonthlyFinance,
    Payment,
    ReserveEntryCreate,
    ReserveFundEntry,
    User,
)
from app import storage
from app.notification_service import app_url, enqueue_for_community_group

router = APIRouter(tags=["finance"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

MEMBER_SCOPED_ROLES = ("owner", "tenant")


def _posted(e: dict) -> bool:
    """Draft expenses are vendor bills under review — they never count."""
    return e.get("status", "posted") == "posted"


def _apartment_scope(user: User) -> dict:
    query: dict = {"community_id": user.community_id}
    if user.role in MEMBER_SCOPED_ROLES and user.apartment_ids:
        query["apartment_id"] = {"$in": user.apartment_ids}
    elif user.role in MEMBER_SCOPED_ROLES and user.apartment_id:
        query["apartment_id"] = user.apartment_id
    return query


@router.get("/invoices", response_model=list[Invoice])
async def list_invoices(db: DB, user: CurrentUser) -> list[Invoice]:
    docs = await db.invoices.find(_apartment_scope(user)).to_list(length=10000)
    return [Invoice.model_validate(d) for d in docs]


@router.get("/payments", response_model=list[Payment])
async def list_payments(db: DB, user: CurrentUser) -> list[Payment]:
    docs = await db.payments.find(_apartment_scope(user)).to_list(length=10000)
    return [Payment.model_validate(d) for d in docs]


@router.get("/expenses", response_model=list[Expense])
async def list_expenses(db: DB, user: CurrentUser) -> list[Expense]:
    docs = await db.expenses.find({"community_id": user.community_id}).to_list(
        length=10000
    )
    return [Expense.model_validate(d) for d in docs]


_MONTH_NUMBERS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}


def _anchor_cutoff(month_str: str) -> str | None:
    """ISO date of the last day of an anchor month. Accepts 'YYYY-MM',
    'Jun' and 'Jun 2026'; bare months are assumed to be the most recent
    occurrence of that month (entries are never in the future)."""
    s = month_str.strip()
    year = month = None
    if len(s) == 7 and s[:4].isdigit() and s[4] == "-" and s[5:].isdigit():
        year, month = int(s[:4]), int(s[5:])
    else:
        parts = s.split()
        month = _MONTH_NUMBERS.get(parts[0][:3].title()) if parts else None
        if month:
            if len(parts) > 1 and parts[1].isdigit():
                year = int(parts[1])
            else:
                today = date.today()
                year = today.year if month <= today.month else today.year - 1
    if not (year and month):
        return None
    last = calendar.monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-{last:02d}"


async def live_reserve(db: Any, community_id: str) -> tuple[float, list[dict]]:
    """The community reserve, computed live: the last manually-recorded entry
    is the anchor, plus every confirmed community-ledger payment and minus
    every expense dated after it. Also returns derived per-month rows for
    post-anchor months that saw activity (for the history view)."""
    entries = await db.reserve_fund.find({"community_id": community_id}).to_list(1000)
    base, cutoff = 0.0, None
    if entries:
        base = entries[-1]["balance"]
        cutoff = _anchor_cutoff(entries[-1]["month"])
        if cutoff is None:
            # Unparseable anchor month — fall back to the stored balance
            # rather than silently double-counting history.
            return base, []
    payments, expenses = await asyncio.gather(
        db.payments.find({"community_id": community_id}).to_list(10000),
        db.expenses.find({"community_id": community_id}).to_list(10000),
    )
    by_month: dict[str, list[float]] = {}
    for p in payments:
        if (
            p.get("status", "confirmed") == "confirmed"
            and p.get("ledger", "community") == "community"
            and (cutoff is None or p["date"] > cutoff)
        ):
            by_month.setdefault(p["date"][:7], [0.0, 0.0])[0] += p["amount"]
    for e in expenses:
        if _posted(e) and (cutoff is None or e["paid_date"] > cutoff):
            by_month.setdefault(e["paid_date"][:7], [0.0, 0.0])[1] += e["amount"]
    balance = base
    derived: list[dict] = []
    for ym in sorted(by_month):
        inflow, outflow = by_month[ym]
        balance += inflow - outflow
        # Label like the manual entries ("Jul") so the page reads uniformly.
        label = date(int(ym[:4]), int(ym[5:7]), 1).strftime("%b")
        derived.append({
            "month": label,
            "contributions": inflow,
            "expenses": outflow,
            "balance": balance,
        })
    return balance, derived


@router.get("/reserve-fund", response_model=list[ReserveFundEntry])
async def reserve_fund(db: DB, user: CurrentUser) -> list[ReserveFundEntry]:
    docs = await db.reserve_fund.find({"community_id": user.community_id}).to_list(
        length=1000
    )
    _, derived = await live_reserve(db, user.community_id)
    return [ReserveFundEntry.model_validate(d) for d in [*docs, *derived]]


@router.get("/reserve-fund/reconciliation")
async def reserve_reconciliation(db: DB, user: CurrentUser) -> dict:
    """Sanity check on the latest reserve anchor: compares money actually
    recorded for the anchor month (confirmed community payments, expenses)
    against the closing entry's figures. `unanchored*` > 0 means activity
    was booked into an already-closed month — it is invisible to the live
    reserve until the anchor entry is amended (this is exactly how the June
    bore well collections went missing)."""
    cid = user.community_id
    entries = await db.reserve_fund.find({"community_id": cid}).to_list(1000)
    if not entries:
        return {"anchorMonth": None, "anchorCutoff": None}
    anchor = entries[-1]
    cutoff = _anchor_cutoff(anchor["month"])
    if cutoff is None:
        return {"anchorMonth": anchor["month"], "anchorCutoff": None}
    prefix = cutoff[:7]
    payments, expenses = await asyncio.gather(
        db.payments.find({"community_id": cid}).to_list(10000),
        db.expenses.find({"community_id": cid}).to_list(10000),
    )
    recorded_contributions = sum(
        p["amount"] for p in payments
        if p["date"].startswith(prefix)
        and p.get("status", "confirmed") == "confirmed"
        and p.get("ledger", "community") == "community"
    )
    recorded_expenses = sum(
        e["amount"] for e in expenses
        if _posted(e) and e["paid_date"].startswith(prefix)
    )
    invoices = await db.invoices.find({"community_id": cid}).to_list(10000)
    # Negative gaps are fine (the anchor can include offline history that
    # never became payment/expense records) — only excess is a problem.
    return {
        "anchorMonth": anchor["month"],
        "anchorCutoff": cutoff,
        "anchoredContributions": anchor["contributions"],
        "anchoredExpenses": anchor["expenses"],
        "recordedContributions": recorded_contributions,
        "recordedExpenses": recorded_expenses,
        "unanchoredContributions": max(0, recorded_contributions - anchor["contributions"]),
        "unanchoredExpenses": max(0, recorded_expenses - anchor["expenses"]),
        "collectionsWithoutExpense": _drives_without_expense(invoices, expenses),
    }


# Generic words that don't identify a job ("Bore well repair work" should
# match an expense named "Bore well motor", not every "repair").
_DRIVE_STOPWORDS = {"work", "works", "repair", "repairs", "charge", "charges",
                    "amount", "monthly", "cost", "costs", "bill", "bills"}


def _drive_tokens(description: str) -> set[str]:
    base = re.sub(r"\s*-\s*Apt\s+\S+\s*$", "", description, flags=re.I)
    return {
        w for w in re.findall(r"[a-z]+", base.lower())
        if len(w) >= 4 and w not in _DRIVE_STOPWORDS
    }


def _drives_without_expense(invoices: list[dict], expenses: list[dict]) -> list[dict]:
    """Special community collection drives (not maintenance/late fees) where
    owners have PAID but no expense was ever recorded for the job — money
    came in for work that isn't in the books (the bore well failure mode).
    Matching is by work-order link when present, else by description words."""
    expense_tokens = [
        (_drive_tokens(e["description"]), e.get("work_order_id"), e.get("cost_case_id"))
        for e in expenses if _posted(e)
    ]
    drives: dict[tuple, dict] = {}
    for inv in invoices:
        if inv.get("ledger", "community") != "community":
            continue
        if inv.get("parent_invoice_id"):  # late fees
            continue
        desc = re.sub(r"\s*-\s*Apt\s+\S+\s*$", "", inv["description"], flags=re.I).strip()
        if "maintenance" in desc.lower() or "late fee" in desc.lower():
            continue
        key = (desc.lower(), inv.get("period"))
        d = drives.setdefault(
            key,
            {"description": desc, "period": inv.get("period"),
             "workOrderId": inv.get("work_order_id"),
             "costCaseId": inv.get("cost_case_id"),
             "billed": 0.0, "collected": 0.0},
        )
        d["billed"] += inv["amount"]
        d["collected"] += inv.get("paid_amount", 0)
        d["workOrderId"] = d["workOrderId"] or inv.get("work_order_id")
        d["costCaseId"] = d["costCaseId"] or inv.get("cost_case_id")
    flagged = []
    for d in drives.values():
        if d["collected"] <= 0:
            continue
        if d["costCaseId"]:
            matched = any(cc == d["costCaseId"] for _, _, cc in expense_tokens)
        elif d["workOrderId"]:
            matched = any(wo == d["workOrderId"] for _, wo, _ in expense_tokens)
        else:
            tokens = _drive_tokens(d["description"])
            # Two shared identifying words (one suffices for one-word jobs) —
            # "Water tank cleaning" must not match a mere "Water tanker".
            need = 1 if len(tokens) == 1 else 2
            matched = bool(tokens) and any(
                len(tokens & etok) >= need for etok, _, _ in expense_tokens
            )
        if not matched:
            flagged.append(d)
    return sorted(flagged, key=lambda d: d["collected"], reverse=True)


def _last_month_prefixes(count: int = 6) -> list[str]:
    """YYYY-MM prefixes for the last `count` months, oldest first."""
    today = date.today()
    year, month = today.year, today.month
    prefixes: list[str] = []
    for _ in range(count):
        prefixes.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(prefixes))


MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/finance/monthly", response_model=list[MonthlyFinance])
async def monthly_finance(db: DB, user: CurrentUser) -> list[MonthlyFinance]:
    """Computed from real payments/expenses/invoices, last 6 months.
    Collection rate = paid/billed for invoices due in that month."""
    cid = user.community_id
    payments, expenses, invoices = await asyncio.gather(
        db.payments.find({"community_id": cid}).to_list(10000),
        db.expenses.find({"community_id": cid}).to_list(10000),
        db.invoices.find({"community_id": cid}).to_list(10000),
    )
    out = []
    for prefix in _last_month_prefixes():
        income = sum(
            p["amount"] for p in payments
            if p["date"].startswith(prefix)
            and p.get("status", "confirmed") == "confirmed"
            and p.get("ledger", "community") == "community"
        )
        spent = sum(
            e["amount"] for e in expenses
            if _posted(e) and e["paid_date"].startswith(prefix)
        )
        billed = sum(
            i["amount"] for i in invoices
            if i["due_date"].startswith(prefix)
            and i.get("ledger", "community") == "community"
        )
        paid = sum(
            i["paid_amount"] for i in invoices
            if i["due_date"].startswith(prefix)
            and i.get("ledger", "community") == "community"
        )
        rate = round(100 * paid / billed) if billed else 0
        out.append(MonthlyFinance(
            month=MONTH_LABELS[int(prefix[5:7]) - 1],
            income=income,
            expenses=spent,
            collection_rate=rate,
        ))
    return out


@router.get("/finance/summary", response_model=CommunitySummary)
async def community_summary(db: DB, user: CurrentUser) -> CommunitySummary:
    """Computed from real data — current calendar month."""
    cid = user.community_id
    prefix = date.today().isoformat()[:7]
    payments, expenses, invoices, (reserve_balance, _) = await asyncio.gather(
        db.payments.find({"community_id": cid}).to_list(10000),
        db.expenses.find({"community_id": cid}).to_list(10000),
        db.invoices.find({"community_id": cid}).to_list(length=10000),
        live_reserve(db, cid),
    )
    return CommunitySummary(
        month_income=sum(
            p["amount"] for p in payments
            if p["date"].startswith(prefix)
            and p.get("status", "confirmed") == "confirmed"
            and p.get("ledger", "community") == "community"
        ),
        month_expenses=sum(
            e["amount"] for e in expenses
            if _posted(e) and e["paid_date"].startswith(prefix)
        ),
        outstanding_dues=sum(
            i["amount"] - i["paid_amount"] for i in invoices
            if i.get("ledger", "community") == "community"
        ),
        reserve_fund_balance=reserve_balance,
    )


# ---------- M2 write operations ----------


@router.post(
    "/expenses",
    response_model=Expense,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_expense(body: ExpenseCreate, db: DB, user: CurrentUser) -> Expense:
    wo = None
    if body.work_order_id:
        wo = await db.work_orders.find_one(
            {"id": body.work_order_id, "community_id": user.community_id}
        )
        if wo is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    if body.cost_case_id:
        cc = await db.cost_cases.find_one(
            {"id": body.cost_case_id, "community_id": user.community_id}
        )
        if cc is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    data = body.model_dump()
    # An expense against a work order inherits its cost case automatically.
    if wo and not data.get("cost_case_id"):
        data["cost_case_id"] = wo.get("cost_case_id")
    expense = Expense(community_id=user.community_id, **data)
    await db.expenses.insert_one(expense.model_dump())
    await record_audit(db, user, "create", "expenses", expense.id)
    # Enqueue WhatsApp notification for the community group.
    await enqueue_for_community_group(
        db,
        community_id=user.community_id,
        event_type="common_expense_created",
        title="New Community Expense",
        message=f"💰 Expense recorded by {user.display_name}. {body.category}: {body.description} — Rs {body.amount:,.0f}. View details: {app_url()}/expenses",
        payload={"expense_id": expense.id, "amount": body.amount, "category": body.category},
        related_type="expense",
        related_id=expense.id,
        actor_user=user,
    )
    return expense


@router.post("/expenses/{expense_id}/post", response_model=Expense, dependencies=[Writer])
async def post_expense(expense_id: str, db: DB, user: CurrentUser) -> Expense:
    """Vendor bill approved after financial review — from here on it counts
    in the reserve and every community total. Idempotent."""
    expense = await db.expenses.find_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.get("status", "posted") == "posted":
        return Expense.model_validate(expense)
    result = await db.expenses.find_one_and_update(
        {"id": expense_id}, {"$set": {"status": "posted"}}, return_document=True
    )
    await record_audit(
        db, user, "update", "expenses", expense_id,
        {"status": "posted", "amount": expense["amount"]},
    )
    return Expense.model_validate(result)


@router.patch("/expenses/{expense_id}", response_model=Expense, dependencies=[Writer])
async def update_expense(
    expense_id: str, body: ExpenseUpdate, db: DB, user: CurrentUser
) -> Expense:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    existing = await db.expenses.find_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if existing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    # Posted money is ledger truth: financial-field edits become a
    # system-generated CORRECTION — reversal entry + corrected replacement —
    # so the ledger history stays intact while the fix is one step.
    if existing.get("status", "posted") == "posted":
        frozen = {"amount", "paid_date", "category"} & set(updates)
        if frozen:
            if existing.get("reversed_by") or existing.get("reversal_of"):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="This entry is part of a reversal pair and can't be corrected",
                )
            reversal = await _create_reversal(db, user, existing)
            corrected = Expense(
                community_id=user.community_id,
                category=updates.get("category", existing["category"]),
                description=updates.get("description", existing["description"]),
                vendor_id=updates.get("vendor_id", existing.get("vendor_id")),
                amount=updates.get("amount", existing["amount"]),
                paid_date=updates.get("paid_date", existing["paid_date"]),
                has_receipt=existing.get("has_receipt", False),
                receipt_path=existing.get("receipt_path"),
                work_order_id=existing.get("work_order_id"),
                cost_case_id=existing.get("cost_case_id"),
                status="posted",
            )
            await db.expenses.insert_one(corrected.model_dump())
            await record_audit(
                db, user, "create", "expenses", corrected.id,
                {"correction_of": expense_id, "via_reversal": reversal.id, **updates},
            )
            return corrected
    result = await db.expenses.find_one_and_update(
        {"id": expense_id},
        {"$set": updates},
        return_document=True,
    )
    await record_audit(db, user, "update", "expenses", expense_id, updates)
    return Expense.model_validate(result)


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Writer],
)
async def delete_expense(expense_id: str, db: DB, user: CurrentUser) -> None:
    existing = await db.expenses.find_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if existing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if existing.get("status", "posted") == "posted":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Posted expenses can't be deleted — record a reversal instead",
        )
    await db.expenses.delete_one({"id": expense_id})
    await record_audit(db, user, "delete", "expenses", expense_id)


@router.post(
    "/expenses/{expense_id}/reverse",
    response_model=Expense,
    dependencies=[Writer],
)
async def reverse_expense(expense_id: str, db: DB, user: CurrentUser) -> Expense:
    """Ledger-safe correction: a posted expense is offset by a negative
    reversal entry (links preserved) instead of being edited or deleted.
    The pair nets to zero everywhere; re-enter the correct expense after."""
    original = await db.expenses.find_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if original is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if original.get("status", "posted") != "posted":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Draft bills are deleted, not reversed"
        )
    if original.get("reversed_by"):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Expense is already reversed"
        )
    if original.get("reversal_of"):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Reversal entries can't be reversed"
        )
    reversal = await _create_reversal(db, user, original)
    return reversal


async def _create_reversal(db: Any, user: User, original: dict) -> Expense:
    reversal = Expense(
        community_id=user.community_id,
        category=original["category"],
        description=f"Reversal: {original['description']}",
        vendor_id=original.get("vendor_id"),
        amount=-original["amount"],
        paid_date=date.today().isoformat(),
        work_order_id=original.get("work_order_id"),
        cost_case_id=original.get("cost_case_id"),
        status="posted",
        reversal_of=original["id"],
    )
    await db.expenses.insert_one(reversal.model_dump())
    await db.expenses.update_one(
        {"id": original["id"]}, {"$set": {"reversed_by": reversal.id}}
    )
    await record_audit(
        db, user, "create", "expenses", reversal.id,
        {"reversal_of": original["id"], "amount": reversal.amount},
    )
    return Expense.model_validate(reversal)


@router.post(
    "/expenses/{expense_id}/receipt",
    response_model=Expense,
    dependencies=[Writer],
)
async def upload_receipt(
    expense_id: str, file: UploadFile, db: DB, user: CurrentUser
) -> Expense:
    expense = await db.expenses.find_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    data = await file.read()
    storage.validate_upload(file.content_type, len(data))
    path = f"{user.community_id}/receipts/{expense_id}/{file.filename or 'receipt'}"
    storage.upload_object(path, data, file.content_type or "application/octet-stream")
    result = await db.expenses.find_one_and_update(
        {"id": expense_id},
        {"$set": {"has_receipt": True, "receipt_path": path}},
        return_document=True,
    )
    await record_audit(db, user, "update", "expenses", expense_id, {"receipt": path})
    return Expense.model_validate(result)


@router.get("/expenses/{expense_id}/receipt")
async def download_receipt(expense_id: str, db: DB, user: CurrentUser) -> Response:
    # Receipts are community-transparent, like the expenses themselves.
    expense = await db.expenses.find_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if expense is None or not expense.get("receipt_path"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No receipt")
    data, content_type = storage.download_object(expense["receipt_path"])
    return Response(content=data, media_type=content_type)


@router.post(
    "/reserve-fund",
    response_model=ReserveFundEntry,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def add_reserve_entry(
    body: ReserveEntryCreate, db: DB, user: CurrentUser
) -> ReserveFundEntry:
    existing = await db.reserve_fund.find_one(
        {"community_id": user.community_id, "month": body.month}
    )
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"Entry for {body.month} already exists"
        )
    # New manual entries anchor on the LIVE balance so a reconciliation
    # entry absorbs the activity recorded since the previous anchor.
    prev_balance, _ = await live_reserve(db, user.community_id)
    entry = ReserveFundEntry(
        month=body.month,
        contributions=body.contributions,
        expenses=body.expenses,
        balance=prev_balance + body.contributions - body.expenses,
    )
    await db.reserve_fund.insert_one(
        {**entry.model_dump(), "community_id": user.community_id}
    )
    await record_audit(db, user, "create", "reserve_fund", body.month)
    return entry
