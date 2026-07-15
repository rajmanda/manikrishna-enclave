import pytest
from app.core.config import get_settings

@pytest.fixture(autouse=True)
def setup_settings():
    settings = get_settings()
    # Save original values
    orig_dev_mode = settings.dev_mode
    orig_env = settings.environment
    orig_db_name = settings.db_name

    # Set up defaults for tests
    settings.dev_mode = True
    settings.environment = "dev"
    settings.db_name = "communityhub_dev"

    yield

    # Restore original values
    settings.dev_mode = orig_dev_mode
    settings.environment = orig_env
    settings.db_name = orig_db_name


async def test_refresh_db_endpoint_success(client, db, super_headers):
    # Setup some test collections in both databases to check copying
    client_mock = db.client
    src_db = client_mock["communityhub"]

    # Clear source collections first
    await src_db.users.drop()
    # Add dummy document to source
    await src_db.users.insert_one({"id": "prod-user", "email": "prod@example.com"})

    resp = await client.post("/api/v1/dev/refresh-db", headers=super_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    # Verify target collection has been populated with the prod document
    doc = await db.users.find_one({"id": "prod-user"})
    assert doc is not None
    assert doc["email"] == "prod@example.com"


async def test_refresh_db_endpoint_unauthorized_without_token(client):
    resp = await client.post("/api/v1/dev/refresh-db")
    assert resp.status_code == 401


async def test_refresh_db_endpoint_forbidden_for_non_super_admin(client, owner_headers):
    resp = await client.post("/api/v1/dev/refresh-db", headers=owner_headers)
    assert resp.status_code == 403


async def test_refresh_db_endpoint_disabled_dev_mode(client, super_headers):
    settings = get_settings()
    settings.dev_mode = False

    resp = await client.post("/api/v1/dev/refresh-db", headers=super_headers)
    assert resp.status_code == 404


async def test_refresh_db_endpoint_wrong_env(client, super_headers):
    settings = get_settings()
    settings.environment = "production"

    resp = await client.post("/api/v1/dev/refresh-db", headers=super_headers)
    assert resp.status_code == 403


async def test_refresh_db_endpoint_prod_db_safety(client, super_headers):
    settings = get_settings()
    settings.db_name = "communityhub"

    resp = await client.post("/api/v1/dev/refresh-db", headers=super_headers)
    assert resp.status_code == 400
