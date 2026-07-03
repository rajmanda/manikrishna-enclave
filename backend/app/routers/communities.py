from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import Community, CommunityCreate

router = APIRouter(prefix="/communities", tags=["communities"])

DB = Annotated[Any, Depends(get_db)]


@router.post(
    "",
    response_model=Community,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles())],  # super_admin only
)
async def create_community(
    body: CommunityCreate, db: DB, user: CurrentUser
) -> Community:
    community = Community(name=body.name, address=body.address)
    await db.communities.insert_one(community.model_dump())
    await record_audit(db, user, "create", "communities", community.id)
    return community


@router.get("", response_model=list[Community])
async def list_communities(db: DB, user: CurrentUser) -> list[Community]:
    if user.role == "super_admin":
        docs = await db.communities.find().to_list(length=1000)
    else:
        docs = await db.communities.find({"id": user.community_id}).to_list(length=1)
    return [Community.model_validate(d) for d in docs]


@router.get("/{community_id}", response_model=Community)
async def get_community(community_id: str, db: DB, user: CurrentUser) -> Community:
    if user.role != "super_admin" and community_id != user.community_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Different community")
    doc = await db.communities.find_one({"id": community_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Community not found")
    return Community.model_validate(doc)
