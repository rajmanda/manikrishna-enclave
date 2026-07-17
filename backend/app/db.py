"""MongoDB connection management.

The Motor database handle is created once at startup (lifespan in main.py)
and exposed through the `get_db` dependency so tests can override it with an
in-memory mongomock database.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None
_db: Any = None


def connect() -> Any:
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    _db = _client[settings.db_name]
    return _db


def disconnect() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> Any:
    if _db is None:
        raise RuntimeError("Database not connected — connect() must run at startup")
    return _db


async def ensure_indexes(db: Any) -> None:
    # Email is unique PER COMMUNITY, not platform-wide: the same person
    # (e.g. a manager) can hold a membership in several communities, one
    # user doc per community. Drop the legacy global-unique index first.
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass  # already dropped or never existed
    await db.users.create_index(
        [("community_id", 1), ("email", 1)],
        unique=True,
        name="community_email_unique",
    )
    await db.users.create_index("community_id")
    await db.apartments.create_index([("community_id", 1), ("number", 1)], unique=True)
    await db.accounts.create_index("community_id")
    await db.accounts.create_index([("community_id", 1), ("name", 1)], unique=True)
    await db.legal_owners.create_index([("community_id", 1), ("apartment_id", 1)])
    await db.invoices.create_index([("community_id", 1), ("apartment_id", 1)])
    await db.expenses.create_index("community_id")
    await db.work_orders.create_index("community_id")
    await db.audit_log.create_index([("community_id", 1), ("timestamp", -1)])
    # Advance credits — balance lookups are always (community, apartment).
    await db.credits.create_index([("community_id", 1), ("apartment_id", 1)])
    # Notification queue — polling by status/channel, listing by community.
    await db.notification_queue.create_index(
        [("status", 1), ("channel", 1), ("scheduled_at", 1)]
    )
    await db.notification_queue.create_index(
        [("community_id", 1), ("created_at", -1)]
    )
    await db.notification_queue.create_index("notification_id", unique=True)
