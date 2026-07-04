"""Maintenance requests (M3) — private (owner + manager only) or community."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    MaintenanceCreate,
    MaintenanceRequest,
    MaintenanceStatusUpdate,
)
from app.notify import notify_user

router = APIRouter(prefix="/maintenance-requests", tags=["maintenance"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

CREATOR_ROLES = ("owner", "tenant", "property_manager", "community_admin", "super_admin")
MANAGER_ROLES = ("property_manager", "community_admin", "auditor", "super_admin")


@router.get("", response_model=list[MaintenanceRequest])
async def list_requests(db: DB, user: CurrentUser) -> list[MaintenanceRequest]:
    query: dict = {"community_id": user.community_id}
    if user.role not in MANAGER_ROLES:
        # Members see community requests plus their own private ones.
        query["$or"] = [{"visibility": "community"}, {"created_by": user.id}]
    docs = await db.maintenance_requests.find(query).to_list(1000)
    docs.sort(key=lambda d: d["created_date"], reverse=True)
    return [MaintenanceRequest.model_validate(d) for d in docs]


@router.post("", response_model=MaintenanceRequest, status_code=status.HTTP_201_CREATED)
async def create_request(
    body: MaintenanceCreate, db: DB, user: CurrentUser
) -> MaintenanceRequest:
    if user.role not in CREATOR_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Read-only role")
    request = MaintenanceRequest(
        community_id=user.community_id,
        created_by=user.id,
        created_date=date.today().isoformat(),
        **body.model_dump(),
    )
    await db.maintenance_requests.insert_one(request.model_dump())
    await record_audit(db, user, "create", "maintenance_requests", request.id)
    # Tell the property manager(s) directly.
    managers = await db.users.find(
        {"community_id": user.community_id, "role": "property_manager"}
    ).to_list(100)
    for m in managers:
        if m["id"] != user.id:
            await notify_user(
                db, user.community_id, m["id"],
                f"New maintenance request: {request.title}", "work_order",
                href="/maintenance",
            )
    return request


@router.patch(
    "/{request_id}/status", response_model=MaintenanceRequest, dependencies=[Writer]
)
async def update_status(
    request_id: str, body: MaintenanceStatusUpdate, db: DB, user: CurrentUser
) -> MaintenanceRequest:
    result = await db.maintenance_requests.find_one_and_update(
        {"id": request_id, "community_id": user.community_id},
        {"$set": {"status": body.status}},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Request not found")
    await record_audit(
        db, user, "update", "maintenance_requests", request_id, {"status": body.status}
    )
    if result["created_by"] != user.id:
        await notify_user(
            db, user.community_id, result["created_by"],
            f"Your request '{result['title']}' is now {body.status}", "work_order",
            href="/maintenance",
        )
    return MaintenanceRequest.model_validate(result)


@router.delete(
    "/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("super_admin"))],
)
async def delete_maintenance_request(
    request_id: str, db: DB, user: CurrentUser
) -> None:
    result = await db.maintenance_requests.delete_one({"id": request_id})
    if result.deleted_count == 0:
         raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Request not found")
    await record_audit(db, user, "delete", "maintenance_requests", request_id)


