"""Growth Center authorization.

Only the platform-level `super_admin` role may use the module. Authentication
itself is delegated to the application's server-side mechanism
(app.core.security.get_current_user) — the ONLY approved dependency on the
operational application. The role is re-loaded from the whitelist on every
request there, so a role claimed by the browser is never trusted.
"""

from typing import Annotated, Any

from fastapi import Depends, HTTPException, status

from app.core.security import CurrentUser


async def require_super_admin(user: CurrentUser) -> Any:
    if user.role != "super_admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Growth Center is restricted to platform super admins",
        )
    return user


SuperAdmin = Annotated[Any, Depends(require_super_admin)]
