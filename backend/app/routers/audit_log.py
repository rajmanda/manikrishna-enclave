"""Audit-log viewer endpoint (M4) — the PRD's transparency backbone."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.security import require_roles
from app.db import get_db
from app.models import AuditEntry, User

router = APIRouter(prefix="/audit-log", tags=["audit"])

DB = Annotated[Any, Depends(get_db)]
Viewer = require_roles("property_manager", "community_admin", "auditor")


@router.get("", response_model=list[AuditEntry])
async def list_audit_entries(
    db: DB, user: Annotated[User, Depends(Viewer)], limit: int = 100
) -> list[AuditEntry]:
    docs = await db.audit_log.find({"community_id": user.community_id}).to_list(5000)
    docs.sort(key=lambda d: d["timestamp"], reverse=True)
    return [AuditEntry.model_validate(d) for d in docs[: min(limit, 500)]]
