async def test_dev_login_whitelisted_user(client):
    resp = await client.post(
        "/api/v1/auth/dev-login", json={"email": "vishnu@communityhub.app"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "property_manager"
    assert body["user"]["communityId"] == "mke"
    assert body["accessToken"]


async def test_unknown_email_rejected(client):
    """Whitelist enforcement — unknown accounts cannot log in."""
    resp = await client.post(
        "/api/v1/auth/dev-login", json={"email": "stranger@gmail.com"}
    )
    assert resp.status_code == 403


async def test_me_returns_current_user(client, owner_headers):
    resp = await client.get("/api/v1/auth/me", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["apartmentId"] == "apt-502"


async def test_requests_without_token_rejected(client):
    resp = await client.get("/api/v1/apartments")
    assert resp.status_code == 401


async def test_garbage_token_rejected(client):
    resp = await client.get(
        "/api/v1/apartments", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert resp.status_code == 401


async def test_access_revoked_when_removed_from_whitelist(client, db, owner_headers):
    """Deleting a user invalidates their existing tokens on the next request."""
    await db.users.delete_one({"id": "u-502"})
    resp = await client.get("/api/v1/auth/me", headers=owner_headers)
    assert resp.status_code == 403


async def test_google_login_endpoint_exists(client):
    # Invalid token should 401 via verification, not 404/500.
    resp = await client.post("/api/v1/auth/google", json={"idToken": "bad-token"})
    assert resp.status_code == 401
