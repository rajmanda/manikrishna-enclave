"""Platform insights (CEO dashboard): login tracking + portfolio-scoped rollup."""


async def test_login_stamps_last_login_and_count(client, db):
    before = await db.users.find_one({"email": "owner101@example.com"})
    assert before.get("last_login") is None

    resp = await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": "owner101@example.com"}
    )
    assert resp.status_code == 200
    after = await db.users.find_one({"email": "owner101@example.com"})
    assert after["last_login"] is not None
    assert after["login_count"] == 1

    await client.post(
        "/api/v1/auth/dev-login", json={"idToken": "", "email": "owner101@example.com"}
    )
    twice = await db.users.find_one({"email": "owner101@example.com"})
    assert twice["login_count"] == 2


async def test_insights_super_admin_only(client, manager_headers, owner_headers):
    for headers in (manager_headers, owner_headers):
        resp = await client.get("/api/v1/insights/platform", headers=headers)
        assert resp.status_code == 403


async def test_insights_portfolio_scoped(client, super_headers, rival_super_headers):
    resp = await client.get("/api/v1/insights/platform", headers=super_headers)
    assert resp.status_code == 200
    data = resp.json()
    cids = {c["id"] for c in data["communities"]}
    # u-super owns mke + other (home community "platform" has no community doc).
    assert {"mke", "other"} <= cids and "rival" not in cids
    assert data["totals"]["users"] > 0
    assert data["totals"]["apartments"] >= 11  # 10 mke + 1 other
    # Funnel stages are monotonically non-increasing.
    counts = [s["count"] for s in data["funnel"]]
    assert counts == sorted(counts, reverse=True)
    # The super admin logged in to call this — at least one activated user.
    assert data["totals"]["activatedUsers"] >= 1
    adoption_cids = {r["communityId"] for r in data["userAdoption"]}
    assert "rival" not in adoption_cids

    # The rival super admin sees only their own community.
    rival = await client.get(
        "/api/v1/insights/platform", headers=rival_super_headers
    )
    rival_cids = {c["id"] for c in rival.json()["communities"]}
    assert rival_cids == {"rival"}
    assert not {"mke", "other"} & rival_cids


async def test_insights_activity_and_finance_shape(client, super_headers, manager_headers):
    # A write generates audit activity that must show up in the series.
    await client.post(
        "/api/v1/invoices",
        json={"apartmentId": "apt-101", "period": "Aug 2026",
              "description": "Insights probe", "amount": 100,
              "dueDate": "2099-01-01"},
        headers=manager_headers,
    )
    data = (
        await client.get("/api/v1/insights/platform", headers=super_headers)
    ).json()
    assert len(data["activitySeries"]) == 30
    assert data["totals"]["actions30d"] >= 1
    assert sum(d["actions"] for d in data["activitySeries"]) >= 1
    assert any(m["module"] == "Invoices" for m in data["moduleUsage"])
    assert data["totals"]["billed"] > 0
    mke = next(c for c in data["communities"] if c["id"] == "mke")
    assert mke["billed"] > 0 and 0 <= mke["collectionRate"] <= 100
