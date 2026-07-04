"""In-app notification fan-out (M3). Email/push delivery comes in M4."""

from datetime import datetime, timezone
from typing import Any

from app.models import Notification

MEMBER_ROLES = ("owner", "tenant", "property_manager", "community_admin")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def notify_members(
    db: Any,
    community_id: str,
    text: str,
    type_: str,
    exclude_user_id: str | None = None,
) -> None:
    """Notify every resident/manager in the community (not the actor)."""
    users = await db.users.find(
        {"community_id": community_id, "role": {"$in": list(MEMBER_ROLES)}}
    ).to_list(1000)
    docs = [
        Notification(
            community_id=community_id,
            user_id=u["id"],
            text=text,
            date=_now(),
            type=type_,
        ).model_dump()
        for u in users
        if u["id"] != exclude_user_id
    ]
    if docs:
        await db.notifications.insert_many(docs)


async def notify_user(
    db: Any, community_id: str, user_id: str, text: str, type_: str
) -> None:
    await db.notifications.insert_one(
        Notification(
            community_id=community_id,
            user_id=user_id,
            text=text,
            date=_now(),
            type=type_,
        ).model_dump()
    )
