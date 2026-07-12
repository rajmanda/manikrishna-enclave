import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.audit import record_audit
from app.core.security import CurrentUser, owned_community_ids, require_roles
from app.db import get_db
from app.models import Community, CommunityCreate, PortfolioCommunityStats

router = APIRouter(prefix="/communities", tags=["communities"])

DB = Annotated[Any, Depends(get_db)]


@router.post(
    "",
    response_model=Community,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles())],  # super_admin only
)
async def create_community(
    body: CommunityCreate, db: DB, user: CurrentUser
) -> Community:
    community = Community(name=body.name, address=body.address)
    await db.communities.insert_one(community.model_dump())
    # The creator owns the new community — it joins their portfolio scope.
    await db.users.update_one(
        {"id": user.id}, {"$addToSet": {"community_ids": community.id}}
    )
    await record_audit(db, user, "create", "communities", community.id)
    return community


@router.get("", response_model=list[Community])
async def list_communities(db: DB, user: CurrentUser) -> list[Community]:
    if user.role == "super_admin":
        docs = await db.communities.find(
            {"id": {"$in": owned_community_ids(user)}}
        ).to_list(length=1000)
    else:
        docs = await db.communities.find({"id": user.community_id}).to_list(length=1)
    return [Community.model_validate(d) for d in docs]


# Mirrors OPEN_STAGES in app.routers.dashboard — stages that count as "open".
OPEN_WORK_ORDER_STAGES = [
    "Reported",
    "Estimate Received",
    "Owner Approval",
    "In Progress",
    "Inspection",
]


async def _community_stats(db: Any, community: dict) -> PortfolioCommunityStats:
    cid = community["id"]
    apartments, invoices, open_wos = await asyncio.gather(
        db.apartments.count_documents({"community_id": cid}),
        db.invoices.find({"community_id": cid}).to_list(length=10000),
        db.work_orders.count_documents(
            {"community_id": cid, "stage": {"$in": OPEN_WORK_ORDER_STAGES}}
        ),
    )
    community_invoices = [
        i for i in invoices if i.get("ledger", "community") == "community"
    ]
    invoiced = sum(i["amount"] for i in community_invoices)
    collected = sum(min(i.get("paid_amount", 0), i["amount"]) for i in community_invoices)
    return PortfolioCommunityStats(
        id=cid,
        name=community["name"],
        address=community.get("address", ""),
        apartment_count=apartments,
        invoiced_total=invoiced,
        collected_total=collected,
        outstanding_total=invoiced - collected,
        collection_rate=round(collected / invoiced * 100, 1) if invoiced else 0.0,
        open_invoices=sum(1 for i in community_invoices if i.get("status") != "paid"),
        open_work_orders=open_wos,
    )


@router.get(
    "/portfolio/stats",
    response_model=list[PortfolioCommunityStats],
    dependencies=[Depends(require_roles())],  # super_admin only
)
async def portfolio_stats(db: DB, user: CurrentUser) -> list[PortfolioCommunityStats]:
    """Per-community health rollup across the caller's portfolio."""
    communities = await db.communities.find(
        {"id": {"$in": owned_community_ids(user)}}
    ).to_list(length=1000)
    return list(
        await asyncio.gather(*(_community_stats(db, c) for c in communities))
    )


@router.get("/{community_id}", response_model=Community)
async def get_community(community_id: str, db: DB, user: CurrentUser) -> Community:
    if community_id not in owned_community_ids(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Different community")
    doc = await db.communities.find_one({"id": community_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Community not found")
    return Community.model_validate(doc)
