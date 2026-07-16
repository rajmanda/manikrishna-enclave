async def test_switch_role_changes_scoping_end_to_end(client, manager_headers, db):
    # Give Vishnu dual roles + an apartment so he can act as its owner.
    await client.patch(
        "/api/v1/users/u-vishnu",
        json={"roles": ["property_manager", "owner"], "apartmentId": "apt-101"},
        headers=manager_headers,
    )

    switched = await client.post(
        "/api/v1/auth/switch-role", json={"role": "owner"}, headers=manager_headers
    )
    assert switched.status_code == 200
    assert switched.json()["user"]["role"] == "owner"

    # Server-side scoping follows: invoices now limited to apt-101.
    invoices = await client.get("/api/v1/invoices", headers=manager_headers)
    assert all(i["apartmentId"] == "apt-101" for i in invoices.json())

    # Write endpoints now deny (acting as owner).
    denied = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "X", "dueDate": "2026-08-01"},
        headers=manager_headers,
    )
    assert denied.status_code == 403

    # Switch back restores manager powers.
    back = await client.post(
        "/api/v1/auth/switch-role",
        json={"role": "property_manager"},
        headers=manager_headers,
    )
    assert back.json()["user"]["role"] == "property_manager"
    all_inv = await client.get("/api/v1/invoices", headers=manager_headers)
    assert len(all_inv.json()) == 10


async def test_switch_role_guards(client, manager_headers, owner_headers):
    # Single-role owner cannot switch to manager.
    denied = await client.post(
        "/api/v1/auth/switch-role",
        json={"role": "property_manager"},
        headers=owner_headers,
    )
    assert denied.status_code == 403

    # Dual-role without an apartment cannot enter owner view.
    await client.patch(
        "/api/v1/users/u-vishnu",
        json={"roles": ["property_manager", "owner"]},
        headers=manager_headers,
    )
    no_apt = await client.post(
        "/api/v1/auth/switch-role", json={"role": "owner"}, headers=manager_headers
    )
    assert no_apt.status_code == 400


async def test_email_change_rekeys_whitelist(client, manager_headers, db):
    changed = await client.patch(
        "/api/v1/users/u-501",
        json={"email": "Prof.Ramakrishna@Gmail.com"},
        headers=manager_headers,
    )
    assert changed.status_code == 200
    assert changed.json()["email"] == "prof.ramakrishna@gmail.com"  # normalized

    # New email logs in; the old one is no longer whitelisted.
    new_login = await client.post(
        "/api/v1/auth/dev-login", json={"email": "prof.ramakrishna@gmail.com"}
    )
    assert new_login.status_code == 200
    old_login = await client.post(
        "/api/v1/auth/dev-login", json={"email": "owner501@example.com"}
    )
    assert old_login.status_code == 403

    # Audited.
    entries = await db.audit_log.find({"entity_id": "u-501"}).to_list(10)
    assert any(e["details"].get("email") == "prof.ramakrishna@gmail.com" for e in entries)


async def test_email_change_duplicate_rejected(client, manager_headers):
    dup = await client.patch(
        "/api/v1/users/u-501",
        json={"email": "owner502@example.com"},
        headers=manager_headers,
    )
    assert dup.status_code == 409


async def test_migration_backfills_roles(db):
    vishnu = await db.users.find_one({"id": "u-vishnu"})
    assert vishnu["roles"] == ["property_manager"]


async def test_super_user_switches_through_all_roles(client, manager_headers):
    # Vishnu becomes a super user with every switchable role.
    await client.patch(
        "/api/v1/users/u-vishnu",
        json={"roles": ["super_admin", "community_admin", "property_manager",
                        "owner", "tenant", "auditor"],
              "apartmentId": "apt-101"},
        headers=manager_headers,
    )

    # Auditor view: reads fine, writes denied.
    await client.post(
        "/api/v1/auth/switch-role", json={"role": "auditor"}, headers=manager_headers
    )
    read = await client.get("/api/v1/audit-log", headers=manager_headers)
    assert read.status_code == 200
    write = await client.post(
        "/api/v1/expenses",
        json={"category": "Water", "description": "x", "amount": 1,
              "paidDate": "2026-07-04"},
        headers=manager_headers,
    )
    assert write.status_code == 403

    # Tenant view: no money data at all (lite experience).
    await client.post(
        "/api/v1/auth/switch-role", json={"role": "tenant"}, headers=manager_headers
    )
    inv = await client.get("/api/v1/invoices", headers=manager_headers)
    assert inv.status_code == 403

    # Super admin view: full powers again.
    await client.post(
        "/api/v1/auth/switch-role", json={"role": "super_admin"}, headers=manager_headers
    )
    all_inv = await client.get("/api/v1/invoices", headers=manager_headers)
    assert len(all_inv.json()) == 10
