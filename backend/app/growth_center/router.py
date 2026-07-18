"""Growth Center API — /api/super-admin/growth-center.

Every endpoint requires the platform super_admin role (verified server-side
on each request) and touches ONLY the dedicated Growth Center database.
No operational collection is ever read or written here.
"""

import io
import json
import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.growth_center.audit import record_growth_audit
from app.growth_center.db import ensure_growth_indexes, get_growth_db
from app.growth_center.default_playbook import seed_default_playbook
from app.growth_center.models import (
    GrowthOverview,
    GrowthPersona,
    GrowthPlaybook,
    GrowthSearchResult,
    GrowthTemplate,
    GrowthAuditEntry,
    PersonaCreate,
    PersonaUpdate,
    PlaybookCreate,
    PlaybookUpdate,
    TemplateCreate,
    TemplateUpdate,
    new_growth_id,
    now_iso,
)
from app.growth_center.crm import crm_router
from app.growth_center.security import SuperAdmin

router = APIRouter(
    prefix="/api/super-admin/growth-center", tags=["growth-center"]
)
router.include_router(crm_router)

GrowthDB = Annotated[Any, Depends(get_growth_db)]

_indexes_ready = False


async def _prepare(db: Any, user: Any) -> None:
    """Lazy one-time index creation + idempotent default-playbook seed."""
    global _indexes_ready
    if not _indexes_ready:
        try:
            await ensure_growth_indexes(db)
        except Exception:
            pass  # index creation is best-effort (mongomock quirks)
        _indexes_ready = True
    if await seed_default_playbook(db, actor_id=user.id):
        await record_growth_audit(
            db,
            action="default_playbook_seeded",
            entity_type="module",
            entity_title="Default Hyderabad playbook",
            actor=user,
        )


# ------------------------------------------------------------- overview


@router.get("/overview", response_model=GrowthOverview)
async def overview(db: GrowthDB, user: SuperAdmin) -> GrowthOverview:
    await _prepare(db, user)
    playbooks = await db.growth_playbooks.find().to_list(length=500)
    templates = await db.growth_templates.find().to_list(length=2000)
    persona_count = await db.growth_personas.count_documents({})

    statuses = [d.get("status", "draft") for d in [*playbooks, *templates]]
    last = max(playbooks, key=lambda d: d.get("updated_at", ""), default=None)
    return GrowthOverview(
        playbook_count=len(playbooks),
        template_count=len(templates),
        objection_response_count=sum(
            1 for t in templates if t.get("template_type") == "objection_response"
        ),
        persona_count=persona_count,
        draft_count=statuses.count("draft"),
        under_review_count=statuses.count("under_review"),
        approved_count=statuses.count("approved"),
        archived_count=statuses.count("archived"),
        last_edited_playbook_id=last.get("id") if last else None,
        last_edited_playbook_title=last.get("title") if last else None,
        last_edited_at=last.get("updated_at") if last else None,
    )


# ------------------------------------------------------------- playbooks


def _snapshot(doc: dict[str, Any]) -> dict[str, Any]:
    """Copy of a document without its own previous_version (one-level undo)."""
    snap = {k: v for k, v in doc.items() if k not in ("_id", "previous_version")}
    return snap


@router.get("/playbooks", response_model=list[GrowthPlaybook])
async def list_playbooks(
    db: GrowthDB,
    user: SuperAdmin,
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = None,
) -> list[GrowthPlaybook]:
    await _prepare(db, user)
    query: dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    docs = await db.growth_playbooks.find(query).to_list(length=500)
    if q:
        needle = q.lower()
        docs = [
            d
            for d in docs
            if needle in d.get("title", "").lower()
            or needle in d.get("description", "").lower()
            or any(needle in s.get("body", "").lower() for s in d.get("sections", []))
        ]
    docs.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    return [GrowthPlaybook.model_validate(d) for d in docs]


@router.post(
    "/playbooks", response_model=GrowthPlaybook, status_code=status.HTTP_201_CREATED
)
async def create_playbook(
    body: PlaybookCreate, db: GrowthDB, user: SuperAdmin
) -> GrowthPlaybook:
    playbook = GrowthPlaybook(
        **body.model_dump(), created_by=user.id
    )
    await db.growth_playbooks.insert_one(playbook.model_dump())
    await record_growth_audit(
        db,
        action="playbook_created",
        entity_type="playbook",
        entity_id=playbook.id,
        entity_title=playbook.title,
        actor=user,
    )
    return playbook


async def _get_playbook_doc(db: Any, playbook_id: str) -> dict[str, Any]:
    doc = await db.growth_playbooks.find_one({"id": playbook_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return doc


@router.get("/playbooks/{playbook_id}", response_model=GrowthPlaybook)
async def get_playbook(
    playbook_id: str, db: GrowthDB, user: SuperAdmin
) -> GrowthPlaybook:
    await _prepare(db, user)
    return GrowthPlaybook.model_validate(await _get_playbook_doc(db, playbook_id))


@router.patch("/playbooks/{playbook_id}", response_model=GrowthPlaybook)
async def update_playbook(
    playbook_id: str, body: PlaybookUpdate, db: GrowthDB, user: SuperAdmin
) -> GrowthPlaybook:
    doc = await _get_playbook_doc(db, playbook_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return GrowthPlaybook.model_validate(doc)

    new_status = updates.get("status")
    updates["previous_version"] = _snapshot(doc)
    updates["updated_at"] = now_iso()
    if new_status == "archived":
        updates["archived_at"] = now_iso()
    elif new_status:
        updates["archived_at"] = None
    if "sections" in updates and updates["sections"] is not None:
        updates["sections"] = [
            s if isinstance(s, dict) else s.model_dump() for s in updates["sections"]
        ]

    await db.growth_playbooks.update_one({"id": playbook_id}, {"$set": updates})
    action = (
        "playbook_approved"
        if new_status == "approved"
        else "playbook_archived"
        if new_status == "archived"
        else "playbook_edited"
    )
    await record_growth_audit(
        db,
        action=action,
        entity_type="playbook",
        entity_id=playbook_id,
        entity_title=updates.get("title", doc.get("title", "")),
        actor=user,
    )
    return GrowthPlaybook.model_validate(await _get_playbook_doc(db, playbook_id))


@router.post("/playbooks/{playbook_id}/duplicate", response_model=GrowthPlaybook)
async def duplicate_playbook(
    playbook_id: str, db: GrowthDB, user: SuperAdmin
) -> GrowthPlaybook:
    doc = await _get_playbook_doc(db, playbook_id)
    copy = _snapshot(doc)
    copy["id"] = new_growth_id("gpb")
    copy["title"] = f"{doc.get('title', 'Playbook')} (copy)"
    copy["status"] = "draft"
    copy["archived_at"] = None
    copy["created_by"] = user.id
    copy["created_at"] = now_iso()
    copy["updated_at"] = now_iso()
    playbook = GrowthPlaybook.model_validate(copy)
    await db.growth_playbooks.insert_one(playbook.model_dump())

    # Duplicate the playbook's templates alongside it.
    templates = await db.growth_templates.find({"playbook_id": playbook_id}).to_list(
        length=2000
    )
    for tpl in templates:
        tcopy = _snapshot(tpl)
        tcopy["id"] = new_growth_id("gtpl")
        tcopy["playbook_id"] = playbook.id
        tcopy["status"] = "draft"
        tcopy["created_by"] = user.id
        tcopy["created_at"] = now_iso()
        tcopy["updated_at"] = now_iso()
        await db.growth_templates.insert_one(
            GrowthTemplate.model_validate(tcopy).model_dump()
        )

    await record_growth_audit(
        db,
        action="playbook_duplicated",
        entity_type="playbook",
        entity_id=playbook.id,
        entity_title=playbook.title,
        actor=user,
        detail=f"duplicated from {playbook_id}",
    )
    return playbook


@router.post("/playbooks/{playbook_id}/restore", response_model=GrowthPlaybook)
async def restore_playbook(
    playbook_id: str, db: GrowthDB, user: SuperAdmin
) -> GrowthPlaybook:
    doc = await _get_playbook_doc(db, playbook_id)
    previous = doc.get("previous_version")
    if not previous:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No previous version to restore"
        )
    previous["previous_version"] = None
    previous["updated_at"] = now_iso()
    await db.growth_playbooks.replace_one({"id": playbook_id}, previous)
    await record_growth_audit(
        db,
        action="playbook_restored",
        entity_type="playbook",
        entity_id=playbook_id,
        entity_title=previous.get("title", ""),
        actor=user,
    )
    return GrowthPlaybook.model_validate(await _get_playbook_doc(db, playbook_id))


# ------------------------------------------------------------- export


def _export_markdown(playbook: dict[str, Any], templates: list[dict[str, Any]]) -> str:
    lines = [f"# {playbook.get('title', 'Playbook')}", ""]
    if playbook.get("description"):
        lines += [playbook["description"], ""]
    lines += [
        f"- **Status:** {playbook.get('status', 'draft')}",
        f"- **Target market:** {playbook.get('target_market', '')}",
        f"- **Geography:** {', '.join(playbook.get('geography', []))}",
        f"- **Personas:** {', '.join(playbook.get('target_personas', []))}",
        f"- **Updated:** {playbook.get('updated_at', '')}",
        "",
    ]
    for section in sorted(playbook.get("sections", []), key=lambda s: s.get("order", 0)):
        lines += [f"# {section.get('title', '')}", "", section.get("body", ""), ""]
    if templates:
        lines += ["# Templates & Sequences", ""]
        for tpl in templates:
            lines += [
                f"## {tpl.get('title', '')}",
                "",
                f"- **Type:** {tpl.get('template_type', '')} · "
                f"**Stage:** {tpl.get('funnel_stage', '')} · "
                f"**Channel:** {tpl.get('channel', '')} · "
                f"**Status:** {tpl.get('status', '')}",
                "",
                tpl.get("content", ""),
                "",
            ]
    return "\n".join(lines)


@router.get("/playbooks/{playbook_id}/export")
async def export_playbook(
    playbook_id: str,
    db: GrowthDB,
    user: SuperAdmin,
    format: str = Query("markdown", pattern="^(markdown|text|json)$"),
) -> StreamingResponse:
    doc = _snapshot(await _get_playbook_doc(db, playbook_id))
    templates = [
        _snapshot(t)
        for t in await db.growth_templates.find({"playbook_id": playbook_id}).to_list(
            length=2000
        )
    ]

    if format == "json":
        payload = json.dumps(
            {"playbook": doc, "templates": templates}, indent=2, default=str
        )
        media, ext = "application/json", "json"
    else:
        markdown = _export_markdown(doc, templates)
        if format == "text":
            # Strip the most common markdown decoration for a plain-text copy.
            payload = re.sub(r"[#*_`]+", "", markdown)
            media, ext = "text/plain", "txt"
        else:
            payload = markdown
            media, ext = "text/markdown", "md"

    await record_growth_audit(
        db,
        action="content_exported",
        entity_type="playbook",
        entity_id=playbook_id,
        entity_title=doc.get("title", ""),
        actor=user,
        detail=f"format={format}",
    )
    slug = re.sub(r"[^a-z0-9]+", "-", doc.get("title", "playbook").lower()).strip("-")
    return StreamingResponse(
        io.BytesIO(payload.encode("utf-8")),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{slug}.{ext}"'},
    )


# ------------------------------------------------------------- templates


@router.get("/templates", response_model=list[GrowthTemplate])
async def list_templates(
    db: GrowthDB,
    user: SuperAdmin,
    playbook_id: str | None = Query(None, alias="playbookId"),
    template_type: str | None = Query(None, alias="type"),
    funnel_stage: str | None = Query(None, alias="stage"),
    channel: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    persona: str | None = None,
    language: str | None = None,
    q: str | None = None,
) -> list[GrowthTemplate]:
    await _prepare(db, user)
    query: dict[str, Any] = {}
    if playbook_id:
        query["playbook_id"] = playbook_id
    if template_type:
        query["template_type"] = template_type
    if funnel_stage:
        query["funnel_stage"] = funnel_stage
    if channel:
        query["channel"] = channel
    if status_filter:
        query["status"] = status_filter
    if persona:
        query["target_persona"] = persona
    if language:
        query["language"] = language
    docs = await db.growth_templates.find(query).to_list(length=2000)
    if q:
        needle = q.lower()
        docs = [
            d
            for d in docs
            if needle in d.get("title", "").lower()
            or needle in d.get("content", "").lower()
        ]
    docs.sort(key=lambda d: (d.get("created_at", ""), d.get("id", "")))
    return [GrowthTemplate.model_validate(d) for d in docs]


@router.post(
    "/templates", response_model=GrowthTemplate, status_code=status.HTTP_201_CREATED
)
async def create_template(
    body: TemplateCreate, db: GrowthDB, user: SuperAdmin
) -> GrowthTemplate:
    template = GrowthTemplate(**body.model_dump(), created_by=user.id)
    await db.growth_templates.insert_one(template.model_dump())
    await record_growth_audit(
        db,
        action="template_created",
        entity_type="template",
        entity_id=template.id,
        entity_title=template.title,
        actor=user,
    )
    return template


async def _get_template_doc(db: Any, template_id: str) -> dict[str, Any]:
    doc = await db.growth_templates.find_one({"id": template_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Template not found")
    return doc


@router.patch("/templates/{template_id}", response_model=GrowthTemplate)
async def update_template(
    template_id: str, body: TemplateUpdate, db: GrowthDB, user: SuperAdmin
) -> GrowthTemplate:
    doc = await _get_template_doc(db, template_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return GrowthTemplate.model_validate(doc)
    updates["previous_version"] = _snapshot(doc)
    updates["updated_at"] = now_iso()
    await db.growth_templates.update_one({"id": template_id}, {"$set": updates})
    await record_growth_audit(
        db,
        action="template_edited",
        entity_type="template",
        entity_id=template_id,
        entity_title=updates.get("title", doc.get("title", "")),
        actor=user,
    )
    return GrowthTemplate.model_validate(await _get_template_doc(db, template_id))


@router.post("/templates/{template_id}/duplicate", response_model=GrowthTemplate)
async def duplicate_template(
    template_id: str, db: GrowthDB, user: SuperAdmin
) -> GrowthTemplate:
    doc = await _get_template_doc(db, template_id)
    copy = _snapshot(doc)
    copy["id"] = new_growth_id("gtpl")
    copy["title"] = f"{doc.get('title', 'Template')} (copy)"
    copy["status"] = "draft"
    copy["created_by"] = user.id
    copy["created_at"] = now_iso()
    copy["updated_at"] = now_iso()
    template = GrowthTemplate.model_validate(copy)
    await db.growth_templates.insert_one(template.model_dump())
    await record_growth_audit(
        db,
        action="template_duplicated",
        entity_type="template",
        entity_id=template.id,
        entity_title=template.title,
        actor=user,
        detail=f"duplicated from {template_id}",
    )
    return template


@router.post("/templates/{template_id}/restore", response_model=GrowthTemplate)
async def restore_template(
    template_id: str, db: GrowthDB, user: SuperAdmin
) -> GrowthTemplate:
    doc = await _get_template_doc(db, template_id)
    previous = doc.get("previous_version")
    if not previous:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No previous version to restore"
        )
    previous["previous_version"] = None
    previous["updated_at"] = now_iso()
    await db.growth_templates.replace_one({"id": template_id}, previous)
    await record_growth_audit(
        db,
        action="template_restored",
        entity_type="template",
        entity_id=template_id,
        entity_title=previous.get("title", ""),
        actor=user,
    )
    return GrowthTemplate.model_validate(await _get_template_doc(db, template_id))


@router.post("/templates/{template_id}/log-copy", status_code=status.HTTP_204_NO_CONTENT)
async def log_template_copy(
    template_id: str, db: GrowthDB, user: SuperAdmin
) -> None:
    """The copy itself happens in the browser clipboard; this records it in
    the module audit trail."""
    doc = await _get_template_doc(db, template_id)
    await record_growth_audit(
        db,
        action="template_copied",
        entity_type="template",
        entity_id=template_id,
        entity_title=doc.get("title", ""),
        actor=user,
    )


# ------------------------------------------------------------- personas


@router.get("/personas", response_model=list[GrowthPersona])
async def list_personas(db: GrowthDB, user: SuperAdmin) -> list[GrowthPersona]:
    await _prepare(db, user)
    docs = await db.growth_personas.find().to_list(length=500)
    docs.sort(key=lambda d: d.get("name", ""))
    return [GrowthPersona.model_validate(d) for d in docs]


@router.post(
    "/personas", response_model=GrowthPersona, status_code=status.HTTP_201_CREATED
)
async def create_persona(
    body: PersonaCreate, db: GrowthDB, user: SuperAdmin
) -> GrowthPersona:
    persona = GrowthPersona(**body.model_dump())
    await db.growth_personas.insert_one(persona.model_dump())
    await record_growth_audit(
        db,
        action="persona_created",
        entity_type="persona",
        entity_id=persona.id,
        entity_title=persona.name,
        actor=user,
    )
    return persona


@router.patch("/personas/{persona_id}", response_model=GrowthPersona)
async def update_persona(
    persona_id: str, body: PersonaUpdate, db: GrowthDB, user: SuperAdmin
) -> GrowthPersona:
    doc = await db.growth_personas.find_one({"id": persona_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Persona not found")
    updates = body.model_dump(exclude_unset=True)
    updates["updated_at"] = now_iso()
    await db.growth_personas.update_one({"id": persona_id}, {"$set": updates})
    doc = await db.growth_personas.find_one({"id": persona_id})
    await record_growth_audit(
        db,
        action="persona_edited",
        entity_type="persona",
        entity_id=persona_id,
        entity_title=doc.get("name", ""),
        actor=user,
    )
    return GrowthPersona.model_validate(doc)


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(persona_id: str, db: GrowthDB, user: SuperAdmin) -> None:
    doc = await db.growth_personas.find_one({"id": persona_id})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Persona not found")
    await db.growth_personas.delete_one({"id": persona_id})
    await record_growth_audit(
        db,
        action="persona_deleted",
        entity_type="persona",
        entity_id=persona_id,
        entity_title=doc.get("name", ""),
        actor=user,
    )


# ------------------------------------------------------------- search


@router.get("/search", response_model=list[GrowthSearchResult])
async def search(
    db: GrowthDB, user: SuperAdmin, q: str = Query(..., min_length=1)
) -> list[GrowthSearchResult]:
    """Searches ONLY Growth Center collections — never the operational app."""
    await _prepare(db, user)
    needle = q.lower()
    results: list[GrowthSearchResult] = []

    for doc in await db.growth_playbooks.find().to_list(length=500):
        haystack = f"{doc.get('title', '')} {doc.get('description', '')} " + " ".join(
            s.get("body", "") for s in doc.get("sections", [])
        )
        if needle in haystack.lower():
            results.append(
                GrowthSearchResult(
                    entity_type="playbook",
                    id=doc["id"],
                    title=doc.get("title", ""),
                    snippet=doc.get("description", "")[:160],
                    status=doc.get("status", ""),
                    updated_at=doc.get("updated_at", ""),
                )
            )

    for doc in await db.growth_templates.find().to_list(length=2000):
        haystack = f"{doc.get('title', '')} {doc.get('content', '')}"
        if needle in haystack.lower():
            results.append(
                GrowthSearchResult(
                    entity_type="template",
                    id=doc["id"],
                    title=doc.get("title", ""),
                    snippet=doc.get("content", "")[:160],
                    status=doc.get("status", ""),
                    updated_at=doc.get("updated_at", ""),
                )
            )

    for doc in await db.growth_personas.find().to_list(length=500):
        haystack = f"{doc.get('name', '')} {doc.get('description', '')}"
        if needle in haystack.lower():
            results.append(
                GrowthSearchResult(
                    entity_type="persona",
                    id=doc["id"],
                    title=doc.get("name", ""),
                    snippet=doc.get("description", "")[:160],
                    updated_at=doc.get("updated_at", ""),
                )
            )

    return results[:50]


# ------------------------------------------------------------- audit


@router.get("/audit", response_model=list[GrowthAuditEntry])
async def list_audit(
    db: GrowthDB, user: SuperAdmin, limit: int = Query(50, le=200)
) -> list[GrowthAuditEntry]:
    docs = await db.growth_audit_log.find().to_list(length=2000)
    docs.sort(key=lambda d: d.get("timestamp", ""), reverse=True)
    return [GrowthAuditEntry.model_validate(d) for d in docs[:limit]]
