"""Growth Center CRM — lead pipeline, follow-up tracker, web discovery.

Same security boundary as the rest of the module: super-admin only, stored
exclusively in the Growth Center database (growth_leads,
growth_lead_activities). Leads here are the operator's SALES prospects for
the platform itself — never operational community members or app leads.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.growth_center.audit import record_growth_audit
from app.growth_center.db import get_growth_db
from app.growth_center.firecrawl import discover_leads, extract_contacts
from app.growth_center.models import (
    ActivityCreate,
    CrmOverview,
    DiscoverRequest,
    DiscoverResponse,
    ExtractContactsRequest,
    ExtractContactsResponse,
    GrowthLead,
    GrowthLeadActivity,
    ImportLeadsRequest,
    ImportLeadsResponse,
    LEAD_STAGES,
    LeadCreate,
    LeadStageChange,
    LeadUpdate,
    now_iso,
)
from app.growth_center.security import SuperAdmin

crm_router = APIRouter(prefix="/crm")

GrowthDB = Annotated[Any, Depends(get_growth_db)]

OPEN_STAGES = [s for s in LEAD_STAGES if s not in ("won", "lost")]


def _today() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


# ------------------------------------------------------------- overview


@crm_router.get("/overview", response_model=CrmOverview)
async def crm_overview(db: GrowthDB, user: SuperAdmin) -> CrmOverview:
    leads = await db.growth_leads.find().to_list(length=5000)
    by_stage = {stage: 0 for stage in LEAD_STAGES}
    overdue = due_today = due_week = unscheduled = 0
    now = _today()
    end_of_today = now.replace(hour=23, minute=59, second=59)
    end_of_week = end_of_today + timedelta(days=7)

    for lead in leads:
        stage = lead.get("stage", "new")
        by_stage[stage] = by_stage.get(stage, 0) + 1
        if stage in OPEN_STAGES:
            due = _parse_dt(lead.get("next_follow_up_at"))
            if due is None:
                unscheduled += 1
            elif due < now.replace(hour=0, minute=0, second=0, microsecond=0):
                overdue += 1
            elif due <= end_of_today:
                due_today += 1
            elif due <= end_of_week:
                due_week += 1

    return CrmOverview(
        total_leads=len(leads),
        by_stage=by_stage,
        open_leads=sum(by_stage.get(s, 0) for s in OPEN_STAGES),
        won_count=by_stage.get("won", 0),
        lost_count=by_stage.get("lost", 0),
        overdue_follow_ups=overdue,
        due_today=due_today,
        due_this_week=due_week,
        unscheduled_open=unscheduled,
    )


# ------------------------------------------------------------- leads CRUD


@crm_router.get("/leads", response_model=list[GrowthLead])
async def list_leads(
    db: GrowthDB,
    user: SuperAdmin,
    stage: str | None = None,
    source: str | None = None,
    area: str | None = None,
    due: str | None = Query(None, pattern="^(overdue|today|week)$"),
    q: str | None = None,
) -> list[GrowthLead]:
    query: dict[str, Any] = {}
    if stage:
        query["stage"] = stage
    if source:
        query["source"] = source
    docs = await db.growth_leads.find(query).to_list(length=5000)

    if area:
        needle = area.lower()
        docs = [d for d in docs if needle in d.get("area", "").lower()]
    if q:
        needle = q.lower()
        docs = [
            d
            for d in docs
            if needle
            in " ".join(
                str(d.get(f, ""))
                for f in ("company", "contact_name", "email", "phone", "notes", "area")
            ).lower()
        ]
    if due:
        now = _today()
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_today = now.replace(hour=23, minute=59, second=59)

        def matches(d: dict[str, Any]) -> bool:
            if d.get("stage") not in OPEN_STAGES:
                return False
            when = _parse_dt(d.get("next_follow_up_at"))
            if when is None:
                return False
            if due == "overdue":
                return when < start_today
            if due == "today":
                return start_today <= when <= end_today
            return end_today < when <= end_today + timedelta(days=7)

        docs = [d for d in docs if matches(d)]

    # Follow-ups due first (oldest due date up), then most recently updated.
    docs.sort(
        key=lambda d: (
            d.get("next_follow_up_at") is None,
            d.get("next_follow_up_at") or "",
            d.get("updated_at", ""),
        )
    )
    return [GrowthLead.model_validate(d) for d in docs]


@crm_router.post(
    "/leads", response_model=GrowthLead, status_code=status.HTTP_201_CREATED
)
async def create_lead(body: LeadCreate, db: GrowthDB, user: SuperAdmin) -> GrowthLead:
    lead = GrowthLead(**body.model_dump(), created_by=user.id)
    await db.growth_leads.insert_one(lead.model_dump())
    await record_growth_audit(
        db,
        action="lead_created",
        entity_type="lead",
        entity_id=lead.id,
        entity_title=lead.company,
        actor=user,
    )
    return lead


async def _get_lead_doc(db: Any, lead_id: str) -> dict[str, Any]:
    doc = await db.growth_leads.find_one({"id": lead_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return doc


@crm_router.get("/leads/{lead_id}", response_model=GrowthLead)
async def get_lead(lead_id: str, db: GrowthDB, user: SuperAdmin) -> GrowthLead:
    return GrowthLead.model_validate(await _get_lead_doc(db, lead_id))


@crm_router.patch("/leads/{lead_id}", response_model=GrowthLead)
async def update_lead(
    lead_id: str, body: LeadUpdate, db: GrowthDB, user: SuperAdmin
) -> GrowthLead:
    doc = await _get_lead_doc(db, lead_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return GrowthLead.model_validate(doc)
    updates["updated_at"] = now_iso()
    await db.growth_leads.update_one({"id": lead_id}, {"$set": updates})
    await record_growth_audit(
        db,
        action="lead_edited",
        entity_type="lead",
        entity_id=lead_id,
        entity_title=updates.get("company", doc.get("company", "")),
        actor=user,
    )
    return GrowthLead.model_validate(await _get_lead_doc(db, lead_id))


@crm_router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: str, db: GrowthDB, user: SuperAdmin) -> None:
    doc = await _get_lead_doc(db, lead_id)
    await db.growth_leads.delete_one({"id": lead_id})
    await db.growth_lead_activities.delete_many({"lead_id": lead_id})
    await record_growth_audit(
        db,
        action="lead_deleted",
        entity_type="lead",
        entity_id=lead_id,
        entity_title=doc.get("company", ""),
        actor=user,
    )


# ------------------------------------------------------------- pipeline


@crm_router.post("/leads/{lead_id}/stage", response_model=GrowthLead)
async def change_stage(
    lead_id: str, body: LeadStageChange, db: GrowthDB, user: SuperAdmin
) -> GrowthLead:
    doc = await _get_lead_doc(db, lead_id)
    old_stage = doc.get("stage", "new")
    updates: dict[str, Any] = {
        "stage": body.stage,
        "stage_changed_at": now_iso(),
        "updated_at": now_iso(),
    }
    if body.stage == "won":
        updates["won_at"] = now_iso()
        updates["next_follow_up_at"] = None
        updates["next_action"] = ""
    elif body.stage == "lost":
        updates["lost_reason"] = body.lost_reason or body.note
        updates["next_follow_up_at"] = None
        updates["next_action"] = ""
    await db.growth_leads.update_one({"id": lead_id}, {"$set": updates})

    activity = GrowthLeadActivity(
        lead_id=lead_id,
        activity_type="stage_change",
        summary=(
            f"{old_stage} → {body.stage}"
            + (f" — {body.note}" if body.note else "")
            + (f" (reason: {body.lost_reason})" if body.lost_reason else "")
        ),
        created_by=user.id,
    )
    await db.growth_lead_activities.insert_one(activity.model_dump())
    await db.growth_leads.update_one(
        {"id": lead_id}, {"$set": {"last_activity_at": now_iso()}}
    )
    await record_growth_audit(
        db,
        action="lead_stage_changed",
        entity_type="lead",
        entity_id=lead_id,
        entity_title=doc.get("company", ""),
        actor=user,
        detail=f"{old_stage} → {body.stage}",
    )
    return GrowthLead.model_validate(await _get_lead_doc(db, lead_id))


# ---------------------------------------------------- follow-up tracker


@crm_router.get("/leads/{lead_id}/activities", response_model=list[GrowthLeadActivity])
async def list_activities(
    lead_id: str, db: GrowthDB, user: SuperAdmin
) -> list[GrowthLeadActivity]:
    await _get_lead_doc(db, lead_id)
    docs = await db.growth_lead_activities.find({"lead_id": lead_id}).to_list(
        length=1000
    )
    docs.sort(key=lambda d: d.get("happened_at", ""), reverse=True)
    return [GrowthLeadActivity.model_validate(d) for d in docs]


@crm_router.post(
    "/leads/{lead_id}/activities",
    response_model=GrowthLeadActivity,
    status_code=status.HTTP_201_CREATED,
)
async def log_activity(
    lead_id: str, body: ActivityCreate, db: GrowthDB, user: SuperAdmin
) -> GrowthLeadActivity:
    doc = await _get_lead_doc(db, lead_id)
    activity = GrowthLeadActivity(
        lead_id=lead_id,
        activity_type=body.activity_type,
        summary=body.summary,
        happened_at=body.happened_at or now_iso(),
        created_by=user.id,
    )
    await db.growth_lead_activities.insert_one(activity.model_dump())

    lead_updates: dict[str, Any] = {
        "last_activity_at": activity.happened_at,
        "updated_at": now_iso(),
    }
    # A first outreach on a fresh lead automatically moves it to "contacted".
    if doc.get("stage") == "new" and body.activity_type in (
        "call",
        "whatsapp",
        "email",
        "linkedin",
        "facebook",
        "meeting",
    ):
        lead_updates["stage"] = "contacted"
        lead_updates["stage_changed_at"] = now_iso()
    if body.next_follow_up_at is not None:
        lead_updates["next_follow_up_at"] = body.next_follow_up_at or None
    if body.next_action is not None:
        lead_updates["next_action"] = body.next_action
    await db.growth_leads.update_one({"id": lead_id}, {"$set": lead_updates})

    await record_growth_audit(
        db,
        action="lead_activity_logged",
        entity_type="lead",
        entity_id=lead_id,
        entity_title=doc.get("company", ""),
        actor=user,
        detail=body.activity_type,
    )
    return activity


# -------------------------------------------------- paste-and-extract

@crm_router.post("/extract-contacts", response_model=ExtractContactsResponse)
async def extract_from_text(
    body: ExtractContactsRequest, db: GrowthDB, user: SuperAdmin
) -> ExtractContactsResponse:
    """Pull phones/emails out of text the operator pasted by hand (e.g. a
    Facebook group post seen in their own browser). Pure local regex — no
    network call, no Firecrawl key needed, nothing stored."""
    phones, emails = extract_contacts(body.text)
    return ExtractContactsResponse(phones=phones, emails=emails)


# ------------------------------------------------------------ discovery


@crm_router.post("/discover", response_model=DiscoverResponse)
async def discover(
    body: DiscoverRequest, db: GrowthDB, user: SuperAdmin
) -> DiscoverResponse:
    """Search the public web for prospects via Firecrawl. Results are
    candidates for review — nothing is stored until /import."""
    candidates = await discover_leads(body.query, body.area, body.city, body.limit)
    await record_growth_audit(
        db,
        action="leads_discovered",
        entity_type="lead",
        entity_title=f"{body.query} {body.area}".strip(),
        actor=user,
        detail=f"{len(candidates)} candidates",
    )
    location = " ".join(b for b in (body.area, body.city) if b.strip())
    return DiscoverResponse(
        query_used=f"{body.query.strip()} {location} contact".strip(),
        candidates=candidates,
    )


def _domain(url: str) -> str:
    import re as _re

    return _re.sub(r"^https?://(www\.)?", "", url or "").split("/")[0].lower()


@crm_router.post("/import", response_model=ImportLeadsResponse)
async def import_leads(
    body: ImportLeadsRequest, db: GrowthDB, user: SuperAdmin
) -> ImportLeadsResponse:
    """Store reviewed candidates as CRM leads, skipping duplicates (matched
    on website domain, phone, or email against existing leads)."""
    existing = await db.growth_leads.find().to_list(length=5000)
    known_domains = {_domain(d.get("website", "")) for d in existing} - {""}
    known_phones = {p for d in existing for p in [d.get("phone", "")] if p}
    known_emails = {e for d in existing for e in [d.get("email", "")] if e}

    imported: list[GrowthLead] = []
    skipped: list[str] = []
    for cand in body.candidates:
        domain = _domain(cand.website)
        phone = cand.phones[0] if cand.phones else ""
        email = cand.emails[0] if cand.emails else ""
        if (
            (domain and domain in known_domains)
            or (phone and phone in known_phones)
            or (email and email in known_emails)
        ):
            skipped.append(cand.company)
            continue
        lead = GrowthLead(
            company=cand.company,
            phone=phone,
            whatsapp=phone,
            email=email,
            website=cand.website,
            source="discovery",
            source_url=cand.source_url,
            area=cand.area or body.area,
            notes=cand.snippet,
            tags=body.tags,
            created_by=user.id,
        )
        await db.growth_leads.insert_one(lead.model_dump())
        imported.append(lead)
        if domain:
            known_domains.add(domain)
        if phone:
            known_phones.add(phone)
        if email:
            known_emails.add(email)

    await record_growth_audit(
        db,
        action="leads_imported",
        entity_type="lead",
        entity_title=f"{len(imported)} imported, {len(skipped)} duplicates skipped",
        actor=user,
    )
    return ImportLeadsResponse(
        imported=imported, skipped_duplicates=skipped
    )
