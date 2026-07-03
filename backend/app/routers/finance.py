"""Read endpoints for the financial module (Phase 1: read-only).

Scoping rules:
- owners/tenants see invoices and payments for their own apartment only;
- managers, community admins and auditors see everything in their community;
- expenses, reserve fund, monthly finance and the community summary are
  visible to every member (PRD transparency requirement).
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser
from app.db import get_db
from app.models import (
    CommunitySummary,
    Expense,
    Invoice,
    MonthlyFinance,
    Payment,
    ReserveFundEntry,
    User,
)

router = APIRouter(tags=["finance"])

DB = Annotated[Any, Depends(get_db)]

MEMBER_SCOPED_ROLES = ("owner", "tenant")


def _apartment_scope(user: User) -> dict:
    query: dict = {"community_id": user.community_id}
    if user.role in MEMBER_SCOPED_ROLES and user.apartment_id:
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


@router.get("/reserve-fund", response_model=list[ReserveFundEntry])
async def reserve_fund(db: DB, user: CurrentUser) -> list[ReserveFundEntry]:
    docs = await db.reserve_fund.find({"community_id": user.community_id}).to_list(
        length=1000
    )
    return [ReserveFundEntry.model_validate(d) for d in docs]


@router.get("/finance/monthly", response_model=list[MonthlyFinance])
async def monthly_finance(db: DB, user: CurrentUser) -> list[MonthlyFinance]:
    docs = await db.monthly_finance.find({"community_id": user.community_id}).to_list(
        length=1000
    )
    return [MonthlyFinance.model_validate(d) for d in docs]


@router.get("/finance/summary", response_model=CommunitySummary)
async def community_summary(db: DB, user: CurrentUser) -> CommunitySummary:
    cid = user.community_id
    monthly = await db.monthly_finance.find({"community_id": cid}).to_list(length=1000)
    current = monthly[-1] if monthly else {"income": 0, "expenses": 0}
    invoices = await db.invoices.find({"community_id": cid}).to_list(length=10000)
    reserve = await db.reserve_fund.find({"community_id": cid}).to_list(length=1000)
    return CommunitySummary(
        month_income=current["income"],
        month_expenses=current["expenses"],
        outstanding_dues=sum(i["amount"] - i["paid_amount"] for i in invoices),
        reserve_fund_balance=reserve[-1]["balance"] if reserve else 0,
    )
