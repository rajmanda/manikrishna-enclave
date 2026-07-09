"""Community feed (M3) — the WhatsApp replacement."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    CommentCreate,
    FeedPostCreate,
    FeedPostOut,
    FeedPost,
    FeedReactions,
    ReactRequest,
)
from app.notify import notify_members
from app.notification_service import enqueue_for_community_members

router = APIRouter(prefix="/feed", tags=["feed"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

POSTER_ROLES = ("owner", "tenant", "property_manager", "community_admin", "super_admin")


def _to_out(doc: dict, user_id: str) -> FeedPostOut:
    reactions_by: dict = doc.get("reactions_by", {})
    counts = FeedReactions()
    for kind in reactions_by.values():
        if hasattr(counts, kind):
            setattr(counts, kind, getattr(counts, kind) + 1)
    return FeedPostOut(
        id=doc["id"],
        community_id=doc["community_id"],
        author_id=doc["author_id"],
        type=doc["type"],
        text=doc["text"],
        date=doc["date"],
        pinned=doc.get("pinned", False),
        reactions=counts,
        comments=doc.get("comments", []),
        attachment_count=doc.get("attachment_count", 0),
        my_reaction=reactions_by.get(user_id),
    )


@router.get("", response_model=list[FeedPostOut])
async def list_posts(db: DB, user: CurrentUser) -> list[FeedPostOut]:
    docs = await db.feed_posts.find({"community_id": user.community_id}).to_list(1000)
    # Pinned first, then newest first within each group.
    pinned = sorted([d for d in docs if d.get("pinned")], key=lambda d: d["date"], reverse=True)
    rest = sorted([d for d in docs if not d.get("pinned")], key=lambda d: d["date"], reverse=True)
    return [_to_out(d, user.id) for d in pinned + rest]


@router.post("", response_model=FeedPostOut, status_code=status.HTTP_201_CREATED)
async def create_post(body: FeedPostCreate, db: DB, user: CurrentUser) -> FeedPostOut:
    if user.role not in POSTER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Read-only role")
    text = body.text.strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty post")
    post = FeedPost(
        community_id=user.community_id,
        author_id=user.id,
        type=body.type,
        text=text,
        date=date.today().isoformat(),
    )
    await db.feed_posts.insert_one(post.model_dump())
    await record_audit(db, user, "create", "feed_posts", post.id)
    if body.type == "announcement":
        await notify_members(
            db, user.community_id,
            f"New announcement: {text[:60]}{'…' if len(text) > 60 else ''}",
            "announcement", user.id, href="/feed",
        )
        # Enqueue WhatsApp notification for community members.
        await enqueue_for_community_members(
            db,
            community_id=user.community_id,
            event_type="announcement_posted",
            title="New Announcement",
            message=f"Announcement by {user.display_name}: {text[:150]}... Read more: https://community.rajmanda.com/feed",
            payload={"post_id": post.id},
            exclude_user_id=user.id,
            actor_user=user,
        )
    return _to_out(post.model_dump(), user.id)


@router.post("/{post_id}/comments", response_model=FeedPostOut)
async def add_comment(
    post_id: str, body: CommentCreate, db: DB, user: CurrentUser
) -> FeedPostOut:
    if user.role not in POSTER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Read-only role")
    text = body.text.strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty comment")
    comment = {"author_id": user.id, "text": text, "date": date.today().isoformat()}
    result = await db.feed_posts.find_one_and_update(
        {"id": post_id, "community_id": user.community_id},
        {"$push": {"comments": comment}},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _to_out(result, user.id)


@router.post("/{post_id}/react", response_model=FeedPostOut)
async def react(
    post_id: str, body: ReactRequest, db: DB, user: CurrentUser
) -> FeedPostOut:
    post = await db.feed_posts.find_one(
        {"id": post_id, "community_id": user.community_id}
    )
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    update = (
        {"$unset": {f"reactions_by.{user.id}": ""}}
        if body.kind == "none"
        else {"$set": {f"reactions_by.{user.id}": body.kind}}
    )
    result = await db.feed_posts.find_one_and_update(
        {"id": post_id}, update, return_document=True
    )
    return _to_out(result, user.id)


@router.post("/{post_id}/pin", response_model=FeedPostOut, dependencies=[Writer])
async def toggle_pin(post_id: str, db: DB, user: CurrentUser) -> FeedPostOut:
    post = await db.feed_posts.find_one(
        {"id": post_id, "community_id": user.community_id}
    )
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    result = await db.feed_posts.find_one_and_update(
        {"id": post_id},
        {"$set": {"pinned": not post.get("pinned", False)}},
        return_document=True,
    )
    await record_audit(db, user, "update", "feed_posts", post_id, {"pinned": result["pinned"]})
    return _to_out(result, user.id)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(post_id: str, db: DB, user: CurrentUser) -> None:
    post = await db.feed_posts.find_one(
        {"id": post_id, "community_id": user.community_id}
    )
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post["author_id"] != user.id and user.role not in WRITE_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only the author or a manager can delete"
        )
    await db.feed_posts.delete_one({"id": post_id})
    await record_audit(db, user, "delete", "feed_posts", post_id)
