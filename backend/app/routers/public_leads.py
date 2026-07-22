"""Public lead capture for the nivaasos.com marketing site.

POST /api/v1/public/leads is the ONE unauthenticated write endpoint the
static marketing site is allowed to call (see docs/NIVAASOS_PUBLIC_SITE.md).
Submissions become sales prospects in the super admin's Growth Center CRM
(growth_leads, dedicated Growth Center database) — they are never
operational community data. Abuse controls: honeypot field, per-IP and
global rate limits, strict field length caps, and a response that leaks
nothing (no ids, no stored state).
"""

import logging
import re
import time
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field

from app.db import get_db
from app.growth_center.audit import record_growth_audit
from app.growth_center.db import get_growth_db
from app.growth_center.models import (
    GrowthLead,
    GrowthLeadActivity,
    GrowthModel,
)
from app.notification_service import enqueue_notification

logger = logging.getLogger("communityhub")

router = APIRouter(prefix="/public", tags=["public"])

DB = Annotated[Any, Depends(get_db)]
GrowthDB = Annotated[Any, Depends(get_growth_db)]

LeadKind = Literal["demo", "start", "waitlist", "contact"]

KIND_LABELS: dict[str, str] = {
    "demo": "Demo request",
    "start": "Start-our-community request",
    "waitlist": "Mobile app waitlist signup",
    "contact": "Contact message",
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ---------------------------------------------------------------- rate limit
# In-memory sliding window. Good enough for a single Cloud Run instance and
# resets on deploy; the honeypot plus field caps do the rest. Tunable here,
# reset via _reset_rate_limit() in tests.
RATE_LIMIT_PER_IP = 5
RATE_LIMIT_GLOBAL = 200
RATE_WINDOW_SECONDS = 3600.0

_hits_by_ip: dict[str, list[float]] = {}
_hits_global: list[float] = []


def _reset_rate_limit() -> None:
    _hits_by_ip.clear()
    _hits_global.clear()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    cutoff = now - RATE_WINDOW_SECONDS
    _hits_global[:] = [t for t in _hits_global if t > cutoff]
    for key in list(_hits_by_ip):
        _hits_by_ip[key] = [t for t in _hits_by_ip[key] if t > cutoff]
        if not _hits_by_ip[key]:
            del _hits_by_ip[key]
    if len(_hits_global) >= RATE_LIMIT_GLOBAL:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please email us instead.",
        )
    if len(_hits_by_ip.get(ip, [])) >= RATE_LIMIT_PER_IP:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests from this address. Please email us instead.",
        )
    _hits_global.append(now)
    _hits_by_ip.setdefault(ip, []).append(now)


# ------------------------------------------------------------------- schema


class PublicLeadSubmission(GrowthModel):
    kind: LeadKind
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(default="", max_length=40)
    community: str = Field(default="", max_length=200)
    city: str = Field(default="", max_length=120)
    units: str = Field(default="", max_length=40)
    role: str = Field(default="", max_length=120)
    message: str = Field(default="", max_length=2000)
    # Honeypot: hidden in the real form, so any value means a bot filled it.
    website: str = Field(default="", max_length=500)


class PublicLeadResponse(GrowthModel):
    received: bool = True


# ----------------------------------------------------------------- endpoint


@router.post(
    "/leads", response_model=PublicLeadResponse, status_code=status.HTTP_201_CREATED
)
async def submit_public_lead(
    body: PublicLeadSubmission,
    request: Request,
    db: DB,
    growth_db: GrowthDB,
) -> PublicLeadResponse:
    # Bots that filled the honeypot get a fake success and nothing stored.
    if body.website.strip():
        return PublicLeadResponse()

    if not _EMAIL_RE.match(body.email.strip()):
        raise HTTPException(422, detail="Please provide a valid email address.")

    _check_rate_limit(_client_ip(request))

    label = KIND_LABELS[body.kind]
    name = body.name.strip()
    community_name = body.community.strip()

    lead = GrowthLead(
        company=community_name or name,
        contact_name=name,
        role_title=body.role.strip(),
        phone=body.phone.strip(),
        whatsapp=body.phone.strip(),
        email=body.email.strip(),
        source="website",
        source_url=f"https://nivaasos.com ({body.kind} form)",
        city=body.city.strip(),
        portfolio_size=body.units.strip(),
        notes="\n".join(
            part
            for part in (
                f"{label} from nivaasos.com.",
                f"Community: {community_name}" if community_name else "",
                f"Message: {body.message.strip()}" if body.message.strip() else "",
            )
            if part
        ),
        tags=["website", body.kind],
        next_action=f"Respond to {label.lower()}",
        created_by="public-web",
    )
    await growth_db.growth_leads.insert_one(lead.model_dump())

    activity = GrowthLeadActivity(
        lead_id=lead.id,
        activity_type="note",
        summary=f"{label} submitted via nivaasos.com",
        created_by="public-web",
    )
    await growth_db.growth_lead_activities.insert_one(activity.model_dump())

    await record_growth_audit(
        growth_db,
        action="lead_created",
        entity_type="lead",
        entity_id=lead.id,
        entity_title=lead.company,
        detail=f"public website ({body.kind})",
    )

    # WhatsApp heads-up to the operator via the OpenClaw queue — best-effort,
    # a queue failure must never lose the CRM entry.
    try:
        await enqueue_notification(
            db=db,
            community_id="mke",
            recipient_type="admin",
            recipient_name="Raj Manda",
            channel="whatsapp",
            event_type="lead_captured",
            title="New Nivaasos website lead",
            message=(
                f"🔔 *{label} on nivaasos.com!*\n\n"
                f"👤 *Name*: {name}\n"
                f"📧 *Email*: {body.email.strip()}\n"
                f"📞 *Phone*: {body.phone.strip() or 'N/A'}\n"
                f"🏢 *Community*: {community_name or 'N/A'}\n"
                f"🏙️ *City*: {body.city.strip() or 'N/A'}\n"
                f"🔢 *Units*: {body.units.strip() or 'N/A'}\n"
                f"💼 *Role*: {body.role.strip() or 'N/A'}\n"
                f"💬 *Message*: {body.message.strip() or 'N/A'}"
            ),
            recipient_phone="+13158775699",
        )
    except Exception:
        logger.exception("Failed to enqueue WhatsApp notification for website lead")

    return PublicLeadResponse()
