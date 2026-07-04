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
