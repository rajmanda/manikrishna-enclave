"""Growth Center — authorization and isolation tests.

Proves: super-admin-only access, 401/403 behaviour for every other role,
no fallback to the operational database when unconfigured, operational
collections untouched by Growth Center usage, search/export scoped to
Growth Center data, and (statically) that the package never imports
operational application code.
"""

import re
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.growth_center.db import get_growth_db
from app.main import app

from .conftest import login

GC = "/api/super-admin/growth-center"


@pytest.fixture
async def growth_db():
    client = AsyncMongoMockClient()
    return client["growth_center_test"]


@pytest.fixture
async def gc_client(db, growth_db):
    """App client with BOTH databases overridden: operational (mongomock via
    conftest `db`) and the separate Growth Center mongomock database."""
    from app.db import get_db

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_growth_db] = lambda: growth_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _collection_fingerprint(db) -> dict[str, int]:
    names = await db.list_collection_names()
    return {name: await db[name].count_documents({}) for name in sorted(names)}


# ------------------------------------------------------------ authorization


async def test_super_admin_can_access(gc_client):
    headers = await login(gc_client, "super@communityhub.app")
    resp = await gc_client.get(f"{GC}/overview", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["playbookCount"] >= 1  # default playbook seeded lazily
    assert body["templateCount"] > 0


@pytest.mark.parametrize(
    "email",
    [
        "vishnu@communityhub.app",  # property_manager
        "owner502@example.com",  # owner
        "auditor@communityhub.app",  # auditor
        "manager@other.example.com",  # property_manager, other community
    ],
)
async def test_other_roles_get_403(gc_client, email):
    headers = await login(gc_client, email)
    for path in ("/overview", "/playbooks", "/templates", "/personas", "/audit"):
        resp = await gc_client.get(f"{GC}{path}", headers=headers)
        assert resp.status_code == 403, f"{email} reached {path}"
    write = await gc_client.post(
        f"{GC}/playbooks", json={"title": "X"}, headers=headers
    )
    assert write.status_code == 403


async def test_tenant_and_community_admin_get_403(gc_client, db):
    """Roles not present in the seed: create them, then verify 403."""
    for role, email in (
        ("tenant", "gc-tenant@example.com"),
        ("community_admin", "gc-cadmin@example.com"),
    ):
        await db.users.insert_one(
            {
                "id": f"u-gc-{role}",
                "community_id": "mke",
                "name": role,
                "email": email,
                "role": role,
                "apartment_id": None,
                "phone": None,
            }
        )
        headers = await login(gc_client, email)
        resp = await gc_client.get(f"{GC}/overview", headers=headers)
        assert resp.status_code == 403, role


async def test_unauthenticated_gets_401(gc_client):
    for path in ("/overview", "/playbooks", "/templates"):
        resp = await gc_client.get(f"{GC}{path}")
        assert resp.status_code == 401
    resp = await gc_client.post(f"{GC}/playbooks", json={"title": "X"})
    assert resp.status_code == 401


async def test_invalid_token_rejected(gc_client):
    resp = await gc_client.get(
        f"{GC}/overview", headers={"Authorization": "Bearer forged-token"}
    )
    assert resp.status_code == 401


# ------------------------------------------------- configuration / fallback


async def test_missing_config_fails_safe_without_fallback(db, monkeypatch):
    """Without GROWTH_CENTER_MONGO_URI the module must 503 for a super admin
    — and must NOT touch the operational database as a fallback. The empty
    URI is forced via monkeypatch so the test is independent of the
    developer's local .env."""
    from app.db import get_db
    from app.growth_center import db as gdb
    from app.growth_center.config import GrowthCenterSettings

    monkeypatch.setattr(
        gdb,
        "get_growth_settings",
        lambda: GrowthCenterSettings(growth_center_mongo_uri="", _env_file=None),
    )
    monkeypatch.setattr(gdb, "_db", None)
    monkeypatch.setattr(gdb, "_client", None)
    assert gdb._db is None  # no growth connection exists in tests

    app.dependency_overrides[get_db] = lambda: db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = await login(ac, "super@communityhub.app")
        before = await _collection_fingerprint(db)
        resp = await ac.get(f"{GC}/overview", headers=headers)
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"]
        after = await _collection_fingerprint(db)
    app.dependency_overrides.clear()

    assert before == after  # operational DB untouched
    assert gdb._db is None  # still no connection — no silent fallback


# --------------------------------------------------------------- isolation


async def test_growth_usage_never_touches_operational_db(gc_client, db, growth_db):
    headers = await login(gc_client, "super@communityhub.app")
    before = await _collection_fingerprint(db)

    # Exercise the module: seed, create, edit, approve, duplicate, archive,
    # search, export, audit.
    overview = await gc_client.get(f"{GC}/overview", headers=headers)
    assert overview.status_code == 200
    created = await gc_client.post(
        f"{GC}/playbooks",
        json={"title": "Vizag expansion", "targetMarket": "PMs in Vizag"},
        headers=headers,
    )
    assert created.status_code == 201
    pid = created.json()["id"]
    edited = await gc_client.patch(
        f"{GC}/playbooks/{pid}", json={"status": "approved"}, headers=headers
    )
    assert edited.status_code == 200
    dup = await gc_client.post(f"{GC}/playbooks/{pid}/duplicate", headers=headers)
    assert dup.status_code == 200
    archived = await gc_client.patch(
        f"{GC}/playbooks/{dup.json()['id']}",
        json={"status": "archived"},
        headers=headers,
    )
    assert archived.status_code == 200
    search = await gc_client.get(f"{GC}/search?q=vizag", headers=headers)
    assert search.status_code == 200
    export = await gc_client.get(
        f"{GC}/playbooks/{pid}/export?format=json", headers=headers
    )
    assert export.status_code == 200

    after = await _collection_fingerprint(db)
    assert before == after, "Growth Center wrote to the operational database"

    # All growth data landed in the dedicated database, growth_-prefixed.
    growth_collections = await growth_db.list_collection_names()
    assert growth_collections
    assert all(name.startswith("growth_") for name in growth_collections)
    # Module audit trail exists inside the growth boundary.
    assert await growth_db.growth_audit_log.count_documents({}) > 0
    # And nothing operational-looking exists there.
    for forbidden in ("users", "invoices", "payments", "apartments", "expenses"):
        assert forbidden not in growth_collections


async def test_search_returns_only_growth_content(gc_client, db):
    """Terms that exist in the operational DB (seeded community/users) must
    find nothing unless they appear in Growth Center content."""
    headers = await login(gc_client, "super@communityhub.app")
    await gc_client.get(f"{GC}/overview", headers=headers)  # ensure seeded

    resp = await gc_client.get(f"{GC}/search?q=Mani Krishna", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []  # operational community name is not growth content

    resp = await gc_client.get(f"{GC}/search?q=Hyderabad", headers=headers)
    assert resp.status_code == 200
    hits = resp.json()
    assert hits, "default playbook should match"
    assert {h["entityType"] for h in hits} <= {"playbook", "template", "persona"}


async def test_export_contains_only_growth_content(gc_client):
    headers = await login(gc_client, "super@communityhub.app")
    playbooks = await gc_client.get(f"{GC}/playbooks", headers=headers)
    pid = playbooks.json()[0]["id"]

    for fmt in ("markdown", "text", "json"):
        resp = await gc_client.get(
            f"{GC}/playbooks/{pid}/export?format={fmt}", headers=headers
        )
        assert resp.status_code == 200
        text = resp.text
        # Seeded operational identifiers must never leak into an export.
        for leak in ("Mani Krishna", "vishnu@communityhub.app", "apt-", "mke"):
            assert leak not in text, f"operational data '{leak}' leaked into {fmt}"
        assert "Hyderabad" in text


async def test_default_playbook_content(gc_client):
    headers = await login(gc_client, "super@communityhub.app")
    await gc_client.get(f"{GC}/overview", headers=headers)
    resp = await gc_client.get(
        f"{GC}/playbooks/gpb-default-hyderabad", headers=headers
    )
    assert resp.status_code == 200
    playbook = resp.json()
    keys = {s["key"] for s in playbook["sections"]}
    assert {"market-strategy", "funnel-strategy", "pilot-pricing"} <= keys

    templates = await gc_client.get(
        f"{GC}/templates?playbookId=gpb-default-hyderabad", headers=headers
    )
    types = [t["templateType"] for t in templates.json()]
    assert types.count("objection_response") >= 10
    for required in (
        "first_contact",
        "no_response_follow_up",
        "demo_invitation",
        "post_demo_pitch",
        "stalled_close",
    ):
        assert required in types


async def test_edit_and_restore_previous_version(gc_client):
    headers = await login(gc_client, "super@communityhub.app")
    created = await gc_client.post(
        f"{GC}/playbooks", json={"title": "Original title"}, headers=headers
    )
    pid = created.json()["id"]
    await gc_client.patch(
        f"{GC}/playbooks/{pid}", json={"title": "Renamed"}, headers=headers
    )
    restored = await gc_client.post(f"{GC}/playbooks/{pid}/restore", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["title"] == "Original title"


async def test_audit_trail_stays_in_growth_db(gc_client, db, growth_db):
    headers = await login(gc_client, "super@communityhub.app")
    templates = await gc_client.get(f"{GC}/templates", headers=headers)
    tid = templates.json()[0]["id"]
    resp = await gc_client.post(f"{GC}/templates/{tid}/log-copy", headers=headers)
    assert resp.status_code == 204

    entries = await growth_db.growth_audit_log.find(
        {"action": "template_copied"}
    ).to_list(length=10)
    assert entries and entries[0]["entity_id"] == tid
    # The operational audit_log gained nothing from Growth Center activity.
    op_audit = await db.audit_log.find().to_list(length=1000)
    assert not any("growth" in str(e).lower() for e in op_audit)


# ------------------------------------------------------- import boundary


def test_growth_center_never_imports_operational_code():
    """Fails if any Growth Center module imports operational repositories,
    models, or services. The ONLY approved app import is app.core.security
    (authentication + role verification)."""
    package_dir = Path(__file__).resolve().parents[1] / "app" / "growth_center"
    allowed = {"app.core.security", "app.growth_center"}
    forbidden_found: list[str] = []

    for source_file in package_dir.glob("*.py"):
        source = source_file.read_text()
        for match in re.finditer(
            r"^\s*(?:from|import)\s+(app[\w.]*)", source, re.MULTILINE
        ):
            module = match.group(1)
            if not any(
                module == entry or module.startswith(f"{entry}.") for entry in allowed
            ):
                forbidden_found.append(f"{source_file.name}: {module}")

    assert not forbidden_found, (
        "Growth Center imports operational application code: "
        f"{forbidden_found}"
    )


def test_growth_models_have_no_operational_references():
    """Growth models must not reference operational collections/fields."""
    package_dir = Path(__file__).resolve().parents[1] / "app" / "growth_center"
    banned = [
        "db.users",
        "db.invoices",
        "db.payments",
        "db.apartments",
        "db.expenses",
        "db.communities",
        "db.work_orders",
        "db.audit_log",
        "db.accounts",
        "db.vendors",
        "db.notification_queue",
        "community_id",
        "apartment_id",
    ]
    for source_file in package_dir.glob("*.py"):
        source = source_file.read_text()
        for term in banned:
            assert term not in source, f"{source_file.name} references '{term}'"
