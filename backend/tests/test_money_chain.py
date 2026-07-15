"""Money-chain integrity: reserve reconciliation + links across
maintenance request → work order → expense → invoice → payment."""


async def test_reserve_reconciliation_flags_unanchored_activity(
    client, manager_headers, db
):
    """A payment booked into the already-closed anchor month must surface as
    unanchored (the June bore well failure mode)."""
    # Seed closes Jun with contributions matching the seeded June payments.
    base = await client.get(
        "/api/v1/reserve-fund/reconciliation", headers=manager_headers
    )
    assert base.status_code == 200
    data = base.json()
    assert data["anchorMonth"] == "Jun"
    assert data["anchorCutoff"] == "2026-06-30"
    before_gap = data["unanchoredContributions"]

    # Record a payment DATED inside the closed month (Jun) against a due
    # June invoice — invisible to the live reserve, must be flagged.
    paid = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-201", "amount": 500, "date": "2026-06-28",
              "method": "Cash", "reference": "backdated"},
        headers=manager_headers,
    )
    assert paid.status_code == 201
    summary_before = await client.get(
        "/api/v1/finance/summary", headers=manager_headers
    )

    recon = (
        await client.get(
            "/api/v1/reserve-fund/reconciliation", headers=manager_headers
        )
    ).json()
    assert recon["unanchoredContributions"] == before_gap + 500
    # And indeed the live reserve did NOT move (that's the whole problem).
    summary_after = await client.get(
        "/api/v1/finance/summary", headers=manager_headers
    )
    assert (
        summary_after.json()["reserveFundBalance"]
        == summary_before.json()["reserveFundBalance"]
    )


async def test_reconciliation_ignores_personal_ledgers(client, manager_headers, db):
    """Manager-fee money never counts toward community reconciliation."""
    base = (
        await client.get(
            "/api/v1/reserve-fund/reconciliation", headers=manager_headers
        )
    ).json()
    await db.invoices.insert_one(
        {
            "id": "inv-fee-recon", "community_id": "mke", "apartment_id": "apt-201",
            "period": "Jun 2026", "description": "Service Fee - Apt 201",
            "amount": 1500, "paid_amount": 0, "due_date": "2026-06-10",
            "status": "due", "ledger": "manager_fee",
        }
    )
    paid = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-fee-recon", "amount": 1500, "date": "2026-06-28",
              "method": "UPI", "reference": ""},
        headers=manager_headers,
    )
    assert paid.status_code == 201
    recon = (
        await client.get(
            "/api/v1/reserve-fund/reconciliation", headers=manager_headers
        )
    ).json()
    assert recon["unanchoredContributions"] == base["unanchoredContributions"]


async def test_collections_without_expense_flagged(client, manager_headers):
    """Owners paid for a special job but no expense was ever recorded —
    the manager must be warned (Raj's bore well case)."""
    gen = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Sep 2026", "dueDate": "2026-09-10", "amount": 500,
              "description": "Water tank cleaning"},
        headers=manager_headers,
    )
    assert gen.json()["created"] == 10
    invoices = (await client.get("/api/v1/invoices", headers=manager_headers)).json()
    target = next(i for i in invoices if "Water tank" in i["description"])
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": target["id"], "amount": 500, "date": "2026-09-02",
              "method": "UPI", "reference": ""},
        headers=manager_headers,
    )

    recon = (
        await client.get("/api/v1/reserve-fund/reconciliation", headers=manager_headers)
    ).json()
    flagged = [d for d in recon["collectionsWithoutExpense"] if "Water tank" in d["description"]]
    assert len(flagged) == 1
    assert flagged[0]["collected"] == 500
    assert flagged[0]["billed"] == 5000

    # Recording an expense for the job clears the warning (word match).
    await client.post(
        "/api/v1/expenses",
        json={"category": "Cleaning", "description": "Water tank cleaning service",
              "amount": 3000, "paidDate": "2026-09-05"},
        headers=manager_headers,
    )
    recon2 = (
        await client.get("/api/v1/reserve-fund/reconciliation", headers=manager_headers)
    ).json()
    assert not any(
        "Water tank" in d["description"] for d in recon2["collectionsWithoutExpense"]
    )


async def test_collections_matched_via_work_order_link(client, manager_headers):
    wo = await client.post(
        "/api/v1/work-orders",
        json={"title": "Lift cable replacement", "priority": "High"},
        headers=manager_headers,
    )
    wo_id = wo.json()["id"]
    await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Oct 2026", "dueDate": "2026-10-10", "amount": 800,
              "description": "Lift cable levy", "workOrderId": wo_id},
        headers=manager_headers,
    )
    invoices = (await client.get("/api/v1/invoices", headers=manager_headers)).json()
    target = next(i for i in invoices if i.get("workOrderId") == wo_id)
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": target["id"], "amount": 800, "date": "2026-10-02",
              "method": "UPI", "reference": ""},
        headers=manager_headers,
    )
    recon = (
        await client.get("/api/v1/reserve-fund/reconciliation", headers=manager_headers)
    ).json()
    assert any(d.get("workOrderId") == wo_id for d in recon["collectionsWithoutExpense"])

    # An expense linked to the same work order clears it — even with a
    # completely different description.
    await client.post(
        "/api/v1/expenses",
        json={"category": "Lift", "description": "Otis AMC extra visit",
              "amount": 7000, "paidDate": "2026-10-05", "workOrderId": wo_id},
        headers=manager_headers,
    )
    recon2 = (
        await client.get("/api/v1/reserve-fund/reconciliation", headers=manager_headers)
    ).json()
    assert not any(d.get("workOrderId") == wo_id for d in recon2["collectionsWithoutExpense"])


async def test_chain_links_maintenance_to_work_order(client, manager_headers, owner_headers, db):
    # Private request: no auto work order (privacy), manager triages manually.
    mr = await client.post(
        "/api/v1/maintenance-requests",
        json={"title": "Bore well not working", "description": "No water on floor 3",
              "visibility": "private"},
        headers=owner_headers,
    )
    assert mr.status_code == 201
    mr_id = mr.json()["id"]

    wo = await client.post(
        "/api/v1/work-orders",
        json={"title": "Bore well repair", "priority": "High",
              "estimate": 13500, "maintenanceRequestId": mr_id},
        headers=manager_headers,
    )
    assert wo.status_code == 201
    assert wo.json()["maintenanceRequestId"] == mr_id
    # Linked request flips to In Progress automatically.
    mr_doc = await db.maintenance_requests.find_one({"id": mr_id})
    assert mr_doc["status"] == "In Progress"

    missing = await client.post(
        "/api/v1/work-orders",
        json={"title": "X", "maintenanceRequestId": "mr-nope"},
        headers=manager_headers,
    )
    assert missing.status_code == 404


async def test_chain_links_expense_and_invoices_to_work_order(client, manager_headers):
    wo = await client.post(
        "/api/v1/work-orders",
        json={"title": "Bore well repair", "priority": "High", "estimate": 13500},
        headers=manager_headers,
    )
    wo_id = wo.json()["id"]

    exp = await client.post(
        "/api/v1/expenses",
        json={"category": "Repairs", "description": "Bore well motor",
              "amount": 13500, "paidDate": "2026-07-11", "workOrderId": wo_id},
        headers=manager_headers,
    )
    assert exp.status_code == 201
    assert exp.json()["workOrderId"] == wo_id

    bad = await client.post(
        "/api/v1/expenses",
        json={"category": "Repairs", "description": "X", "amount": 1,
              "paidDate": "2026-07-11", "workOrderId": "wo-nope"},
        headers=manager_headers,
    )
    assert bad.status_code == 404

    gen = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Aug 2026", "dueDate": "2026-08-10", "amount": 1350,
              "description": "Bore well repair recovery", "workOrderId": wo_id},
        headers=manager_headers,
    )
    assert gen.json()["created"] == 10
    invoices = await client.get("/api/v1/invoices", headers=manager_headers)
    linked = [i for i in invoices.json() if i.get("workOrderId") == wo_id]
    assert len(linked) == 10


async def test_no_duplicate_work_order_per_open_request(client, manager_headers, owner_headers, db):
    mr = await client.post(
        "/api/v1/maintenance-requests",
        json={"title": "Lobby light flicker", "visibility": "community"},
        headers=owner_headers,
    )
    mr_id = mr.json()["id"]
    # Community request auto-created its work order already.
    auto = await db.work_orders.find_one({"maintenance_request_id": mr_id})
    assert auto is not None

    dup = await client.post(
        "/api/v1/work-orders",
        json={"title": "Duplicate job", "maintenanceRequestId": mr_id},
        headers=manager_headers,
    )
    assert dup.status_code == 409

    # Once the existing job closes, a follow-up is allowed.
    await client.post(
        f"/api/v1/work-orders/{auto['id']}/stage",
        json={"stage": "Closed", "note": "done"},
        headers=manager_headers,
    )
    follow_up = await client.post(
        "/api/v1/work-orders",
        json={"title": "Follow-up job", "maintenanceRequestId": mr_id},
        headers=manager_headers,
    )
    assert follow_up.status_code == 201
