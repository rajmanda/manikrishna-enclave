import asyncio
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import CurrentUser
from app.db import get_db
from app.models import ManagerDashboard, NavBadges, OwnerDashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DB = Annotated[Any, Depends(get_db)]

OPEN_STAGES = [
    "Reported",
    "Estimate Received",
    "Owner Approval",
    "In Progress",
    "Inspection",
]
APPROVAL_STAGES = ["Estimate Received", "Owner Approval"]


async def _reserve_balance(db: Any, community_id: str) -> float:
    entries = await db.reserve_fund.find({"community_id": community_id}).to_list(
        length=100
    )
    return entries[-1]["balance"] if entries else 0.0


async def _month_expenses(db: Any, community_id: str) -> float:
    prefix = date.today().isoformat()[:7]
    docs = await db.expenses.find({"community_id": community_id}).to_list(length=1000)
    return sum(d["amount"] for d in docs if d["paid_date"].startswith(prefix))


@router.get("/badges", response_model=NavBadges)
async def nav_badges(db: DB, user: CurrentUser) -> NavBadges:
    """Counts behind nav badges. Invoice count is role-scoped (owners see
    their own apartment(s)); pending confirmations are manager-relevant."""
    invoice_query: dict = {"community_id": user.community_id, "status": {"$ne": "paid"}}
    if user.role in ("owner", "tenant") and user.apartment_ids:
        invoice_query["apartment_id"] = {"$in": user.apartment_ids}
    elif user.role in ("owner", "tenant") and user.apartment_id:
        invoice_query["apartment_id"] = user.apartment_id
    open_inv, pending_pay = await asyncio.gather(
        db.invoices.count_documents(invoice_query),
        db.payments.count_documents(
            {"community_id": user.community_id, "status": "pending"}
        ),
    )
    return NavBadges(
        open_invoices=open_inv,
        pending_payment_confirmations=pending_pay,
    )


@router.get("/owner", response_model=OwnerDashboard)
async def owner_dashboard(db: DB, user: CurrentUser) -> OwnerDashboard:
    if not user.apartment_ids and not user.apartment_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="User has no apartment assigned"
        )
    apt_ids = user.apartment_ids or ([user.apartment_id] if user.apartment_id else [])
    invoices, open_wos, month_exp, reserve = await asyncio.gather(
        db.invoices.find(
            {"community_id": user.community_id, "apartment_id": {"$in": apt_ids}}
        ).to_list(length=1000),
        db.work_orders.count_documents(
            {"community_id": user.community_id, "stage": {"$in": OPEN_STAGES}}
        ),
        _month_expenses(db, user.community_id),
        _reserve_balance(db, user.community_id),
    )
    return OwnerDashboard(
        outstanding_balance=sum(i["amount"] - i["paid_amount"] for i in invoices),
        open_work_orders=open_wos,
        month_expenses=month_exp,
        reserve_fund_balance=reserve,
    )


@router.get("/manager", response_model=ManagerDashboard)
async def manager_dashboard(db: DB, user: CurrentUser) -> ManagerDashboard:
    if user.role not in ("property_manager", "community_admin", "auditor", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Managers only")
    cid = user.community_id
    (invoices, month_exp, reserve, open_wos, approvals, overdue, pending_pay
     ) = await asyncio.gather(
        db.invoices.find({"community_id": cid}).to_list(length=10000),
        _month_expenses(db, cid),
        _reserve_balance(db, cid),
        db.work_orders.count_documents(
            {"community_id": cid, "stage": {"$in": OPEN_STAGES}}
        ),
        db.work_orders.count_documents(
            {"community_id": cid, "stage": {"$in": APPROVAL_STAGES}}
        ),
        db.invoices.count_documents({"community_id": cid, "status": "overdue"}),
        db.payments.count_documents({"community_id": cid, "status": "pending"}),
    )
    community_inv = [i for i in invoices if i.get("ledger", "community") == "community"]
    fee_inv = [i for i in invoices if i.get("ledger") == "manager_fee"]
    return ManagerDashboard(
        outstanding_collections=sum(i["amount"] - i["paid_amount"] for i in community_inv),
        payments_received=sum(i["paid_amount"] for i in community_inv),
        month_expenses=month_exp,
        reserve_fund_balance=reserve,
        open_work_orders=open_wos,
        pending_approvals=approvals,
        overdue_invoices=overdue,
        pending_payment_confirmations=pending_pay,
        fee_outstanding=sum(i["amount"] - i["paid_amount"] for i in fee_inv),
        fee_collected=sum(i["paid_amount"] for i in fee_inv),
    )
