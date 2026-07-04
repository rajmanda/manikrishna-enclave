async def test_owner_sees_only_own_invoices(client, owner_headers):
    resp = await client.get("/api/v1/invoices", headers=owner_headers)
    assert resp.status_code == 200
    invoices = resp.json()
    assert len(invoices) == 1
    assert all(i["apartmentId"] == "apt-502" for i in invoices)


async def test_manager_sees_all_invoices(client, manager_headers):
    resp = await client.get("/api/v1/invoices", headers=manager_headers)
    assert len(resp.json()) == 10


async def test_owner_sees_only_own_payments(client, owner_headers, manager_headers):
    owner = await client.get("/api/v1/payments", headers=owner_headers)
    assert owner.json() == []  # apt-502 hasn't paid June yet

    manager = await client.get("/api/v1/payments", headers=manager_headers)
    assert len(manager.json()) == 7


async def test_expenses_visible_to_owners(client, owner_headers):
    resp = await client.get("/api/v1/expenses", headers=owner_headers)
    assert resp.status_code == 200
    assert sum(e["amount"] for e in resp.json()) == 44830


async def test_community_summary_computed_from_real_data(client, owner_headers, manager_headers):
    from datetime import date
    today = date.today().isoformat()

    before = (await client.get("/api/v1/finance/summary", headers=owner_headers)).json()
    assert before["outstandingDues"] == 12000
    assert before["reserveFundBalance"] == 121000

    await client.post(
        "/api/v1/expenses",
        json={"category": "Water", "description": "Tanker today", "amount": 900,
              "paidDate": today},
        headers=manager_headers,
    )
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 1000, "date": today,
              "method": "UPI", "reference": "T1"},
        headers=manager_headers,
    )
    after = (await client.get("/api/v1/finance/summary", headers=owner_headers)).json()
    assert after["monthExpenses"] == before["monthExpenses"] + 900
    assert after["monthIncome"] == before["monthIncome"] + 1000
    assert after["outstandingDues"] == 11000


async def test_reserve_fund_and_monthly_finance(client, owner_headers, manager_headers):
    reserve = await client.get("/api/v1/reserve-fund", headers=owner_headers)
    assert len(reserve.json()) == 6
    assert reserve.json()[-1]["balance"] == 121000

    # Monthly series is computed from live data: activity in the current
    # month must land in the latest bucket.
    from datetime import date
    today = date.today().isoformat()
    await client.post(
        "/api/v1/expenses",
        json={"category": "Repairs", "description": "Bucket test", "amount": 700,
              "paidDate": today},
        headers=manager_headers,
    )
    monthly = (await client.get("/api/v1/finance/monthly", headers=owner_headers)).json()
    assert len(monthly) == 6
    assert monthly[-1]["expenses"] >= 700


async def test_work_orders_visible_to_all_members(client, owner_headers):
    listing = await client.get("/api/v1/work-orders", headers=owner_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 5

    detail = await client.get("/api/v1/work-orders/wo-1", headers=owner_headers)
    assert detail.status_code == 200
    assert detail.json()["stage"] == "In Progress"
    assert len(detail.json()["timeline"]) == 4


async def test_work_orders_isolated_between_communities(client, other_manager_headers):
    listing = await client.get("/api/v1/work-orders", headers=other_manager_headers)
    assert listing.json() == []
    detail = await client.get("/api/v1/work-orders/wo-1", headers=other_manager_headers)
    assert detail.status_code == 404


async def test_vendors_list(client, manager_headers):
    resp = await client.get("/api/v1/vendors", headers=manager_headers)
    assert resp.status_code == 200
    vendors = resp.json()
    assert len(vendors) == 8
    lift = next(v for v in vendors if v["id"] == "v-lift")
    assert lift["gst"] == "36AAACS1111A1Z5"
    assert lift["amcExpiry"] == "2026-12-31"


async def test_seeded_auditor_can_read_finance(client, auditor_headers):
    resp = await client.get("/api/v1/invoices", headers=auditor_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 10
