"""Invoice receipts: paper receipts uploaded as documents with
apartment-scoped visibility."""

import pytest

from app import storage
from tests.conftest import login


@pytest.fixture
async def owner101_headers(client):
    return await login(client, "owner101@example.com")


@pytest.fixture
def blobs(monkeypatch):
    store: dict[str, tuple[bytes, str]] = {}
    monkeypatch.setattr(storage, "upload_object", lambda p, d, c: store.__setitem__(p, (d, c)))
    monkeypatch.setattr(storage, "download_object", lambda p: store[p])
    return store


async def test_attach_receipt_scoped_to_invoice_apartment(
    client, manager_headers, owner_headers, owner101_headers, blobs
):
    up = await client.post(
        "/api/v1/invoices/inv-2606-502/receipt",
        files={"file": ("receipt.jpg", b"jpegdata", "image/jpeg")},
        headers=manager_headers,
    )
    assert up.status_code == 201, up.text
    doc = up.json()
    assert doc["category"] == "Receipts"
    assert doc["apartmentIds"] == ["apt-502"]
    assert doc["invoiceId"] == "inv-2606-502"
    assert "Monthly Maintenance" in doc["title"]

    # The apartment's owner sees and downloads it; another owner does not.
    listing_502 = await client.get("/api/v1/documents", headers=owner_headers)
    assert any(d["id"] == doc["id"] for d in listing_502.json())
    listing_101 = await client.get("/api/v1/documents", headers=owner101_headers)
    assert not any(d["id"] == doc["id"] for d in listing_101.json())

    down = await client.get(f"/api/v1/documents/{doc['id']}/file", headers=owner_headers)
    assert down.status_code == 200 and down.content == b"jpegdata"
    denied = await client.get(
        f"/api/v1/documents/{doc['id']}/file", headers=owner101_headers
    )
    assert denied.status_code == 404

    # Managers see everything.
    listing_mgr = await client.get("/api/v1/documents", headers=manager_headers)
    assert any(d["id"] == doc["id"] for d in listing_mgr.json())


async def test_owner_cannot_attach_receipt(client, owner_headers, blobs):
    resp = await client.post(
        "/api/v1/invoices/inv-2606-502/receipt",
        files={"file": ("receipt.jpg", b"x", "image/jpeg")},
        headers=owner_headers,
    )
    assert resp.status_code == 403


async def test_receipt_requires_existing_invoice(client, manager_headers, blobs):
    resp = await client.post(
        "/api/v1/invoices/inv-nope/receipt",
        files={"file": ("receipt.jpg", b"x", "image/jpeg")},
        headers=manager_headers,
    )
    assert resp.status_code == 404


async def test_scoped_document_upload_and_community_visibility(
    client, manager_headers, owner_headers, owner101_headers, blobs
):
    # Scoped to two apartments via the documents endpoint.
    scoped = await client.post(
        "/api/v1/documents",
        files={"file": ("bill.pdf", b"%PDF", "application/pdf")},
        data={
            "title": "Water bill split",
            "category": "Receipts",
            "apartment_ids": "apt-101, apt-201",
        },
        headers=manager_headers,
    )
    assert scoped.status_code == 201
    assert scoped.json()["apartmentIds"] == ["apt-101", "apt-201"]
    sid = scoped.json()["id"]

    # Unscoped upload stays community-wide.
    community = await client.post(
        "/api/v1/documents",
        files={"file": ("agm.pdf", b"%PDF", "application/pdf")},
        data={"title": "AGM notice", "category": "Other"},
        headers=manager_headers,
    )
    assert community.json()["apartmentIds"] is None
    cid = community.json()["id"]

    ids_101 = {d["id"] for d in (await client.get("/api/v1/documents", headers=owner101_headers)).json()}
    ids_502 = {d["id"] for d in (await client.get("/api/v1/documents", headers=owner_headers)).json()}
    assert sid in ids_101 and cid in ids_101
    assert sid not in ids_502 and cid in ids_502
