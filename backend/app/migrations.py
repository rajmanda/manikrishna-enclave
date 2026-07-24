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


async def _m008_third_party_payments(db: Any) -> None:
    """Backfill payer attribution and invoice responsibility fields.

    Invoices: the owner is stamped as the responsible party, the payment
    request defaults to the owner, occupancy snapshots from the current
    whitelist, and the billing month/year is parsed from `period`.

    Payments/credits: rows reported by a tenant are reclassified as
    tenant-paid-on-behalf-of-owner (payment stays on the SAME owner
    invoice — no new invoices or payments are created, no dates/amounts/
    references touched). Everything else defaults to owner-paid.

    A per-community report of every reclassification (and rows needing
    manual review) is stored in `migration_reports` (id "m008").
    """
    from app.routers.invoices import active_tenants, period_month_year

    users_by_id = {u["id"]: u async for u in db.users.find({})}
    apartments = {a["id"]: a async for a in db.apartments.find({})}
    tenant_maps: dict[str, dict[str, dict]] = {}

    async def tenants_for(cid: str) -> dict[str, dict]:
        if cid not in tenant_maps:
            tenant_maps[cid] = await active_tenants(db, cid)
        return tenant_maps[cid]

    async for inv in db.invoices.find(
        {"responsible_party_type": {"$exists": False}}
    ):
        apt = apartments.get(inv["apartment_id"], {})
        owner_ids = apt.get("owner_ids") or []
        owner_id = owner_ids[0] if owner_ids else None
        tmap = await tenants_for(inv["community_id"])
        month, year = period_month_year(inv.get("period", ""))
        await db.invoices.update_one(
            {"id": inv["id"]},
            {"$set": {
                "responsible_party_type": "owner",
                "responsible_owner_id": owner_id,
                "payment_request_recipient_type": "owner",
                "payment_request_recipient_id": owner_id,
                "apartment_occupancy_status":
                    "rented" if inv["apartment_id"] in tmap else "owner_occupied",
                "billing_period_month": month,
                "billing_period_year": year,
            }},
        )

    report: list[dict] = []
    async for p in db.payments.find({"payer_type": {"$exists": False}}):
        reporter = users_by_id.get(p.get("reported_by") or "")
        apt = apartments.get(p["apartment_id"], {})
        owner_ids = apt.get("owner_ids") or []
        owner = users_by_id.get(owner_ids[0]) if owner_ids else None
        if reporter and (
            reporter.get("role") == "tenant" or "tenant" in (reporter.get("roles") or [])
        ):
            payer_type, payer_id = "tenant", reporter["id"]
            payer_name = reporter["name"]
            needs_review = False
        else:
            # Recorded by a manager or reported by the owner — classified as
            # owner-paid; rows with no reporter can't be verified from data.
            payer_type = "owner"
            payer_id = reporter["id"] if reporter else (owner or {}).get("id")
            payer_name = (reporter or owner or {}).get("name", "")
            needs_review = reporter is None and p.get("method") != "Credit"
        await db.payments.update_one(
            {"id": p["id"]},
            {"$set": {
                "payer_type": payer_type,
                "payer_entity_id": payer_id,
                "payer_name": payer_name,
                "collected_by": None,
                "collection_date": None,
                "deposit_status": "not_required",
                "deposit_date": None,
                "notes": "[m008] payer classification backfilled from reporter",
            }},
        )
        if payer_type != "owner" or needs_review:
            report.append({
                "community_id": p["community_id"],
                "apartment_id": p["apartment_id"],
                "invoice_id": p["invoice_id"],
                "payment_id": p["id"],
                "amount": p["amount"],
                "date": p["date"],
                "previous_classification": "owner (implicit)",
                "updated_classification": payer_type,
                "payer_name": payer_name,
                "needs_manual_review": needs_review,
            })

    async for cr in db.credits.find({"payer_type": {"$exists": False}}):
        funder = users_by_id.get(cr.get("created_by") or "")
        is_tenant = bool(funder) and (
            funder.get("role") == "tenant" or "tenant" in (funder.get("roles") or [])
        )
        await db.credits.update_one(
            {"id": cr["id"]},
            {"$set": {
                "payer_type": "tenant" if is_tenant else "owner",
                "payer_entity_id": funder["id"] if funder else None,
                "payer_name": (funder or {}).get("name", ""),
                "collected_by": None,
                "notes": "[m008] payer classification backfilled from creator",
            }},
        )

    await db.migration_reports.update_one(
        {"id": "m008"},
        {"$set": {"id": "m008", "title": "Third-party payment reclassification",
                  "entries": report}},
        upsert=True,
    )
    logger.info(
        "m008: payer attribution backfilled; %d reclassified/review rows", len(report)
    )


async def _m009_notification_related_refs(db: Any) -> None:
    """Backfill first-class related_type/related_id on notification_queue rows
    from the entity ids historically stored inside payload. Rows whose payload
    carries no entity ref (bulk-period, batch confirms, reason-only rejections)
    stay unlinked and never surface a delivery badge."""
    # cost_case_id is checked before invoice_id: credit rows carry both and
    # must group under the cost case, matching new write-time behavior.
    ref_keys = [
        ("work_order_id", "work_order"),
        ("maintenance_request_id", "maintenance_request"),
        ("expense_id", "expense"),
        ("post_id", "feed_post"),
        ("cost_case_id", "cost_case"),
        ("invoice_id", "invoice"),
    ]
    updated = 0
    async for doc in db.notification_queue.find({"related_id": {"$exists": False}}):
        payload = doc.get("payload") or {}
        related_type = related_id = None
        for key, rtype in ref_keys:
            if payload.get(key):
                related_type, related_id = rtype, payload[key]
                break
        await db.notification_queue.update_one(
            {"_id": doc["_id"]},
            {"$set": {"related_type": related_type, "related_id": related_id}},
        )
        if related_id:
            updated += 1
    logger.info("m009: notification related refs backfilled (%d linked)", updated)


MIGRATIONS: list[tuple[int, Callable[[Any], Awaitable[None]]]] = [
    (1, _m001_community_monthly_maintenance),
    (2, _m002_backfill_m3_collections),
    (3, _m003_backfill_m4_collections),
    (4, _m004_user_roles_list),
    (5, _m005_invoice_ledger),
    (6, _m006_apartment_in_invoice_description),
    (7, _m007_cost_cases_borewell),
    (8, _m008_third_party_payments),
    (9, _m009_notification_related_refs),
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
