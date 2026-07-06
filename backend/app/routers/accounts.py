"""Accounts — billing/portal entities owning one or more apartments (Raj's
domain model). Read endpoint powering per-client filtering in manager views."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.security import require_roles
from app.db import get_db
from app.models import Account, User

router = APIRouter(prefix="/accounts", tags=["accounts"])

DB = Annotated[Any, Depends(get_db)]
Viewer = require_roles("property_manager", "community_admin", "auditor")


@router.get("", response_model=list[Account])
async def list_accounts(
    db: DB, user: Annotated[User, Depends(Viewer)]
) -> list[Account]:
    docs = await db.accounts.find({"community_id": user.community_id}).to_list(1000)
    docs.sort(key=lambda d: d["name"])
    return [Account.model_validate(d) for d in docs]


from fastapi import HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser
from app.models import AccountCreate, AccountUpdate, LegalOwner, LegalOwnerCreate, LegalOwnerUpdate

SuperAdmin = Depends(require_roles())  # super_admin only


async def _validate_apartments(db, user, apartment_ids, exclude_account=None):
    known = {a["id"] for a in await db.apartments.find(
        {"community_id": user.community_id}).to_list(1000)}
    unknown = [a for a in apartment_ids if a not in known]
    if unknown:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Unknown apartments: {unknown}")
    # BOOTSTRAP: one apartment has ONE primary billing account.
    query = {"community_id": user.community_id, "apartment_ids": {"$in": apartment_ids}}
    if exclude_account:
        query["id"] = {"$ne": exclude_account}
    clash = await db.accounts.find_one(query)
    if clash:
        taken = sorted(set(apartment_ids) & set(clash["apartment_ids"]))
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Apartment(s) {taken} already belong to account '{clash['name']}'",
        )


@router.post("", response_model=Account, status_code=status.HTTP_201_CREATED,
             dependencies=[SuperAdmin])
async def create_account(body: AccountCreate, db: DB, user: CurrentUser) -> Account:
    await _validate_apartments(db, user, body.apartment_ids)
    account = Account(community_id=user.community_id, **body.model_dump())
    await db.accounts.insert_one(account.model_dump())
    await record_audit(db, user, "create", "accounts", account.id, {"name": body.name})
    return account


@router.patch("/{account_id}", response_model=Account, dependencies=[SuperAdmin])
async def update_account(
    account_id: str, body: AccountUpdate, db: DB, user: CurrentUser
) -> Account:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if "apartment_ids" in updates:
        await _validate_apartments(db, user, updates["apartment_ids"],
                                   exclude_account=account_id)
    result = await db.accounts.find_one_and_update(
        {"id": account_id, "community_id": user.community_id},
        {"$set": updates}, return_document=True)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Account not found")
    await record_audit(db, user, "update", "accounts", account_id, updates)
    return Account.model_validate(result)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[SuperAdmin])
async def delete_account(account_id: str, db: DB, user: CurrentUser) -> None:
    linked = await db.users.find_one({"account_id": account_id})
    if linked:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Portal user '{linked['name']}' is linked — unlink first")
    result = await db.accounts.delete_one(
        {"id": account_id, "community_id": user.community_id})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Account not found")
    await record_audit(db, user, "delete", "accounts", account_id)


# ---------- Legal owners (title holders, separate from billing) ----------


@router.get("/legal-owners", response_model=list[LegalOwner])
async def list_legal_owners(
    db: DB, user: Annotated[User, Depends(Viewer)]
) -> list[LegalOwner]:
    docs = await db.legal_owners.find({"community_id": user.community_id}).to_list(1000)
    docs.sort(key=lambda d: (d["apartment_id"], d["name"]))
    return [LegalOwner.model_validate(d) for d in docs]


@router.post("/legal-owners", response_model=LegalOwner,
             status_code=status.HTTP_201_CREATED, dependencies=[SuperAdmin])
async def create_legal_owner(
    body: LegalOwnerCreate, db: DB, user: CurrentUser
) -> LegalOwner:
    apt = await db.apartments.find_one(
        {"id": body.apartment_id, "community_id": user.community_id})
    if apt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    owner = LegalOwner(community_id=user.community_id, **body.model_dump())
    await db.legal_owners.insert_one(owner.model_dump())
    await record_audit(db, user, "create", "legal_owners", owner.id, {"name": body.name})
    return owner


@router.patch("/legal-owners/{owner_id}", response_model=LegalOwner,
              dependencies=[SuperAdmin])
async def update_legal_owner(
    owner_id: str, body: LegalOwnerUpdate, db: DB, user: CurrentUser
) -> LegalOwner:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = await db.legal_owners.find_one_and_update(
        {"id": owner_id, "community_id": user.community_id},
        {"$set": updates}, return_document=True)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Legal owner not found")
    await record_audit(db, user, "update", "legal_owners", owner_id, updates)
    return LegalOwner.model_validate(result)


@router.delete("/legal-owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[SuperAdmin])
async def delete_legal_owner(owner_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.legal_owners.delete_one(
        {"id": owner_id, "community_id": user.community_id})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Legal owner not found")
    await record_audit(db, user, "delete", "legal_owners", owner_id)
