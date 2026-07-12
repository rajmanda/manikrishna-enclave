"""One email, many communities: per-community whitelist + membership switching.

The Vishnu scenario: the same manager (same Google account) serves two
communities. Each membership is its own user doc; email is unique per
community, not platform-wide.
"""

VISHNU = "vishnu@communityhub.app"  # seeded property manager of mke


async def _whitelist_vishnu_in_other(client, other_manager_headers):
    return await client.post(
        "/api/v1/users",
        json={"name": "Vishnu Manchala", "email": VISHNU, "role": "property_manager"},
        headers=other_manager_headers,
    )


async def test_same_email_allowed_in_second_community(
    client, other_manager_headers
):
    resp = await _whitelist_vishnu_in_other(client, other_manager_headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["communityId"] == "other"


async def test_same_email_still_rejected_within_one_community(
    client, manager_headers
):
    resp = await client.post(
        "/api/v1/users",
        json={"name": "Vishnu Again", "email": VISHNU, "role": "owner"},
        headers=manager_headers,  # mke — where Vishnu already exists
    )
    assert resp.status_code == 409


async def test_login_is_deterministic_with_two_memberships(
    client, other_manager_headers
):
    await _whitelist_vishnu_in_other(client, other_manager_headers)
    resp = await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": VISHNU}
    )
    assert resp.status_code == 200
    # "mke" < "other": home community wins deterministically.
    assert resp.json()["user"]["communityId"] == "mke"


async def test_memberships_listing_and_switch(client, other_manager_headers):
    await _whitelist_vishnu_in_other(client, other_manager_headers)
    login = await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": VISHNU}
    )
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

    memberships = await client.get("/api/v1/auth/memberships", headers=headers)
    assert memberships.status_code == 200
    by_cid = {m["communityId"]: m for m in memberships.json()}
    assert set(by_cid) == {"mke", "other"}
    assert by_cid["other"]["communityName"] == "Other Towers"

    switched = await client.post(
        "/api/v1/auth/switch-membership",
        json={"communityId": "other"},
        headers=headers,
    )
    assert switched.status_code == 200
    acting = {"Authorization": f"Bearer {switched.json()['accessToken']}"}

    me = await client.get("/api/v1/auth/me", headers=acting)
    assert me.json()["communityId"] == "other"
    assert me.json()["role"] == "property_manager"

    # Writes land in the switched community.
    created = await client.post(
        "/api/v1/apartments",
        json={"number": "O-9", "floor": 9},
        headers=acting,
    )
    assert created.status_code == 201
    assert created.json()["communityId"] == "other"


async def test_switch_membership_requires_existing_membership(
    client, manager_headers
):
    resp = await client.post(
        "/api/v1/auth/switch-membership",
        json={"communityId": "other"},
        headers=manager_headers,  # Vishnu has no membership in "other" here
    )
    assert resp.status_code == 403


async def test_owner_here_tenant_there(client, manager_headers, other_manager_headers):
    """Same email: owner in mke, tenant in other — role follows membership."""
    email = "dualresident@example.com"
    in_mke = await client.post(
        "/api/v1/users",
        json={"name": "Dual Resident", "email": email, "role": "owner",
              "apartmentId": "apt-101"},
        headers=manager_headers,
    )
    assert in_mke.status_code == 201, in_mke.text
    in_other = await client.post(
        "/api/v1/users",
        json={"name": "Dual Resident", "email": email, "role": "tenant",
              "apartmentId": "apt-other-1"},
        headers=other_manager_headers,
    )
    assert in_other.status_code == 201, in_other.text

    login = await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": email}
    )
    assert login.json()["user"]["role"] == "owner"  # mke membership first
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

    switched = await client.post(
        "/api/v1/auth/switch-membership",
        json={"communityId": "other"},
        headers=headers,
    )
    me = switched.json()["user"]
    assert me["communityId"] == "other"
    assert me["role"] == "tenant"
    assert me["apartmentId"] == "apt-other-1"


async def test_owner_with_apartments_in_two_communities(
    client, manager_headers, other_manager_headers
):
    """Owner owns a flat in each community — each membership shows its own
    apartment, and the switcher moves between them."""
    email = "twoflats@example.com"
    assert (
        await client.post(
            "/api/v1/users",
            json={"name": "Two Flats", "email": email, "role": "owner",
                  "apartmentId": "apt-101"},
            headers=manager_headers,
        )
    ).status_code == 201
    assert (
        await client.post(
            "/api/v1/users",
            json={"name": "Two Flats", "email": email, "role": "owner",
                  "apartmentId": "apt-other-1"},
            headers=other_manager_headers,
        )
    ).status_code == 201

    login = await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": email}
    )
    assert login.json()["user"]["apartmentId"] == "apt-101"  # mke membership
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

    switched = await client.post(
        "/api/v1/auth/switch-membership",
        json={"communityId": "other"},
        headers=headers,
    )
    me = switched.json()["user"]
    assert me["role"] == "owner"
    assert me["communityId"] == "other"
    assert me["apartmentId"] == "apt-other-1"


async def test_auditor_membership_switching(client, manager_headers, other_manager_headers):
    """Auditors (and any other role) get the same membership switching."""
    email = "sharedauditor@example.com"
    for headers in (manager_headers, other_manager_headers):
        resp = await client.post(
            "/api/v1/users",
            json={"name": "Shared Auditor", "email": email, "role": "auditor"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text

    login = await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": email}
    )
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    switched = await client.post(
        "/api/v1/auth/switch-membership",
        json={"communityId": "other"},
        headers=headers,
    )
    acting = {"Authorization": f"Bearer {switched.json()['accessToken']}"}
    assert switched.json()["user"]["role"] == "auditor"

    # Read-only in the switched community still enforced.
    write = await client.post(
        "/api/v1/apartments",
        json={"number": "O-99", "floor": 9},
        headers=acting,
    )
    assert write.status_code == 403


async def test_memberships_do_not_leak_across_emails(client, other_manager_headers):
    """Another user in the same communities sees only their own memberships."""
    memberships = await client.get(
        "/api/v1/auth/memberships", headers=other_manager_headers
    )
    assert [m["communityId"] for m in memberships.json()] == ["other"]
