"""Direct messages: resident ↔ manager threads, notifications, RBAC."""

from tests.conftest import login


async def make_tenant(client, manager_headers, email="tenant502@gmail.com"):
    resp = await client.post(
        "/api/v1/users",
        json={
            "name": "Ravi Tenant",
            "email": email,
            "role": "tenant",
            "apartmentId": "apt-502",
        },
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"], await login(client, email)


async def test_tenant_and_manager_exchange_messages(client, manager_headers):
    tenant_id, tenant_headers = await make_tenant(client, manager_headers)

    sent = await client.post(
        "/api/v1/messages",
        json={"text": "The tap in my kitchen is leaking."},
        headers=tenant_headers,
    )
    assert sent.status_code == 201, sent.text
    assert sent.json()["threadUserId"] == tenant_id

    # Manager inbox shows the thread with one unread message.
    threads = await client.get("/api/v1/messages/threads", headers=manager_headers)
    assert threads.status_code == 200
    row = next(t for t in threads.json() if t["threadUserId"] == tenant_id)
    assert row["unreadCount"] == 1
    assert row["threadUserName"] == "Ravi Tenant"

    # Manager was notified in-app.
    notifications = await client.get("/api/v1/notifications", headers=manager_headers)
    assert any("Ravi Tenant" in n["text"] for n in notifications.json())

    # Manager opens the thread (marks it read) and replies.
    thread = await client.get(
        f"/api/v1/messages?threadUserId={tenant_id}", headers=manager_headers
    )
    assert thread.status_code == 200
    assert len(thread.json()) == 1

    reply = await client.post(
        "/api/v1/messages",
        json={"text": "I'll send the plumber tomorrow.", "threadUserId": tenant_id},
        headers=manager_headers,
    )
    assert reply.status_code == 201

    threads2 = await client.get("/api/v1/messages/threads", headers=manager_headers)
    row2 = next(t for t in threads2.json() if t["threadUserId"] == tenant_id)
    assert row2["unreadCount"] == 0  # read when the manager opened the thread

    # Tenant sees the full conversation (their own thread, no param needed).
    convo = await client.get("/api/v1/messages", headers=tenant_headers)
    assert convo.status_code == 200
    assert [m["text"] for m in convo.json()] == [
        "The tap in my kitchen is leaking.",
        "I'll send the plumber tomorrow.",
    ]

    # Tenant got the reply notification too.
    tenant_notifs = await client.get("/api/v1/notifications", headers=tenant_headers)
    assert any(n["href"] == "/messages" for n in tenant_notifs.json())


async def test_residents_cannot_see_each_others_threads(client, manager_headers, owner_headers):
    _, tenant_headers = await make_tenant(client, manager_headers)
    await client.post(
        "/api/v1/messages", json={"text": "private tenant note"}, headers=tenant_headers
    )
    convo = await client.get("/api/v1/messages", headers=owner_headers)
    assert convo.status_code == 200
    assert convo.json() == []  # owner only sees their own (empty) thread

    # Residents cannot list the manager inbox.
    threads = await client.get("/api/v1/messages/threads", headers=tenant_headers)
    assert threads.status_code == 403


async def test_manager_message_requires_thread_and_valid_resident(client, manager_headers):
    missing = await client.post(
        "/api/v1/messages", json={"text": "hi"}, headers=manager_headers
    )
    assert missing.status_code == 422

    unknown = await client.post(
        "/api/v1/messages",
        json={"text": "hi", "threadUserId": "u-nope"},
        headers=manager_headers,
    )
    assert unknown.status_code == 404


async def test_auditor_cannot_send_messages(client, auditor_headers):
    resp = await client.post(
        "/api/v1/messages", json={"text": "hello"}, headers=auditor_headers
    )
    assert resp.status_code == 403


async def test_tenant_message_enqueues_whatsapp_for_manager(client, db, manager_headers):
    # Give Vishnu a phone so the WhatsApp enqueue path fires.
    await db.users.update_one({"id": "u-vishnu"}, {"$set": {"phone": "+911234567890"}})
    _, tenant_headers = await make_tenant(client, manager_headers)
    await client.post(
        "/api/v1/messages", json={"text": "Gate light is out."}, headers=tenant_headers
    )
    queued = await db.notification_queue.find({"event_type": "direct_message"}).to_list(10)
    assert len(queued) == 1
    assert queued[0]["recipient_user_id"] == "u-vishnu"
    assert queued[0]["message"] == "Gate light is out."
