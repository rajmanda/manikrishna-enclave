"""Module-specific audit trail, stored inside the Growth Center database
(growth_audit_log). Operational audit records are never copied here and
Growth Center actions never touch the application's audit_log collection."""

from typing import Any

from app.growth_center.models import AuditAction, GrowthAuditEntry


async def record_growth_audit(
    db: Any,
    *,
    action: AuditAction,
    entity_type: str,
    entity_id: str = "",
    entity_title: str = "",
    actor: Any = None,
    detail: str = "",
) -> None:
    entry = GrowthAuditEntry(
        action=action,
        entity_type=entity_type,  # type: ignore[arg-type]
        entity_id=entity_id,
        entity_title=entity_title,
        actor_id=getattr(actor, "id", "") or "",
        actor_email=getattr(actor, "email", "") or "",
        detail=detail,
    )
    await db.growth_audit_log.insert_one(entry.model_dump())
