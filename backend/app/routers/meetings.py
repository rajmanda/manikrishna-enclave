"""Meeting minutes (M4)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status

from app import storage
from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import WRITE_ROLES, Meeting, MeetingCreate, MeetingUpdate
from app.notify import notify_members

router = APIRouter(prefix="/meetings", tags=["meetings"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


@router.get("", response_model=list[Meeting])
async def list_meetings(db: DB, user: CurrentUser) -> list[Meeting]:
    docs = await db.meetings.find({"community_id": user.community_id}).to_list(1000)
    docs.sort(key=lambda d: d["date"], reverse=True)
    return [Meeting.model_validate(d) for d in docs]


@router.post("", response_model=Meeting, status_code=status.HTTP_201_CREATED, dependencies=[Writer])
async def create_meeting(body: MeetingCreate, db: DB, user: CurrentUser) -> Meeting:
    meeting = Meeting(community_id=user.community_id, **body.model_dump())
    await db.meetings.insert_one(meeting.model_dump())
    await record_audit(db, user, "create", "meetings", meeting.id)
    await notify_members(
        db, user.community_id,
        f"Meeting scheduled: {meeting.title} on {meeting.date}", "meeting", user.id,
    )
    return meeting


@router.patch("/{meeting_id}", response_model=Meeting, dependencies=[Writer])
async def update_meeting(
    meeting_id: str, body: MeetingUpdate, db: DB, user: CurrentUser
) -> Meeting:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = await db.meetings.find_one_and_update(
        {"id": meeting_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    await record_audit(db, user, "update", "meetings", meeting_id, updates)
    return Meeting.model_validate(result)


@router.post("/{meeting_id}/minutes", response_model=Meeting, dependencies=[Writer])
async def upload_minutes(
    meeting_id: str, file: UploadFile, db: DB, user: CurrentUser
) -> Meeting:
    meeting = await db.meetings.find_one(
        {"id": meeting_id, "community_id": user.community_id}
    )
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    data = await file.read()
    if file.content_type != "application/pdf":
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Minutes must be a PDF"
        )
    if len(data) > storage.MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Max 10 MB")
    path = f"{user.community_id}/meetings/{meeting_id}/{file.filename or 'minutes.pdf'}"
    storage.upload_object(path, data, "application/pdf")
    result = await db.meetings.find_one_and_update(
        {"id": meeting_id},
        {"$set": {"minutes_path": path, "has_pdf": True}},
        return_document=True,
    )
    await record_audit(db, user, "update", "meetings", meeting_id, {"minutes": path})
    return Meeting.model_validate(result)


@router.get("/{meeting_id}/minutes")
async def download_minutes(meeting_id: str, db: DB, user: CurrentUser) -> Response:
    meeting = await db.meetings.find_one(
        {"id": meeting_id, "community_id": user.community_id}
    )
    if meeting is None or not meeting.get("minutes_path"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No minutes uploaded")
    data, content_type = storage.download_object(meeting["minutes_path"])
    return Response(content=data, media_type=content_type)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer])
async def delete_meeting(meeting_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.meetings.delete_one(
        {"id": meeting_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    await record_audit(db, user, "delete", "meetings", meeting_id)
