from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import (
    CurrentUser,
    create_access_token,
    owned_community_ids,
    verify_google_id_token,
)
from app.db import get_db
from app.audit import record_audit
from app.models import (
    DevLoginRequest,
    GoogleLoginRequest,
    SwitchCommunityRequest,
    SwitchRoleRequest,
    TokenResponse,
    User,
)

router = APIRouter(prefix="/auth", tags=["auth"])

DB = Annotated[Any, Depends(get_db)]


async def _login_by_email(db: Any, email: str) -> TokenResponse:
    doc = await db.users.find_one({"email": email.lower()})
    if doc is None:
        # Whitelist enforcement: unknown Google accounts cannot log in.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="This account is not whitelisted. Contact your property manager.",
        )
    user = User.model_validate(doc)
    # Resolve apartment_ids from Account for multi-apartment support.
    if user.account_id:
        account = await db.accounts.find_one({"id": user.account_id})
        if account:
            user.apartment_ids = account.get("apartment_ids", [])
            if not user.apartment_id and user.apartment_ids:
                user.apartment_id = user.apartment_ids[0]
    elif user.apartment_id:
        user.apartment_ids = [user.apartment_id]
    return TokenResponse(access_token=create_access_token(user), user=user)


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest, db: DB) -> TokenResponse:
    claims = verify_google_id_token(body.id_token)
    return await _login_by_email(db, claims["email"])


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(body: DevLoginRequest, db: DB) -> TokenResponse:
    """DEV ONLY — impersonate a seeded user without Google OAuth."""
    if not get_settings().dev_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return await _login_by_email(db, body.email)


@router.get("/me", response_model=User)
async def me(user: CurrentUser) -> User:
    return user


@router.post("/switch-role", response_model=TokenResponse)
async def switch_role(
    body: SwitchRoleRequest, db: DB, user: CurrentUser
) -> TokenResponse:
    """Dual-role users switch their ACTIVE role server-side, so all RBAC and
    data scoping genuinely follow (e.g. a manager experiencing the owner
    view). The active role persists until switched back."""
    allowed = set(user.roles or [user.role])
    if body.role not in allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=f"Your account cannot act as {body.role}",
        )
    if body.role == "owner" and not user.apartment_id and not user.apartment_ids:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Owner view needs an apartment assigned to your account",
        )
    doc = await db.users.find_one_and_update(
        {"id": user.id, "community_id": user.community_id},
        {"$set": {"role": body.role}},
        return_document=True
    )
    updated = User.model_validate(doc)
    # Resolve apartment_ids from Account.
    if updated.account_id:
        account = await db.accounts.find_one({"id": updated.account_id})
        if account:
            updated.apartment_ids = account.get("apartment_ids", [])
            if not updated.apartment_id and updated.apartment_ids:
                updated.apartment_id = updated.apartment_ids[0]
    elif updated.apartment_id:
        updated.apartment_ids = [updated.apartment_id]
    await record_audit(db, user, "update", "users", user.id, {"active_role": body.role})
    return TokenResponse(access_token=create_access_token(updated), user=updated)


@router.post("/switch-community", response_model=TokenResponse)
async def switch_community(
    body: SwitchCommunityRequest, db: DB, user: CurrentUser
) -> TokenResponse:
    """Super admins step into a community they own: the issued token carries
    the acting community, so every subsequent read AND write operates there.
    Ownership is re-validated on every request in get_current_user."""
    if user.role != "super_admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only super admins switch communities"
        )
    # Load the raw doc: user.community_id may already be an acting override,
    # while the token's community_id claim must always be the HOME community.
    doc = await db.users.find_one({"id": user.id})
    home_user = User.model_validate(doc)
    if body.community_id not in owned_community_ids(home_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Not an owner of this community"
        )
    token = create_access_token(home_user, acting_community_id=body.community_id)
    acting_user = home_user.model_copy(
        update={
            "community_id": body.community_id,
            "community_ids": list(
                dict.fromkeys([home_user.community_id, *home_user.community_ids])
            ),
        }
    )
    await record_audit(
        db, user, "update", "users", user.id,
        {"acting_community": body.community_id},
    )
    return TokenResponse(access_token=token, user=acting_user)
