# API.md

Last updated: 2026-07-03 · Base path: `/api/v1` · OpenAPI: `/docs` on the backend

All responses are camelCase JSON matching `frontend/src/lib/types.ts`.
Authentication: `Authorization: Bearer <JWT>` (issued by the auth endpoints).
Errors: `{"detail": "<message>"}` with conventional status codes
(401 unauthenticated, 403 forbidden/not whitelisted, 404 not found or
cross-tenant, 409 conflict).

## Auth

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/google` | public | Body `{idToken}`. Verifies Google ID token, 403 if email not whitelisted. Returns `{accessToken, tokenType, user}` |
| POST | `/auth/dev-login` | DEV_MODE only | Body `{email}`. Impersonate a seeded user. 404 in production |
| GET | `/auth/me` | any authenticated | Current user; re-checks whitelist (403 if revoked) |

## Communities

| Method | Path | Access |
|---|---|---|
| POST | `/communities` | super_admin |
| GET | `/communities` | any (own community; super_admin sees all) |
| GET | `/communities/{id}` | own community or super_admin |

## Apartments

| Method | Path | Access |
|---|---|---|
| GET | `/apartments` | any member |
| POST | `/apartments` | manager/admin — 409 on duplicate number |
| GET | `/apartments/{id}` | any member (404 cross-tenant) |
| PATCH | `/apartments/{id}` | manager/admin |
| DELETE | `/apartments/{id}` | manager/admin |

## Users (whitelist management)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/users` | any member | Community-scoped |
| POST | `/users` | manager/admin | Whitelists an email (normalized lowercase); 409 if exists |
| PATCH | `/users/{id}` | manager/admin | name/role/apartmentId/phone |
| DELETE | `/users/{id}` | manager/admin | Revokes access immediately; cannot delete self |

## Dashboards

| Method | Path | Access | Returns |
|---|---|---|---|
| GET | `/dashboard/owner` | owner/tenant with apartment | outstandingBalance, openWorkOrders, monthExpenses, reserveFundBalance |
| GET | `/dashboard/manager` | manager/admin/auditor | outstandingCollections, paymentsReceived, monthExpenses, reserveFundBalance, openWorkOrders, pendingApprovals, overdueInvoices |

## Finance (read-only in Phase 1)

| Method | Path | Access | Scoping |
|---|---|---|---|
| GET | `/invoices` | any member | owners/tenants: own apartment only |
| GET | `/payments` | any member | owners/tenants: own apartment only |
| GET | `/expenses` | any member | community-wide (transparency) |
| GET | `/reserve-fund` | any member | community-wide |
| GET | `/finance/monthly` | any member | income/expenses/collectionRate series |
| GET | `/finance/summary` | any member | HOA-page summary (monthIncome, monthExpenses, outstandingDues, reserveFundBalance) |

## Work orders & vendors (read-only in Phase 1)

| Method | Path | Access |
|---|---|---|
| GET | `/work-orders` | any member |
| GET | `/work-orders/{id}` | any member (404 cross-tenant) |
| GET | `/vendors` | any member |

## Health

| Method | Path | Access |
|---|---|---|
| GET | `/healthz` | public (no `/api/v1` prefix) |

## Planned (Phase 2+)

Write APIs for invoices/payments/expenses (bulk invoice generation, recurring
charges, statements PDF/CSV), work-order mutations + comments, vendor CRUD,
maintenance requests, feed, polls, documents (GCS signed URLs), meetings,
notifications, global search endpoint, audit-log listing.

**Policy:** update this file in the same change as any API modification.
Breaking changes require owner approval (BOOTSTRAP constitution #10).
