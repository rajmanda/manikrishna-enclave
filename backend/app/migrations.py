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


async def _m005_invoice_ledger(db: Any) -> None:
    for coll in (db.invoices, db.payments):
        await coll.update_many(
            {"ledger": {"$exists": False}}, {"$set": {"ledger": "community"}}
        )


async def _m006_apartment_in_invoice_description(db: Any) -> None:
    invoices = await db.invoices.find({}).to_list(100000)
    for inv in invoices:
        if "apt" in inv["description"].lower():
            continue
        number = inv["apartment_id"].replace("apt-", "")
        await db.invoices.update_one(
            {"id": inv["id"]},
            {"$set": {"description": f"{inv['description']} - Apt {number}"}},
        )


async def _m007_cost_cases_borewell(db: Any) -> None:
    """Cost-case backfill. (a) Legacy expenses become `posted` (they were
    always real spend). (b) The historical 'Bore well repair work' billing
    drive gets its cost case + a clearly-labeled migrated work order, with
    the 10 assessment invoices linked. NO expense is fabricated — collected
    money is not a spend; the vendor bill is still awaited. Original dates
    and history untouched, links only."""
    from app.models import CostCase, WorkOrder

    await db.expenses.update_many(
        {"status": {"$exists": False}}, {"$set": {"status": "posted"}}
    )

    invoices = await db.invoices.find(
        {
            "description": {"$regex": "^Bore well repair", "$options": "i"},
            "$or": [{"cost_case_id": None}, {"cost_case_id": {"$exists": False}}],
        }
    ).to_list(1000)
    by_community: dict[str, list[dict]] = {}
    for inv in invoices:
        by_community.setdefault(inv["community_id"], []).append(inv)

    for cid, invs in by_community.items():
        existing = await db.cost_cases.find_one(
            {"community_id": cid, "title": "Bore well repair work"}
        )
        if existing:
            case_id = existing["id"]
        else:
            billed = sum(i["amount"] for i in invs)
            first_due = min(i["due_date"] for i in invs)
            case = CostCase(
                community_id=cid,
                title="Bore well repair work",
                description=(
                    "[Migrated] Reconstructed from the July 2026 billing drive. "
                    "Owners were assessed for the repair; the vendor bill is "
                    "still awaited — post the expense to complete reconciliation."
                ),
                approved_budget=billed,  # expected cost = what was assessed
                funding_method="collect_first",
                created_date=first_due,
            )
            wo = WorkOrder(
                community_id=cid,
                title="Bore well repair work",
                description="[Migrated] Work order reconstructed from historical data — no operational timeline was recorded at the time.",
                priority="High",
                stage="Completed",
                estimate=billed,
                reported_date=first_due,
                cost_case_id=case.id,
                timeline=[{
                    "stage": "Completed", "date": first_due,
                    "note": "[Migrated] created from historical billing data",
                }],
            )
            await db.cost_cases.insert_one(case.model_dump())
            await db.work_orders.insert_one(wo.model_dump())
            case_id, wo_id = case.id, wo.id
            await db.invoices.update_many(
                {"id": {"$in": [i["id"] for i in invs]}},
                {"$set": {"cost_case_id": case_id, "work_order_id": wo_id}},
            )
            logger.info(
                "m007: bore well cost case %s created for %s (%d invoices linked)",
                case_id, cid, len(invs),
            )


MIGRATIONS: list[tuple[int, Callable[[Any], Awaitable[None]]]] = [
    (1, _m001_community_monthly_maintenance),
    (2, _m002_backfill_m3_collections),
    (3, _m003_backfill_m4_collections),
    (4, _m004_user_roles_list),
    (5, _m005_invoice_ledger),
    (6, _m006_apartment_in_invoice_description),
    (7, _m007_cost_cases_borewell),
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
