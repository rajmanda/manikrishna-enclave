"""Audit log — every modification is recorded (PRD security requirement)."""

from datetime import datetime, timezone
from typing import Any

from app.models import AuditEntry, User


async def record_audit(
    db: Any,
    user: User,
    action: str,
    entity: str,
    entity_id: str,
    details: dict | None = None,
) -> None:
    entry = AuditEntry(
        community_id=user.community_id,
        user_id=user.id,
        user_name=user.name,
        action=action,
        entity=entity,
        entity_id=entity_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        details=details or {},
    )
    await db.audit_log.insert_one(entry.model_dump())
