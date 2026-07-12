"""Guided community setup (Setup Assistant).

Turns the four-concept dance (apartments -> accounts -> users -> legal
owners) into one batch call per flat, so the admin only ever thinks in
"flats and the people in them". Households are Accounts underneath.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import (
    WRITE_ROLES,
    Account,
    LegalOwner,
    SetupResident,
    SetupResidentResult,
    SetupStatus,
    User,
)

router = APIRouter(prefix="/setup", tags=["setup"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))


@router.get(
    "/status",
    response_model=SetupStatus,
    dependencies=[Depends(require_roles(*WRITE_ROLES, "auditor"))],
)
async def setup_status(db: DB, user: CurrentUser) -> SetupStatus:
    cid = user.community_id
    apartments = await db.apartments.count_documents({"community_id": cid})
    accounts = await db.accounts.find({"community_id": cid}).to_list(length=1000)
    covered: set[str] = set()
    for a in accounts:
        covered.update(a.get("apartment_ids", []))
    return SetupStatus(
        apartments=apartments,
        households=len(accounts),
        flats_with_household=len(covered),
        owners=await db.users.count_documents({"community_id": cid, "role": "owner"}),
        tenants=await db.users.count_documents({"community_id": cid, "role": "tenant"}),
        managers=await db.users.count_documents(
            {"community_id": cid, "role": {"$in": ["property_manager", "community_admin"]}}
        ),
    )


async def _unique_household_name(db: Any, cid: str, name: str, apt_number: str) -> str:
    """Household (account) names are unique per community — disambiguate
    with the flat number when two owners share a name."""
    if await db.accounts.find_one({"community_id": cid, "name": name}) is None:
        return name
    return f"{name} ({apt_number})"


async def _setup_flat(db: Any, actor: User, row: SetupResident) -> SetupResidentResult:
    cid = actor.community_id

    apartment = await db.apartments.find_one(
        {"id": row.apartment_id, "community_id": cid}
    )
    if apartment is None:
        return SetupResidentResult(
            apartment_id=row.apartment_id, ok=False, error="Flat not found"
        )
    if await db.accounts.find_one({"community_id": cid, "apartment_ids": row.apartment_id}):
        return SetupResidentResult(
            apartment_id=row.apartment_id, ok=False,
            error="Flat already belongs to a household",
        )
    owner_email = row.owner_email.lower()
    if await db.users.find_one({"community_id": cid, "email": owner_email}):
        return SetupResidentResult(
            apartment_id=row.apartment_id, ok=False,
            error=f"{owner_email} is already a member of this community",
        )
    tenant_email = row.tenant_email.lower() if row.tenant_email else None
    if tenant_email:
        if tenant_email == owner_email:
            return SetupResidentResult(
                apartment_id=row.apartment_id, ok=False,
                error="Owner and tenant emails must differ",
            )
        if await db.users.find_one({"community_id": cid, "email": tenant_email}):
            return SetupResidentResult(
                apartment_id=row.apartment_id, ok=False,
                error=f"{tenant_email} is already a member of this community",
            )

    account = Account(
        community_id=cid,
        name=await _unique_household_name(db, cid, row.owner_name.strip(), apartment["number"]),
        apartment_ids=[row.apartment_id],
    )
    await db.accounts.insert_one(account.model_dump())
    await record_audit(db, actor, "create", "accounts", account.id)

    owner = User(
        community_id=cid,
        name=row.owner_name.strip(),
        email=owner_email,
        role="owner",
        account_id=account.id,
        apartment_id=row.apartment_id,
        phone=row.owner_phone,
    )
    await db.users.insert_one(owner.model_dump())
    await record_audit(db, actor, "create", "users", owner.id, {"email": owner_email})

    legal = LegalOwner(
        community_id=cid,
        apartment_id=row.apartment_id,
        name=row.owner_name.strip(),
        ownership_percentage=100.0,
    )
    await db.legal_owners.insert_one(legal.model_dump())
    await record_audit(db, actor, "create", "legal_owners", legal.id)

    if tenant_email:
        tenant = User(
            community_id=cid,
            name=(row.tenant_name or "Tenant").strip(),
            email=tenant_email,
            role="tenant",
            apartment_id=row.apartment_id,
        )
        await db.users.insert_one(tenant.model_dump())
        await record_audit(db, actor, "create", "users", tenant.id, {"email": tenant_email})

    return SetupResidentResult(apartment_id=row.apartment_id, ok=True)


@router.post(
    "/residents",
    response_model=list[SetupResidentResult],
    dependencies=[Writer],
)
async def setup_residents(
    rows: list[SetupResident], db: DB, user: CurrentUser
) -> list[SetupResidentResult]:
    """Batch: for each flat create household + owner (+ tenant) + legal
    title record. Rows are independent — one failure never blocks the rest."""
    return [await _setup_flat(db, user, row) for row in rows]
