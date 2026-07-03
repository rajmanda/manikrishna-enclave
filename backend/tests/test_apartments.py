async def test_list_apartments_scoped_to_community(client, manager_headers, other_manager_headers):
    mke = await client.get("/api/v1/apartments", headers=manager_headers)
    assert mke.status_code == 200
    numbers = {a["number"] for a in mke.json()}
    assert numbers == {"101", "102", "201", "202", "301", "302", "401", "402", "501", "502"}

    other = await client.get("/api/v1/apartments", headers=other_manager_headers)
    assert {a["number"] for a in other.json()} == {"O-1"}


async def test_cannot_read_apartment_of_other_community(client, other_manager_headers):
    resp = await client.get("/api/v1/apartments/apt-101", headers=other_manager_headers)
    assert resp.status_code == 404


async def test_apartment_crud_and_audit_trail(client, db, manager_headers):
    created = await client.post(
        "/api/v1/apartments",
        json={"number": "601", "floor": 6},
        headers=manager_headers,
    )
    assert created.status_code == 201
    apt_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/apartments/{apt_id}",
        json={"ownerIds": ["u-101"]},
        headers=manager_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["ownerIds"] == ["u-101"]

    deleted = await client.delete(
        f"/api/v1/apartments/{apt_id}", headers=manager_headers
    )
    assert deleted.status_code == 204

    # Every modification must be in the audit log (PRD security requirement).
    entries = await db.audit_log.find({"entity_id": apt_id}).to_list(length=10)
    assert [e["action"] for e in entries] == ["create", "update", "delete"]
    assert all(e["user_name"] == "Vishnu" for e in entries)


async def test_duplicate_apartment_number_rejected(client, manager_headers):
    resp = await client.post(
        "/api/v1/apartments",
        json={"number": "101", "floor": 1},
        headers=manager_headers,
    )
    assert resp.status_code == 409


async def test_users_list_scoped_and_owner_readable(client, owner_headers):
    resp = await client.get("/api/v1/users", headers=owner_headers)
    assert resp.status_code == 200
    assert all(u["communityId"] == "mke" for u in resp.json())
