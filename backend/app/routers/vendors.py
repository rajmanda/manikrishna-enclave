from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import WRITE_ROLES, Vendor, VendorCreate, VendorUpdate

router = APIRouter(prefix="/vendors", tags=["vendors"])

DB = Annotated[Any, Depends(get_db)]


@router.get("", response_model=list[Vendor])
async def list_vendors(db: DB, user: CurrentUser) -> list[Vendor]:
    docs = await db.vendors.find({"community_id": user.community_id}).to_list(
        length=1000
    )
    return [Vendor.model_validate(d) for d in docs]


Writer = Depends(require_roles(*WRITE_ROLES))


@router.post(
    "",
    response_model=Vendor,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def create_vendor(body: VendorCreate, db: DB, user: CurrentUser) -> Vendor:
    vendor = Vendor(community_id=user.community_id, **body.model_dump())
    await db.vendors.insert_one(vendor.model_dump())
    await record_audit(db, user, "create", "vendors", vendor.id)
    return vendor


@router.patch("/{vendor_id}", response_model=Vendor, dependencies=[Writer])
async def update_vendor(
    vendor_id: str, body: VendorUpdate, db: DB, user: CurrentUser
) -> Vendor:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = await db.vendors.find_one_and_update(
        {"id": vendor_id, "community_id": user.community_id},
        {"$set": updates},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    await record_audit(db, user, "update", "vendors", vendor_id, updates)
    return Vendor.model_validate(result)


@router.delete(
    "/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer]
)
async def delete_vendor(vendor_id: str, db: DB, user: CurrentUser) -> None:
    active_wo = await db.work_orders.find_one(
        {"community_id": user.community_id, "vendor_id": vendor_id,
         "stage": {"$nin": ["Completed", "Closed"]}}
    )
    if active_wo:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Vendor has open work orders - close them first",
        )
    result = await db.vendors.delete_one(
        {"id": vendor_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    await record_audit(db, user, "delete", "vendors", vendor_id)
