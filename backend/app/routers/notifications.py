"""In-app notifications (M3). Email/push delivery lands in M4."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import CurrentUser
from app.db import get_db
from app.models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

DB = Annotated[Any, Depends(get_db)]


@router.get("", response_model=list[Notification])
async def list_notifications(db: DB, user: CurrentUser) -> list[Notification]:
    docs = await db.notifications.find(
        {"community_id": user.community_id, "user_id": user.id}
    ).to_list(500)
    docs.sort(key=lambda d: d["date"], reverse=True)
    return [Notification.model_validate(d) for d in docs[:50]]


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(db: DB, user: CurrentUser) -> None:
    await db.notifications.update_many(
        {"community_id": user.community_id, "user_id": user.id, "read": False},
        {"$set": {"read": True}},
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user.id},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found")
