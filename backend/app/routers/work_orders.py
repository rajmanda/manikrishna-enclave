from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status

from app import storage
from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    CommentCreate,
    StageUpdate,
    WorkOrder,
    WorkOrderCreate,
    WorkOrderUpdate,
)
from app.notify import notify_members

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


Writer = Depends(require_roles(*WRITE_ROLES))
COMMENT_ROLES = ("owner", "tenant", "property_manager", "community_admin", "super_admin")


@router.post(
    "",
    response_model=WorkOrder,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_work_order(
    body: WorkOrderCreate, db: DB, user: CurrentUser
) -> WorkOrder:
    today = date.today().isoformat()
    wo = WorkOrder(
        community_id=user.community_id,
        reported_date=today,
        assigned_to=user.id,
        timeline=[{"stage": "Reported", "date": today, "note": f"Created by {user.name}"}],
        **body.model_dump(),
    )
    await db.work_orders.insert_one(wo.model_dump())
    await record_audit(db, user, "create", "work_orders", wo.id)
    await notify_members(
        db, user.community_id, f"New work order: {wo.title}", "work_order", user.id
    )
    return wo


@router.patch("/{work_order_id}", response_model=WorkOrder, dependencies=[Writer])
async def update_work_order(
    work_order_id: str, body: WorkOrderUpdate, db: DB, user: CurrentUser
) -> WorkOrder:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = await db.work_orders.find_one_and_update(
        {"id": work_order_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    await record_audit(db, user, "update", "work_orders", work_order_id, updates)
    return WorkOrder.model_validate(result)


@router.post("/{work_order_id}/stage", response_model=WorkOrder, dependencies=[Writer])
async def change_stage(
    work_order_id: str, body: StageUpdate, db: DB, user: CurrentUser
) -> WorkOrder:
    wo = await db.work_orders.find_one(
        {"id": work_order_id, "community_id": user.community_id}
    )
    if wo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    event = {"stage": body.stage, "date": date.today().isoformat(), "note": body.note}
    updates: dict = {"stage": body.stage}
    if body.final_cost is not None:
        updates["final_cost"] = body.final_cost
    result = await db.work_orders.find_one_and_update(
        {"id": work_order_id},
        {"$set": updates, "$push": {"timeline": event}},
        return_document=True,
    )
    await record_audit(
        db, user, "update", "work_orders", work_order_id, {"stage": body.stage}
    )
    # PRD: owners are notified whenever a work-order status changes.
    await notify_members(
        db,
        user.community_id,
        f"Work order '{wo['title']}' moved to {body.stage}",
        "work_order",
        user.id,
    )
    return WorkOrder.model_validate(result)


@router.post("/{work_order_id}/comments", response_model=WorkOrder)
async def add_comment(
    work_order_id: str, body: CommentCreate, db: DB, user: CurrentUser
) -> WorkOrder:
    if user.role not in COMMENT_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Read-only role")
    comment = {
        "author_id": user.id,
        "date": date.today().isoformat(),
        "text": body.text.strip(),
    }
    if not comment["text"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty comment")
    result = await db.work_orders.find_one_and_update(
        {"id": work_order_id, "community_id": user.community_id},
        {"$push": {"comments": comment}},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    await record_audit(db, user, "update", "work_orders", work_order_id, {"comment": True})
    return WorkOrder.model_validate(result)


@router.post("/{work_order_id}/photos", response_model=WorkOrder, dependencies=[Writer])
async def upload_photo(
    work_order_id: str, file: UploadFile, db: DB, user: CurrentUser
) -> WorkOrder:
    wo = await db.work_orders.find_one(
        {"id": work_order_id, "community_id": user.community_id}
    )
    if wo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    data = await file.read()
    storage.validate_upload(file.content_type, len(data))
    index = len(wo.get("photos", []))
    path = f"{user.community_id}/work-orders/{work_order_id}/{index}-{file.filename or 'photo'}"
    storage.upload_object(path, data, file.content_type or "application/octet-stream")
    result = await db.work_orders.find_one_and_update(
        {"id": work_order_id},
        {"$push": {"photos": path}, "$inc": {"photo_count": 1}},
        return_document=True,
    )
    await record_audit(db, user, "update", "work_orders", work_order_id, {"photo": path})
    return WorkOrder.model_validate(result)


@router.get("/{work_order_id}/photos/{index}")
async def get_photo(
    work_order_id: str, index: int, db: DB, user: CurrentUser
) -> Response:
    wo = await db.work_orders.find_one(
        {"id": work_order_id, "community_id": user.community_id}
    )
    if wo is None or index >= len(wo.get("photos", [])):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Photo not found")
    data, content_type = storage.download_object(wo["photos"][index])
    return Response(content=data, media_type=content_type)
