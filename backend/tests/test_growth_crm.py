"""Growth Center CRM — pipeline, follow-ups, discovery (mocked), isolation."""

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.growth_center.db import get_growth_db
from app.growth_center.models import LeadCandidate
from app.main import app

from .conftest import login

CRM = "/api/super-admin/growth-center/crm"


@pytest.fixture
async def growth_db():
    client = AsyncMongoMockClient()
    return client["growth_center_test"]


@pytest.fixture
async def gc_client(db, growth_db):
    from app.db import get_db

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_growth_db] = lambda: growth_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def super_headers_gc(gc_client):
    return await login(gc_client, "super@communityhub.app")


# ---------------------------------------------------------- authorization


async def test_crm_requires_super_admin(gc_client):
    manager = await login(gc_client, "vishnu@communityhub.app")
    for path in ("/overview", "/leads"):
        resp = await gc_client.get(f"{CRM}{path}", headers=manager)
        assert resp.status_code == 403
    resp = await gc_client.post(
        f"{CRM}/discover", json={"query": "x"}, headers=manager
    )
    assert resp.status_code == 403
    assert (await gc_client.get(f"{CRM}/leads")).status_code == 401


# ------------------------------------------------------- pipeline lifecycle


async def test_lead_lifecycle(gc_client, super_headers_gc, db, growth_db):
    op_before = {
        name: await db[name].count_documents({})
        for name in await db.list_collection_names()
    }

    created = await gc_client.post(
        f"{CRM}/leads",
        json={
            "company": "Gachibowli Property Care",
            "contactName": "Ramesh",
            "phone": "+919876543210",
            "area": "Gachibowli",
            "source": "facebook",
            "nextFollowUpAt": "2026-07-19T09:00:00Z",
            "nextAction": "Send first-contact WhatsApp",
        },
        headers=super_headers_gc,
    )
    assert created.status_code == 201
    lead = created.json()
    assert lead["stage"] == "new"
    lead_id = lead["id"]

    # Logging an outreach activity auto-advances new → contacted and can
    # reschedule the follow-up.
    activity = await gc_client.post(
        f"{CRM}/leads/{lead_id}/activities",
        json={
            "activityType": "whatsapp",
            "summary": "Sent first-contact message",
            "nextFollowUpAt": "2026-07-21T09:00:00Z",
            "nextAction": "48h follow-up if no reply",
        },
        headers=super_headers_gc,
    )
    assert activity.status_code == 201
    after = (
        await gc_client.get(f"{CRM}/leads/{lead_id}", headers=super_headers_gc)
    ).json()
    assert after["stage"] == "contacted"
    assert after["nextFollowUpAt"] == "2026-07-21T09:00:00Z"

    # Walk it to won; follow-up clears.
    for stage in ("responded", "qualified", "demo_scheduled", "demo_done",
                  "pilot_proposed", "won"):
        resp = await gc_client.post(
            f"{CRM}/leads/{lead_id}/stage",
            json={"stage": stage},
            headers=super_headers_gc,
        )
        assert resp.status_code == 200
    final = resp.json()
    assert final["wonAt"] and final["nextFollowUpAt"] is None

    # Timeline recorded every stage change + the outreach.
    timeline = (
        await gc_client.get(
            f"{CRM}/leads/{lead_id}/activities", headers=super_headers_gc
        )
    ).json()
    assert len(timeline) == 7
    overview = (
        await gc_client.get(f"{CRM}/overview", headers=super_headers_gc)
    ).json()
    assert overview["wonCount"] == 1 and overview["totalLeads"] == 1

    # Operational database untouched by all of it.
    op_after = {
        name: await db[name].count_documents({})
        for name in await db.list_collection_names()
    }
    assert op_before == op_after
    assert await growth_db.growth_leads.count_documents({}) == 1


async def test_follow_up_due_filters(gc_client, super_headers_gc):
    for company, due in (
        ("Overdue & Co", "2020-01-01T09:00:00Z"),
        ("Someday Ltd", "2099-01-01T09:00:00Z"),
        ("Unscheduled LLP", None),
    ):
        payload = {"company": company}
        if due:
            payload["nextFollowUpAt"] = due
        resp = await gc_client.post(
            f"{CRM}/leads", json=payload, headers=super_headers_gc
        )
        assert resp.status_code == 201

    overdue = (
        await gc_client.get(f"{CRM}/leads?due=overdue", headers=super_headers_gc)
    ).json()
    assert [lead["company"] for lead in overdue] == ["Overdue & Co"]
    overview = (
        await gc_client.get(f"{CRM}/overview", headers=super_headers_gc)
    ).json()
    assert overview["overdueFollowUps"] == 1
    assert overview["unscheduledOpen"] == 1


# --------------------------------------------------------------- discovery


async def test_discover_unconfigured_returns_503(
    gc_client, super_headers_gc, monkeypatch
):
    """Force an empty key via monkeypatch so the test is independent of the
    developer's local .env."""
    from app.growth_center import firecrawl as fc
    from app.growth_center.config import GrowthCenterSettings

    monkeypatch.setattr(
        fc,
        "get_growth_settings",
        lambda: GrowthCenterSettings(firecrawl_api_key="", _env_file=None),
    )
    resp = await gc_client.post(
        f"{CRM}/discover", json={"query": "property managers"},
        headers=super_headers_gc,
    )
    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"]


async def test_discover_and_import_with_dedupe(
    gc_client, super_headers_gc, monkeypatch, growth_db
):
    fake = [
        LeadCandidate(
            company="Madhapur Estates",
            website="https://madhapurestates.example",
            source_url="https://madhapurestates.example/contact",
            snippet="Property management in Madhapur",
            phones=["+919812345678"],
            emails=["hello@madhapurestates.example"],
            area="Madhapur",
        ),
        LeadCandidate(
            company="HITEC Property Desk",
            website="https://hitecdesk.example",
            phones=[],
            emails=[],
            area="Madhapur",
        ),
    ]

    async def fake_discover(query, area, city, limit):
        return fake

    monkeypatch.setattr("app.growth_center.crm.discover_leads", fake_discover)

    found = await gc_client.post(
        f"{CRM}/discover",
        json={"query": "property management", "area": "Madhapur"},
        headers=super_headers_gc,
    )
    assert found.status_code == 200
    assert len(found.json()["candidates"]) == 2

    imported = await gc_client.post(
        f"{CRM}/import",
        json={"candidates": found.json()["candidates"], "area": "Madhapur"},
        headers=super_headers_gc,
    )
    assert imported.status_code == 200
    body = imported.json()
    assert len(body["imported"]) == 2 and body["skippedDuplicates"] == []
    assert body["imported"][0]["source"] == "discovery"

    # Re-import: both skipped as duplicates (domain match).
    again = await gc_client.post(
        f"{CRM}/import",
        json={"candidates": found.json()["candidates"]},
        headers=super_headers_gc,
    )
    assert len(again.json()["imported"]) == 0
    assert sorted(again.json()["skippedDuplicates"]) == [
        "HITEC Property Desk",
        "Madhapur Estates",
    ]
    assert await growth_db.growth_leads.count_documents({}) == 2


async def test_extract_contacts_endpoint(gc_client, super_headers_gc):
    """Paste-and-extract: local regex over operator-pasted text, super-admin
    only, nothing stored."""
    resp = await gc_client.post(
        f"{CRM}/extract-contacts",
        json={
            "text": (
                "Managing 2BHK flats in Kondapur & Gachibowli. NRI owners "
                "welcome. Contact 98491 23456 or mail rentals@hydhomes.in"
            )
        },
        headers=super_headers_gc,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["phones"] == ["+919849123456"]
    assert body["emails"] == ["rentals@hydhomes.in"]

    manager = await login(gc_client, "vishnu@communityhub.app")
    denied = await gc_client.post(
        f"{CRM}/extract-contacts", json={"text": "x"}, headers=manager
    )
    assert denied.status_code == 403


def test_contact_extraction():
    from app.growth_center.firecrawl import extract_contacts

    phones, emails = extract_contacts(
        "Call us: +91 98765 43210 or 040-23456789. "
        "Mail hello@agency.in or image@logo.png junk."
    )
    assert "+919876543210" in phones
    assert emails == ["hello@agency.in"]
