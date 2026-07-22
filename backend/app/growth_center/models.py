"""Growth Center schemas — isolated from app.models on purpose.

These models exist only in the Growth Center database. `created_by` /
`actor_id` carry the authenticated super admin's immutable user id for audit
purposes only — no foreign-key-style references to operational entities.
Wire format is camelCase to match the frontend, snake_case internally.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


def new_growth_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class GrowthModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


ContentStatus = Literal["draft", "under_review", "approved", "archived"]

TemplateType = Literal[
    "first_contact",
    "no_response_follow_up",
    "demo_invitation",
    "post_demo_pitch",
    "stalled_close",
    "objection_response",
    "lead_magnet",
    "other",
]

FunnelStage = Literal[
    "awareness",
    "first_contact",
    "follow_up",
    "demo",
    "post_demo",
    "closing",
    "objection",
    "any",
]

Channel = Literal["whatsapp", "email", "linkedin", "facebook", "any"]


# ---------- Playbooks ----------


class PlaybookSection(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gsec"))
    key: str  # e.g. "market-strategy", "funnel-strategy", "pilot-pricing"
    title: str
    body: str = ""  # markdown
    order: int = 0


class GrowthPlaybook(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gpb"))
    title: str
    description: str = ""
    target_market: str = ""
    target_personas: list[str] = []
    geography: list[str] = []
    status: ContentStatus = "draft"
    sections: list[PlaybookSection] = []
    tags: list[str] = []
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    archived_at: str | None = None
    # Snapshot of the record before the most recent save (restore support).
    previous_version: dict[str, Any] | None = None


class PlaybookCreate(GrowthModel):
    title: str
    description: str = ""
    target_market: str = ""
    target_personas: list[str] = []
    geography: list[str] = []
    tags: list[str] = []


class PlaybookUpdate(GrowthModel):
    title: str | None = None
    description: str | None = None
    target_market: str | None = None
    target_personas: list[str] | None = None
    geography: list[str] | None = None
    status: ContentStatus | None = None
    sections: list[PlaybookSection] | None = None
    tags: list[str] | None = None


# ---------- Templates ----------


class GrowthTemplate(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gtpl"))
    playbook_id: str | None = None
    template_type: TemplateType = "other"
    funnel_stage: FunnelStage = "any"
    channel: Channel = "any"
    title: str
    content: str = ""  # markdown / plain message body
    status: ContentStatus = "draft"
    tags: list[str] = []
    target_persona: str = ""
    language: str = "en-IN"
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    previous_version: dict[str, Any] | None = None


class TemplateCreate(GrowthModel):
    playbook_id: str | None = None
    template_type: TemplateType = "other"
    funnel_stage: FunnelStage = "any"
    channel: Channel = "any"
    title: str
    content: str = ""
    tags: list[str] = []
    target_persona: str = ""
    language: str = "en-IN"


class TemplateUpdate(GrowthModel):
    template_type: TemplateType | None = None
    funnel_stage: FunnelStage | None = None
    channel: Channel | None = None
    title: str | None = None
    content: str | None = None
    status: ContentStatus | None = None
    tags: list[str] | None = None
    target_persona: str | None = None
    language: str | None = None


# ---------- Personas ----------


class GrowthPersona(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gper"))
    name: str
    description: str = ""
    portfolio_size: str = ""
    common_problems: list[str] = []
    buying_motivations: list[str] = []
    objections: list[str] = []
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class PersonaCreate(GrowthModel):
    name: str
    description: str = ""
    portfolio_size: str = ""
    common_problems: list[str] = []
    buying_motivations: list[str] = []
    objections: list[str] = []


class PersonaUpdate(GrowthModel):
    name: str | None = None
    description: str | None = None
    portfolio_size: str | None = None
    common_problems: list[str] | None = None
    buying_motivations: list[str] | None = None
    objections: list[str] | None = None


# ---------- CRM: leads & follow-up tracker ----------

# Pipeline mirrors the playbook's funnel: discover → contact → qualify →
# demo → pilot → won/lost.
LeadStage = Literal[
    "new",
    "contacted",
    "responded",
    "qualified",
    "demo_scheduled",
    "demo_done",
    "pilot_proposed",
    "won",
    "lost",
]

LEAD_STAGES: tuple[str, ...] = (
    "new",
    "contacted",
    "responded",
    "qualified",
    "demo_scheduled",
    "demo_done",
    "pilot_proposed",
    "won",
    "lost",
)

LeadSource = Literal[
    "discovery",  # imported from a Firecrawl web search
    "manual",
    "facebook",
    "linkedin",
    "whatsapp",
    "referral",
    "website",  # captured from a nivaasos.com CTA form (public endpoint)
    "other",
]


class GrowthLead(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gld"))
    company: str  # agency / business name (the anchor field)
    contact_name: str = ""
    role_title: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    website: str = ""
    source: LeadSource = "manual"
    source_url: str = ""  # where the lead was found
    area: str = ""  # e.g. Gachibowli, Madhapur
    city: str = "Hyderabad"
    address: str = ""
    portfolio_size: str = ""  # as learned during qualification
    nri_owners: str = ""  # e.g. "yes — most clients in US"
    persona: str = ""  # matching GrowthPersona name, free text
    notes: str = ""
    tags: list[str] = []
    stage: LeadStage = "new"
    stage_changed_at: str = Field(default_factory=now_iso)
    lost_reason: str = ""
    won_at: str | None = None
    next_follow_up_at: str | None = None  # ISO date/datetime
    next_action: str = ""  # what the follow-up is
    last_activity_at: str | None = None
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class LeadCreate(GrowthModel):
    company: str
    contact_name: str = ""
    role_title: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    website: str = ""
    source: LeadSource = "manual"
    source_url: str = ""
    area: str = ""
    city: str = "Hyderabad"
    address: str = ""
    portfolio_size: str = ""
    nri_owners: str = ""
    persona: str = ""
    notes: str = ""
    tags: list[str] = []
    next_follow_up_at: str | None = None
    next_action: str = ""


class LeadUpdate(GrowthModel):
    company: str | None = None
    contact_name: str | None = None
    role_title: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None
    website: str | None = None
    source: LeadSource | None = None
    source_url: str | None = None
    area: str | None = None
    city: str | None = None
    address: str | None = None
    portfolio_size: str | None = None
    nri_owners: str | None = None
    persona: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    next_follow_up_at: str | None = None
    next_action: str | None = None


class LeadStageChange(GrowthModel):
    stage: LeadStage
    note: str = ""
    lost_reason: str = ""


ActivityType = Literal[
    "note",
    "call",
    "whatsapp",
    "email",
    "linkedin",
    "facebook",
    "meeting",
    "demo",
    "proposal",
    "stage_change",
]


class GrowthLeadActivity(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gact"))
    lead_id: str
    activity_type: ActivityType = "note"
    summary: str = ""
    happened_at: str = Field(default_factory=now_iso)
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)


class ActivityCreate(GrowthModel):
    activity_type: ActivityType = "note"
    summary: str = ""
    happened_at: str | None = None
    # Optionally (re)schedule the lead's next follow-up in the same call.
    next_follow_up_at: str | None = None
    next_action: str | None = None


class LeadCandidate(GrowthModel):
    """A discovery result awaiting human review — NOT stored until imported."""

    company: str
    website: str = ""
    source_url: str = ""
    snippet: str = ""
    phones: list[str] = []
    emails: list[str] = []
    area: str = ""


class ExtractContactsRequest(GrowthModel):
    """Text the operator pasted by hand (e.g. a Facebook group post they are
    viewing in their own browser) — extraction is local regex, no scraping."""

    text: str


class ExtractContactsResponse(GrowthModel):
    phones: list[str] = []
    emails: list[str] = []


class DiscoverRequest(GrowthModel):
    # Free-text focus, e.g. "property management services" / "NRI property care"
    query: str = "property management services"
    area: str = ""  # e.g. "Gachibowli"
    city: str = "Hyderabad"
    limit: int = 8  # capped server-side


class DiscoverResponse(GrowthModel):
    query_used: str
    candidates: list[LeadCandidate] = []


class ImportLeadsRequest(GrowthModel):
    candidates: list[LeadCandidate]
    area: str = ""
    tags: list[str] = []


class ImportLeadsResponse(GrowthModel):
    imported: list[GrowthLead] = []
    skipped_duplicates: list[str] = []  # company names already in the CRM


class CrmOverview(GrowthModel):
    total_leads: int = 0
    by_stage: dict[str, int] = {}
    open_leads: int = 0  # not won / lost
    won_count: int = 0
    lost_count: int = 0
    overdue_follow_ups: int = 0
    due_today: int = 0
    due_this_week: int = 0
    unscheduled_open: int = 0  # open leads with no next follow-up set


# ---------- Audit ----------

AuditAction = Literal[
    "playbook_created",
    "playbook_edited",
    "playbook_approved",
    "playbook_archived",
    "playbook_duplicated",
    "playbook_restored",
    "template_created",
    "template_edited",
    "template_duplicated",
    "template_restored",
    "template_copied",
    "persona_created",
    "persona_edited",
    "persona_deleted",
    "content_exported",
    "default_playbook_seeded",
    "lead_created",
    "lead_edited",
    "lead_stage_changed",
    "lead_deleted",
    "lead_activity_logged",
    "leads_discovered",
    "leads_imported",
]


class GrowthAuditEntry(GrowthModel):
    id: str = Field(default_factory=lambda: new_growth_id("gaud"))
    action: AuditAction
    entity_type: Literal["playbook", "template", "persona", "lead", "module"]
    entity_id: str = ""
    entity_title: str = ""
    actor_id: str = ""
    actor_email: str = ""
    detail: str = ""
    timestamp: str = Field(default_factory=now_iso)


# ---------- Aggregates ----------


class GrowthOverview(GrowthModel):
    playbook_count: int = 0
    template_count: int = 0
    objection_response_count: int = 0
    persona_count: int = 0
    draft_count: int = 0
    under_review_count: int = 0
    approved_count: int = 0
    archived_count: int = 0
    last_edited_playbook_id: str | None = None
    last_edited_playbook_title: str | None = None
    last_edited_at: str | None = None


class GrowthSearchResult(GrowthModel):
    entity_type: Literal["playbook", "template", "persona"]
    id: str
    title: str
    snippet: str = ""
    status: str = ""
    updated_at: str = ""
