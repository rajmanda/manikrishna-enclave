"""Read endpoints for the financial module (Phase 1: read-only).

Scoping rules:
- owners/tenants see invoices and payments for their own apartment only;
- managers, community admins and auditors see everything in their community;
- expenses, reserve fund, monthly finance and the community summary are
  visible to every member (PRD transparency requirement).
"""

import asyncio
import calendar
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
from app.notification_service import enqueue_for_community_members

router = APIRouter(tags=["finance"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

MEMBER_SCOPED_ROLES = ("owner", "tenant")


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
        if cutoff is None or e["paid_date"] > cutoff:
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
        spent = sum(e["amount"] for e in expenses if e["paid_date"].startswith(prefix))
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
            e["amount"] for e in expenses if e["paid_date"].startswith(prefix)
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
    expense = Expense(community_id=user.community_id, **body.model_dump())
    await db.expenses.insert_one(expense.model_dump())
    await record_audit(db, user, "create", "expenses", expense.id)
    # Enqueue WhatsApp notification for community members.
    await enqueue_for_community_members(
        db,
        community_id=user.community_id,
        event_type="common_expense_created",
        title="New Community Expense",
        message=f"{body.category}: {body.description} — Rs {body.amount:,.0f}",
        payload={"expense_id": expense.id, "amount": body.amount, "category": body.category},
        exclude_user_id=user.id,
        actor_user=user,
    )
    return expense


@router.patch("/expenses/{expense_id}", response_model=Expense, dependencies=[Writer])
async def update_expense(
    expense_id: str, body: ExpenseUpdate, db: DB, user: CurrentUser
) -> Expense:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = await db.expenses.find_one_and_update(
        {"id": expense_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    await record_audit(db, user, "update", "expenses", expense_id, updates)
    return Expense.model_validate(result)


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Writer],
)
async def delete_expense(expense_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.expenses.delete_one(
        {"id": expense_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Expense not found")
    await record_audit(db, user, "delete", "expenses", expense_id)


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
