import pytest

from app import storage


async def test_generate_invoices_bulk_and_idempotent(client, manager_headers):
    body = {"period": "Jul 2026", "dueDate": "2026-07-10"}
    first = await client.post(
        "/api/v1/invoices/generate", json=body, headers=manager_headers
    )
    assert first.status_code == 200
    assert first.json() == {"created": 10, "skipped": 0}

    # Re-run is a no-op (safe for schedulers).
    second = await client.post(
        "/api/v1/invoices/generate", json=body, headers=manager_headers
    )
    assert second.json() == {"created": 0, "skipped": 10}

    # Amount defaulted from community.monthly_maintenance (migration 001).
    invoices = await client.get("/api/v1/invoices", headers=manager_headers)
    july = [i for i in invoices.json() if i["period"] == "Jul 2026"]
    assert len(july) == 10
    assert all(i["amount"] == 3500 for i in july)


async def test_record_payment_updates_status(client, manager_headers, db):
    # apt-502's June invoice is unpaid (3500 due).
    partial = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 1500, "date": "2026-07-04",
              "method": "UPI", "reference": "UPI-TEST1"},
        headers=manager_headers,
    )
    assert partial.status_code == 201
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 1500 and inv["status"] == "partial"

    rest = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 2000, "date": "2026-07-05",
              "method": "Cash", "reference": "CSH-TEST"},
        headers=manager_headers,
    )
    assert rest.status_code == 201
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 3500 and inv["status"] == "paid"

    # Overpayment rejected.
    over = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 1, "date": "2026-07-05",
              "method": "Cash", "reference": ""},
        headers=manager_headers,
    )
    assert over.status_code == 400


async def test_reverse_payment_recomputes(client, manager_headers, db):
    created = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-502", "amount": 3500, "date": "2026-07-04",
              "method": "UPI", "reference": "X"},
        headers=manager_headers,
    )
    pay_id = created.json()["id"]
    reversed_ = await client.delete(
        f"/api/v1/payments/{pay_id}", headers=manager_headers
    )
    assert reversed_.status_code == 204
    inv = await db.invoices.find_one({"id": "inv-2606-502"})
    assert inv["paid_amount"] == 0 and inv["status"] in ("due", "overdue")


async def test_credit_counts_toward_paid(client, manager_headers, db):
    resp = await client.post(
        "/api/v1/payments",
        json={"invoiceId": "inv-2606-201", "amount": 3500, "date": "2026-07-04",
              "method": "Credit", "reference": "waiver approved in AGM"},
        headers=manager_headers,
    )
    assert resp.status_code == 201
    inv = await db.invoices.find_one({"id": "inv-2606-201"})
    assert inv["status"] == "paid"


async def test_apply_late_fees(client, manager_headers, db):
    resp = await client.post(
        "/api/v1/invoices/apply-late-fees",
        json={"period": "Jun 2026", "amount": 200, "dueDate": "2026-07-20"},
        headers=manager_headers,
    )
    # Two overdue June invoices (201, 401). apartmentIds names the charged
    # apartments so the UI can scope a supporting receipt to just them.
    assert resp.json() == {"created": 2, "apartmentIds": ["apt-201", "apt-401"]}
    again = await client.post(
        "/api/v1/invoices/apply-late-fees",
        json={"period": "Jun 2026", "amount": 200, "dueDate": "2026-07-20"},
        headers=manager_headers,
    )
    assert again.json() == {"created": 0, "apartmentIds": []}
    fee = await db.invoices.find_one({"parent_invoice_id": "inv-2606-201"})
    assert fee["amount"] == 200 and "Late Fee" in fee["description"]


async def test_invoice_delete_blocked_by_payments(client, super_headers):
    blocked = await client.delete(
        "/api/v1/invoices/inv-2606-101", headers=super_headers
    )
    assert blocked.status_code == 409  # has a payment
    ok = await client.delete("/api/v1/invoices/inv-2606-502", headers=super_headers)
    assert ok.status_code == 204


async def test_owner_cannot_write_finance(client, owner_headers):
    for method, path, body in [
        ("post", "/api/v1/invoices/generate", {"period": "X", "dueDate": "2026-08-01"}),
        ("post", "/api/v1/payments", {"invoiceId": "inv-2606-502", "amount": 1,
                                      "date": "2026-07-04", "method": "UPI"}),
        ("post", "/api/v1/expenses", {"category": "Water", "description": "x",
                                      "amount": 1, "paidDate": "2026-07-04"}),
        ("post", "/api/v1/reserve-fund", {"month": "Jul", "contributions": 1}),
    ]:
        resp = await getattr(client, method)(path, json=body, headers=owner_headers)
        assert resp.status_code == 403, path


async def test_expense_crud(client, manager_headers, db):
    created = await client.post(
        "/api/v1/expenses",
        json={"category": "Repairs", "description": "Gate hinge", "amount": 800,
              "paidDate": "2026-07-04", "vendorId": "v-elec"},
        headers=manager_headers,
    )
    assert created.status_code == 201
    eid = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/expenses/{eid}", json={"amount": 850}, headers=manager_headers
    )
    assert updated.json()["amount"] == 850

    deleted = await client.delete(f"/api/v1/expenses/{eid}", headers=manager_headers)
    assert deleted.status_code == 204
    entries = await db.audit_log.find({"entity_id": eid}).to_list(10)
    assert [e["action"] for e in entries] == ["create", "update", "delete"]


async def test_receipt_upload_and_download(client, manager_headers, owner_headers, monkeypatch):
    blobs: dict[str, tuple[bytes, str]] = {}
    monkeypatch.setattr(
        storage, "upload_object", lambda path, data, ct: blobs.__setitem__(path, (data, ct))
    )
    monkeypatch.setattr(storage, "download_object", lambda path: blobs[path])

    up = await client.post(
        "/api/v1/expenses/exp-1/receipt",
        files={"file": ("bill.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=manager_headers,
    )
    assert up.status_code == 200, up.text
    assert up.json()["hasReceipt"] is True

    # Transparency: owners can view receipts.
    down = await client.get("/api/v1/expenses/exp-1/receipt", headers=owner_headers)
    assert down.status_code == 200
    assert down.content == b"%PDF-1.4 fake"

    bad = await client.post(
        "/api/v1/expenses/exp-1/receipt",
        files={"file": ("x.exe", b"MZ", "application/octet-stream")},
        headers=manager_headers,
    )
    assert bad.status_code == 415


async def test_reserve_entry_math_and_duplicate(client, manager_headers):
    created = await client.post(
        "/api/v1/reserve-fund",
        json={"month": "Jul", "contributions": 5000, "expenses": 1000},
        headers=manager_headers,
    )
    assert created.status_code == 201
    assert created.json()["balance"] == 125000  # 121000 + 5000 - 1000

    dup = await client.post(
        "/api/v1/reserve-fund",
        json={"month": "Jul", "contributions": 5000},
        headers=manager_headers,
    )
    assert dup.status_code == 409


async def test_statement_pdf_and_scoping(client, owner_headers, manager_headers):
    own = await client.get("/api/v1/statements/apt-502.pdf", headers=owner_headers)
    assert own.status_code == 200
    assert own.headers["content-type"] == "application/pdf"
    assert own.content.startswith(b"%PDF")

    other = await client.get("/api/v1/statements/apt-101.pdf", headers=owner_headers)
    assert other.status_code == 403

    any_apt = await client.get("/api/v1/statements/apt-101.pdf", headers=manager_headers)
    assert any_apt.status_code == 200


async def test_csv_export_scoped(client, owner_headers, manager_headers):
    owner_csv = await client.get("/api/v1/invoices/export.csv", headers=owner_headers)
    assert owner_csv.status_code == 200
    lines = owner_csv.text.strip().splitlines()
    assert len(lines) == 2  # header + apt-502's single invoice

    mgr_csv = await client.get("/api/v1/invoices/export.csv", headers=manager_headers)
    assert len(mgr_csv.text.strip().splitlines()) == 11  # header + 10


async def test_generate_invoices_for_specific_apartments(client, manager_headers):
    body = {"period": "Aug 2026", "dueDate": "2026-08-10",
            "apartmentIds": ["apt-101", "apt-502"]}
    resp = await client.post(
        "/api/v1/invoices/generate", json=body, headers=manager_headers
    )
    assert resp.json() == {"created": 2, "skipped": 0}

    # Idempotent for the subset; the rest of the building is untouched.
    again = await client.post(
        "/api/v1/invoices/generate", json=body, headers=manager_headers
    )
    assert again.json() == {"created": 0, "skipped": 2}

    invoices = await client.get("/api/v1/invoices", headers=manager_headers)
    aug = [i for i in invoices.json() if i["period"] == "Aug 2026"]
    assert {i["apartmentId"] for i in aug} == {"apt-101", "apt-502"}

    unknown = await client.post(
        "/api/v1/invoices/generate",
        json={"period": "Aug 2026", "dueDate": "2026-08-10", "apartmentIds": ["apt-999"]},
        headers=manager_headers,
    )
    assert unknown.status_code == 400
