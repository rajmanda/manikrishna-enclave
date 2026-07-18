"""Third-party (tenant on behalf of owner) payments.

The HOA invoice is ALWAYS the owner's receivable. A tenant may fund it —
partially, fully, in advance or beyond the balance — without ever creating
a tenant receivable, and the payer identity survives every hop (payment,
banked credit, applied credit, refund, receipt).
"""

from tests.conftest import login


async def make_tenant(db, apartment_id: str = "apt-502",
                      email: str = "tenant502@example.com") -> str:
    """Whitelist a tenant for an apartment; returns the user id."""
    user_id = f"u-tenant-{apartment_id}"
    await db.users.insert_one(
        {
            "id": user_id,
            "community_id": "mke",
            "name": "Tara Tenant",
            "email": email,
            "role": "tenant",
            "apartment_id": apartment_id,
            "phone": None,
        }
    )
    return user_id


# ---------- migration 008 backfill ----------


async def test_migration_backfills_invoices_and_payments(db):
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["responsible_party_type"] == "owner"
    assert inv["responsible_owner_id"] == "u-502"
    assert inv["payment_request_recipient_type"] == "owner"
    assert inv["billing_period_month"] == 6
    assert inv["billing_period_year"] == 2026
    pay = await db.payments.find_one({"id": "pay-1"})
    assert pay["payer_type"] == "owner"
    assert pay["deposit_status"] == "not_required"
    report = await db.migration_reports.find_one({"id": "m008"})
    assert report is not None


# ---------- tenant pays the owner's invoice ----------


async def test_tenant_payment_settles_owner_invoice(client, manager_headers, db):
    tenant_id = await make_tenant(db)
    invoices_before = await db.invoices.count_documents({"community_id": "mke"})
    resp = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": "UPI-TP1", "payerType": "tenant",
              "payerEntityId": tenant_id},
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["payerType"] == "tenant"
    assert body["payerName"] == "Tara Tenant"
    assert body["collectedBy"]  # defaults to the recording manager
    # The OWNER's invoice is settled — no tenant receivable appears.
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 3500 and inv["status"] == "paid"
    assert await db.invoices.count_documents({"community_id": "mke"}) == invoices_before
    # Full audit trail: who paid, who recorded, who collected.
    audit = await db.audit_log.find_one({"entity": "payments", "entity_id": body["id"]})
    assert audit["details"]["payer_type"] == "tenant"
    assert audit["details"]["collected_by"] == body["collectedBy"]


async def test_partial_tenant_payment_leaves_owner_balance(client, manager_headers, db):
    tenant_id = await make_tenant(db)
    resp = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 2000, "date": "2026-07-10",
              "method": "Cash", "reference": "", "payerType": "tenant",
              "payerEntityId": tenant_id},
        headers=manager_headers,
    )
    assert resp.status_code == 201
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    # The remaining Rs 1,500 stays the OWNER's responsibility.
    assert inv["paid_amount"] == 2000 and inv["status"] == "partial"


async def test_overpayment_banks_credit_with_payer(client, manager_headers, db):
    tenant_id = await make_tenant(db)
    resp = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 5000, "date": "2026-07-10",
              "method": "UPI", "reference": "UPI-OVER", "payerType": "tenant",
              "payerEntityId": tenant_id},
        headers=manager_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["amount"] == 3500  # only the required amount applied
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 3500 and inv["status"] == "paid"
    credit = await db.credits.find_one({"apartment_id": "apt-502"})
    assert credit["amount"] == 1500 and credit["remaining"] == 1500
    assert credit["payer_type"] == "tenant"
    assert credit["payer_name"] == "Tara Tenant"


async def test_paying_settled_invoice_still_rejected(client, manager_headers, db):
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": ""},
        headers=manager_headers,
    )
    resp = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 100, "date": "2026-07-10",
              "method": "Cash", "reference": ""},
        headers=manager_headers,
    )
    assert resp.status_code == 400


# ---------- advance payments (before the invoice exists) ----------


async def test_advance_payment_applies_with_payer_preserved(
    client, manager_headers, db
):
    tenant_id = await make_tenant(db)
    adv = await client.post(
        "/api/v1/payments/advance",
        json={"apartmentId": "apt-502", "amount": 3500, "date": "2026-07-20",
              "method": "UPI", "reference": "UPI-ADV", "payerType": "tenant",
              "payerEntityId": tenant_id, "notes": "Aug 2026 HOA paid early"},
        headers=manager_headers,
    )
    assert adv.status_code == 201, adv.text
    body = adv.json()
    assert body["source"] == "advance"
    assert body["payerType"] == "tenant" and body["payerName"] == "Tara Tenant"

    # The invoice arrives later; the manager applies the held money to it.
    gen = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Aug 2026", "dueDate": "2026-08-10",
              "description": "Homeowners Association Fee",
              "apartmentIds": ["apt-502"]},
        headers=manager_headers,
    )
    assert gen.status_code == 200
    # Settle June first so the advance lands on August.
    await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-21",
              "method": "Cash", "reference": ""},
        headers=manager_headers,
    )
    applied = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=manager_headers,
    )
    assert applied.status_code == 201, applied.text
    aug = await db.invoices.find_one(
        {"apartment_id": "apt-502", "period": "Aug 2026"}
    )
    assert aug["paid_amount"] == 3500 and aug["status"] == "paid"
    # The applied payment still names the tenant as the source.
    pay = await db.payments.find_one({"invoice_id": aug["id"]})
    assert pay["payer_type"] == "tenant" and pay["payer_name"] == "Tara Tenant"


async def test_refund_credit_goes_back_to_payer(client, manager_headers, db):
    tenant_id = await make_tenant(db)
    adv = await client.post(
        "/api/v1/payments/advance",
        json={"apartmentId": "apt-502", "amount": 1200, "date": "2026-07-20",
              "method": "Cash", "payerType": "tenant", "payerEntityId": tenant_id},
        headers=manager_headers,
    )
    credit_id = adv.json()["id"]
    refund = await client.post(
        f"/api/v1/credits/{credit_id}/refund",
        json={"note": "Tenant moving out"},
        headers=manager_headers,
    )
    assert refund.status_code == 200, refund.text
    assert refund.json()["status"] == "refunded"
    entry = await db.credits.find_one({"id": credit_id})
    assert entry["remaining"] == 0 and entry["status"] == "refunded"
    audit = await db.audit_log.find_one(
        {"entity": "credits", "entity_id": credit_id, "details.refunded": True}
    )
    assert audit["details"]["refund_to_payer_type"] == "tenant"
    assert audit["details"]["refund_to_payer_name"] == "Tara Tenant"
    # Refunded credit can no longer be spent.
    spend = await client.post(
        "/api/v1/payments/apply-credit",
        json={"apartmentId": "apt-502"},
        headers=manager_headers,
    )
    assert spend.status_code == 409


# ---------- void-and-replace ----------


async def test_void_payment_restores_balance_and_keeps_record(
    client, manager_headers, db
):
    created = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": "UPI-X"},
        headers=manager_headers,
    )
    pay_id = created.json()["id"]
    voided = await client.post(
        f"/api/v1/payments/{pay_id}/void",
        json={"reason": "Recorded against the wrong flat"},
        headers=manager_headers,
    )
    assert voided.status_code == 200, voided.text
    body = voided.json()
    assert body["status"] == "voided"
    assert body["voidReason"] == "Recorded against the wrong flat"
    assert body["voidedBy"]
    # Balance restored, record retained.
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 0 and inv["status"] in ("due", "overdue")
    assert await db.payments.find_one({"id": pay_id}) is not None
    # A voided payment cannot be voided twice.
    again = await client.post(
        f"/api/v1/payments/{pay_id}/void", json={"reason": "x"},
        headers=manager_headers,
    )
    assert again.status_code == 404


async def test_voided_payment_excluded_from_owner_statement(
    client, manager_headers, owner_headers, db
):
    created = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": "GONE-REF"},
        headers=manager_headers,
    )
    await client.post(
        f"/api/v1/payments/{created.json()['id']}/void",
        json={"reason": "test"}, headers=manager_headers,
    )
    pdf = await client.get("/api/v1/statements/apt-502.pdf", headers=owner_headers)
    assert pdf.status_code == 200
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 0


# ---------- tenant receipt ----------


async def test_receipt_pdf_for_tenant_payment(client, manager_headers, db):
    tenant_id = await make_tenant(db)
    created = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": "UPI-RCPT", "payerType": "tenant",
              "payerEntityId": tenant_id},
        headers=manager_headers,
    )
    pay_id = created.json()["id"]
    # The tenant (the actual payer) downloads their own receipt.
    tenant_headers = await login(client, "tenant502@example.com")
    pdf = await client.get(
        f"/api/v1/payments/{pay_id}/receipt.pdf", headers=tenant_headers
    )
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert len(pdf.content) > 500
    # Another apartment's owner may not.
    other_headers = await login(client, "owner101@example.com")
    denied = await client.get(
        f"/api/v1/payments/{pay_id}/receipt.pdf", headers=other_headers
    )
    assert denied.status_code == 403


# ---------- payment-request routing at invoice generation ----------


async def test_generate_routes_request_to_tenant_where_chosen(
    client, manager_headers, db
):
    await make_tenant(db, "apt-101", "tenant101@example.com")
    gen = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Sep 2026", "dueDate": "2026-09-10",
              "description": "Homeowners Association Fee",
              "apartmentIds": ["apt-101", "apt-201"],
              # apt-201 has no tenant — the request must fall back to owner.
              "tenantRecipients": ["apt-101", "apt-201"]},
        headers=manager_headers,
    )
    assert gen.status_code == 200 and gen.json()["created"] == 2
    rented = await db.invoices.find_one(
        {"apartment_id": "apt-101", "period": "Sep 2026"}
    )
    assert rented["payment_request_recipient_type"] == "tenant"
    assert rented["payment_request_recipient_id"] == "u-tenant-apt-101"
    assert rented["apartment_occupancy_status"] == "rented"
    assert rented["responsible_owner_id"] == "u-101"  # liability unmoved
    assert rented["billing_period_month"] == 9
    assert rented["billing_period_year"] == 2026
    vacant = await db.invoices.find_one(
        {"apartment_id": "apt-201", "period": "Sep 2026"}
    )
    assert vacant["payment_request_recipient_type"] == "owner"
    assert vacant["payment_request_recipient_id"] == "u-201"
    assert vacant["apartment_occupancy_status"] == "owner_occupied"


async def test_patch_reroutes_payment_request(client, manager_headers, db):
    await make_tenant(db)
    patched = await client.patch(
        "/api/v1/invoices/inv-2606-502",
        json={"paymentRequestRecipientType": "tenant"},
        headers=manager_headers,
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["paymentRequestRecipientType"] == "tenant"
    assert body["paymentRequestRecipientId"] == "u-tenant-apt-502"
    # Without a tenant the reroute is rejected.
    denied = await client.patch(
        "/api/v1/invoices/inv-2606-201",
        json={"paymentRequestRecipientType": "tenant"},
        headers=manager_headers,
    )
    assert denied.status_code == 400


async def test_tenant_reported_claim_carries_payer(client, manager_headers, db):
    await make_tenant(db)
    tenant_headers = await login(client, "tenant502@example.com")
    reported = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": "UPI-CLAIM"},
        headers=tenant_headers,
    )
    assert reported.status_code == 201, reported.text
    pay_id = reported.json()["id"]
    pay = await db.payments.find_one({"id": pay_id})
    assert pay["payer_type"] == "tenant" and pay["payer_name"] == "Tara Tenant"
    # Pending claims count nowhere and have no receipt yet.
    no_receipt = await client.get(
        f"/api/v1/payments/{pay_id}/receipt.pdf", headers=tenant_headers
    )
    assert no_receipt.status_code == 400
    confirmed = await client.post(
        f"/api/v1/payments/{pay_id}/confirm", headers=manager_headers
    )
    assert confirmed.status_code == 200
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 3500 and inv["status"] == "paid"
    receipt = await client.get(
        f"/api/v1/payments/{pay_id}/receipt.pdf", headers=tenant_headers
    )
    assert receipt.status_code == 200


# ---------- owner declares the payer when reporting ----------


async def test_owner_reports_tenant_paid(client, manager_headers, owner_headers, db):
    await make_tenant(db)
    reported = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "UPI", "reference": "UPI-OD", "payerType": "tenant"},
        headers=owner_headers,
    )
    assert reported.status_code == 201, reported.text
    pay = await db.payments.find_one({"id": reported.json()["id"]})
    # The whitelisted tenant is resolved as the payer; the owner reported it.
    assert pay["payer_type"] == "tenant"
    assert pay["payer_entity_id"] == "u-tenant-apt-502"
    assert pay["payer_name"] == "Tara Tenant"
    assert pay["status"] == "pending"
    # Vishnu confirms — he becomes the collector, books tally.
    confirmed = await client.post(
        f"/api/v1/payments/{pay['id']}/confirm", headers=manager_headers
    )
    assert confirmed.status_code == 200
    pay = await db.payments.find_one({"id": pay["id"]})
    assert pay["collected_by"] is not None
    assert pay["collection_date"] == "2026-07-10"
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 3500 and inv["status"] == "paid"


async def test_owner_reports_other_payer_requires_name(client, owner_headers, db):
    missing = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "Cash", "payerType": "other"},
        headers=owner_headers,
    )
    assert missing.status_code == 400
    named = await client.post(
        "/api/v1/payments/report",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-10",
              "method": "Cash", "payerType": "other", "payerName": "Uncle Ravi"},
        headers=owner_headers,
    )
    assert named.status_code == 201, named.text
    pay = await db.payments.find_one({"id": named.json()["id"]})
    assert pay["payer_type"] == "other" and pay["payer_name"] == "Uncle Ravi"


async def test_batch_report_carries_declared_payer(
    client, manager_headers, owner_headers, db
):
    await make_tenant(db)
    # A second open invoice for the same apartment.
    gen = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Jul 2026", "dueDate": "2026-07-10",
              "description": "Homeowners Association Fee",
              "apartmentIds": ["apt-502"]},
        headers=manager_headers,
    )
    assert gen.status_code == 200 and gen.json()["created"] == 1
    jul = await db.invoices.find_one({"apartment_id": "apt-502", "period": "Jul 2026"})
    batch = await client.post(
        "/api/v1/payments/report-batch",
        json={"invoiceIds": ["inv-2606-502", jul["id"]], "amount": 7000,
              "date": "2026-07-10", "method": "Bank Transfer",
              "reference": "NEFT-1", "payerType": "tenant"},
        headers=owner_headers,
    )
    assert batch.status_code == 201, batch.text
    batch_id = batch.json()["batchId"]
    rows = await db.payments.find({"batch_id": batch_id}).to_list(10)
    assert len(rows) == 2
    assert all(
        r["payer_type"] == "tenant" and r["payer_name"] == "Tara Tenant"
        for r in rows
    )
    # Confirm the batch — both invoices settle, payer survives.
    confirmed = await client.post(
        f"/api/v1/payments/batch/{batch_id}/confirm", headers=manager_headers
    )
    assert confirmed.status_code == 200 and confirmed.json()["confirmed"] == 2
    for inv_id in ("inv-2606-502", jul["id"]):
        inv = await db.invoices.find_one({"id": inv_id})
        assert inv["status"] == "paid"
    rows = await db.payments.find({"batch_id": batch_id}).to_list(10)
    assert all(r["collected_by"] is not None for r in rows)
