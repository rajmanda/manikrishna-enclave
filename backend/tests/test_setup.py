"""Setup Assistant: status counts and one-call-per-flat resident batch."""

STATUS_URL = "/api/v1/setup/status"
RESIDENTS_URL = "/api/v1/setup/residents"


async def test_status_reflects_fresh_community(client, other_manager_headers):
    resp = await client.get(STATUS_URL, headers=other_manager_headers)
    assert resp.status_code == 200
    s = resp.json()
    assert s["apartments"] == 1  # apt-other-1 from conftest
    assert s["flatsWithHousehold"] == 0
    assert s["owners"] == 0
    assert s["managers"] == 1


async def test_residents_batch_creates_household_owner_legal_and_tenant(
    client, other_manager_headers, db
):
    resp = await client.post(
        RESIDENTS_URL,
        json=[
            {
                "apartmentId": "apt-other-1",
                "ownerName": "Anil Kumar",
                "ownerEmail": "Anil.Kumar@example.com",
                "ownerPhone": "+919999999999",
                "tenantName": "Ravi Rao",
                "tenantEmail": "ravi.rao@example.com",
            }
        ],
        headers=other_manager_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == [{"apartmentId": "apt-other-1", "ok": True, "error": None}]

    account = await db.accounts.find_one({"community_id": "other", "name": "Anil Kumar"})
    assert account and account["apartment_ids"] == ["apt-other-1"]

    owner = await db.users.find_one({"community_id": "other", "email": "anil.kumar@example.com"})
    assert owner["role"] == "owner"
    assert owner["account_id"] == account["id"]
    assert owner["apartment_id"] == "apt-other-1"

    legal = await db.legal_owners.find_one({"community_id": "other", "apartment_id": "apt-other-1"})
    assert legal["name"] == "Anil Kumar"
    assert legal["ownership_percentage"] == 100.0

    tenant = await db.users.find_one({"community_id": "other", "email": "ravi.rao@example.com"})
    assert tenant["role"] == "tenant"
    assert tenant["apartment_id"] == "apt-other-1"

    status = await client.get(STATUS_URL, headers=other_manager_headers)
    s = status.json()
    assert s["flatsWithHousehold"] == 1
    assert s["owners"] == 1
    assert s["tenants"] == 1


async def test_residents_rows_fail_independently(client, other_manager_headers):
    first = await client.post(
        RESIDENTS_URL,
        json=[{"apartmentId": "apt-other-1", "ownerName": "A", "ownerEmail": "a@example.com"}],
        headers=other_manager_headers,
    )
    assert first.json()[0]["ok"] is True

    second = await client.post(
        RESIDENTS_URL,
        json=[
            # Same flat again — must fail with a friendly message...
            {"apartmentId": "apt-other-1", "ownerName": "B", "ownerEmail": "b@example.com"},
            # ...while an unknown flat fails with its own message.
            {"apartmentId": "apt-missing", "ownerName": "C", "ownerEmail": "c@example.com"},
        ],
        headers=other_manager_headers,
    )
    results = second.json()
    assert results[0]["ok"] is False
    assert "household" in results[0]["error"]
    assert results[1]["ok"] is False
    assert results[1]["error"] == "Flat not found"


async def test_duplicate_household_name_gets_flat_suffix(
    client, other_manager_headers, db
):
    # Two flats, both owned by people named "Sam Rao".
    created = await client.post(
        "/api/v1/apartments",
        json={"number": "O-2", "floor": 2},
        headers=other_manager_headers,
    )
    apt2 = created.json()["id"]
    resp = await client.post(
        RESIDENTS_URL,
        json=[
            {"apartmentId": "apt-other-1", "ownerName": "Sam Rao", "ownerEmail": "sam1@example.com"},
            {"apartmentId": apt2, "ownerName": "Sam Rao", "ownerEmail": "sam2@example.com"},
        ],
        headers=other_manager_headers,
    )
    assert [r["ok"] for r in resp.json()] == [True, True]
    accounts = await db.accounts.find({"community_id": "other"}).to_list(length=10)
    assert sorted(a["name"] for a in accounts) == ["Sam Rao", "Sam Rao (O-2)"]


async def test_residents_requires_write_role(client, owner_headers, auditor_headers):
    for headers in (owner_headers, auditor_headers):
        resp = await client.post(
            RESIDENTS_URL,
            json=[{"apartmentId": "apt-101", "ownerName": "X", "ownerEmail": "x@example.com"}],
            headers=headers,
        )
        assert resp.status_code == 403

    # Auditor may still read status.
    status = await client.get(STATUS_URL, headers=auditor_headers)
    assert status.status_code == 200
