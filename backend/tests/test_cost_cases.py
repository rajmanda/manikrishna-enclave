"""Cost cases: one financial event connecting MR → WO → vendor bill →
assessments → payments → reconciliation."""


async def _create_case_with_wo(client, manager_headers) -> tuple[str, str]:
    # Creating a work order auto-opens its cost case (estimate = budget).
    wo = await client.post(
        "/api/v1/work-orders",
        json={"title": "Motor replacement", "priority": "High", "estimate": 20000},
        headers=manager_headers,
    )
    assert wo.status_code == 201, wo.text
    wo_id = wo.json()["id"]
    case_id = wo.json()["costCaseId"]
    assert case_id, "work order should auto-create its cost case"
    return case_id, wo_id


async def test_full_chain_and_live_summary(client, manager_headers):
    case_id, wo_id = await _create_case_with_wo(client, manager_headers)

    # Assessments generated via the WO inherit the cost case.
    gen = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Nov 2026", "dueDate": "2026-11-10", "amount": 2000,
              "description": "Motor replacement levy", "workOrderId": wo_id},
        headers=manager_headers,
    )
    assert gen.json()["created"] == 10
    invoices = (await client.get("/api/v1/invoices", headers=manager_headers)).json()
    target = next(i for i in invoices if i.get("costCaseId") == case_id)
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": target["id"], "amount": 2000, "date": "2026-11-02",
              "method": "UPI", "reference": ""},
        headers=manager_headers,
    )

    detail = (
        await client.get(f"/api/v1/cost-cases/{case_id}", headers=manager_headers)
    ).json()
    s = detail["summary"]
    assert s["billedToOwners"] == 20000
    assert s["collectedFromOwners"] == 2000
    assert s["outstandingFromOwners"] == 18000
    assert s["actualCost"] == 0 and s["awaitingVendorBill"] is True
    assert len(detail["workOrders"]) == 1
    assert len(detail["invoices"]) == 10
    assert len(detail["payments"]) == 1
    assert any(t["kind"] == "payment" for t in detail["timeline"])


async def test_completed_wo_creates_draft_bill_not_expense(client, manager_headers):
    case_id, wo_id = await _create_case_with_wo(client, manager_headers)
    summary_before = (
        await client.get("/api/v1/finance/summary", headers=manager_headers)
    ).json()

    done = await client.post(
        f"/api/v1/work-orders/{wo_id}/stage",
        json={"stage": "Completed", "note": "done", "finalCost": 21000},
        headers=manager_headers,
    )
    assert done.status_code == 200
    expenses = (await client.get("/api/v1/expenses", headers=manager_headers)).json()
    drafts = [e for e in expenses if e.get("workOrderId") == wo_id]
    assert len(drafts) == 1
    assert drafts[0]["status"] == "draft"
    assert drafts[0]["amount"] == 21000
    assert drafts[0]["costCaseId"] == case_id

    # Idempotent: completing again must not duplicate the draft bill.
    await client.post(
        f"/api/v1/work-orders/{wo_id}/stage",
        json={"stage": "Completed", "note": "again"},
        headers=manager_headers,
    )
    expenses2 = (await client.get("/api/v1/expenses", headers=manager_headers)).json()
    assert len([e for e in expenses2 if e.get("workOrderId") == wo_id]) == 1

    # Draft never moves the reserve/books; posting does.
    summary_draft = (
        await client.get("/api/v1/finance/summary", headers=manager_headers)
    ).json()
    assert summary_draft["reserveFundBalance"] == summary_before["reserveFundBalance"]
    posted = await client.post(
        f"/api/v1/expenses/{drafts[0]['id']}/post", headers=manager_headers
    )
    assert posted.json()["status"] == "posted"
    summary_posted = (
        await client.get("/api/v1/finance/summary", headers=manager_headers)
    ).json()
    assert (
        summary_posted["reserveFundBalance"]
        == summary_before["reserveFundBalance"] - 21000
    )
    # And the cost case now shows the actual cost.
    s = (
        await client.get(f"/api/v1/cost-cases/{case_id}", headers=manager_headers)
    ).json()["summary"]
    assert s["actualCost"] == 21000 and s["awaitingVendorBill"] is False


async def test_close_guard_and_force(client, manager_headers):
    case_id, wo_id = await _create_case_with_wo(client, manager_headers)
    await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Dec 2026", "dueDate": "2026-12-10", "amount": 2000,
              "description": "Motor replacement levy", "workOrderId": wo_id},
        headers=manager_headers,
    )
    blocked = await client.post(
        f"/api/v1/cost-cases/{case_id}/close", json={}, headers=manager_headers
    )
    assert blocked.status_code == 409
    assert "outstanding" in blocked.json()["detail"]

    forced = await client.post(
        f"/api/v1/cost-cases/{case_id}/close",
        json={"force": True, "note": "written off"},
        headers=manager_headers,
    )
    assert forced.json() == {"closed": True, "forced": True}


async def test_owner_cannot_write_cost_cases(client, owner_headers):
    resp = await client.post(
        "/api/v1/cost-cases", json={"title": "X"}, headers=owner_headers
    )
    assert resp.status_code == 403
    # But reading is community-transparent.
    listing = await client.get("/api/v1/cost-cases", headers=owner_headers)
    assert listing.status_code == 200


async def test_m007_migrates_borewell_history(client, manager_headers, db):
    """Simulate the prod situation: paid bore well invoices with no case."""
    for n, paid in (("101", 1350), ("102", 0)):
        await db.invoices.insert_one({
            "id": f"inv-bw-{n}", "community_id": "mke", "apartment_id": f"apt-{n}",
            "period": "Jul 2026", "description": f"Bore well repair work  - Apt {n}",
            "amount": 1350, "paid_amount": paid, "due_date": "2026-07-10",
            "status": "paid" if paid else "due", "ledger": "community",
        })
    from app.migrations import _m007_cost_cases_borewell

    await _m007_cost_cases_borewell(db)
    case = await db.cost_cases.find_one({"title": "Bore well repair work"})
    assert case is not None and case["funding_method"] == "collect_first"
    wo = await db.work_orders.find_one({"cost_case_id": case["id"]})
    assert wo is not None and "[Migrated]" in wo["description"]
    linked = await db.invoices.count_documents({"cost_case_id": case["id"]})
    assert linked == 2
    # NO expense fabricated from collections.
    assert await db.expenses.count_documents({"cost_case_id": case["id"]}) == 0
    # Idempotent — running again must not duplicate the case.
    await _m007_cost_cases_borewell(db)
    assert await db.cost_cases.count_documents({"title": "Bore well repair work"}) == 1

    # The reconciliation warning now carries the case id (actionable).
    recon = (
        await client.get("/api/v1/reserve-fund/reconciliation", headers=manager_headers)
    ).json()
    drive = next(
        d for d in recon["collectionsWithoutExpense"] if "Bore well" in d["description"]
    )
    assert drive["costCaseId"] == case["id"]


async def test_assessment_generation_with_allocations(client, manager_headers):
    case_id, _ = await _create_case_with_wo(client, manager_headers)
    # Unequal allocations: two apartments, custom amounts.
    resp = await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Jan 2027", "dueDate": "2027-01-10",
              "allocations": [
                  {"apartmentId": "apt-101", "amount": 5000},
                  {"apartmentId": "apt-102", "amount": 2500},
              ]},
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json() == {"created": 2, "skipped": 0}

    detail = (
        await client.get(f"/api/v1/cost-cases/{case_id}", headers=manager_headers)
    ).json()
    assert detail["summary"]["billedToOwners"] == 7500
    amounts = {i["apartmentId"]: i["amount"] for i in detail["invoices"]}
    assert amounts == {"apt-101": 5000, "apt-102": 2500}
    # Description defaults to the case title, apartment-labeled.
    assert all("Motor replacement" in i["description"] for i in detail["invoices"])

    # Idempotent: same batch again creates nothing new.
    again = await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Jan 2027", "dueDate": "2027-01-10",
              "allocations": [
                  {"apartmentId": "apt-101", "amount": 5000},
                  {"apartmentId": "apt-102", "amount": 2500},
              ]},
        headers=manager_headers,
    )
    assert again.json() == {"created": 0, "skipped": 2}

    # Unknown apartment and closed-case guards.
    bad = await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Feb 2027", "dueDate": "2027-02-10",
              "allocations": [{"apartmentId": "apt-nope", "amount": 100}]},
        headers=manager_headers,
    )
    assert bad.status_code == 404


async def test_assessment_installments(client, manager_headers):
    """Different owners can get different installment schedules."""
    case_id, _ = await _create_case_with_wo(client, manager_headers)
    resp = await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Mar 2027", "dueDate": "2027-03-31",
              "allocations": [
                  {"apartmentId": "apt-101", "amount": 10000, "installments": 3},
                  {"apartmentId": "apt-102", "amount": 10000},
              ]},
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json() == {"created": 4, "skipped": 0}

    detail = (
        await client.get(f"/api/v1/cost-cases/{case_id}", headers=manager_headers)
    ).json()
    a101 = sorted(
        (i for i in detail["invoices"] if i["apartmentId"] == "apt-101"),
        key=lambda i: i["dueDate"],
    )
    assert [i["period"] for i in a101] == ["Mar 2027 - 1/3", "Mar 2027 - 2/3", "Mar 2027 - 3/3"]
    assert sum(i["amount"] for i in a101) == 10000
    # Monthly cadence, clamped to month length (Mar 31 → Apr 30 → May 31).
    assert [i["dueDate"] for i in a101] == ["2027-03-31", "2027-04-30", "2027-05-31"]
    # Case totals still reconcile.
    assert detail["summary"]["billedToOwners"] == 20000

    # Idempotent re-run creates nothing.
    again = await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Mar 2027", "dueDate": "2027-03-31",
              "allocations": [
                  {"apartmentId": "apt-101", "amount": 10000, "installments": 3},
                  {"apartmentId": "apt-102", "amount": 10000},
              ]},
        headers=manager_headers,
    )
    assert again.json() == {"created": 0, "skipped": 4}


async def test_combined_payment_allocation(client, manager_headers):
    """One family payment covers multiple invoices, oldest due first."""
    case_id, _ = await _create_case_with_wo(client, manager_headers)
    await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Jun 2027", "dueDate": "2027-06-10",
              "allocations": [
                  {"apartmentId": "apt-501", "amount": 3000},
                  {"apartmentId": "apt-502", "amount": 3000},
              ]},
        headers=manager_headers,
    )
    detail = (
        await client.get(f"/api/v1/cost-cases/{case_id}", headers=manager_headers)
    ).json()
    ids = [i["id"] for i in detail["invoices"]]

    resp = await client.post(
        "/api/v1/payments/allocate",
        json={"invoiceIds": ids, "amount": 4500, "date": "2027-06-05",
              "method": "UPI", "reference": "family-upi-1"},
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    applied = resp.json()["applied"]
    assert sum(a["amount"] for a in applied) == 4500
    assert len(applied) == 2  # 3000 to the first, 1500 to the second

    detail2 = (
        await client.get(f"/api/v1/cost-cases/{case_id}", headers=manager_headers)
    ).json()
    assert detail2["summary"]["collectedFromOwners"] == 4500
    statuses = sorted(i["status"] for i in detail2["invoices"])
    assert statuses == ["paid", "partial"]

    # Overpayment across the batch is rejected.
    over = await client.post(
        "/api/v1/payments/allocate",
        json={"invoiceIds": ids, "amount": 99999, "date": "2027-06-05",
              "method": "UPI", "reference": ""},
        headers=manager_headers,
    )
    assert over.status_code == 400


async def test_money_health_report(client, manager_headers):
    case_id, wo_id = await _create_case_with_wo(client, manager_headers)
    await client.post(
        f"/api/v1/cost-cases/{case_id}/assessments",
        json={"period": "Sep 2027", "dueDate": "2027-09-10",
              "allocations": [{"apartmentId": "apt-101", "amount": 4000}]},
        headers=manager_headers,
    )
    # Completing the WO auto-creates a draft bill (so it's NOT "awaiting
    # expense" — it's in the draft list instead).
    await client.post(
        f"/api/v1/work-orders/{wo_id}/stage",
        json={"stage": "Completed", "note": "done", "finalCost": 3800},
        headers=manager_headers,
    )
    report = (
        await client.get("/api/v1/reports/money-health", headers=manager_headers)
    ).json()
    case_row = next(r for r in report["openCostCases"] if r["id"] == case_id)
    assert case_row["billed"] == 4000 and case_row["outstanding"] == 4000
    assert any(d["workOrderId"] == wo_id for d in report["draftVendorBills"])
    assert not any(w["id"] == wo_id for w in report["workOrdersAwaitingExpense"])
    assert any(a["costCaseId"] == case_id for a in report["outstandingAssessments"])

    # Post the draft → it leaves the draft list; shortfall appears.
    draft = next(d for d in report["draftVendorBills"] if d["workOrderId"] == wo_id)
    await client.post(f"/api/v1/expenses/{draft['id']}/post", headers=manager_headers)
    report2 = (
        await client.get("/api/v1/reports/money-health", headers=manager_headers)
    ).json()
    assert not any(d["workOrderId"] == wo_id for d in report2["draftVendorBills"])
    case_row2 = next(r for r in report2["openCostCases"] if r["id"] == case_id)
    assert case_row2["actualCost"] == 3800 and case_row2["shortfall"] == 3800


async def test_automation_chain_and_cascades(client, manager_headers, owner_headers, db):
    # Community maintenance request → auto work order + auto cost case.
    mr = await client.post(
        "/api/v1/maintenance-requests",
        json={"title": "Gate motor jammed", "description": "front gate",
              "visibility": "community"},
        headers=owner_headers,
    )
    mr_id = mr.json()["id"]
    wo = await db.work_orders.find_one({"maintenance_request_id": mr_id})
    assert wo is not None
    case = await db.cost_cases.find_one({"id": wo["cost_case_id"]})
    assert case is not None and case["maintenance_request_id"] == mr_id

    # PRIVATE requests never auto-create (a public WO would leak them).
    private = await client.post(
        "/api/v1/maintenance-requests",
        json={"title": "Neighbour noise", "visibility": "private"},
        headers=owner_headers,
    )
    assert await db.work_orders.find_one(
        {"maintenance_request_id": private.json()["id"]}
    ) is None

    # Standalone cost case → auto work order.
    cc = await client.post(
        "/api/v1/cost-cases",
        json={"title": "Diwali lighting", "approvedBudget": 3000},
        headers=manager_headers,
    )
    cc_id = cc.json()["id"]
    auto_wo = await db.work_orders.find_one({"cost_case_id": cc_id})
    assert auto_wo is not None and auto_wo["estimate"] == 3000

    # Deleting an EMPTY case cascades to its money-less work order.
    deleted = await client.delete(
        f"/api/v1/cost-cases/{cc_id}", headers=manager_headers
    )
    assert deleted.status_code == 204
    assert await db.work_orders.find_one({"id": auto_wo["id"]}) is None

    # A case holding money refuses deletion.
    case2_id, wo2_id = await _create_case_with_wo(client, manager_headers)
    await client.post(
        f"/api/v1/cost-cases/{case2_id}/assessments",
        json={"period": "Oct 2027", "dueDate": "2027-10-10",
              "allocations": [{"apartmentId": "apt-101", "amount": 100}]},
        headers=manager_headers,
    )
    blocked = await client.delete(
        f"/api/v1/cost-cases/{case2_id}", headers=manager_headers
    )
    assert blocked.status_code == 409
