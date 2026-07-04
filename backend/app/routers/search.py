"""Global search (M4) — substring match across all modules, RBAC-scoped."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser
from app.db import get_db
from app.models import SearchResult, User

router = APIRouter(tags=["search"])

DB = Annotated[Any, Depends(get_db)]

LIMIT = 15


def _match(q: str, *fields: str | None) -> bool:
    return any(q in (f or "").lower() for f in fields)


@router.get("/search", response_model=list[SearchResult])
async def global_search(
    db: DB, user: CurrentUser, q: Annotated[str, Query(min_length=2)]
) -> list[SearchResult]:
    q = q.strip().lower()
    cid = user.community_id
    results: list[SearchResult] = []

    def add(category: str, title: str, subtitle: str, href: str) -> None:
        if len(results) < LIMIT:
            results.append(
                SearchResult(category=category, title=title, subtitle=subtitle, href=href)
            )

    for a in await db.apartments.find({"community_id": cid}).to_list(1000):
        if _match(q, a["number"], f"apartment {a['number']}"):
            add("Apartment", f"Apartment {a['number']}", f"Floor {a['floor']}", "/community")

    for u in await db.users.find({"community_id": cid}).to_list(1000):
        if _match(q, u["name"], u["email"]):
            add("Member", u["name"], u["role"].replace("_", " "), "/community")

    for v in await db.vendors.find({"community_id": cid}).to_list(1000):
        if _match(q, v["name"], v["service"]):
            add("Vendor", v["name"], v["service"], "/vendors")

    invoice_query: dict = {"community_id": cid}
    if user.role in ("owner", "tenant") and user.apartment_id:
        invoice_query["apartment_id"] = user.apartment_id
    for i in await db.invoices.find(invoice_query).to_list(10000):
        if _match(q, i["description"], i["period"], i["status"]):
            add(
                "Invoice",
                f"{i['description']} — {i['period']}",
                f"Apt {i['apartment_id'].replace('apt-', '')} · {i['status']}",
                "/invoices",
            )

    for w in await db.work_orders.find({"community_id": cid}).to_list(1000):
        if _match(q, w["title"], w["description"], w["stage"]):
            add("Work Order", w["title"], w["stage"], f"/work-orders/{w['id']}")

    for d in await db.documents.find({"community_id": cid}).to_list(1000):
        if _match(q, d["title"], d["category"]):
            add("Document", d["title"], d["category"], "/documents")

    for m in await db.meetings.find({"community_id": cid}).to_list(1000):
        if _match(q, m["title"], *m.get("agenda", []), *m.get("resolutions", [])):
            add("Minutes", m["title"], m["date"], "/meetings")

    for e in await db.expenses.find({"community_id": cid}).to_list(1000):
        if _match(q, e["description"], e["category"]):
            add("Expense", e["description"], e["category"], "/community")

    for p in await db.feed_posts.find({"community_id": cid}).to_list(1000):
        if _match(q, p["text"]):
            add("Feed", p["text"][:60], p["type"], "/feed")

    return results
