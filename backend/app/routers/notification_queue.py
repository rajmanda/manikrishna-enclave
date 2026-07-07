"""Notification queue management endpoints (JWT-authenticated, manager roles).

These endpoints let managers view, create, retry and cancel notification queue
entries.  They do NOT send notifications — delivery is handled by OpenClaw.
"""

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    NotificationRecord,
    NotificationRecordCreate,
)
from app.notification_service import enqueue_notification

router = APIRouter(prefix="/notification-queue", tags=["notification-queue"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post(
    "",
    response_model=NotificationRecord,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_notification(
    body: NotificationRecordCreate, db: DB, user: CurrentUser
) -> NotificationRecord:
    """Manually enqueue a notification."""
    doc = await enqueue_notification(
        db,
        community_id=user.community_id,
        recipient_type=body.recipient_type,
        recipient_name=body.recipient_name,
        recipient_phone=body.recipient_phone,
        recipient_user_id=body.recipient_user_id,
        recipient_account_id=body.recipient_account_id,
        channel=body.channel,
        event_type=body.event_type,
        title=body.title,
        message=body.message,
        payload=body.payload,
        scheduled_at=body.scheduled_at,
        actor_user=user,
    )
    return NotificationRecord.model_validate(doc)


@router.get("", response_model=list[NotificationRecord], dependencies=[Writer])
async def list_notifications(
    db: DB,
    user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    channel: str | None = None,
    event_type: str | None = None,
    limit: int = Query(100, le=500),
) -> list[NotificationRecord]:
    """List notification queue entries for the caller's community."""
    query: dict[str, Any] = {"community_id": user.community_id}
    if status_filter:
        query["status"] = status_filter
    if channel:
        query["channel"] = channel
    if event_type:
        query["event_type"] = event_type
    docs = (
        await db.notification_queue.find(query)
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [NotificationRecord.model_validate(d) for d in docs]


@router.post(
    "/{notification_id}/retry",
    response_model=NotificationRecord,
    dependencies=[Writer],
)
async def retry_notification(
    notification_id: str, db: DB, user: CurrentUser
) -> NotificationRecord:
    """Reset a failed/cancelled notification to pending for re-delivery."""
    doc = await db.notification_queue.find_one(
        {"notification_id": notification_id, "community_id": user.community_id}
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if doc["status"] not in ("failed", "cancelled"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Cannot retry a notification in '{doc['status']}' status",
        )
    now = _now()
    result = await db.notification_queue.find_one_and_update(
        {"notification_id": notification_id},
        {
            "$set": {
                "status": "pending",
                "error_message": None,
                "failed_at": None,
                "updated_at": now,
            },
            "$inc": {"retry_count": 1},
        },
        return_document=True,
    )
    await record_audit(
        db, user, "update", "notification_queue", notification_id, {"action": "retry"}
    )
    return NotificationRecord.model_validate(result)


@router.post(
    "/{notification_id}/cancel",
    response_model=NotificationRecord,
    dependencies=[Writer],
)
async def cancel_notification(
    notification_id: str, db: DB, user: CurrentUser
) -> NotificationRecord:
    """Cancel a pending/failed notification — it will not be picked up by OpenClaw."""
    doc = await db.notification_queue.find_one(
        {"notification_id": notification_id, "community_id": user.community_id}
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if doc["status"] in ("sent", "cancelled"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a notification in '{doc['status']}' status",
        )
    now = _now()
    result = await db.notification_queue.find_one_and_update(
        {"notification_id": notification_id},
        {"$set": {"status": "cancelled", "updated_at": now}},
        return_document=True,
    )
    await record_audit(
        db, user, "update", "notification_queue", notification_id, {"action": "cancel"}
    )
    return NotificationRecord.model_validate(result)
