"""Notification queue endpoints: related-entity linkage, delivery-failure
summary, retry (resend) flow, agent health/staleness sweep, and the m009
backfill."""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import get_settings
from app.migrations import _m009_notification_related_refs
from app.notification_service import enqueue_notification

API = "/api/v1/notification-queue"


async def _seed_failed(
    db,
    *,
    community_id: str = "mke",
    related_type: str | None = "work_order",
    related_id: str | None = "wo-test-1",
    status: str = "failed",
    error: str = "WhatsApp send timed out",
    failed_at: str = "2026-07-21T09:00:00+00:00",
) -> str:
    doc = await enqueue_notification(
        db,
        community_id=community_id,
        recipient_type="owner",
        recipient_name="Test Owner",
        recipient_phone="+911234567890",
        channel="whatsapp",
        event_type="work_order_created",
        title="Test",
        message="Test message",
        related_type=related_type,
        related_id=related_id,
    )
    await db.notification_queue.update_one(
        {"notification_id": doc["notification_id"]},
        {"$set": {"status": status, "error_message": error, "failed_at": failed_at}},
    )
    return doc["notification_id"]


@pytest.mark.asyncio
async def test_work_order_create_sets_related_refs(client, db, manager_headers):
    resp = await client.post(
        "/api/v1/work-orders",
        headers=manager_headers,
        json={"title": "Fix lobby light", "priority": "Medium"},
    )
    assert resp.status_code in (200, 201), resp.text
    wo_id = resp.json()["id"]
    ntf = await db.notification_queue.find_one(
        {"event_type": "work_order_created", "related_id": wo_id}
    )
    assert ntf is not None
    assert ntf["related_type"] == "work_order"


@pytest.mark.asyncio
async def test_list_filters_by_related_entity(client, db, manager_headers):
    await _seed_failed(db, related_id="wo-aaa")
    await _seed_failed(db, related_id="wo-bbb")
    resp = await client.get(
        f"{API}?related_type=work_order&related_id=wo-aaa&status=failed",
        headers=manager_headers,
    )
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["relatedId"] == "wo-aaa"
    assert rows[0]["relatedType"] == "work_order"


@pytest.mark.asyncio
async def test_delivery_summary_groups_and_scopes(client, db, manager_headers):
    # Two failures for the same work order — newest error must win.
    await _seed_failed(db, related_id="wo-xyz", error="old error",
                       failed_at="2026-07-20T08:00:00+00:00")
    await _seed_failed(db, related_id="wo-xyz", error="new error",
                       failed_at="2026-07-21T10:00:00+00:00")
    # Noise that must NOT appear: other community, unlinked, not failed.
    await _seed_failed(db, community_id="other", related_id="wo-elsewhere")
    await _seed_failed(db, related_type=None, related_id=None)
    await _seed_failed(db, related_id="wo-pending", status="pending")
    # A different entity type, to prove the related_type filter narrows.
    await _seed_failed(db, related_type="expense", related_id="exp-1")

    resp = await client.get(f"{API}/delivery-summary", headers=manager_headers)
    assert resp.status_code == 200
    rows = resp.json()
    by_key = {(r["relatedType"], r["relatedId"]): r for r in rows}
    assert ("work_order", "wo-elsewhere") not in by_key
    assert ("work_order", "wo-pending") not in by_key
    wo = by_key[("work_order", "wo-xyz")]
    assert wo["failedCount"] == 2
    assert len(wo["notificationIds"]) == 2
    assert wo["lastErrorMessage"] == "new error"
    assert ("expense", "exp-1") in by_key

    narrowed = await client.get(
        f"{API}/delivery-summary?related_type=expense", headers=manager_headers
    )
    assert [r["relatedType"] for r in narrowed.json()] == ["expense"]


@pytest.mark.asyncio
async def test_delivery_summary_rbac(client, db, owner_headers, auditor_headers):
    for headers in (owner_headers, auditor_headers):
        resp = await client.get(f"{API}/delivery-summary", headers=headers)
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_retry_resets_failed_to_pending(client, db, manager_headers):
    ntf_id = await _seed_failed(db, related_id="wo-retry")
    resp = await client.post(f"{API}/{ntf_id}/retry", headers=manager_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["errorMessage"] is None
    doc = await db.notification_queue.find_one({"notification_id": ntf_id})
    assert doc["status"] == "pending"
    assert doc["retry_count"] == 1
    # The badge source is empty again.
    summary = await client.get(f"{API}/delivery-summary", headers=manager_headers)
    assert all(r["relatedId"] != "wo-retry" for r in summary.json())


@pytest.mark.asyncio
async def test_retry_conflict_on_sent(client, db, manager_headers):
    ntf_id = await _seed_failed(db, related_id="wo-sent", status="sent")
    resp = await client.post(f"{API}/{ntf_id}/retry", headers=manager_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_openclaw_pending_poll_stamps_heartbeat(client, db):
    key = get_settings().openclaw_api_key
    resp = await client.get(
        "/api/v1/openclaw/notifications/pending", headers={"X-API-Key": key}
    )
    assert resp.status_code == 200, resp.text
    beat = await db.agent_status.find_one({"id": "openclaw-whatsapp"})
    assert beat is not None
    assert beat["last_poll_at"]


@pytest.mark.asyncio
async def test_health_sweeps_stale_and_reports_counts(client, db, manager_headers):
    now = datetime.now(timezone.utc)
    stale_pending = await _seed_failed(db, related_id="wo-stale-p", status="pending")
    stale_processing = await _seed_failed(db, related_id="wo-stale-x", status="processing")
    fresh_pending = await _seed_failed(db, related_id="wo-fresh", status="pending")
    await db.notification_queue.update_one(
        {"notification_id": stale_pending},
        {"$set": {"updated_at": (now - timedelta(hours=3)).isoformat(),
                  "error_message": None, "failed_at": None}},
    )
    await db.notification_queue.update_one(
        {"notification_id": stale_processing},
        {"$set": {"updated_at": (now - timedelta(hours=2)).isoformat(),
                  "error_message": None, "failed_at": None}},
    )
    await db.notification_queue.update_one(
        {"notification_id": fresh_pending},
        {"$set": {"updated_at": now.isoformat(),
                  "error_message": None, "failed_at": None}},
    )

    resp = await client.get(f"{API}/health", headers=manager_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # No poller has ever hit this test DB.
    assert body["agentLastPollAt"] is None
    # Stale entries were swept to failed; only the fresh one is still pending.
    assert body["pendingCount"] == 1
    assert body["processingCount"] == 0
    for nid in (stale_pending, stale_processing):
        doc = await db.notification_queue.find_one({"notification_id": nid})
        assert doc["status"] == "failed"
        assert "expired" in doc["error_message"]
    fresh = await db.notification_queue.find_one({"notification_id": fresh_pending})
    assert fresh["status"] == "pending"
    # Swept entries now surface in the badge feed.
    summary = await client.get(f"{API}/delivery-summary", headers=manager_headers)
    ids = {r["relatedId"] for r in summary.json()}
    assert {"wo-stale-p", "wo-stale-x"} <= ids


@pytest.mark.asyncio
async def test_health_rbac(client, db, owner_headers, auditor_headers):
    for headers in (owner_headers, auditor_headers):
        resp = await client.get(f"{API}/health", headers=headers)
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_sweep_respects_community_scope(client, db, manager_headers):
    now = datetime.now(timezone.utc)
    other_stale = await _seed_failed(
        db, community_id="other", related_id="wo-other-stale", status="pending"
    )
    await db.notification_queue.update_one(
        {"notification_id": other_stale},
        {"$set": {"updated_at": (now - timedelta(hours=5)).isoformat()}},
    )
    await client.get(f"{API}/health", headers=manager_headers)
    doc = await db.notification_queue.find_one({"notification_id": other_stale})
    assert doc["status"] == "pending"  # another community's row is untouched


@pytest.mark.asyncio
async def test_m009_backfills_related_from_payload(db):
    await db.notification_queue.insert_one(
        {
            "notification_id": "ntf-legacy-1",
            "community_id": "mke",
            "payload": {"work_order_id": "wo-legacy"},
            "status": "failed",
        }
    )
    # Carries both refs — cost_case must win over invoice.
    await db.notification_queue.insert_one(
        {
            "notification_id": "ntf-legacy-2",
            "community_id": "mke",
            "payload": {"invoice_id": "inv-1", "cost_case_id": "cc-1"},
            "status": "sent",
        }
    )
    await _m009_notification_related_refs(db)
    d1 = await db.notification_queue.find_one({"notification_id": "ntf-legacy-1"})
    assert (d1["related_type"], d1["related_id"]) == ("work_order", "wo-legacy")
    d2 = await db.notification_queue.find_one({"notification_id": "ntf-legacy-2"})
    assert (d2["related_type"], d2["related_id"]) == ("cost_case", "cc-1")
