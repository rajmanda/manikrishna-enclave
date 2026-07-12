import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.db import get_db
from app.main import app
from app.migrations import run_migrations
from app.seed import seed


@pytest.fixture
async def db():
    client = AsyncMongoMockClient()
    database = client["communityhub_test"]
    await seed(database)
    await run_migrations(database)
    # A second community to prove tenant isolation.
    await database.communities.insert_one(
        {"id": "other", "name": "Other Towers", "address": "", "apartment_count": 1}
    )
    await database.users.insert_one(
        {
            "id": "u-other-mgr",
            "community_id": "other",
            "name": "Other Manager",
            "email": "manager@other.example.com",
            "role": "property_manager",
            "apartment_id": None,
            "phone": None,
        }
    )
    await database.apartments.insert_one(
        {
            "id": "apt-other-1",
            "community_id": "other",
            "number": "O-1",
            "floor": 1,
            "owner_ids": [],
        }
    )
    await database.users.insert_one(
        {
            "id": "u-super",
            "community_id": "platform",
            # Portfolio scoping: super admins only reach communities they own.
            "community_ids": ["mke", "other"],
            "name": "Platform Admin",
            "email": "super@communityhub.app",
            "role": "super_admin",
            "apartment_id": None,
            "phone": None,
        }
    )
    # A second, independent super admin who owns only their own community —
    # must never see mke/other (multi-super-admin isolation).
    await database.communities.insert_one(
        {"id": "rival", "name": "Rival Residency", "address": "", "apartment_count": 0}
    )
    await database.users.insert_one(
        {
            "id": "u-super-rival",
            "community_id": "rival",
            "community_ids": [],
            "name": "Rival Admin",
            "email": "super@rival.example.com",
            "role": "super_admin",
            "apartment_id": None,
            "phone": None,
        }
    )
    yield database


@pytest.fixture
async def client(db):
    app.dependency_overrides[get_db] = lambda: db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def login(client: AsyncClient, email: str) -> dict[str, str]:
    """Dev-login as a seeded user; returns auth headers."""
    resp = await client.post("/api/v1/auth/dev-login", json={"idToken": "", "email": email})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['accessToken']}"}


@pytest.fixture
async def manager_headers(client):
    return await login(client, "vishnu@communityhub.app")


@pytest.fixture
async def owner_headers(client):
    return await login(client, "owner502@example.com")


@pytest.fixture
async def auditor_headers(client):
    return await login(client, "auditor@communityhub.app")


@pytest.fixture
async def super_headers(client):
    return await login(client, "super@communityhub.app")


@pytest.fixture
async def rival_super_headers(client):
    return await login(client, "super@rival.example.com")


@pytest.fixture
async def other_manager_headers(client):
    return await login(client, "manager@other.example.com")
