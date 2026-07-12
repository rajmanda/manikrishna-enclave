"""Authentication and role-based access control.

Flow: the frontend obtains a Google ID token (Google Identity Services) and
posts it to /auth/google. We verify it against our OAuth client ID, then look
the email up in the users collection — that collection IS the whitelist:
unknown Google accounts get 403. Successful logins receive an app JWT that
carries the user id; every request re-loads the user so role/whitelist
changes take effect immediately.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import get_settings
from app.db import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def verify_google_id_token(token: str) -> dict[str, Any]:
    """Verify a Google ID token and return its claims (email, name, ...)."""
    settings = get_settings()
    try:
        claims = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token"
        ) from exc
    if not claims.get("email_verified", False):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Google email not verified"
        )
    return claims


def create_access_token(user: User, acting_community_id: str | None = None) -> str:
    """`community_id` always carries the user's HOME community (the users
    collection is keyed on it); `act_cid` optionally carries the owned
    community a super admin is currently managing."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "community_id": user.community_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    if acting_community_id:
        payload["act_cid"] = acting_community_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[Any, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc

    doc = await db.users.find_one({
        "id": payload.get("sub"),
        "community_id": payload.get("community_id")
    })
    if doc is None:
        # User removed from the whitelist since the token was issued.
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access revoked")

    # Resolve apartment_ids from the Account entity for multi-apartment support.
    user = User.model_validate(doc)
    if user.account_id:
        account = await db.accounts.find_one({"id": user.account_id})
        if account:
            user.apartment_ids = account.get("apartment_ids", [])
            # Keep apartment_id in sync: use first apartment if not explicitly set.
            if not user.apartment_id and user.apartment_ids:
                user.apartment_id = user.apartment_ids[0]
    elif user.apartment_id:
        # Legacy fallback: no account, but has a single apartment_id.
        user.apartment_ids = [user.apartment_id]

    # Community switching: a super admin's token may carry an acting
    # community. Re-validate ownership on every request (revocation-safe),
    # then act as that community while keeping the home community owned.
    acting = payload.get("act_cid")
    if (
        acting
        and acting != user.community_id
        and user.role == "super_admin"
        and acting in user.community_ids
    ):
        user.community_ids = list(
            dict.fromkeys([user.community_id, *user.community_ids])
        )
        user.community_id = acting

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str):
    """Dependency factory: allow only the given roles (super_admin always)."""

    async def checker(user: CurrentUser) -> User:
        if user.role != "super_admin" and user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}",
            )
        return user

    return checker


def owned_community_ids(user: User) -> list[str]:
    """Communities this user may administer: home community + owned list.

    For non-super-admins this is always just their own community. Super
    admins get their portfolio — but never other super admins' communities.
    """
    return list(dict.fromkeys([user.community_id, *user.community_ids]))


def scoped_community_id(user: User, requested: str | None = None) -> str:
    """Tenant isolation: non-super-admins are locked to their own community.
    Super admins may request another community only if they own it."""
    if user.role == "super_admin" and requested:
        if requested not in owned_community_ids(user):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Not an owner of this community",
            )
        return requested
    return user.community_id


# ---------- OpenClaw (WhatsApp agent) authentication ----------


async def verify_openclaw_key(
    x_api_key: Annotated[str | None, Header()] = None,
) -> str:
    """Verify the OpenClaw polling agent's API key (X-API-Key header)."""
    settings = get_settings()
    if not settings.openclaw_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenClaw integration not configured",
        )
    if not x_api_key or x_api_key != settings.openclaw_api_key:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Invalid API key"
        )
    return x_api_key

