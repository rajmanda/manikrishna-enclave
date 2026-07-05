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
