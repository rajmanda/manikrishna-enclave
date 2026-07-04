from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles, scoped_community_id
from app.db import get_db
from app.models import WRITE_ROLES, User, UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


@router.get("", response_model=list[User])
async def list_users(
    db: DB, user: CurrentUser, community_id: str | None = None
) -> list[User]:
    cid = scoped_community_id(user, community_id)
    docs = await db.users.find({"community_id": cid}).to_list(length=1000)
    return [User.model_validate(d) for d in docs]


@router.post(
    "",
    response_model=User,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_user(body: UserCreate, db: DB, user: CurrentUser) -> User:
    """Whitelist a Google account for this community."""
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already whitelisted")
    new_user = User(
        community_id=user.community_id,
        name=body.name,
        email=email,
        role=body.role,
        apartment_id=body.apartment_id,
        phone=body.phone,
    )
    await db.users.insert_one(new_user.model_dump())
    await record_audit(db, user, "create", "users", new_user.id, {"email": email})
    return new_user


@router.patch("/{user_id}", response_model=User, dependencies=[Writer])
async def update_user(
    user_id: str, body: UserUpdate, db: DB, user: CurrentUser
) -> User:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if "email" in updates:
        # Email IS the whitelist key — normalize and keep unique.
        updates["email"] = updates["email"].lower()
        clash = await db.users.find_one(
            {"email": updates["email"], "id": {"$ne": user_id}}
        )
        if clash:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="Email already whitelisted"
            )
    result = await db.users.find_one_and_update(
        {"id": user_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    await record_audit(db, user, "update", "users", user_id, updates)
    return User.model_validate(result)


@router.delete(
    "/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer]
)
async def delete_user(user_id: str, db: DB, user: CurrentUser) -> None:
    """Remove a user from the whitelist — their access is revoked immediately."""
    if user_id == user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Cannot remove your own access"
        )
    result = await db.users.delete_one(
        {"id": user_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    await record_audit(db, user, "delete", "users", user_id)
