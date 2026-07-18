"""Dedicated MongoDB connection for the Growth Center.

Separate Motor client + database from the operational app (app/db.py). If
GROWTH_CENTER_MONGO_URI is not configured the dependency fails with 503 —
it must never fall back to the operational connection.

Collections are prefixed with `growth_`:
  growth_playbooks, growth_templates, growth_personas, growth_audit_log
"""

from typing import Any

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient

from app.growth_center.config import get_growth_settings

_client: AsyncIOMotorClient | None = None
_db: Any = None


def connect() -> Any:
    """Connect lazily on first use. Raises if the module is unconfigured."""
    global _client, _db
    settings = get_growth_settings()
    if not settings.growth_center_mongo_uri:
        raise RuntimeError("GROWTH_CENTER_MONGO_URI is not configured")
    _client = AsyncIOMotorClient(
        settings.growth_center_mongo_uri, serverSelectionTimeoutMS=5000
    )
    _db = _client[settings.growth_center_db_name]
    return _db


def disconnect() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_growth_db() -> Any:
    """FastAPI dependency. 503 when the module is unconfigured — never a
    fallback to the operational database."""
    global _db
    if _db is None:
        try:
            connect()
        except RuntimeError as exc:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Growth Center storage is not configured. Set "
                    "GROWTH_CENTER_MONGO_URI to a dedicated database. "
                    "The module never uses the operational database."
                ),
            ) from exc
    return _db


async def ensure_growth_indexes(db: Any) -> None:
    await db.growth_playbooks.create_index([("status", 1), ("updated_at", -1)])
    await db.growth_templates.create_index([("playbook_id", 1), ("funnel_stage", 1)])
    await db.growth_templates.create_index([("status", 1), ("updated_at", -1)])
    await db.growth_audit_log.create_index([("timestamp", -1)])
    await db.growth_leads.create_index([("stage", 1), ("next_follow_up_at", 1)])
    await db.growth_lead_activities.create_index(
        [("lead_id", 1), ("happened_at", -1)]
    )
