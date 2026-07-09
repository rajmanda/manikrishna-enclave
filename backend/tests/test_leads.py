import pytest

async def test_create_lead_success(client, db):
    payload = {
        "name": "Aditya Rao",
        "phone": "9876543210",
        "email": "aditya.rao@gmail.com",
        "communityName": "Lotus Enclave",
        "unitCount": 12,
        "role": "president",
    }
    resp = await client.post("/api/v1/leads", json=payload)
    assert resp.status_code == 201
    
    body = resp.json()
    assert body["accessToken"]
    assert body["tokenType"] == "bearer"
    assert body["user"]["name"] == "Aditya Rao"
    assert body["user"]["email"] == "aditya.rao@gmail.com"
    assert body["user"]["role"] == "property_manager"
    
    # Check that it exists in the database
    doc = await db.leads.find_one({"email": "aditya.rao@gmail.com"})
    assert doc is not None
    assert doc["name"] == "Aditya Rao"
    assert doc["community_name"] == "Lotus Enclave"

    # Check that a WhatsApp notification is enqueued for Raj Manda
    notif = await db.notification_queue.find_one({"recipient_phone": "+13158775699"})
    assert notif is not None
    assert "Aditya Rao" in notif["message"]


async def test_create_lead_validation_error(client):
    # Missing required field "email"
    payload = {
        "name": "Aditya Rao",
        "phone": "9876543210",
        "communityName": "Lotus Enclave",
    }
    resp = await client.post("/api/v1/leads", json=payload)
    assert resp.status_code == 422


async def test_get_leads_unauthenticated_rejected(client):
    resp = await client.get("/api/v1/leads")
    assert resp.status_code == 401


async def test_get_leads_owner_rejected(client, owner_headers):
    resp = await client.get("/api/v1/leads", headers=owner_headers)
    assert resp.status_code == 403


async def test_get_leads_manager_success(client, manager_headers, db):
    # Insert a mock lead
    await db.leads.insert_one({
        "id": "lead-test123",
        "name": "Karan Mehta",
        "phone": "9988776655",
        "email": "karan.mehta@gmail.com",
        "community_name": "Greenwood Heights",
        "unit_count": 25,
        "role": "manager",
        "created_at": "2026-07-09T12:00:00Z"
    })
    
    resp = await client.get("/api/v1/leads", headers=manager_headers)
    assert resp.status_code == 200
    
    body = resp.json()
    assert len(body) >= 1
    assert body[0]["name"] == "Karan Mehta"
    assert body[0]["communityName"] == "Greenwood Heights"


async def test_create_lead_duplicate_email_purges_old_sandbox(client, db):
    # 1. First lead signup
    payload1 = {
        "name": "Aditya Rao",
        "phone": "9876543210",
        "email": "duplicate@gmail.com",
        "communityName": "First Sandbox",
        "unitCount": 10,
        "role": "president",
    }
    resp1 = await client.post("/api/v1/leads", json=payload1)
    assert resp1.status_code == 201
    body1 = resp1.json()
    first_token = body1["accessToken"]
    
    # Verify user exists
    user1 = await db.users.find_one({"email": "duplicate@gmail.com"})
    assert user1 is not None
    first_com_id = user1["community_id"]
    
    # 2. Duplicate lead signup (same email, fresh sandbox)
    payload2 = {
        "name": "Aditya Rao",
        "phone": "9876543210",
        "email": "duplicate@gmail.com",
        "communityName": "Second Sandbox",
        "unitCount": 5,
        "role": "president",
    }
    resp2 = await client.post("/api/v1/leads", json=payload2)
    assert resp2.status_code == 201
    body2 = resp2.json()
    assert body2["accessToken"] != first_token
    
    # Verify old community data was purged
    old_com = await db.communities.find_one({"id": first_com_id})
    assert old_com is None
    
    # Verify new community exists and has user
    user2 = await db.users.find_one({"email": "duplicate@gmail.com"})
    assert user2 is not None
    assert user2["community_id"] != first_com_id
