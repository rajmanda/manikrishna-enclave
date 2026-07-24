"""Notification queue management endpoints (JWT-authenticated, manager roles).

These endpoints let managers view, create, retry and cancel notification queue
entries.  They do NOT send notifications — delivery is handled by OpenClaw.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    DeliveryFailureSummary,
    NotificationAgentHealth,
    NotificationRecord,
    NotificationRecordCreate,
    User,
)
from app.notification_service import enqueue_notification

router = APIRouter(prefix="/notification-queue", tags=["notification-queue"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

# A message stuck this long without a state change is presumed lost — the
# delivery agent is down or died mid-send. Sweeping it to 'failed' surfaces
# the red badge (with Resend) instead of leaving it invisibly queued forever.
PENDING_STALE_HOURS = 2
PROCESSING_STALE_HOURS = 1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _sweep_stale(db: Any, user: User) -> int:
    """Expire stale pending/processing entries for the caller's community.

    Runs lazily whenever a manager loads delivery status — there is no
    scheduler on Cloud Run, and this is exactly the moment staleness matters.
    """
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    swept = 0
    for stale_status, hours in (
        ("pending", PENDING_STALE_HOURS),
        ("processing", PROCESSING_STALE_HOURS),
    ):
        cutoff = (now_dt - timedelta(hours=hours)).isoformat()
        result = await db.notification_queue.update_many(
            {
                "community_id": user.community_id,
                "status": stale_status,
                "updated_at": {"$lt": cutoff},
            },
            {
                "$set": {
                    "status": "failed",
                    "error_message": (
                        f"expired after {hours}h in '{stale_status}' — "
                        "delivery agent unavailable"
                    ),
                    "failed_at": now,
                    "updated_at": now,
                }
            },
        )
        swept += result.modified_count
    if swept:
        await record_audit(
            db, user, "update", "notification_queue", "stale-sweep",
            {"expired": swept},
        )
    return swept


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
        related_type=body.related_type,
        related_id=body.related_id,
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
    related_type: str | None = None,
    related_id: str | None = None,
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
    if related_type:
        query["related_type"] = related_type
    if related_id:
        query["related_id"] = related_id
    docs = (
        await db.notification_queue.find(query)
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [NotificationRecord.model_validate(d) for d in docs]


@router.get(
    "/health",
    response_model=NotificationAgentHealth,
    dependencies=[Writer],
)
async def delivery_agent_health(db: DB, user: CurrentUser) -> NotificationAgentHealth:
    """Delivery-agent liveness + queue depth — drives the manager banner.

    `agent_last_poll_at` is stamped by every OpenClaw poll; the frontend
    treats a gap over a few minutes as 'agent down' (it polls every 15s).
    Also expires stale queue entries so they surface as real failures.
    """
    await _sweep_stale(db, user)
    status_doc = await db.agent_status.find_one({"id": "openclaw-whatsapp"})
    pending = await db.notification_queue.count_documents(
        {"community_id": user.community_id, "status": "pending"}
    )
    processing = await db.notification_queue.count_documents(
        {"community_id": user.community_id, "status": "processing"}
    )
    return NotificationAgentHealth(
        agent_last_poll_at=(status_doc or {}).get("last_poll_at"),
        pending_count=pending,
        processing_count=processing,
    )


@router.get(
    "/delivery-summary",
    response_model=list[DeliveryFailureSummary],
    dependencies=[Writer],
)
async def delivery_failure_summary(
    db: DB,
    user: CurrentUser,
    related_type: str | None = None,
) -> list[DeliveryFailureSummary]:
    """Failed deliveries grouped by the entity that triggered them.

    One call per page: the frontend maps (relatedType, relatedId) to a
    'not delivered' badge. Only terminally failed entries appear — OpenClaw
    auto-retries up to max_retries before a record lands here.
    """
    await _sweep_stale(db, user)
    query: dict[str, Any] = {
        "community_id": user.community_id,
        "status": "failed",
        "related_id": {"$nin": [None]},
    }
    if related_type:
        query["related_type"] = related_type
    docs = (
        await db.notification_queue.find(query)
        .sort("failed_at", -1)
        .to_list(1000)
    )
    # Grouped in Python: the terminal-failed set is small by construction and
    # mongomock (used in tests) has patchy $group support.
    grouped: dict[tuple[str, str], DeliveryFailureSummary] = {}
    for d in docs:
        key = (d.get("related_type") or "", d["related_id"])
        entry = grouped.get(key)
        if entry is None:
            entry = DeliveryFailureSummary(
                related_type=key[0],
                related_id=key[1],
                failed_count=0,
                last_failed_at=d.get("failed_at"),
                last_error_message=d.get("error_message"),
            )
            grouped[key] = entry
        entry.failed_count += 1
        entry.notification_ids.append(d["notification_id"])
    return list(grouped.values())


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
