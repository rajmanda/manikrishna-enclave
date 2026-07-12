"""Super-admin community switching: act inside an owned community."""

from httpx import AsyncClient

SWITCH_URL = "/api/v1/auth/switch-community"


async def _switch(client: AsyncClient, headers: dict, community_id: str):
    return await client.post(
        SWITCH_URL, json={"communityId": community_id}, headers=headers
    )


async def test_switch_to_owned_community_scopes_reads(client, super_headers):
    resp = await _switch(client, super_headers, "other")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["communityId"] == "other"
    acting = {"Authorization": f"Bearer {body['accessToken']}"}

    me = await client.get("/api/v1/auth/me", headers=acting)
    assert me.json()["communityId"] == "other"

    apartments = await client.get("/api/v1/apartments", headers=acting)
    assert {a["communityId"] for a in apartments.json()} == {"other"}


async def test_switch_scopes_writes_to_acting_community(client, super_headers, db):
    resp = await _switch(client, super_headers, "other")
    acting = {"Authorization": f"Bearer {resp.json()['accessToken']}"}

    created = await client.post(
        "/api/v1/apartments",
        json={"number": "O-2", "floor": 2},
        headers=acting,
    )
    assert created.status_code == 201, created.text
    doc = await db.apartments.find_one({"number": "O-2"})
    assert doc["community_id"] == "other"


async def test_acting_super_admin_keeps_full_portfolio(client, super_headers):
    resp = await _switch(client, super_headers, "other")
    acting = {"Authorization": f"Bearer {resp.json()['accessToken']}"}

    stats = await client.get(
        "/api/v1/communities/portfolio/stats", headers=acting
    )
    names = {c["name"] for c in stats.json()}
    assert "Other Towers" in names
    assert len(names) >= 2  # home portfolio retained while acting

    # And can switch again from the acting token (e.g. back to another owned).
    back = await _switch(client, acting, "mke")
    assert back.status_code == 200
    assert back.json()["user"]["communityId"] == "mke"


async def test_switch_to_unowned_community_forbidden(client, rival_super_headers):
    resp = await _switch(client, rival_super_headers, "mke")
    assert resp.status_code == 403


async def test_switch_forbidden_for_non_super_roles(
    client, manager_headers, owner_headers, auditor_headers
):
    for headers in (manager_headers, owner_headers, auditor_headers):
        resp = await _switch(client, headers, "mke")
        assert resp.status_code == 403, resp.text


async def test_acting_token_survives_ownership_check_each_request(
    client, super_headers, db
):
    """If ownership is revoked mid-session, the acting override falls back
    to the home community instead of granting stale access."""
    resp = await _switch(client, super_headers, "other")
    acting = {"Authorization": f"Bearer {resp.json()['accessToken']}"}

    await db.users.update_one({"id": "u-super"}, {"$set": {"community_ids": ["mke"]}})

    me = await client.get("/api/v1/auth/me", headers=acting)
    assert me.status_code == 200
    assert me.json()["communityId"] == "platform"  # fell back to home
