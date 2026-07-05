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
    await db.users.create_index("email", unique=True)
    await db.users.create_index("community_id")
    await db.apartments.create_index([("community_id", 1), ("number", 1)], unique=True)
    await db.accounts.create_index("community_id")
    await db.accounts.create_index([("community_id", 1), ("name", 1)], unique=True)
    await db.legal_owners.create_index([("community_id", 1), ("apartment_id", 1)])
    await db.invoices.create_index([("community_id", 1), ("apartment_id", 1)])
    await db.expenses.create_index("community_id")
    await db.work_orders.create_index("community_id")
    await db.audit_log.create_index([("community_id", 1), ("timestamp", -1)])
