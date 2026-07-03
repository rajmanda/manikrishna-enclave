async def test_owner_cannot_create_apartment(client, owner_headers):
    resp = await client.post(
        "/api/v1/apartments",
        json={"number": "601", "floor": 6},
        headers=owner_headers,
    )
    assert resp.status_code == 403


async def test_auditor_is_read_only(client, auditor_headers):
    read = await client.get("/api/v1/apartments", headers=auditor_headers)
    assert read.status_code == 200
    write = await client.post(
        "/api/v1/users",
        json={"name": "X", "email": "x@example.com"},
        headers=auditor_headers,
    )
    assert write.status_code == 403


async def test_manager_can_whitelist_user(client, manager_headers):
    resp = await client.post(
        "/api/v1/users",
        json={
            "name": "New Tenant",
            "email": "Tenant502@Gmail.com",
            "role": "tenant",
            "apartmentId": "apt-502",
        },
        headers=manager_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "tenant502@gmail.com"  # normalized

    # The new user can now log in.
    login_resp = await client.post(
        "/api/v1/auth/dev-login", json={"email": "tenant502@gmail.com"}
    )
    assert login_resp.status_code == 200


async def test_only_super_admin_creates_communities(client, manager_headers, super_headers):
    denied = await client.post(
        "/api/v1/communities", json={"name": "New Community"}, headers=manager_headers
    )
    assert denied.status_code == 403

    allowed = await client.post(
        "/api/v1/communities",
        json={"name": "Sunrise Apartments", "address": "Vizag"},
        headers=super_headers,
    )
    assert allowed.status_code == 201


async def test_owner_dashboard_and_manager_dashboard(client, owner_headers, manager_headers):
    owner = await client.get("/api/v1/dashboard/owner", headers=owner_headers)
    assert owner.status_code == 200
    body = owner.json()
    assert body["outstandingBalance"] == 3500  # apt-502 June invoice unpaid
    assert body["reserveFundBalance"] == 121000

    mgr = await client.get("/api/v1/dashboard/manager", headers=manager_headers)
    assert mgr.status_code == 200
    mbody = mgr.json()
    assert mbody["overdueInvoices"] == 2
    assert mbody["pendingApprovals"] == 2  # wo-3 (Owner Approval) + wo-5 (Estimate)
    # 6 paid × ₹3,500 + one partial ₹2,000
    assert mbody["paymentsReceived"] == 23000
    assert mbody["outstandingCollections"] == 12000


async def test_owner_cannot_access_manager_dashboard(client, owner_headers):
    resp = await client.get("/api/v1/dashboard/manager", headers=owner_headers)
    assert resp.status_code == 403
