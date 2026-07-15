from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status

from app import storage
from app.audit import record_audit
from app.core.security import CurrentUser, owned_community_ids, require_roles
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
from app.notification_service import enqueue_for_community_members

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
    if body.maintenance_request_id:
        mr = await db.maintenance_requests.find_one(
            {"id": body.maintenance_request_id, "community_id": user.community_id}
        )
        if mr is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail="Maintenance request not found"
            )
        # One live job per request: a duplicate would split the money story.
        # A follow-up work order is allowed once the previous one is closed.
        existing = await db.work_orders.find_one(
            {"maintenance_request_id": body.maintenance_request_id,
             "community_id": user.community_id,
             "stage": {"$ne": "Closed"}}
        )
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"An open work order already exists for this request ({existing['title']}) — close it before creating another",
            )
    if body.cost_case_id:
        cc = await db.cost_cases.find_one(
            {"id": body.cost_case_id, "community_id": user.community_id}
        )
        if cc is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cost case not found")
    today = date.today().isoformat()
    wo = WorkOrder(
        community_id=user.community_id,
        reported_date=today,
        assigned_to=user.id,
        timeline=[{"stage": "Reported", "date": today, "note": f"Created by {user.name}"}],
        **body.model_dump(),
    )
    if not wo.cost_case_id:
        # Every job carries money implications — open its cost case with it
        # so nothing needs manual linking later.
        from app.models import CostCase

        case = CostCase(
            community_id=user.community_id,
            title=body.title,
            description="Opened automatically with the work order.",
            approved_budget=body.estimate,
            maintenance_request_id=body.maintenance_request_id,
            created_by=user.id,
            created_date=today,
        )
        await db.cost_cases.insert_one(case.model_dump())
        await record_audit(db, user, "create", "cost_cases", case.id,
                           {"auto": "work_order_created", "title": case.title})
        wo.cost_case_id = case.id
    await db.work_orders.insert_one(wo.model_dump())
    if body.maintenance_request_id:
        # The request is being acted on — reflect that for its reporter.
        await db.maintenance_requests.update_one(
            {"id": body.maintenance_request_id, "status": "Open"},
            {"$set": {"status": "In Progress"}},
        )
    await record_audit(db, user, "create", "work_orders", wo.id)
    await notify_members(
        db, user.community_id, f"New work order: {wo.title}", "work_order", user.id,
        href=f"/work-orders/{wo.id}",
    )
    # Enqueue WhatsApp notification for community members.
    await enqueue_for_community_members(
        db,
        community_id=user.community_id,
        event_type="work_order_created",
        title="New Work Order",
        message=f"Created by {user.display_name}. New work order: {wo.title} (Priority: {wo.priority}). View details: https://community.rajmanda.com/work-orders/{wo.id}",
        payload={"work_order_id": wo.id, "priority": wo.priority},
        exclude_user_id=user.id,
        actor_user=user,
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
    # Completed job → a DRAFT vendor bill for financial review (never a
    # posted expense: an estimate is not a spend). Idempotent — skipped
    # when any expense already references this work order.
    if body.stage == "Completed":
        existing = await db.expenses.find_one({"work_order_id": work_order_id})
        if existing is None:
            from app.models import Expense

            draft = Expense(
                community_id=user.community_id,
                category="Repairs",
                description=wo["title"],
                vendor_id=wo.get("vendor_id"),
                amount=body.final_cost if body.final_cost is not None
                else (wo.get("final_cost") or wo.get("estimate") or 0),
                paid_date=date.today().isoformat(),
                work_order_id=work_order_id,
                cost_case_id=wo.get("cost_case_id"),
                status="draft",
            )
            await db.expenses.insert_one(draft.model_dump())
            await record_audit(
                db, user, "create", "expenses", draft.id,
                {"status": "draft", "auto": "work_order_completed",
                 "work_order_id": work_order_id},
            )
    # PRD: owners are notified whenever a work-order status changes.
    await notify_members(
        db,
        user.community_id,
        f"Work order '{wo['title']}' moved to {body.stage}",
        "work_order",
        user.id,
        href=f"/work-orders/{work_order_id}",
    )
    # Enqueue WhatsApp: status update + special case for Owner Approval.
    event_type = "work_order_status_updated"
    title = "Work Order Update"
    message = f"Updated by {user.display_name}. Work order '{wo['title']}' moved to {body.stage}. View details: https://community.rajmanda.com/work-orders/{work_order_id}"
    if body.stage == "Owner Approval":
        event_type = "owner_approval_required"
        title = "Approval Required"
        message = f"Updated by {user.display_name}. Work order '{wo['title']}' needs owner approval. Review here: https://community.rajmanda.com/work-orders/{work_order_id}"
    await enqueue_for_community_members(
        db,
        community_id=user.community_id,
        event_type=event_type,
        title=title,
        message=message,
        payload={"work_order_id": work_order_id, "stage": body.stage},
        exclude_user_id=user.id,
        actor_user=user,
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


@router.delete(
    "/{work_order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("super_admin"))],
)
async def delete_work_order(
    work_order_id: str, db: DB, user: CurrentUser
) -> None:
    wo = await db.work_orders.find_one(
        {"id": work_order_id, "community_id": {"$in": owned_community_ids(user)}}
    )
    if wo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Work order not found")
    await db.work_orders.delete_one({"id": work_order_id})
    await record_audit(db, user, "delete", "work_orders", work_order_id)
    # Cascade: an auto-opened cost case with no money and no other job
    # vanishes with its work order; anything holding money stays.
    case_id = wo.get("cost_case_id")
    if case_id:
        other_wos = await db.work_orders.count_documents({"cost_case_id": case_id})
        expenses = await db.expenses.count_documents({"cost_case_id": case_id})
        invoices = await db.invoices.count_documents({"cost_case_id": case_id})
        if other_wos == 0 and expenses == 0 and invoices == 0:
            await db.cost_cases.delete_one({"id": case_id})
            await record_audit(db, user, "delete", "cost_cases", case_id,
                               {"cascade_from_work_order": work_order_id})

