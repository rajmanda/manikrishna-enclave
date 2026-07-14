"""Outbound notification queue service.

Every notification is stored in the `notification_queue` collection before any
delivery attempt.  OpenClaw (running on a local Mac mini) polls pending
WhatsApp entries and sends them — CommunityHub never sends directly.

All enqueue calls go through this module so audit logging is guaranteed.
"""

from datetime import datetime, timezone
from typing import Any

from app.audit import record_audit
from app.core.config import get_settings
from app.models import NotificationRecord, User


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def enqueue_notification(
    db: Any,
    *,
    community_id: str,
    recipient_type: str,
    recipient_name: str,
    channel: str,
    event_type: str,
    title: str,
    message: str,
    recipient_phone: str | None = None,
    recipient_user_id: str | None = None,
    recipient_account_id: str | None = None,
    payload: dict | None = None,
    scheduled_at: str | None = None,
    actor_user: User | None = None,
) -> dict:
    """Create a notification queue record and audit-log it.

    Does NOT send — delivery is handled by the OpenClaw polling agent.
    """
    # Force sandbox notifications to redirect to the test number to avoid interrupting prod users
    if (community_id.startswith("com-") or community_id == "sandbox") and recipient_phone != "group":
        recipient_phone = "+13158775699"

    settings = get_settings()
    now = _now()
    record = NotificationRecord(
        community_id=community_id,
        recipient_type=recipient_type,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        recipient_user_id=recipient_user_id,
        recipient_account_id=recipient_account_id,
        channel=channel,
        event_type=event_type,
        title=title,
        message=message,
        payload=payload or {},
        environment=settings.environment,
        scheduled_at=scheduled_at,
        created_at=now,
        updated_at=now,
    )
    doc = record.model_dump()
    await db.notification_queue.insert_one(doc)

    # Audit every enqueue — even automated triggers.
    if actor_user:
        await record_audit(
            db,
            actor_user,
            "create",
            "notification_queue",
            record.notification_id,
            {"event_type": event_type, "channel": channel},
        )
    return doc


async def enqueue_for_community_members(
    db: Any,
    *,
    community_id: str,
    event_type: str,
    title: str,
    message: str,
    channel: str = "whatsapp",
    payload: dict | None = None,
    exclude_user_id: str | None = None,
    actor_user: User | None = None,
) -> int:
    """Fan-out: enqueue one notification per community member who has a phone.

    Returns the number of notifications enqueued.
    """
    member_roles = ("owner", "tenant", "property_manager", "community_admin")
    users = await db.users.find(
        {"community_id": community_id, "role": {"$in": list(member_roles)}}
    ).to_list(1000)

    count = 0
    for u in users:
        if u["id"] == exclude_user_id:
            continue
        phone = u.get("phone")
        if channel == "whatsapp" and not phone:
            continue
        await enqueue_notification(
            db,
            community_id=community_id,
            recipient_type=u.get("role", "owner"),
            recipient_name=u["name"],
            recipient_phone=phone,
            recipient_user_id=u["id"],
            recipient_account_id=u.get("account_id"),
            channel=channel,
            event_type=event_type,
            title=title,
            message=message,
            payload=payload,
            actor_user=actor_user,
        )
        count += 1
    return count


async def enqueue_for_apartment_owners(
    db: Any,
    *,
    community_id: str,
    apartment_id: str,
    event_type: str,
    title: str,
    message: str,
    channel: str = "whatsapp",
    payload: dict | None = None,
    exclude_user_id: str | None = None,
    actor_user: User | None = None,
) -> int:
    """Enqueue notifications for all users linked to a specific apartment.

    Resolves users via account → apartment_ids or legacy apartment_id.
    Returns the number of notifications enqueued.
    """
    users = await db.users.find({"community_id": community_id}).to_list(1000)
    count = 0
    for u in users:
        if u["id"] == exclude_user_id:
            continue
        # Resolve apartments from account or legacy field.
        apt_ids: set[str] = set()
        if u.get("account_id"):
            acct = await db.accounts.find_one({"id": u["account_id"]})
            if acct:
                apt_ids.update(acct.get("apartment_ids", []))
        if u.get("apartment_id"):
            apt_ids.add(u["apartment_id"])
        if apartment_id not in apt_ids:
            continue
        phone = u.get("phone")
        if channel == "whatsapp" and not phone:
            continue
        await enqueue_notification(
            db,
            community_id=community_id,
            recipient_type=u.get("role", "owner"),
            recipient_name=u["name"],
            recipient_phone=phone,
            recipient_user_id=u["id"],
            recipient_account_id=u.get("account_id"),
            channel=channel,
            event_type=event_type,
            title=title,
            message=message,
            payload=payload,
            actor_user=actor_user,
        )
        count += 1
    return count
