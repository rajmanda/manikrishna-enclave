async def _super(client):
    login = await client.post(
        "/api/v1/auth/dev-login", json={"email": "super@communityhub.app"}
    )
    return {"Authorization": f"Bearer {login.json()['accessToken']}"}


async def test_account_crud_and_apartment_uniqueness(client, manager_headers, db):
    # Super admin in tests belongs to "platform"; use an mke super user instead.
    await db.users.update_one({"id": "u-vishnu"}, {"$set": {"role": "super_admin"}})

    created = await client.post(
        "/api/v1/accounts",
        json={"name": "Sangam Family", "apartmentIds": ["apt-301", "apt-302"]},
        headers=manager_headers,
    )
    assert created.status_code == 201
    acct = created.json()

    # One apartment = one billing account (BOOTSTRAP rule).
    clash = await client.post(
        "/api/v1/accounts",
        json={"name": "Other", "apartmentIds": ["apt-302"]},
        headers=manager_headers,
    )
    assert clash.status_code == 409

    updated = await client.patch(
        f"/api/v1/accounts/{acct['id']}",
        json={"apartmentIds": ["apt-301"]},
        headers=manager_headers,
    )
    assert updated.json()["apartmentIds"] == ["apt-301"]

    # Linked portal user blocks deletion.
    await client.patch(
        "/api/v1/users/u-301", json={"accountId": acct["id"]}, headers=manager_headers
    )
    blocked = await client.delete(
        f"/api/v1/accounts/{acct['id']}", headers=manager_headers
    )
    assert blocked.status_code == 409

    # Unlink ("" sentinel) then delete succeeds.
    await client.patch(
        "/api/v1/users/u-301", json={"accountId": ""}, headers=manager_headers
    )
    ok = await client.delete(f"/api/v1/accounts/{acct['id']}", headers=manager_headers)
    assert ok.status_code == 204


async def test_legal_owner_crud(client, manager_headers, db):
    await db.users.update_one({"id": "u-vishnu"}, {"$set": {"role": "super_admin"}})
    created = await client.post(
        "/api/v1/accounts/legal-owners",
        json={"apartmentId": "apt-501", "name": "Prof. Dr. Ramakrishna Manda",
              "ownershipPercentage": 50},
        headers=manager_headers,
    )
    assert created.status_code == 201
    lo = created.json()

    updated = await client.patch(
        f"/api/v1/accounts/legal-owners/{lo['id']}",
        json={"ownershipPercentage": 60},
        headers=manager_headers,
    )
    assert updated.json()["ownershipPercentage"] == 60

    listed = await client.get(
        "/api/v1/accounts/legal-owners", headers=manager_headers
    )
    assert any(o["id"] == lo["id"] for o in listed.json())

    deleted = await client.delete(
        f"/api/v1/accounts/legal-owners/{lo['id']}", headers=manager_headers
    )
    assert deleted.status_code == 204


async def test_ownership_writes_are_super_admin_only(client, manager_headers):
    # property_manager (default fixture role) cannot restructure ownership.
    denied = await client.post(
        "/api/v1/accounts",
        json={"name": "X", "apartmentIds": ["apt-101"]},
        headers=manager_headers,
    )
    assert denied.status_code == 403
    denied2 = await client.post(
        "/api/v1/accounts/legal-owners",
        json={"apartmentId": "apt-101", "name": "X"},
        headers=manager_headers,
    )
    assert denied2.status_code == 403
