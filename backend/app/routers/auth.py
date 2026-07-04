from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import (
    CurrentUser,
    create_access_token,
    verify_google_id_token,
)
from app.db import get_db
from app.audit import record_audit
from app.models import (
    DevLoginRequest,
    GoogleLoginRequest,
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
    if body.role == "owner" and not user.apartment_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Owner view needs an apartment assigned to your account",
        )
    doc = await db.users.find_one_and_update(
        {"id": user.id}, {"$set": {"role": body.role}}, return_document=True
    )
    updated = User.model_validate(doc)
    await record_audit(db, user, "update", "users", user.id, {"active_role": body.role})
    return TokenResponse(access_token=create_access_token(updated), user=updated)
