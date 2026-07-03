from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import (
    CurrentUser,
    create_access_token,
    verify_google_id_token,
)
from app.db import get_db
from app.models import DevLoginRequest, GoogleLoginRequest, TokenResponse, User

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
