"""Pay-multiple-invoices + advance credits.

The invariant under test: paying N invoices in one shot must leave the books
EXACTLY as if each invoice had been paid individually — per-invoice Payment
rows, per-invoice recompute, and any excess held as an apartment credit.

Seed facts used: owner502@example.com owns apt-502; inv-2606-502 (Jun, 3500
due) is unpaid. Extra invoices are created per-test via the manager.
"""

from tests.conftest import login


async def make_invoice(client, manager_headers, period, due, amount=3500,
                       apartment_id="apt-502"):
    resp = await client.post(
        "/api/v1/invoices",
        json={"apartmentId": apartment_id, "period": period,
              "description": "Monthly Maintenance", "amount": amount,
              "dueDate": due},
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def get_invoice(client, headers, invoice_id):
    invoices = (await client.get("/api/v1/invoices", headers=headers)).json()
    return next(i for i in invoices if i["id"] == invoice_id)


async def test_owner_batch_report_and_manager_batch_confirm(
    client, owner_headers, manager_headers
):
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10")
    aug = await make_invoice(client, manager_headers, "Aug 2026", "2026-08-10")

    # Owner pays June + July + August with one UPI transfer.
    resp = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-502", jul, aug], "amount": 10500,
              "date": "2026-08-01", "method": "UPI", "reference": "UPI-777"},
        headers=owner_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    batch_id = body["batchId"]
    assert body["excessCredit"] == 0
    # Oldest due first: June, July, August — full outstanding each.
    assert [p["amount"] for p in body["applied"]] == [3500, 3500, 3500]

    # Pending: invoices unchanged until the manager confirms.
    inv = await get_invoice(client, owner_headers, "inv-2606-502")
    assert inv["paidAmount"] == 0 and inv["status"] != "paid"

    # Manager sees three pending rows sharing the batch id.
    payments = (await client.get("/api/v1/payments", headers=manager_headers)).json()
    rows = [p for p in payments if p.get("batchId") == batch_id]
    assert len(rows) == 3 and all(p["status"] == "pending" for p in rows)

    # One click: confirm the whole batch.
    confirm = await client.post(
        f"/api/v1/payments/batch/{batch_id}/confirm", headers=manager_headers
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json() == {"confirmed": 3, "total": 10500, "creditConfirmed": 0}

    # Balancing identical to individual payments: each invoice fully paid.
    for inv_id in ("inv-2606-502", jul, aug):
        inv = await get_invoice(client, owner_headers, inv_id)
        assert inv["paidAmount"] == 3500 and inv["status"] == "paid"

    # Owner was notified once about the combined confirmation.
    notifs = (await client.get("/api/v1/notifications", headers=owner_headers)).json()
    assert any("covering 3 invoices" in n["text"] for n in notifs)


async def test_batch_reject_removes_rows_and_pending_credit(
    client, owner_headers, manager_headers
):
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10")
    resp = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-502", jul], "amount": 8000,
              "date": "2026-08-01", "method": "UPI", "reference": ""},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["excessCredit"] == 1000  # 8000 - 7000 owed

    reject = await client.post(
        f"/api/v1/payments/batch/{body['batchId']}/reject", headers=manager_headers
    )
    assert reject.status_code == 204

    payments = (await client.get("/api/v1/payments", headers=manager_headers)).json()
    assert not [p for p in payments if p.get("batchId") == body["batchId"]]
    assert (await client.get("/api/v1/credits", headers=owner_headers)).json() == []
    inv = await get_invoice(client, owner_headers, "inv-2606-502")
    assert inv["paidAmount"] == 0


async def test_overpaid_batch_mints_credit_then_pays_next_invoice(
    client, owner_headers, manager_headers
):
    # Owner overpays June by 2000; manager confirms → credit becomes real.
    resp = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-502"], "amount": 5500,
              "date": "2026-07-01", "method": "Bank Transfer", "reference": "NEFT-1"},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    batch_id = resp.json()["batchId"]
    assert resp.json()["excessCredit"] == 2000

    # Pending credit is visible but NOT spendable yet.
    denied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=owner_headers,
    )
    assert denied.status_code == 409

    confirm = await client.post(
        f"/api/v1/payments/batch/{batch_id}/confirm", headers=manager_headers
    )
    assert confirm.status_code == 200
    assert confirm.json()["creditConfirmed"] == 2000

    # Next month's invoice arrives; the owner pays it FROM the credit.
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10")
    applied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=owner_headers,
    )
    assert applied.status_code == 201, applied.text
    assert applied.json()["applied"] == 2000
    assert applied.json()["remainingCredit"] == 0

    inv = await get_invoice(client, owner_headers, jul)
    assert inv["paidAmount"] == 2000 and inv["status"] == "partial"
    # The credit landed as a normal confirmed Credit-method payment.
    payments = (await client.get("/api/v1/payments", headers=owner_headers)).json()
    credit_pay = next(p for p in payments if p["invoiceId"] == jul)
    assert credit_pay["method"] == "Credit" and credit_pay["status"] == "confirmed"
    # Balance exhausted.
    credits = (await client.get("/api/v1/credits", headers=owner_headers)).json()
    assert sum(c["remaining"] for c in credits) == 0


async def test_batches_are_all_or_none(client, owner_headers, manager_headers):
    """One transfer either arrived or it didn't: portions of a batch cannot
    be confirmed or rejected individually."""
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10")
    resp = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-502", jul], "amount": 9000,
              "date": "2026-08-01", "method": "UPI", "reference": "BIG-1"},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    batch_id = resp.json()["batchId"]
    assert resp.json()["excessCredit"] == 2000  # 9000 - 7000 owed

    payments = (await client.get("/api/v1/payments", headers=manager_headers)).json()
    rows = [p for p in payments if p.get("batchId") == batch_id]
    single_confirm = await client.post(
        f"/api/v1/payments/{rows[0]['id']}/confirm", headers=manager_headers
    )
    assert single_confirm.status_code == 400
    single_reject = await client.post(
        f"/api/v1/payments/{rows[1]['id']}/reject", headers=manager_headers
    )
    assert single_reject.status_code == 400

    # The whole batch confirms in one action, credit included.
    confirm = await client.post(
        f"/api/v1/payments/batch/{batch_id}/confirm", headers=manager_headers
    )
    assert confirm.status_code == 200
    assert confirm.json()["creditConfirmed"] == 2000
    for inv_id in ("inv-2606-502", jul):
        inv = await get_invoice(client, owner_headers, inv_id)
        assert inv["status"] == "paid"


async def test_apply_credit_fifo_and_partial_amount(
    client, db, owner_headers, manager_headers
):
    # Two confirmed credits (manager-side overpayments), oldest first.
    await db.credits.insert_many([
        {"id": "cr-old", "community_id": "mke", "apartment_id": "apt-502",
         "amount": 800, "remaining": 800, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-05-01",
         "created_by": "u-vishnu", "batch_id": None},
        {"id": "cr-new", "community_id": "mke", "apartment_id": "apt-502",
         "amount": 700, "remaining": 700, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-06-01",
         "created_by": "u-vishnu", "batch_id": None},
    ])
    applied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502", "amount": 1000},
        headers=owner_headers,
    )
    assert applied.status_code == 201, applied.text
    # FIFO: the old entry drains fully, the newer one partially.
    old = await db.credits.find_one({"id": "cr-old"})
    new = await db.credits.find_one({"id": "cr-new"})
    assert old["remaining"] == 0 and new["remaining"] == 500
    inv = await get_invoice(client, owner_headers, "inv-2606-502")
    assert inv["paidAmount"] == 1000 and inv["status"] == "partial"


async def test_owner_cannot_touch_other_apartments(client, db, owner_headers):
    # Batch report on someone else's invoice → 404 (existence not leaked).
    other = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-101"], "amount": 3500,
              "date": "2026-07-01", "method": "UPI", "reference": ""},
        headers=owner_headers,
    )
    assert other.status_code == 404

    # Applying another apartment's credit → 403.
    denied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-101"},
        headers=owner_headers,
    )
    assert denied.status_code == 403

    # Credits list is scoped: a credit held for apt-101 is invisible to
    # the 502 owner.
    await db.credits.insert_one(
        {"id": "cr-101", "community_id": "mke", "apartment_id": "apt-101",
         "amount": 6499, "remaining": 6499, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-07-01",
         "created_by": "u-vishnu", "batch_id": None}
    )
    mine = (await client.get("/api/v1/credits", headers=owner_headers)).json()
    assert all(c["apartmentId"] == "apt-502" for c in mine)


async def test_double_report_blocked(client, owner_headers, manager_headers):
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10")
    first = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-502", jul], "amount": 7000,
              "date": "2026-08-01", "method": "UPI", "reference": ""},
        headers=owner_headers,
    )
    assert first.status_code == 201

    # A second claim touching one of the same invoices is blocked.
    dup = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": [jul], "amount": 3500,
              "date": "2026-08-02", "method": "UPI", "reference": ""},
        headers=owner_headers,
    )
    assert dup.status_code == 409


async def test_rejection_reason_reaches_the_owner(client, owner_headers, manager_headers):
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10")
    resp = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": [jul], "amount": 3500,
              "date": "2026-08-01", "method": "UPI", "reference": "UPI-9"},
        headers=owner_headers,
    )
    batch_id = resp.json()["batchId"]

    reject = await client.post(
        f"/api/v1/payments/batch/{batch_id}/reject",
        json={"reason": "No matching UPI credit in the bank statement"},
        headers=manager_headers,
    )
    assert reject.status_code == 204

    notifs = (await client.get("/api/v1/notifications", headers=owner_headers)).json()
    assert any(
        "No matching UPI credit in the bank statement" in n["text"] for n in notifs
    )

    # The rejection is durable: the owner sees it against the invoice.
    rejections = (
        await client.get("/api/v1/payments/rejections", headers=owner_headers)
    ).json()
    row = next(r for r in rejections if r["invoiceId"] == jul)
    assert row["reason"] == "No matching UPI credit in the bank statement"
    assert row["amount"] == 3500

    # Single-payment reject carries the reason too (and works without one).
    single = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": jul, "amount": 3500, "date": "2026-08-02", "method": "Cash"},
        headers=owner_headers,
    )
    reject2 = await client.post(
        f"/api/v1/payments/{single.json()['id']}/reject",
        json={"reason": "Cash never handed over"},
        headers=manager_headers,
    )
    assert reject2.status_code == 204
    notifs2 = (await client.get("/api/v1/notifications", headers=owner_headers)).json()
    assert any("Cash never handed over" in n["text"] for n in notifs2)


async def test_apply_credit_with_nothing_open_keeps_the_credit(
    client, db, owner_headers, manager_headers
):
    """Vishnu hits 'Apply to dues' when nothing is due: the call refuses and
    the credit stays banked — funds never disappear."""
    await db.credits.insert_one(
        {"id": "cr-bank", "community_id": "mke", "apartment_id": "apt-502",
         "amount": 5000, "remaining": 5000, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-06-01",
         "created_by": "u-vishnu", "batch_id": None}
    )
    # Settle the only open invoice first.
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500,
              "date": "2026-07-01", "method": "Cash", "reference": ""},
        headers=manager_headers,
    )
    denied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=manager_headers,
    )
    assert denied.status_code == 409
    assert "stays banked" in denied.json()["detail"]
    credit = await db.credits.find_one({"id": "cr-bank"})
    assert credit["remaining"] == 5000  # untouched


async def test_apply_credit_skips_invoices_with_pending_claims(
    client, db, owner_headers, manager_headers
):
    """Credit never lands on an invoice the owner has already claimed —
    confirming the claim later would double-cover it."""
    await db.credits.insert_one(
        {"id": "cr-race", "community_id": "mke", "apartment_id": "apt-502",
         "amount": 5000, "remaining": 5000, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-06-01",
         "created_by": "u-vishnu", "batch_id": None}
    )
    claim = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500,
              "date": "2026-07-01", "method": "UPI", "reference": ""},
        headers=owner_headers,
    )
    assert claim.status_code == 201
    denied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=manager_headers,
    )
    assert denied.status_code == 409  # the only open invoice is claimed
    assert (await db.credits.find_one({"id": "cr-race"}))["remaining"] == 5000


async def test_confirming_never_overshoots_the_invoice(
    client, owner_headers, manager_headers
):
    """If money reached the invoice through another path between report and
    confirm, the confirmation is capped and the rest becomes credit."""
    claim = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500,
              "date": "2026-07-01", "method": "UPI", "reference": "UPI-X"},
        headers=owner_headers,
    )
    assert claim.status_code == 201
    # Meanwhile the manager records the same money directly (e.g. spotted it
    # on the bank statement before opening the pending claim).
    direct = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500,
              "date": "2026-07-01", "method": "Bank Transfer", "reference": ""},
        headers=manager_headers,
    )
    assert direct.status_code == 201
    # Confirming the claim must NOT push the invoice to 7000 paid.
    confirm = await client.post(
        f"/api/v1/payments/{claim.json()['id']}/confirm", headers=manager_headers
    )
    assert confirm.status_code == 200
    inv = await get_invoice(client, owner_headers, "inv-2606-502")
    assert inv["paidAmount"] == 3500 and inv["status"] == "paid"
    credits = (await client.get("/api/v1/credits", headers=owner_headers)).json()
    assert sum(c["remaining"] for c in credits if c["status"] == "confirmed") == 3500


async def test_credit_pools_across_the_accounts_apartments(
    client, db, owner_headers, manager_headers
):
    """A family's credit is theirs, not one flat's: credit banked on one
    apartment settles another apartment's invoice in the same account."""
    # Give owner502 a second apartment via an account (Raj's model).
    await db.accounts.insert_one(
        {"id": "acct-502", "community_id": "mke", "name": "Household 502",
         "apartment_ids": ["apt-502", "apt-501"]}
    )
    await db.users.update_one(
        {"email": "owner502@example.com"}, {"$set": {"account_id": "acct-502"}}
    )
    # Credit held on apt-501; due invoice on apt-502 (the seeded June one).
    await db.credits.insert_one(
        {"id": "cr-pool", "community_id": "mke", "apartment_id": "apt-501",
         "amount": 5000, "remaining": 5000, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-06-01",
         "created_by": "u-vishnu", "batch_id": None}
    )
    applied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502", "amount": 3500,
              "invoiceIds": ["inv-2606-502"]},
        headers=owner_headers,
    )
    assert applied.status_code == 201, applied.text
    inv = await get_invoice(client, owner_headers, "inv-2606-502")
    assert inv["status"] == "paid"
    pool = await db.credits.find_one({"id": "cr-pool"})
    assert pool["remaining"] == 1500  # drawn from the sibling apartment

    # The manager path pools via the account too.
    jul = await make_invoice(client, manager_headers, "Jul 2026", "2026-07-10",
                             amount=1000, apartment_id="apt-502")
    mgr = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502", "amount": 1000, "invoiceIds": [jul]},
        headers=manager_headers,
    )
    assert mgr.status_code == 201, mgr.text
    assert (await db.credits.find_one({"id": "cr-pool"}))["remaining"] == 500


async def test_auditor_cannot_apply_credit(client, auditor_headers, db):
    await db.credits.insert_one(
        {"id": "cr-x", "community_id": "mke", "apartment_id": "apt-502",
         "amount": 500, "remaining": 500, "source": "overpayment",
         "status": "confirmed", "reference": "", "date": "2026-06-01",
         "created_by": "u-vishnu", "batch_id": None}
    )
    resp = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=auditor_headers,
    )
    assert resp.status_code == 403
