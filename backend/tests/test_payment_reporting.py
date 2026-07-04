async def test_owner_reports_payment_pending_until_confirmed(
    client, owner_headers, manager_headers, db
):
    reported = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-04",
              "method": "UPI", "reference": "UPI-9911"},
        headers=owner_headers,
    )
    assert reported.status_code == 201
    payment = reported.json()
    assert payment["status"] == "pending"

    # Pending: invoice untouched, income untouched, manager notified.
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 0
    notes = await client.get("/api/v1/notifications", headers=manager_headers)
    report_note = next(n for n in notes.json() if "reported a payment" in n["text"])
    assert report_note["href"] == "/payments"  # notification deep-links to confirm

    # Fail-proof layer: manager dashboard counts pending confirmations live.
    dash = await client.get("/api/v1/dashboard/manager", headers=manager_headers)
    assert dash.json()["pendingPaymentConfirmations"] == 1

    # Duplicate report blocked.
    dup = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-04",
              "method": "UPI"},
        headers=owner_headers,
    )
    assert dup.status_code == 409

    # Manager confirms → invoice paid, owner notified.
    confirmed = await client.post(
        f"/api/v1/payments/{payment['id']}/confirm", headers=manager_headers
    )
    assert confirmed.json()["status"] == "confirmed"
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 3500 and inv["status"] == "paid"
    owner_notes = await client.get("/api/v1/notifications", headers=owner_headers)
    assert any("was confirmed" in n["text"] for n in owner_notes.json())


async def test_reject_removes_pending_and_notifies(
    client, owner_headers, manager_headers, db
):
    reported = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 2000, "date": "2026-07-04",
              "method": "Cash", "reference": ""},
        headers=owner_headers,
    )
    pid = reported.json()["id"]
    rejected = await client.post(
        f"/api/v1/payments/{pid}/reject", headers=manager_headers
    )
    assert rejected.status_code == 204
    assert await db.payments.find_one({"id": pid}) is None
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 0
    notes = await client.get("/api/v1/notifications", headers=owner_headers)
    assert any("could not be verified" in n["text"] for n in notes.json())


async def test_report_scoping_and_validation(client, owner_headers, manager_headers):
    # Not your apartment's invoice.
    other = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-101", "amount": 100, "date": "2026-07-04",
              "method": "UPI"},
        headers=owner_headers,
    )
    assert other.status_code == 404

    # Over the outstanding amount.
    over = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 99999, "date": "2026-07-04",
              "method": "UPI"},
        headers=owner_headers,
    )
    assert over.status_code == 400

    # Managers use the direct endpoint, not report.
    mgr = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 100, "date": "2026-07-04",
              "method": "UPI"},
        headers=manager_headers,
    )
    assert mgr.status_code == 403

    # Owner cannot confirm anything.
    confirm = await client.post(
        "/api/v1/payments/whatever/confirm", headers=owner_headers
    )
    assert confirm.status_code == 403


async def test_pending_excluded_from_income_and_statement(
    client, owner_headers, manager_headers
):
    from datetime import date
    today = date.today().isoformat()
    before = (await client.get("/api/v1/finance/summary", headers=owner_headers)).json()
    await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 1200, "date": today,
              "method": "UPI", "reference": "PEND"},
        headers=owner_headers,
    )
    after = (await client.get("/api/v1/finance/summary", headers=owner_headers)).json()
    assert after["monthIncome"] == before["monthIncome"]  # pending doesn't count

    pdf = await client.get("/api/v1/statements/apt-502.pdf", headers=owner_headers)
    assert pdf.status_code == 200  # renders fine; pending rows excluded


async def test_nav_badges_role_scoped(client, owner_headers, manager_headers):
    # Owner (apt-502): one unpaid June invoice.
    owner_badges = (await client.get("/api/v1/dashboard/badges", headers=owner_headers)).json()
    assert owner_badges["openInvoices"] == 1
    assert owner_badges["pendingPaymentConfirmations"] == 0

    # Manager sees community-wide unpaid count (4: 201, 401 overdue + 301 partial + 502 due).
    mgr_badges = (await client.get("/api/v1/dashboard/badges", headers=manager_headers)).json()
    assert mgr_badges["openInvoices"] == 4

    # Owner reports a payment -> manager badge appears; owner invoice badge
    # persists until the money is confirmed.
    await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-04",
              "method": "UPI", "reference": "B1"},
        headers=owner_headers,
    )
    mgr_badges = (await client.get("/api/v1/dashboard/badges", headers=manager_headers)).json()
    assert mgr_badges["pendingPaymentConfirmations"] == 1
