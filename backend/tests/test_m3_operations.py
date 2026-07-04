from app import storage


# ---------- Work orders ----------


async def test_create_work_order_notifies_members(client, manager_headers, db):
    resp = await client.post(
        "/api/v1/work-orders",
        json={"title": "Gate motor jam", "description": "Sliding gate stuck",
              "priority": "High", "vendorId": "v-elec", "estimate": 1500},
        headers=manager_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["stage"] == "Reported" and len(body["timeline"]) == 1
    # Owners were notified (not the acting manager).
    notes = await db.notifications.find({"text": {"$regex": "Gate motor"}}).to_list(100)
    assert len(notes) == 10  # all 10 owners; actor and auditor excluded
    assert all(n["user_id"] != "u-vishnu" for n in notes)


async def test_stage_change_appends_timeline_and_notifies(client, manager_headers, owner_headers, db):
    resp = await client.post(
        "/api/v1/work-orders/wo-3/stage",
        json={"stage": "In Progress", "note": "Approved offline, starting Monday"},
        headers=manager_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["stage"] == "In Progress"
    assert resp.json()["timeline"][-1]["note"] == "Approved offline, starting Monday"

    # Owner sees it in their notifications.
    notes = await client.get("/api/v1/notifications", headers=owner_headers)
    texts = [n["text"] for n in notes.json()]
    assert any("Water Tank Cleaning" in t and "In Progress" in t for t in texts)


async def test_stage_with_final_cost(client, manager_headers):
    resp = await client.post(
        "/api/v1/work-orders/wo-2/stage",
        json={"stage": "Completed", "note": "Pressure stable", "finalCost": 2850},
        headers=manager_headers,
    )
    assert resp.json()["finalCost"] == 2850


async def test_owner_can_comment_auditor_cannot(client, owner_headers, auditor_headers):
    ok = await client.post(
        "/api/v1/work-orders/wo-1/comments",
        json={"text": "Please prioritise, elders use this lift daily."},
        headers=owner_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["comments"][-1]["authorId"] == "u-502"

    denied = await client.post(
        "/api/v1/work-orders/wo-1/comments",
        json={"text": "x"},
        headers=auditor_headers,
    )
    assert denied.status_code == 403


async def test_owner_cannot_create_or_stage(client, owner_headers):
    create = await client.post(
        "/api/v1/work-orders", json={"title": "X"}, headers=owner_headers
    )
    assert create.status_code == 403
    stage = await client.post(
        "/api/v1/work-orders/wo-1/stage", json={"stage": "Closed"}, headers=owner_headers
    )
    assert stage.status_code == 403


async def test_work_order_photo_upload_and_fetch(client, manager_headers, owner_headers, monkeypatch):
    blobs: dict[str, tuple[bytes, str]] = {}
    monkeypatch.setattr(storage, "upload_object", lambda p, d, c: blobs.__setitem__(p, (d, c)))
    monkeypatch.setattr(storage, "download_object", lambda p: blobs[p])

    up = await client.post(
        "/api/v1/work-orders/wo-3/photos",
        files={"file": ("tank.jpg", b"\xff\xd8fakejpg", "image/jpeg")},
        headers=manager_headers,
    )
    assert up.status_code == 200
    assert up.json()["photoCount"] == 1

    down = await client.get(
        "/api/v1/work-orders/wo-3/photos/0", headers=owner_headers
    )
    assert down.status_code == 200
    assert down.content == b"\xff\xd8fakejpg"


# ---------- Maintenance requests ----------


async def test_maintenance_visibility(client, owner_headers, manager_headers, db):
    # Seeded: 3 community + 1 private (created by u-502, the owner fixture).
    own = await client.get("/api/v1/maintenance-requests", headers=owner_headers)
    assert len(own.json()) == 4  # sees own private request

    # Another owner does not see u-502's private request.
    login = await client.post(
        "/api/v1/auth/dev-login", json={"email": "owner101@example.com"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    other = await client.get("/api/v1/maintenance-requests", headers=other_headers)
    assert len(other.json()) == 3
    assert all(r["visibility"] == "community" for r in other.json())

    mgr = await client.get("/api/v1/maintenance-requests", headers=manager_headers)
    assert len(mgr.json()) == 4


async def test_maintenance_create_and_status_notification(client, owner_headers, manager_headers, db):
    created = await client.post(
        "/api/v1/maintenance-requests",
        json={"title": "Corridor bulb fused", "description": "3rd floor", "visibility": "community"},
        headers=owner_headers,
    )
    assert created.status_code == 201
    rid = created.json()["id"]

    # Manager got a direct notification.
    mgr_notes = await client.get("/api/v1/notifications", headers=manager_headers)
    assert any("Corridor bulb" in n["text"] for n in mgr_notes.json())

    updated = await client.patch(
        f"/api/v1/maintenance-requests/{rid}/status",
        json={"status": "Resolved"},
        headers=manager_headers,
    )
    assert updated.json()["status"] == "Resolved"

    # Creator was notified of the status change.
    own_notes = await client.get("/api/v1/notifications", headers=owner_headers)
    assert any("Corridor bulb" in n["text"] and "Resolved" in n["text"] for n in own_notes.json())


# ---------- Vendors ----------


async def test_vendor_crud_and_delete_guard(client, manager_headers):
    created = await client.post(
        "/api/v1/vendors",
        json={"name": "Aqua Pumps", "service": "Bore well", "phone": "+91 90000 99999", "rating": 4.0},
        headers=manager_headers,
    )
    assert created.status_code == 201
    vid = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/vendors/{vid}", json={"rating": 4.6}, headers=manager_headers
    )
    assert updated.json()["rating"] == 4.6

    # v-lift has an open work order (wo-1) — deletion blocked.
    blocked = await client.delete("/api/v1/vendors/v-lift", headers=manager_headers)
    assert blocked.status_code == 409

    ok = await client.delete(f"/api/v1/vendors/{vid}", headers=manager_headers)
    assert ok.status_code == 204


# ---------- Feed ----------


async def test_feed_list_pinned_first_with_counts(client, owner_headers):
    resp = await client.get("/api/v1/feed", headers=owner_headers)
    posts = resp.json()
    assert posts[0]["id"] == "post-1" and posts[0]["pinned"] is True
    assert posts[0]["reactions"] == {"like": 2, "heart": 0, "thanks": 1}
    assert posts[0]["myReaction"] is None


async def test_feed_post_comment_react_flow(client, owner_headers, db):
    created = await client.post(
        "/api/v1/feed",
        json={"type": "question", "text": "Anyone else's water pressure low today?"},
        headers=owner_headers,
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    commented = await client.post(
        f"/api/v1/feed/{pid}/comments",
        json={"text": "Yes, tank cleaning is scheduled."},
        headers=owner_headers,
    )
    assert len(commented.json()["comments"]) == 1

    reacted = await client.post(
        f"/api/v1/feed/{pid}/react", json={"kind": "like"}, headers=owner_headers
    )
    assert reacted.json()["reactions"]["like"] == 1
    assert reacted.json()["myReaction"] == "like"

    unreacted = await client.post(
        f"/api/v1/feed/{pid}/react", json={"kind": "none"}, headers=owner_headers
    )
    assert unreacted.json()["reactions"]["like"] == 0
    assert unreacted.json()["myReaction"] is None


async def test_announcement_notifies_members(client, manager_headers, owner_headers):
    await client.post(
        "/api/v1/feed",
        json={"type": "announcement", "text": "Water supply off Sunday 10am-12pm for tank cleaning."},
        headers=manager_headers,
    )
    notes = await client.get("/api/v1/notifications", headers=owner_headers)
    assert any("Water supply off Sunday" in n["text"] for n in notes.json())


async def test_feed_delete_rules_and_pin(client, owner_headers, manager_headers):
    created = await client.post(
        "/api/v1/feed", json={"type": "suggestion", "text": "Compost bins?"},
        headers=owner_headers,
    )
    pid = created.json()["id"]

    # Another member cannot delete someone else's post.
    login = await client.post(
        "/api/v1/auth/dev-login", json={"email": "owner101@example.com"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    denied = await client.delete(f"/api/v1/feed/{pid}", headers=other_headers)
    assert denied.status_code == 403

    # Manager can pin; owner cannot.
    pin_denied = await client.post(f"/api/v1/feed/{pid}/pin", headers=owner_headers)
    assert pin_denied.status_code == 403
    pinned = await client.post(f"/api/v1/feed/{pid}/pin", headers=manager_headers)
    assert pinned.json()["pinned"] is True

    # Author can delete their own post.
    deleted = await client.delete(f"/api/v1/feed/{pid}", headers=owner_headers)
    assert deleted.status_code == 204


# ---------- Notifications ----------


async def test_notifications_read_flow_and_isolation(client, manager_headers, owner_headers, db):
    await client.post(
        "/api/v1/work-orders/wo-5/stage",
        json={"stage": "Owner Approval", "note": "Poll opened"},
        headers=manager_headers,
    )
    notes = await client.get("/api/v1/notifications", headers=owner_headers)
    unread = [n for n in notes.json() if not n["read"]]
    assert len(unread) >= 1
    nid = unread[0]["id"]

    await client.post(f"/api/v1/notifications/{nid}/read", headers=owner_headers)
    await client.post("/api/v1/notifications/read-all", headers=owner_headers)
    after = await client.get("/api/v1/notifications", headers=owner_headers)
    assert all(n["read"] for n in after.json())

    # A user cannot mark someone else's notification.
    other = await client.post(
        f"/api/v1/notifications/{nid}/read", headers=manager_headers
    )
    assert other.status_code == 404


async def test_maintenance_delete_super_admin_only(client, manager_headers, db):
    denied = await client.delete(
        "/api/v1/maintenance-requests/mr-1", headers=manager_headers
    )
    assert denied.status_code == 403  # property_manager is not enough

    login = await client.post(
        "/api/v1/auth/dev-login", json={"email": "super@communityhub.app"}
    )
    super_headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    # Super admins are platform-level: delete works across communities.
    ok = await client.delete(
        "/api/v1/maintenance-requests/mr-1", headers=super_headers
    )
    assert ok.status_code == 204
    assert await db.maintenance_requests.find_one({"id": "mr-1"}) is None
