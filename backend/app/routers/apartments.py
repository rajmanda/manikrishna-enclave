from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles, scoped_community_id
from app.db import get_db
from app.models import WRITE_ROLES, Apartment, ApartmentCreate, ApartmentUpdate

router = APIRouter(prefix="/apartments", tags=["apartments"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


@router.get("", response_model=list[Apartment])
async def list_apartments(
    db: DB, user: CurrentUser, community_id: str | None = None
) -> list[Apartment]:
    cid = scoped_community_id(user, community_id)
    docs = await db.apartments.find({"community_id": cid}).to_list(length=1000)
    return [Apartment.model_validate(d) for d in docs]


@router.post(
    "",
    response_model=Apartment,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_apartment(
    body: ApartmentCreate, db: DB, user: CurrentUser
) -> Apartment:
    cid = user.community_id
    existing = await db.apartments.find_one(
        {"community_id": cid, "number": body.number}
    )
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"Apartment {body.number} already exists"
        )
    apartment = Apartment(community_id=cid, **body.model_dump())
    await db.apartments.insert_one(apartment.model_dump())
    await db.communities.update_one({"id": cid}, {"$inc": {"apartment_count": 1}})
    await record_audit(db, user, "create", "apartments", apartment.id)
    return apartment


@router.get("/{apartment_id}", response_model=Apartment)
async def get_apartment(apartment_id: str, db: DB, user: CurrentUser) -> Apartment:
    doc = await db.apartments.find_one(
        {"id": apartment_id, "community_id": scoped_community_id(user)}
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    return Apartment.model_validate(doc)


@router.patch("/{apartment_id}", response_model=Apartment, dependencies=[Writer])
async def update_apartment(
    apartment_id: str, body: ApartmentUpdate, db: DB, user: CurrentUser
) -> Apartment:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = await db.apartments.find_one_and_update(
        {"id": apartment_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    await record_audit(db, user, "update", "apartments", apartment_id, updates)
    return Apartment.model_validate(result)


@router.delete(
    "/{apartment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer]
)
async def delete_apartment(apartment_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.apartments.delete_one(
        {"id": apartment_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    await db.communities.update_one(
        {"id": user.community_id}, {"$inc": {"apartment_count": -1}}
    )
    await record_audit(db, user, "delete", "apartments", apartment_id)
