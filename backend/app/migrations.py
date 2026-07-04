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


async def _m002_backfill_m3_collections(db: Any) -> None:
    # Databases seeded before M3 lack feed/maintenance data; seed_m3 is
    # idempotent (no-op unless those collections are empty).
    from app.seed import seed_m3

    await seed_m3(db)


async def _m003_backfill_m4_collections(db: Any) -> None:
    from app.seed import seed_m4

    await seed_m4(db)


async def _m004_user_roles_list(db: Any) -> None:
    users = await db.users.find({"roles": {"$exists": False}}).to_list(10000)
    for u in users:
        await db.users.update_one(
            {"id": u["id"]}, {"$set": {"roles": [u["role"]]}}
        )


MIGRATIONS: list[tuple[int, Callable[[Any], Awaitable[None]]]] = [
    (1, _m001_community_monthly_maintenance),
    (2, _m002_backfill_m3_collections),
    (3, _m003_backfill_m4_collections),
    (4, _m004_user_roles_list),
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
