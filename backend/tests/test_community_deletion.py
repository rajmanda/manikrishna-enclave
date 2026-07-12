"""Cascade community deletion: everything inside goes, memberships elsewhere survive."""

VISHNU = "vishnu@communityhub.app"  # seeded manager of mke


async def test_delete_cascades_but_keeps_other_memberships(
    client, super_headers, other_manager_headers, db
):
    # Vishnu also becomes a member of "other" (the Vishnu scenario).
    resp = await client.post(
        "/api/v1/users",
        json={"name": "Vishnu Manchala", "email": VISHNU, "role": "property_manager"},
        headers=other_manager_headers,
    )
    assert resp.status_code == 201

    deleted = await client.delete("/api/v1/communities/other", headers=super_headers)
    assert deleted.status_code == 204, deleted.text

    # Community and its contents are gone...
    assert await db.communities.find_one({"id": "other"}) is None
    assert await db.apartments.count_documents({"community_id": "other"}) == 0
    assert await db.users.count_documents({"community_id": "other"}) == 0

    # ...but Vishnu's mke membership is untouched.
    assert await db.users.find_one({"community_id": "mke", "email": VISHNU}) is not None

    # And the owner's portfolio no longer lists it.
    u_super = await db.users.find_one({"id": "u-super"})
    assert "other" not in u_super["community_ids"]

    # Portfolio stats no longer include it.
    stats = await client.get(
        "/api/v1/communities/portfolio/stats", headers=super_headers
    )
    assert "Other Towers" not in {c["name"] for c in stats.json()}


async def test_cannot_delete_home_community(client, rival_super_headers):
    resp = await client.delete("/api/v1/communities/rival", headers=rival_super_headers)
    assert resp.status_code == 400


async def test_cannot_delete_unowned_community(client, rival_super_headers, db):
    resp = await client.delete("/api/v1/communities/mke", headers=rival_super_headers)
    assert resp.status_code == 403
    assert await db.communities.find_one({"id": "mke"}) is not None


async def test_delete_forbidden_for_non_super_roles(client, manager_headers, db):
    resp = await client.delete("/api/v1/communities/other", headers=manager_headers)
    assert resp.status_code == 403
    assert await db.communities.find_one({"id": "other"}) is not None


async def test_deletion_is_audited_in_home_community(client, super_headers, db):
    await client.delete("/api/v1/communities/other", headers=super_headers)
    entry = await db.audit_log.find_one(
        {"entity": "communities", "entity_id": "other", "action": "delete"}
    )
    assert entry is not None
    assert entry["community_id"] == "platform"  # actor's home, not the deleted one
    assert entry["details"]["name"] == "Other Towers"
