from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import CurrentUser
from app.db import get_db
from app.models import WorkOrder

router = APIRouter(prefix="/work-orders", tags=["work-orders"])

DB = Annotated[Any, Depends(get_db)]


@router.get("", response_model=list[WorkOrder])
async def list_work_orders(db: DB, user: CurrentUser) -> list[WorkOrder]:
    # Common-area work orders are visible to every member (PRD).
    docs = await db.work_orders.find({"community_id": user.community_id}).to_list(
        length=10000
    )
    return [WorkOrder.model_validate(d) for d in docs]


@router.get("/{work_order_id}", response_model=WorkOrder)
async def get_work_order(work_order_id: str, db: DB, user: CurrentUser) -> WorkOrder:
    doc = await db.work_orders.find_one(
        {"id": work_order_id, "community_id": user.community_id}
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    return WorkOrder.model_validate(doc)
