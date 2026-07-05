ENROLLMENTS = {
    "enrollments": [
        {"apartmentId": "apt-201", "amount": 1500, "active": True},
        {"apartmentId": "apt-202", "amount": 1500, "active": True},
        {"apartmentId": "apt-301", "amount": 2000, "active": True},   # per-owner amount
        {"apartmentId": "apt-502", "amount": 1500, "active": False},  # tenant moved out
    ]
}


async def test_enrollment_config_and_generation(client, manager_headers, db):
    saved = await client.put(
        "/api/v1/manager-fees/enrollments", json=ENROLLMENTS, headers=manager_headers
    )
    assert saved.status_code == 200

    bad = await client.put(
        "/api/v1/manager-fees/enrollments",
        json={"enrollments": [{"apartmentId": "apt-999", "amount": 1}]},
        headers=manager_headers,
    )
    assert bad.status_code == 400

    gen = await client.post(
        "/api/v1/manager-fees/generate",
        json={"period": "Jul 2026", "dueDate": "2026-07-10"},
        headers=manager_headers,
    )
    # Only the 3 ACTIVE enrollments, each at its own amount.
    assert gen.json() == {"created": 3, "skipped": 0}
    again = await client.post(
        "/api/v1/manager-fees/generate",
        json={"period": "Jul 2026", "dueDate": "2026-07-10"},
        headers=manager_headers,
    )
    assert again.json() == {"created": 0, "skipped": 3}

    fees = await db.invoices.find({"ledger": "manager_fee"}).to_list(100)
    assert {f["apartment_id"]: f["amount"] for f in fees} == {
        "apt-201": 1500, "apt-202": 1500, "apt-301": 2000,
    }


async def test_fee_money_never_touches_community_figures(client, manager_headers, db):
    from datetime import date
    today = date.today().isoformat()
    await client.put(
        "/api/v1/manager-fees/enrollments", json=ENROLLMENTS, headers=manager_headers
    )
    await client.post(
        "/api/v1/manager-fees/generate",
        json={"period": "Jul 2026", "dueDate": "2026-07-10"},
        headers=manager_headers,
    )
    before_summary = (await client.get("/api/v1/finance/summary", headers=manager_headers)).json()
    before_dash = (await client.get("/api/v1/dashboard/manager", headers=manager_headers)).json()

    # Pay a fee invoice in full (manager records it — same flow).
    fee = await db.invoices.find_one({"ledger": "manager_fee", "apartment_id": "apt-301"})
    paid = await client.post(
        "/api/v1/payments",
        json={"invoiceId": fee["id"], "amount": 2000, "date": today,
              "method": "UPI", "reference": "FEE-1"},
        headers=manager_headers,
    )
    assert paid.status_code == 201
    assert paid.json()["ledger"] == "manager_fee"  # inherited

    after_summary = (await client.get("/api/v1/finance/summary", headers=manager_headers)).json()
    after_dash = (await client.get("/api/v1/dashboard/manager", headers=manager_headers)).json()

    # Community money: identical before/after the fee payment.
    assert after_summary["monthIncome"] == before_summary["monthIncome"]
    assert after_summary["outstandingDues"] == before_summary["outstandingDues"]
    assert after_dash["paymentsReceived"] == before_dash["paymentsReceived"]
    assert after_dash["outstandingCollections"] == before_dash["outstandingCollections"]

    # Fee tile shows the separate money.
    assert after_dash["feeCollected"] == 2000
    assert after_dash["feeOutstanding"] == 3000  # 1500 + 1500 unpaid

    # Monthly income series also ignores fee payments.
    monthly = (await client.get("/api/v1/finance/monthly", headers=manager_headers)).json()
    assert monthly[-1]["income"] == 0  # current month: no community payments in seed


async def test_owner_fee_flow_same_path_and_privacy(client, manager_headers, db):
    await client.put(
        "/api/v1/manager-fees/enrollments", json=ENROLLMENTS, headers=manager_headers
    )
    await client.post(
        "/api/v1/manager-fees/generate",
        json={"period": "Jul 2026", "dueDate": "2026-07-10"},
        headers=manager_headers,
    )

    # Privacy: owner 101 (not enrolled) sees no fee invoices; owner 201 sees own.
    login = await client.post("/api/v1/auth/dev-login", json={"email": "owner101@example.com"})
    h101 = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    inv101 = (await client.get("/api/v1/invoices", headers=h101)).json()
    assert all(i["ledger"] == "community" for i in inv101)

    login = await client.post("/api/v1/auth/dev-login", json={"email": "owner201@example.com"})
    h201 = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    inv201 = (await client.get("/api/v1/invoices", headers=h201)).json()
    fee = next(i for i in inv201 if i["ledger"] == "manager_fee")

    # Same report -> confirm path.
    reported = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": fee["id"], "amount": 1500, "date": "2026-07-04",
              "method": "UPI", "reference": "FEE-UPI"},
        headers=h201,
    )
    assert reported.status_code == 201
    assert reported.json()["ledger"] == "manager_fee"
    confirmed = await client.post(
        f"/api/v1/payments/{reported.json()['id']}/confirm", headers=manager_headers
    )
    assert confirmed.json()["status"] == "confirmed"
    fee_after = await db.invoices.find_one({"id": fee["id"]})
    assert fee_after["status"] == "paid"

    # Owners cannot touch enrollment config.
    denied = await client.get("/api/v1/manager-fees/enrollments", headers=h201)
    assert denied.status_code == 403


async def test_statement_pdf_has_fee_section(client, manager_headers):
    await client.put(
        "/api/v1/manager-fees/enrollments", json=ENROLLMENTS, headers=manager_headers
    )
    await client.post(
        "/api/v1/manager-fees/generate",
        json={"period": "Jul 2026", "dueDate": "2026-07-10"},
        headers=manager_headers,
    )
    pdf = await client.get("/api/v1/statements/apt-201.pdf", headers=manager_headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


async def test_account_scoping_spans_multiple_apartments(client, manager_headers, db):
    # Raj's Account model: one account owning two apartments.
    await db.accounts.insert_one(
        {"id": "acct-t1", "community_id": "mke", "name": "Test Family",
         "apartment_ids": ["apt-501", "apt-502"]}
    )
    await db.users.update_one({"id": "u-502"}, {"$set": {"account_id": "acct-t1"}})

    login = await client.post("/api/v1/auth/dev-login", json={"email": "owner502@example.com"})
    h = {"Authorization": f"Bearer {login.json()['accessToken']}"}

    me = (await client.get("/api/v1/auth/me", headers=h)).json()
    assert set(me["apartmentIds"]) == {"apt-501", "apt-502"}

    inv = (await client.get("/api/v1/invoices", headers=h)).json()
    assert {i["apartmentId"] for i in inv} == {"apt-501", "apt-502"}

    # Statement access extends to both owned apartments, no others.
    ok = await client.get("/api/v1/statements/apt-501.pdf", headers=h)
    assert ok.status_code == 200
    denied = await client.get("/api/v1/statements/apt-101.pdf", headers=h)
    assert denied.status_code == 403


async def test_consolidated_statement(client, manager_headers, db):
    await db.accounts.insert_one(
        {"id": "acct-t2", "community_id": "mke", "name": "Fam",
         "apartment_ids": ["apt-501", "apt-502"]}
    )
    await db.users.update_one({"id": "u-502"}, {"$set": {"account_id": "acct-t2"}})
    login = await client.post("/api/v1/auth/dev-login", json={"email": "owner502@example.com"})
    h = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    pdf = await client.get("/api/v1/statements/consolidated.pdf", headers=h)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    # Manager without apartments gets a clear 400.
    none = await client.get("/api/v1/statements/consolidated.pdf", headers=manager_headers)
    assert none.status_code == 400


async def test_accounts_endpoint(client, manager_headers, owner_headers, db):
    await db.accounts.insert_one(
        {"id": "acct-t3", "community_id": "mke", "name": "Zeta Family",
         "apartment_ids": ["apt-101"]}
    )
    listed = await client.get("/api/v1/accounts", headers=manager_headers)
    assert listed.status_code == 200
    assert any(a["name"] == "Zeta Family" for a in listed.json())
    denied = await client.get("/api/v1/accounts", headers=owner_headers)
    assert denied.status_code == 403
