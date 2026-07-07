"""OpenClaw polling endpoints — secured with a shared API key (X-API-Key).

OpenClaw is a WhatsApp automation agent running on a local Mac mini.
It polls these endpoints for pending notifications and reports delivery status.
The Mac mini is never exposed to the public internet — it initiates all
connections outbound to Cloud Run.
"""

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import verify_openclaw_key
from app.db import get_db
from app.models import MarkFailedRequest, MarkSentRequest, NotificationRecord

router = APIRouter(
    prefix="/openclaw",
    tags=["openclaw"],
    dependencies=[Depends(verify_openclaw_key)],
)

DB = Annotated[Any, Depends(get_db)]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/notifications/pending", response_model=list[NotificationRecord])
async def fetch_pending(
    db: DB,
    channel: str = Query("whatsapp"),
    limit: int = Query(10, le=50),
) -> list[NotificationRecord]:
    """Fetch pending notifications for the given channel.

    Atomically marks each returned record as 'processing' to prevent
    double-pickup when OpenClaw polls twice quickly.
    """
    now = _now()
    query: dict[str, Any] = {
        "status": "pending",
        "channel": channel,
        "$or": [
            {"scheduled_at": None},
            {"scheduled_at": {"$lte": now}},
        ],
    }
    docs = (
        await db.notification_queue.find(query)
        .sort("created_at", 1)  # oldest first (FIFO)
        .to_list(limit)
    )
    # Atomically mark as processing — each update is individual so partial
    # failures leave the rest still pending.
    result = []
    for doc in docs:
        updated = await db.notification_queue.find_one_and_update(
            {"notification_id": doc["notification_id"], "status": "pending"},
            {"$set": {"status": "processing", "updated_at": now}},
            return_document=True,
        )
        if updated:
            result.append(NotificationRecord.model_validate(updated))
    return result


@router.post(
    "/notifications/{notification_id}/sent",
    response_model=NotificationRecord,
)
async def mark_sent(
    notification_id: str, body: MarkSentRequest, db: DB
) -> NotificationRecord:
    """OpenClaw confirms successful delivery."""
    now = _now()
    sent_at = body.sent_at or now
    result = await db.notification_queue.find_one_and_update(
        {"notification_id": notification_id, "status": "processing"},
        {
            "$set": {
                "status": "sent",
                "sent_at": sent_at,
                "provider": "openclaw",
                "updated_at": now,
            }
        },
        return_document=True,
    )
    if result is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Notification not found or not in 'processing' status",
        )
    return NotificationRecord.model_validate(result)


@router.post(
    "/notifications/{notification_id}/failed",
    response_model=NotificationRecord,
)
async def mark_failed(
    notification_id: str, body: MarkFailedRequest, db: DB
) -> NotificationRecord:
    """OpenClaw reports a delivery failure.

    If retries remain, the notification is re-queued as 'pending'.
    Otherwise it stays 'failed'.
    """
    now = _now()
    doc = await db.notification_queue.find_one(
        {"notification_id": notification_id, "status": "processing"}
    )
    if doc is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Notification not found or not in 'processing' status",
        )
    new_retry = doc.get("retry_count", 0) + 1
    max_retries = doc.get("max_retries", 3)
    # Re-queue if retries remain; otherwise mark permanently failed.
    new_status = "pending" if new_retry < max_retries else "failed"
    result = await db.notification_queue.find_one_and_update(
        {"notification_id": notification_id},
        {
            "$set": {
                "status": new_status,
                "error_message": body.error_message,
                "failed_at": now,
                "retry_count": new_retry,
                "updated_at": now,
            }
        },
        return_document=True,
    )
    return NotificationRecord.model_validate(result)
