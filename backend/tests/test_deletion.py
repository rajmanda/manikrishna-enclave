import pytest

# ---------- Work orders Deletion ----------

async def test_owner_cannot_delete_work_order(client, owner_headers):
    # Try deleting wo-1 as owner
    resp = await client.delete("/api/v1/work-orders/wo-1", headers=owner_headers)
    assert resp.status_code == 403
    assert "Requires one of" in resp.json()["detail"] or "Forbidden" in resp.text

async def test_manager_cannot_delete_work_order(client, manager_headers):
    # Try deleting wo-1 as manager
    resp = await client.delete("/api/v1/work-orders/wo-1", headers=manager_headers)
    assert resp.status_code == 403

async def test_super_admin_can_delete_work_order(client, super_headers, db):
    # Delete wo-1 as super_admin
    resp = await client.delete("/api/v1/work-orders/wo-1", headers=super_headers)
    assert resp.status_code == 204
    
    # Confirm it is removed from the database
    doc = await db.work_orders.find_one({"id": "wo-1"})
    assert doc is None
    
    # Verify audit log was recorded
    audit = await db.audit_log.find_one({"entity": "work_orders", "entity_id": "wo-1", "action": "delete"})
    assert audit is not None
    assert audit["user_id"] == "u-super"

async def test_delete_nonexistent_work_order(client, super_headers):
    # Try deleting non-existent work order as super_admin
    resp = await client.delete("/api/v1/work-orders/wo-fake", headers=super_headers)
    assert resp.status_code == 404

# ---------- Maintenance Requests Deletion ----------

async def test_owner_cannot_delete_maintenance_request(client, owner_headers):
    resp = await client.delete("/api/v1/maintenance-requests/mr-1", headers=owner_headers)
    assert resp.status_code == 403

async def test_manager_cannot_delete_maintenance_request(client, manager_headers):
    resp = await client.delete("/api/v1/maintenance-requests/mr-1", headers=manager_headers)
    assert resp.status_code == 403

async def test_super_admin_can_delete_maintenance_request(client, super_headers, db):
    # Delete mr-1 as super_admin
    resp = await client.delete("/api/v1/maintenance-requests/mr-1", headers=super_headers)
    assert resp.status_code == 204
    
    # Confirm it is removed from the database
    doc = await db.maintenance_requests.find_one({"id": "mr-1"})
    assert doc is None
    
    # Verify audit log was recorded
    audit = await db.audit_log.find_one({"entity": "maintenance_requests", "entity_id": "mr-1", "action": "delete"})
    assert audit is not None
    assert audit["user_id"] == "u-super"

async def test_delete_nonexistent_maintenance_request(client, super_headers):
    resp = await client.delete("/api/v1/maintenance-requests/mr-fake", headers=super_headers)
    assert resp.status_code == 404

# ---------- Invoice deletion (manager privilege + payment cascade) ----------

async def _create_paid_invoice(client, manager_headers) -> tuple[str, str]:
    inv = (await client.post(
        "/api/v1/invoices",
        json={"apartmentId": "apt-502", "period": "Test 2026",
              "description": "Cascade test", "amount": 500, "dueDate": "2026-08-01"},
        headers=manager_headers,
    )).json()
    pay = (await client.post(
        "/api/v1/payments",
        json={"invoiceId": inv["id"], "amount": 500, "date": "2026-07-05",
              "method": "UPI", "reference": "CASC-1"},
        headers=manager_headers,
    )).json()
    return inv["id"], pay["id"]

async def test_manager_can_delete_unpaid_invoice(client, manager_headers, db):
    inv = (await client.post(
        "/api/v1/invoices",
        json={"apartmentId": "apt-502", "period": "Test 2026",
              "description": "Delete me", "amount": 100, "dueDate": "2026-08-01"},
        headers=manager_headers,
    )).json()
    resp = await client.delete(f"/api/v1/invoices/{inv['id']}", headers=manager_headers)
    assert resp.status_code == 204
    assert await db.invoices.find_one({"id": inv["id"]}) is None

async def test_delete_invoice_with_payments_requires_cascade(client, super_headers, manager_headers, db):
    invoice_id, payment_id = await _create_paid_invoice(client, manager_headers)

    # Super admin tries to delete without cascade -> 409
    resp = await client.delete(f"/api/v1/invoices/{invoice_id}", headers=super_headers)
    assert resp.status_code == 409
    assert await db.invoices.find_one({"id": invoice_id}) is not None
    assert await db.payments.find_one({"id": payment_id}) is not None

    # Super admin tries to delete with cascade -> 204
    resp = await client.delete(
        f"/api/v1/invoices/{invoice_id}?cascade=true", headers=super_headers
    )
    assert resp.status_code == 204
    assert await db.invoices.find_one({"id": invoice_id}) is None
    assert await db.payments.find_one({"id": payment_id}) is None

    # Both the invoice and the cascaded payments are audited
    audit = await db.audit_log.find_one(
        {"entity": "invoices", "entity_id": invoice_id, "action": "delete"}
    )
    assert audit is not None and audit["details"]["cascaded_payments"] == 1
    assert await db.audit_log.find_one(
        {"entity": "payments", "entity_id": f"cascade:{invoice_id}", "action": "delete"}
    ) is not None

async def test_manager_cannot_delete_paid_invoice(client, manager_headers):
    # Create a paid invoice
    invoice_id, _ = await _create_paid_invoice(client, manager_headers)
    
    # Manager tries to delete -> 403 Forbidden
    resp = await client.delete(
        f"/api/v1/invoices/{invoice_id}?cascade=true", headers=manager_headers
    )
    assert resp.status_code == 403
    assert "not allowed to delete paid off invoices" in resp.json()["detail"]

async def test_owner_cannot_delete_invoice(client, owner_headers, manager_headers):
    invoice_id, _ = await _create_paid_invoice(client, manager_headers)
    resp = await client.delete(
        f"/api/v1/invoices/{invoice_id}?cascade=true", headers=owner_headers
    )
    assert resp.status_code == 403
