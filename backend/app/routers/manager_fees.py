"""Manager service fees — a private ledger between individual owners and the
property manager. Same invoice/payment/confirmation flow as community money,
but NEVER mixed into community aggregates (ledger="manager_fee")."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    FeeEnrollment,
    FeeEnrollmentsUpdate,
    FeeGenerateRequest,
    Invoice,
)
from app.routers.invoices import compute_status

router = APIRouter(prefix="/manager-fees", tags=["manager-fees"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

FEE_DESCRIPTION = "Manager Service Fee"


@router.get("/enrollments", response_model=list[FeeEnrollment], dependencies=[Writer])
async def list_enrollments(db: DB, user: CurrentUser) -> list[FeeEnrollment]:
    docs = await db.fee_enrollments.find(
        {"community_id": user.community_id}
    ).to_list(1000)
    docs.sort(key=lambda d: d["apartment_id"])
    return [FeeEnrollment.model_validate(d) for d in docs]


@router.put("/enrollments", response_model=list[FeeEnrollment], dependencies=[Writer])
async def replace_enrollments(
    body: FeeEnrollmentsUpdate, db: DB, user: CurrentUser
) -> list[FeeEnrollment]:
    apt_ids = [e.apartment_id for e in body.enrollments]
    if len(apt_ids) != len(set(apt_ids)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Duplicate apartment")
    known = {
        a["id"] for a in await db.apartments.find(
            {"community_id": user.community_id}
        ).to_list(1000)
    }
    unknown = [a for a in apt_ids if a not in known]
    if unknown:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"Unknown apartments: {unknown}"
        )
    await db.fee_enrollments.delete_many({"community_id": user.community_id})
    if body.enrollments:
        await db.fee_enrollments.insert_many(
            [{"community_id": user.community_id, **e.model_dump()} for e in body.enrollments]
        )
    await record_audit(
        db, user, "update", "fee_enrollments", user.community_id,
        {"count": len(body.enrollments)},
    )
    return body.enrollments


@router.post("/generate", dependencies=[Writer])
async def generate_fee_invoices(
    body: FeeGenerateRequest, db: DB, user: CurrentUser
) -> dict:
    """One fee invoice per ACTIVE enrollment, at that apartment's own amount.
    Idempotent per period."""
    enrollments = await db.fee_enrollments.find(
        {"community_id": user.community_id, "active": True}
    ).to_list(1000)
    if not enrollments:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="No active fee enrollments configured"
        )
    created = 0
    for e in enrollments:
        exists = await db.invoices.find_one(
            {
                "community_id": user.community_id,
                "apartment_id": e["apartment_id"],
                "period": body.period,
                "description": FEE_DESCRIPTION,
            }
        )
        if exists:
            continue
        invoice = Invoice(
            community_id=user.community_id,
            apartment_id=e["apartment_id"],
            period=body.period,
            description=FEE_DESCRIPTION,
            amount=e["amount"],
            due_date=body.due_date,
            status=compute_status(e["amount"], 0, body.due_date),
            ledger="manager_fee",
        )
        await db.invoices.insert_one(invoice.model_dump())
        created += 1
    await record_audit(
        db, user, "create", "invoices", f"fees:{body.period}", {"created": created}
    )
    return {"created": created, "skipped": len(enrollments) - created}
