"""Polls & voting (M4) — one vote per apartment (PRD)."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    Poll,
    PollCreate,
    PollOptionOut,
    PollOut,
    VoteRequest,
)
from app.notify import notify_members

router = APIRouter(prefix="/polls", tags=["polls"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


def _effective_status(doc: dict) -> str:
    if doc["status"] == "closed" or doc["close_date"] < date.today().isoformat():
        return "closed"
    return "open"


async def _to_out(
    db: Any, doc: dict, user_apartment: str | None, eligible: int | None = None
) -> PollOut:
    votes_by: dict = doc.get("votes_by", {})
    counts = {label: 0 for label in doc.get("option_labels", [])}
    for label in votes_by.values():
        if label in counts:
            counts[label] += 1
    if eligible is None:
        eligible = await db.apartments.count_documents(
            {"community_id": doc["community_id"]}
        )
    return PollOut(
        id=doc["id"],
        community_id=doc["community_id"],
        question=doc["question"],
        description=doc.get("description", ""),
        open_date=doc["open_date"],
        close_date=doc["close_date"],
        status=_effective_status(doc),
        options=[PollOptionOut(label=k, votes=v) for k, v in counts.items()],
        total_eligible=eligible,
        my_vote=votes_by.get(user_apartment) if user_apartment else None,
    )


@router.get("", response_model=list[PollOut])
async def list_polls(db: DB, user: CurrentUser) -> list[PollOut]:
    docs = await db.polls.find({"community_id": user.community_id}).to_list(1000)
    docs.sort(key=lambda d: d["open_date"], reverse=True)
    eligible = await db.apartments.count_documents(
        {"community_id": user.community_id}
    )
    return [await _to_out(db, d, user.apartment_id, eligible) for d in docs]


@router.post("", response_model=PollOut, status_code=status.HTTP_201_CREATED, dependencies=[Writer])
async def create_poll(body: PollCreate, db: DB, user: CurrentUser) -> PollOut:
    options = [o.strip() for o in body.options if o.strip()]
    if len(options) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="At least 2 options")
    poll = Poll(
        community_id=user.community_id,
        question=body.question,
        description=body.description,
        open_date=date.today().isoformat(),
        close_date=body.close_date,
        option_labels=options,
    )
    await db.polls.insert_one(poll.model_dump())
    await record_audit(db, user, "create", "polls", poll.id)
    await notify_members(
        db, user.community_id, f"Poll open: {body.question}", "poll", user.id,
        href="/polls",
    )
    return await _to_out(db, poll.model_dump(), user.apartment_id)


@router.post("/{poll_id}/vote", response_model=PollOut)
async def vote(poll_id: str, body: VoteRequest, db: DB, user: CurrentUser) -> PollOut:
    if not user.apartment_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Voting is one vote per apartment — your account has none assigned",
        )
    poll = await db.polls.find_one(
        {"id": poll_id, "community_id": user.community_id}
    )
    if poll is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Poll not found")
    if _effective_status(poll) == "closed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Poll is closed")
    if body.option not in poll.get("option_labels", []):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unknown option")
    result = await db.polls.find_one_and_update(
        {"id": poll_id},
        {"$set": {f"votes_by.{user.apartment_id}": body.option}},
        return_document=True,
    )
    return await _to_out(db, result, user.apartment_id)


@router.post("/{poll_id}/close", response_model=PollOut, dependencies=[Writer])
async def close_poll(poll_id: str, db: DB, user: CurrentUser) -> PollOut:
    result = await db.polls.find_one_and_update(
        {"id": poll_id, "community_id": user.community_id},
        {"$set": {"status": "closed"}},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Poll not found")
    await record_audit(db, user, "update", "polls", poll_id, {"status": "closed"})
    return await _to_out(db, result, user.apartment_id)


@router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer])
async def delete_poll(poll_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.polls.delete_one(
        {"id": poll_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Poll not found")
    await record_audit(db, user, "delete", "polls", poll_id)
