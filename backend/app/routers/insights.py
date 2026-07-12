"""Platform insights — the super-admin "CEO dashboard" rollup.

Adoption (whitelisted → logged in → active), engagement (audit activity,
feature usage), and financial pulse across the caller's owned communities.
Strictly portfolio-scoped: independent super admins never see each other's
numbers.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, owned_community_ids, require_roles
from app.db import get_db

router = APIRouter(prefix="/insights", tags=["insights"])

DB = Annotated[Any, Depends(get_db)]

# audit_log.entity → dashboard module label. Unlisted entities fold into Other.
MODULE_LABELS = {
    "invoices": "Invoices",
    "payments": "Payments",
    "expenses": "Expenses",
    "reserve_fund": "Reserve Fund",
    "work_orders": "Work Orders",
    "maintenance": "Maintenance",
    "vendors": "Vendors",
    "feed": "Feed",
    "polls": "Polls",
    "documents": "Documents",
    "meetings": "Meetings",
    "users": "Members",
}


@router.get("/platform", dependencies=[Depends(require_roles())])  # super_admin only
async def platform_insights(db: DB, user: CurrentUser) -> dict:
    cids = owned_community_ids(user)
    now = datetime.now(timezone.utc)
    cutoff7 = (now - timedelta(days=7)).isoformat()
    cutoff30 = (now - timedelta(days=30)).isoformat()

    communities, users, invoices, recent_audit = await asyncio.gather(
        db.communities.find({"id": {"$in": cids}}).to_list(1000),
        db.users.find({"community_id": {"$in": cids}}).to_list(10000),
        db.invoices.find(
            {"community_id": {"$in": cids}, "ledger": {"$in": [None, "community"]}}
        ).to_list(100000),
        db.audit_log.find(
            {"community_id": {"$in": cids}, "timestamp": {"$gte": cutoff30}}
        ).to_list(100000),
    )
    community_names = {c["id"]: c["name"] for c in communities}

    apartment_counts = dict(
        zip(
            cids,
            await asyncio.gather(
                *(db.apartments.count_documents({"community_id": c}) for c in cids)
            ),
        )
    )

    # ---- Adoption: whitelisted → ever logged in → active 30d → active 7d
    activated = [u for u in users if u.get("last_login")]
    active30 = [u for u in activated if u["last_login"] >= cutoff30]
    active7 = [u for u in activated if u["last_login"] >= cutoff7]

    roles: dict[str, dict[str, int]] = {}
    for u in users:
        r = roles.setdefault(u.get("role", "owner"), {"count": 0, "activated": 0})
        r["count"] += 1
        if u.get("last_login"):
            r["activated"] += 1

    # ---- Engagement: daily audit activity for the last 30 days
    days = [(now - timedelta(days=i)).date().isoformat() for i in range(29, -1, -1)]
    actions_by_day = {d: 0 for d in days}
    users_by_day: dict[str, set[str]] = {d: set() for d in days}
    module_counts: dict[str, int] = {}
    for entry in recent_audit:
        day = entry["timestamp"][:10]
        if day in actions_by_day:
            actions_by_day[day] += 1
            users_by_day[day].add(entry["user_id"])
        label = MODULE_LABELS.get(entry["entity"], "Other")
        module_counts[label] = module_counts.get(label, 0) + 1
    activity_series = [
        {"date": d, "actions": actions_by_day[d], "activeUsers": len(users_by_day[d])}
        for d in days
    ]

    # ---- Financial pulse (community ledger only — fee/reimbursement money
    # is the manager's, not the platform story)
    billed_by_cid: dict[str, float] = {c: 0.0 for c in cids}
    collected_by_cid: dict[str, float] = {c: 0.0 for c in cids}
    for inv in invoices:
        billed_by_cid[inv["community_id"]] += inv["amount"]
        collected_by_cid[inv["community_id"]] += inv.get("paid_amount", 0)

    last_activity_by_cid: dict[str, str] = {}
    for entry in recent_audit:
        cid = entry["community_id"]
        if entry["timestamp"] > last_activity_by_cid.get(cid, ""):
            last_activity_by_cid[cid] = entry["timestamp"]

    community_rows = []
    for c in sorted(communities, key=lambda c: c["name"]):
        cid = c["id"]
        c_users = [u for u in users if u["community_id"] == cid]
        c_activated = [u for u in c_users if u.get("last_login")]
        billed = billed_by_cid.get(cid, 0)
        community_rows.append(
            {
                "id": cid,
                "name": c["name"],
                "apartments": apartment_counts.get(cid, 0),
                "users": len(c_users),
                "activatedUsers": len(c_activated),
                "active7d": sum(1 for u in c_activated if u["last_login"] >= cutoff7),
                "actions30d": sum(
                    1 for e in recent_audit if e["community_id"] == cid
                ),
                "lastActivity": last_activity_by_cid.get(cid),
                "billed": billed,
                "collected": collected_by_cid.get(cid, 0),
                "collectionRate": round(
                    collected_by_cid.get(cid, 0) / billed * 100
                )
                if billed
                else 0,
            }
        )

    adoption_rows = sorted(
        (
            {
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "role": u.get("role", "owner"),
                "communityId": u["community_id"],
                "communityName": community_names.get(
                    u["community_id"], u["community_id"]
                ),
                "lastLogin": u.get("last_login"),
                "loginCount": u.get("login_count", 0),
            }
            for u in users
        ),
        key=lambda r: (r["lastLogin"] or "", r["name"]),
        reverse=True,
    )

    total_billed = sum(billed_by_cid.values())
    total_collected = sum(collected_by_cid.values())
    return {
        "generatedAt": now.isoformat(),
        "totals": {
            "communities": len(communities),
            "apartments": sum(apartment_counts.values()),
            "users": len(users),
            "activatedUsers": len(activated),
            "active7d": len(active7),
            "active30d": len(active30),
            "actions30d": len(recent_audit),
            "logins": sum(u.get("login_count", 0) for u in users),
            "billed": total_billed,
            "collected": total_collected,
            "collectionRate": round(total_collected / total_billed * 100)
            if total_billed
            else 0,
        },
        "funnel": [
            {"stage": "Whitelisted", "count": len(users)},
            {"stage": "Logged in ever", "count": len(activated)},
            {"stage": "Active last 30d", "count": len(active30)},
            {"stage": "Active last 7d", "count": len(active7)},
        ],
        "roles": [
            {"role": role, **counts}
            for role, counts in sorted(
                roles.items(), key=lambda kv: kv[1]["count"], reverse=True
            )
        ],
        "activitySeries": activity_series,
        "moduleUsage": sorted(
            ({"module": m, "actions": n} for m, n in module_counts.items()),
            key=lambda r: r["actions"],
            reverse=True,
        ),
        "communities": community_rows,
        "userAdoption": adoption_rows,
    }
