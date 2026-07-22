"""Public marketing lead capture → Growth Center CRM (no auth)."""

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.growth_center.db import get_growth_db
from app.main import app
from app.routers import public_leads

from .conftest import login

URL = "/api/v1/public/leads"

DEMO_BODY = {
    "kind": "demo",
    "name": "Sita Rao",
    "email": "sita@example.com",
    "phone": "+919876543210",
    "community": "Greenwood Residency",
    "city": "Hyderabad",
    "units": "24",
    "role": "Community administrator / committee member",
    "message": "We drown in WhatsApp bookkeeping.",
}


@pytest.fixture
async def growth_db():
    client = AsyncMongoMockClient()
    return client["growth_center_test"]


@pytest.fixture
async def public_client(db, growth_db):
    from app.db import get_db

    public_leads._reset_rate_limit()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_growth_db] = lambda: growth_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    public_leads._reset_rate_limit()


async def test_demo_submission_creates_crm_lead(public_client, db, growth_db):
    resp = await public_client.post(URL, json=DEMO_BODY)
    assert resp.status_code == 201
    assert resp.json() == {"received": True}

    docs = await growth_db.growth_leads.find().to_list(length=10)
    assert len(docs) == 1
    lead = docs[0]
    assert lead["company"] == "Greenwood Residency"
    assert lead["contact_name"] == "Sita Rao"
    assert lead["email"] == "sita@example.com"
    assert lead["source"] == "website"
    assert lead["stage"] == "new"
    assert lead["tags"] == ["website", "demo"]
    assert lead["portfolio_size"] == "24"
    assert "WhatsApp bookkeeping" in lead["notes"]

    activities = await growth_db.growth_lead_activities.find().to_list(length=10)
    assert len(activities) == 1
    assert activities[0]["lead_id"] == lead["id"]

    audits = await growth_db.growth_audit_log.find().to_list(length=10)
    assert any(a["action"] == "lead_created" for a in audits)

    queued = await db.notification_queue.find({"event_type": "lead_captured"}).to_list(
        length=10
    )
    assert len(queued) == 1
    assert "Sita Rao" in queued[0]["message"]


async def test_compact_kinds_fall_back_to_name_as_company(public_client, growth_db):
    resp = await public_client.post(
        URL, json={"kind": "contact", "name": "Arun M", "email": "arun@example.com"}
    )
    assert resp.status_code == 201
    lead = (await growth_db.growth_leads.find().to_list(length=10))[0]
    assert lead["company"] == "Arun M"
    assert lead["tags"] == ["website", "contact"]


async def test_honeypot_pretends_success_but_stores_nothing(
    public_client, db, growth_db
):
    resp = await public_client.post(
        URL, json={**DEMO_BODY, "website": "http://spam.example"}
    )
    assert resp.status_code == 201
    assert await growth_db.growth_leads.count_documents({}) == 0
    assert await db.notification_queue.count_documents({}) == 0


async def test_validation_rejects_bad_input(public_client, growth_db):
    # Missing required fields.
    assert (await public_client.post(URL, json={"kind": "demo"})).status_code == 422
    # Unknown kind.
    resp = await public_client.post(
        URL, json={"kind": "hack", "name": "X", "email": "x@example.com"}
    )
    assert resp.status_code == 422
    # Malformed email.
    resp = await public_client.post(
        URL, json={"kind": "demo", "name": "X", "email": "not-an-email"}
    )
    assert resp.status_code == 422
    # Oversized message.
    resp = await public_client.post(
        URL,
        json={"kind": "demo", "name": "X", "email": "x@example.com", "message": "a" * 2001},
    )
    assert resp.status_code == 422
    assert await growth_db.growth_leads.count_documents({}) == 0


async def test_per_ip_rate_limit(public_client, growth_db):
    for i in range(public_leads.RATE_LIMIT_PER_IP):
        resp = await public_client.post(
            URL,
            json={"kind": "waitlist", "name": f"User {i}", "email": f"u{i}@example.com"},
        )
        assert resp.status_code == 201
    resp = await public_client.post(
        URL, json={"kind": "waitlist", "name": "One Too Many", "email": "z@example.com"}
    )
    assert resp.status_code == 429
    assert (
        await growth_db.growth_leads.count_documents({})
        == public_leads.RATE_LIMIT_PER_IP
    )


async def test_lead_visible_to_super_admin_crm(public_client, growth_db):
    await public_client.post(URL, json=DEMO_BODY)
    headers = await login(public_client, "super@communityhub.app")
    resp = await public_client.get(
        "/api/super-admin/growth-center/crm/leads", headers=headers
    )
    assert resp.status_code == 200
    leads = resp.json()
    assert any(
        l["source"] == "website" and l["company"] == "Greenwood Residency"
        for l in leads
    )
