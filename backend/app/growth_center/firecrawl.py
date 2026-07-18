"""Firecrawl-powered lead discovery for the Growth Center CRM.

Searches the PUBLIC web (search results, business directories, agency
websites) for property-management businesses and extracts contact details
from the page text. It never scrapes LinkedIn or Facebook (both prohibit
scraping); leads found there are added manually with the matching source
tag.

Only the operator's typed query is ever sent to Firecrawl — no application
data of any kind. Results are returned as candidates for human review and
are not stored until explicitly imported.
"""

import logging
import re
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.growth_center.config import get_growth_settings
from app.growth_center.models import LeadCandidate

logger = logging.getLogger("growth_center.firecrawl")

MAX_RESULTS = 10
_TIMEOUT = httpx.Timeout(60.0, connect=10.0)

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# Indian numbers: optional +91/0 prefix, then a 10-digit mobile (6-9 first)
# or an STD landline; tolerate spaces/dashes between groups.
_PHONE_RE = re.compile(
    r"(?:\+91[\s-]?|0)?(?:[6-9]\d{4}[\s-]?\d{5}|40[\s-]?\d{8})"
)
_JUNK_EMAIL = ("example.", "sentry.", "wixpress.", ".png", ".jpg", ".webp")


def require_firecrawl_key() -> str:
    key = get_growth_settings().firecrawl_api_key
    if not key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Lead discovery is not configured. Set FIRECRAWL_API_KEY in "
                "the backend environment (get one at firecrawl.dev). Manual "
                "lead entry works without it."
            ),
        )
    return key


def extract_contacts(text: str) -> tuple[list[str], list[str]]:
    """Pull phone numbers and emails out of page text, deduplicated."""
    emails: list[str] = []
    for email in _EMAIL_RE.findall(text or ""):
        lowered = email.lower()
        if any(junk in lowered for junk in _JUNK_EMAIL):
            continue
        if lowered not in emails:
            emails.append(lowered)

    phones: list[str] = []
    for raw in _PHONE_RE.findall(text or ""):
        digits = re.sub(r"\D", "", raw)
        if len(digits) < 10:
            continue
        normalized = f"+91{digits[-10:]}"
        if normalized not in phones:
            phones.append(normalized)
    return phones[:5], emails[:5]


def _clean_title(title: str) -> str:
    """Directory/search titles carry suffixes like ' - Justdial' or
    ' | Best Property Management in …' — keep the business-name part."""
    for sep in (" | ", " - ", " – ", " — "):
        if sep in title:
            title = title.split(sep)[0]
    return title.strip()[:120] or "Unknown business"


async def discover_leads(
    query: str, area: str, city: str, limit: int
) -> list[LeadCandidate]:
    """Search the web via Firecrawl and turn results into lead candidates."""
    api_key = require_firecrawl_key()
    settings = get_growth_settings()
    limit = max(1, min(limit, MAX_RESULTS))

    location_bits = " ".join(bit for bit in (area, city) if bit.strip())
    full_query = f"{query.strip()} {location_bits} contact".strip()

    payload: dict[str, Any] = {
        "query": full_query,
        "limit": limit,
        # Scrape each hit so we can mine phones/emails from the page text.
        "scrapeOptions": {"formats": ["markdown"], "onlyMainContent": True},
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.firecrawl_api_base}/v1/search",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
    except httpx.HTTPError as exc:
        logger.warning("Firecrawl request failed: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Firecrawl. Check your network and try again.",
        ) from exc

    if resp.status_code == 401:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Firecrawl rejected the API key. Check FIRECRAWL_API_KEY.",
        )
    if resp.status_code == 402:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Firecrawl credits exhausted for this API key.",
        )
    if resp.status_code >= 400:
        logger.warning("Firecrawl error %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Firecrawl search failed (HTTP {resp.status_code}).",
        )

    body = resp.json()
    # v1 returns {"success": true, "data": [{title, description, url, markdown?}]}
    results = body.get("data") or []
    if isinstance(results, dict):  # some responses nest under data.web
        results = results.get("web") or []

    candidates: list[LeadCandidate] = []
    seen_domains: set[str] = set()
    for item in results:
        if not isinstance(item, dict):
            continue
        url = item.get("url") or item.get("link") or ""
        title = item.get("title") or ""
        description = item.get("description") or item.get("snippet") or ""
        markdown = item.get("markdown") or ""

        domain = re.sub(r"^https?://(www\.)?", "", url).split("/")[0].lower()
        if not domain or domain in seen_domains:
            continue
        # Social networks prohibit scraping — skip any that slip into results.
        if any(s in domain for s in ("facebook.", "linkedin.", "instagram.")):
            continue
        seen_domains.add(domain)

        phones, emails = extract_contacts(f"{description}\n{markdown}")
        candidates.append(
            LeadCandidate(
                company=_clean_title(title),
                website=f"https://{domain}",
                source_url=url,
                snippet=description[:280],
                phones=phones,
                emails=emails,
                area=area,
            )
        )
    return candidates
