from app import storage


# ---------- Polls ----------


async def test_poll_lifecycle_one_vote_per_apartment(client, owner_headers, manager_headers):
    created = await client.post(
        "/api/v1/polls",
        json={"question": "Repaint the lobby?", "closeDate": "2099-01-01",
              "options": ["Yes", "No"]},
        headers=manager_headers,
    )
    assert created.status_code == 201
    pid = created.json()["id"]
    assert created.json()["totalEligible"] == 10

    voted = await client.post(
        f"/api/v1/polls/{pid}/vote", json={"option": "Yes"}, headers=owner_headers
    )
    assert voted.json()["myVote"] == "Yes"
    assert next(o for o in voted.json()["options"] if o["label"] == "Yes")["votes"] == 1

    # Changing the vote replaces it (still one per apartment).
    changed = await client.post(
        f"/api/v1/polls/{pid}/vote", json={"option": "No"}, headers=owner_headers
    )
    assert next(o for o in changed.json()["options"] if o["label"] == "Yes")["votes"] == 0
    assert next(o for o in changed.json()["options"] if o["label"] == "No")["votes"] == 1

    # Manager (no apartment) cannot vote.
    denied = await client.post(
        f"/api/v1/polls/{pid}/vote", json={"option": "Yes"}, headers=manager_headers
    )
    assert denied.status_code == 403

    closed = await client.post(f"/api/v1/polls/{pid}/close", headers=manager_headers)
    assert closed.json()["status"] == "closed"
    late = await client.post(
        f"/api/v1/polls/{pid}/vote", json={"option": "Yes"}, headers=owner_headers
    )
    assert late.status_code == 409


async def test_seeded_polls_and_date_close(client, owner_headers):
    resp = await client.get("/api/v1/polls", headers=owner_headers)
    polls = {p["id"]: p for p in resp.json()}
    assert polls["poll-1"]["status"] == "closed"
    approve = next(o for o in polls["poll-1"]["options"] if o["label"] == "Approve")
    assert approve["votes"] == 8
    assert polls["poll-3"]["myVote"] == "Reject"  # apt-502 seeded vote


async def test_owner_cannot_create_poll(client, owner_headers):
    resp = await client.post(
        "/api/v1/polls",
        json={"question": "X?", "closeDate": "2099-01-01", "options": ["A", "B"]},
        headers=owner_headers,
    )
    assert resp.status_code == 403


# ---------- Documents ----------


async def test_document_upload_versioning_download(client, manager_headers, owner_headers, monkeypatch):
    blobs: dict[str, tuple[bytes, str]] = {}
    monkeypatch.setattr(storage, "upload_object", lambda p, d, c: blobs.__setitem__(p, (d, c)))
    monkeypatch.setattr(storage, "download_object", lambda p: blobs[p])

    up = await client.post(
        "/api/v1/documents",
        files={"file": ("rules.pdf", b"%PDF v1", "application/pdf")},
        data={"title": "Parking Rules", "category": "Society Rules"},
        headers=manager_headers,
    )
    assert up.status_code == 201
    doc = up.json()
    assert doc["version"] == 1 and doc["fileType"] == "pdf"

    v2 = await client.post(
        f"/api/v1/documents/{doc['id']}/file",
        files={"file": ("rules-v2.pdf", b"%PDF v2", "application/pdf")},
        headers=manager_headers,
    )
    assert v2.json()["version"] == 2

    down = await client.get(
        f"/api/v1/documents/{doc['id']}/file", headers=owner_headers
    )
    assert down.content == b"%PDF v2"  # latest version served

    denied = await client.post(
        "/api/v1/documents",
        files={"file": ("x.pdf", b"%PDF", "application/pdf")},
        data={"title": "X", "category": "Y"},
        headers=owner_headers,
    )
    assert denied.status_code == 403


async def test_legacy_document_without_file(client, owner_headers):
    listing = await client.get("/api/v1/documents", headers=owner_headers)
    doc1 = next(d for d in listing.json() if d["id"] == "doc-1")
    assert doc1["path"] is None
    resp = await client.get("/api/v1/documents/doc-1/file", headers=owner_headers)
    assert resp.status_code == 404


# ---------- Meetings ----------


async def test_meeting_crud_and_minutes(client, manager_headers, owner_headers, monkeypatch):
    blobs: dict[str, tuple[bytes, str]] = {}
    monkeypatch.setattr(storage, "upload_object", lambda p, d, c: blobs.__setitem__(p, (d, c)))
    monkeypatch.setattr(storage, "download_object", lambda p: blobs[p])

    created = await client.post(
        "/api/v1/meetings",
        json={"title": "Diwali planning", "date": "2026-09-15",
              "agenda": ["Budget", "Volunteers"]},
        headers=manager_headers,
    )
    assert created.status_code == 201
    mid = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/meetings/{mid}",
        json={"attendance": 8, "resolutions": ["Budget Rs 15,000 approved"]},
        headers=manager_headers,
    )
    assert updated.json()["attendance"] == 8

    minutes = await client.post(
        f"/api/v1/meetings/{mid}/minutes",
        files={"file": ("minutes.pdf", b"%PDF minutes", "application/pdf")},
        headers=manager_headers,
    )
    assert minutes.json()["hasPdf"] is True

    down = await client.get(f"/api/v1/meetings/{mid}/minutes", headers=owner_headers)
    assert down.content == b"%PDF minutes"

    # Owner got a meeting notification on creation.
    notes = await client.get("/api/v1/notifications", headers=owner_headers)
    assert any("Diwali planning" in n["text"] for n in notes.json())


# ---------- Search ----------


async def test_search_across_modules(client, owner_headers):
    resp = await client.get("/api/v1/search?q=lift", headers=owner_headers)
    assert resp.status_code == 200
    categories = {r["category"] for r in resp.json()}
    assert "Work Order" in categories and "Vendor" in categories


async def test_search_invoice_scoping(client, owner_headers, manager_headers):
    owner = await client.get("/api/v1/search?q=maintenance", headers=owner_headers)
    owner_invoices = [r for r in owner.json() if r["category"] == "Invoice"]
    assert all("Apt 502" in r["subtitle"] for r in owner_invoices)

    mgr = await client.get("/api/v1/search?q=maintenance", headers=manager_headers)
    mgr_invoices = [r for r in mgr.json() if r["category"] == "Invoice"]
    assert len(mgr_invoices) > len(owner_invoices)


# ---------- Reports & audit ----------


async def test_report_pdfs_manager_only(client, manager_headers, owner_headers):
    for path in ("/api/v1/reports/collection.pdf", "/api/v1/reports/expenses.pdf",
                 "/api/v1/reports/vendor-spend.pdf"):
        ok = await client.get(path, headers=manager_headers)
        assert ok.status_code == 200, path
        assert ok.content.startswith(b"%PDF")
        denied = await client.get(path, headers=owner_headers)
        assert denied.status_code == 403, path


async def test_audit_log_endpoint(client, manager_headers, owner_headers, auditor_headers):
    await client.post(
        "/api/v1/expenses",
        json={"category": "Water", "description": "Tanker", "amount": 800,
              "paidDate": "2026-07-04"},
        headers=manager_headers,
    )
    entries = await client.get("/api/v1/audit-log", headers=auditor_headers)
    assert entries.status_code == 200
    expenses_entry = next(entry for entry in entries.json() if entry["entity"] == "expenses")
    assert expenses_entry["userName"] == "Vishnu"

    denied = await client.get("/api/v1/audit-log", headers=owner_headers)
    assert denied.status_code == 403
