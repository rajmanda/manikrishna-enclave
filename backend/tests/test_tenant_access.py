"""Tenant lite experience: maintenance + messages only — no money data.

Owners keep the transparency reads (expenses, reserve fund, summary);
tenants are blocked from every finance surface, server-side.
"""

import pytest

from tests.conftest import login


@pytest.fixture
async def tenant_headers(client, manager_headers):
    resp = await client.post(
        "/api/v1/users",
        json={
            "name": "Ravi Tenant",
            "email": "tenant502@gmail.com",
            "role": "tenant",
            "apartmentId": "apt-502",
        },
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    return await login(client, "tenant502@gmail.com")


BLOCKED_READS = [
    "/api/v1/invoices",
    "/api/v1/payments",
    "/api/v1/expenses",
    "/api/v1/reserve-fund",
    "/api/v1/reserve-fund/reconciliation",
    "/api/v1/finance/monthly",
    "/api/v1/finance/summary",
    "/api/v1/cost-cases",
    "/api/v1/work-orders",
    "/api/v1/dashboard/owner",
    "/api/v1/statements/apt-502.pdf",
    "/api/v1/statements/consolidated.pdf",
    "/api/v1/invoices/export.csv",
]


@pytest.mark.parametrize("path", BLOCKED_READS)
async def test_tenant_blocked_from_money_reads(client, tenant_headers, path):
    resp = await client.get(path, headers=tenant_headers)
    assert resp.status_code == 403, f"{path} -> {resp.status_code}"


async def test_owner_still_sees_transparency_reads(client, owner_headers):
    for path in ("/api/v1/expenses", "/api/v1/reserve-fund", "/api/v1/finance/summary",
                 "/api/v1/work-orders"):
        resp = await client.get(path, headers=owner_headers)
        assert resp.status_code == 200, f"{path} -> {resp.status_code}"


async def test_tenant_can_create_and_track_maintenance(client, tenant_headers):
    created = await client.post(
        "/api/v1/maintenance-requests",
        json={"title": "Balcony door jammed", "description": "", "visibility": "private"},
        headers=tenant_headers,
    )
    assert created.status_code == 201, created.text

    listed = await client.get("/api/v1/maintenance-requests", headers=tenant_headers)
    assert listed.status_code == 200
    assert any(r["title"] == "Balcony door jammed" for r in listed.json())


async def test_tenant_search_hides_money_results(client, tenant_headers, owner_headers):
    # "watchman" matches a seeded expense; owners see it, tenants must not.
    owner = await client.get("/api/v1/search?q=watchman", headers=owner_headers)
    assert any(r["category"] == "Expense" for r in owner.json())

    tenant = await client.get("/api/v1/search?q=watchman", headers=tenant_headers)
    assert all(
        r["category"] not in ("Expense", "Invoice", "Work Order")
        for r in tenant.json()
    )


async def test_tenant_cannot_comment_on_work_orders(client, tenant_headers):
    resp = await client.post(
        "/api/v1/work-orders/wo-1/comments",
        json={"text": "when will this be fixed?"},
        headers=tenant_headers,
    )
    assert resp.status_code == 403
