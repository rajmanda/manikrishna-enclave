"""Versioned schema migrations, applied at startup.

Convention: append a (version, coroutine) pair to MIGRATIONS — never edit or
reorder existing entries. The current schema version lives in the `meta`
collection ({"id": "schema", "version": N}). Document changes in
docs/DATABASE.md.
"""

import logging
from typing import Any, Awaitable, Callable

logger = logging.getLogger("communityhub")


async def _m001_community_monthly_maintenance(db: Any) -> None:
    await db.communities.update_many(
        {"monthly_maintenance": {"$exists": False}},
        {"$set": {"monthly_maintenance": 3500}},
    )


MIGRATIONS: list[tuple[int, Callable[[Any], Awaitable[None]]]] = [
    (1, _m001_community_monthly_maintenance),
]


async def run_migrations(db: Any) -> None:
    meta = await db.meta.find_one({"id": "schema"})
    current = meta["version"] if meta else 0
    for version, migration in MIGRATIONS:
        if version > current:
            await migration(db)
            await db.meta.update_one(
                {"id": "schema"}, {"$set": {"version": version}}, upsert=True
            )
            logger.info("Applied migration %03d", version)
