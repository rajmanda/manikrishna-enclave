"""Super-admin portfolio console: cross-community stats rollup."""

STATS_URL = "/api/v1/communities/portfolio/stats"


async def test_portfolio_stats_lists_owned_communities(client, super_headers):
    resp = await client.get(STATS_URL, headers=super_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    names = {c["name"] for c in data}
    assert "Other Towers" in names  # second community from conftest
    assert len(data) >= 2
    # Owned-scope: another super admin's community never appears.
    assert "Rival Residency" not in names


async def test_portfolio_stats_shape_and_invariants(client, super_headers):
    resp = await client.get(STATS_URL, headers=super_headers)
    assert resp.status_code == 200
    for c in resp.json():
        assert {
            "id",
            "name",
            "apartmentCount",
            "invoicedTotal",
            "collectedTotal",
            "outstandingTotal",
            "collectionRate",
            "openInvoices",
            "openWorkOrders",
        } <= c.keys()
        assert 0 <= c["collectionRate"] <= 100
        assert c["invoicedTotal"] == c["collectedTotal"] + c["outstandingTotal"]


async def test_portfolio_stats_counts_seeded_apartments(client, super_headers):
    resp = await client.get(STATS_URL, headers=super_headers)
    by_name = {c["name"]: c for c in resp.json()}
    assert by_name["Other Towers"]["apartmentCount"] == 1


async def test_portfolio_stats_forbidden_for_other_roles(
    client, manager_headers, owner_headers, auditor_headers
):
    for headers in (manager_headers, owner_headers, auditor_headers):
        resp = await client.get(STATS_URL, headers=headers)
        assert resp.status_code == 403, resp.text


# ---------- Multi-super-admin isolation ----------


async def test_rival_super_admin_sees_only_own_portfolio(client, rival_super_headers):
    stats = await client.get(STATS_URL, headers=rival_super_headers)
    assert stats.status_code == 200
    assert {c["name"] for c in stats.json()} == {"Rival Residency"}

    communities = await client.get("/api/v1/communities", headers=rival_super_headers)
    assert {c["name"] for c in communities.json()} == {"Rival Residency"}


async def test_rival_super_admin_cannot_read_foreign_community(
    client, rival_super_headers
):
    direct = await client.get("/api/v1/communities/mke", headers=rival_super_headers)
    assert direct.status_code == 403

    apartments = await client.get(
        "/api/v1/apartments?community_id=mke", headers=rival_super_headers
    )
    assert apartments.status_code == 403


async def test_rival_super_admin_cannot_delete_foreign_records(
    client, rival_super_headers, db
):
    # wo-1 belongs to mke — deletion must scoped-miss (404), not succeed.
    resp = await client.delete("/api/v1/work-orders/wo-1", headers=rival_super_headers)
    assert resp.status_code == 404
    assert await db.work_orders.find_one({"id": "wo-1"}) is not None


async def test_created_community_joins_creator_portfolio_only(
    client, rival_super_headers, super_headers
):
    created = await client.post(
        "/api/v1/communities",
        json={"name": "Rival Phase 2", "address": "Pune"},
        headers=rival_super_headers,
    )
    assert created.status_code == 201

    rival_stats = await client.get(STATS_URL, headers=rival_super_headers)
    assert "Rival Phase 2" in {c["name"] for c in rival_stats.json()}

    other_stats = await client.get(STATS_URL, headers=super_headers)
    assert "Rival Phase 2" not in {c["name"] for c in other_stats.json()}
