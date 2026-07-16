"""Direct messages — one thread per resident with the property manager(s).

Residents (owners/tenants) see only their own thread; managers see every
thread in their community. Each message notifies the counterparty in-app,
and also enqueues a WhatsApp notification (via the OpenClaw queue) so the
recipient hears about it even when they are not in the app.
"""

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.audit import record_audit
from app.core.security import CurrentUser
from app.db import get_db
from app.models import Message, MessageCreate, MessageThread
from app.notification_service import enqueue_notification
from app.notify import notify_user

router = APIRouter(prefix="/messages", tags=["messages"])

DB = Annotated[Any, Depends(get_db)]

MANAGER_ROLES = ("property_manager", "community_admin", "super_admin")
RESIDENT_ROLES = ("owner", "tenant")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _preview(text: str) -> str:
    return text if len(text) <= 80 else text[:77] + "…"


@router.get("/threads", response_model=list[MessageThread])
async def list_threads(db: DB, user: CurrentUser) -> list[MessageThread]:
    """Manager inbox: one row per resident conversation, newest first."""
    if user.role not in (*MANAGER_ROLES, "auditor"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Managers only — residents use /messages"
        )
    msgs = await db.messages.find({"community_id": user.community_id}).to_list(10000)
    by_thread: dict[str, list[dict]] = {}
    for m in msgs:
        by_thread.setdefault(m["thread_user_id"], []).append(m)
    users = await db.users.find({"community_id": user.community_id}).to_list(1000)
    users_by_id = {u["id"]: u for u in users}
    threads: list[MessageThread] = []
    for tid, thread_msgs in by_thread.items():
        thread_msgs.sort(key=lambda m: m["date"])
        last = thread_msgs[-1]
        resident = users_by_id.get(tid, {})
        threads.append(
            MessageThread(
                thread_user_id=tid,
                thread_user_name=resident.get("name", "Former member"),
                apartment_id=resident.get("apartment_id"),
                last_text=last["text"],
                last_date=last["date"],
                unread_count=sum(
                    1 for m in thread_msgs if m["sender_id"] == tid and not m["read"]
                ),
            )
        )
    threads.sort(key=lambda t: t.last_date, reverse=True)
    return threads


@router.get("", response_model=list[Message])
async def list_messages(
    db: DB,
    user: CurrentUser,
    thread_user_id: Annotated[str | None, Query(alias="threadUserId")] = None,
) -> list[Message]:
    """One conversation, oldest first. Residents always get their own thread;
    managers/auditors pass ?threadUserId=. Fetching marks the counterparty's
    messages as read (except for auditors, who stay read-only)."""
    if user.role in RESIDENT_ROLES:
        tid = user.id
    elif user.role in (*MANAGER_ROLES, "auditor"):
        if not thread_user_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, detail="threadUserId is required"
            )
        tid = thread_user_id
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No message access")

    query = {"community_id": user.community_id, "thread_user_id": tid}
    docs = await db.messages.find(query).to_list(10000)
    docs.sort(key=lambda d: d["date"])
    if user.role != "auditor":
        await db.messages.update_many(
            {**query, "sender_id": {"$ne": user.id}, "read": False},
            {"$set": {"read": True}},
        )
    return [Message.model_validate(d) for d in docs]


@router.post("", response_model=Message, status_code=status.HTTP_201_CREATED)
async def send_message(body: MessageCreate, db: DB, user: CurrentUser) -> Message:
    text = body.text.strip()
    if not text:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message text is required"
        )

    if user.role in RESIDENT_ROLES:
        tid = user.id
        recipients = await db.users.find(
            {"community_id": user.community_id, "role": "property_manager"}
        ).to_list(100)
    elif user.role in MANAGER_ROLES:
        if not body.thread_user_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, detail="threadUserId is required"
            )
        resident = await db.users.find_one(
            {"id": body.thread_user_id, "community_id": user.community_id}
        )
        if resident is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail="Resident not found"
            )
        tid = body.thread_user_id
        recipients = [resident]
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Read-only role")

    message = Message(
        community_id=user.community_id,
        thread_user_id=tid,
        sender_id=user.id,
        sender_name=user.name,
        sender_role=user.role,
        text=text,
        date=_now(),
    )
    await db.messages.insert_one(message.model_dump())
    await record_audit(db, user, "create", "messages", message.id)

    for r in recipients:
        if r["id"] == user.id:
            continue
        await notify_user(
            db, user.community_id, r["id"],
            f"New message from {user.name}: {_preview(text)}", "message",
            href="/messages",
        )
        if r.get("phone"):
            await enqueue_notification(
                db,
                community_id=user.community_id,
                recipient_type=r.get("role", "owner"),
                recipient_name=r["name"],
                recipient_phone=r["phone"],
                recipient_user_id=r["id"],
                recipient_account_id=r.get("account_id"),
                channel="whatsapp",
                event_type="direct_message",
                title=f"Message from {user.name}",
                message=text,
                payload={"threadUserId": tid},
                actor_user=user,
            )
    return message
