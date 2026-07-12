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
| POST | `/auth/switch-role` | dual-role users | Switches the ACTIVE role server-side (RBAC + scoping follow); owner view requires an assigned apartment |

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
| PATCH | `/users/{id}` | manager/admin | name/email (re-keys whitelist)/role/roles/apartmentId/accountId ("" unlinks)/phone |
| DELETE | `/users/{id}` | manager/admin | Revokes access immediately; cannot delete self |

## Accounts

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/accounts` | manager/admin/auditor | Billing entities with their apartment_ids — powers per-client filtering |
| POST/PATCH/DELETE | `/accounts[/{id}]` | **super_admin** | Ownership restructuring; one billing account per apartment enforced (409); delete blocked while portal users linked |
| GET | `/accounts/legal-owners` | manager/admin/auditor | Title holders per apartment |
| POST/PATCH/DELETE | `/accounts/legal-owners[/{id}]` | **super_admin** | Legal title holder CRUD (name, ownership %) |

## Dashboards

| Method | Path | Access | Returns |
|---|---|---|---|
| GET | `/dashboard/owner` | owner/tenant with apartment | outstandingBalance, openWorkOrders, monthExpenses, reserveFundBalance |
| GET | `/dashboard/badges` | any authenticated | Live nav-badge counts: openInvoices (role-scoped), pendingPaymentConfirmations |
| GET | `/dashboard/manager` | manager/admin/auditor | outstandingCollections, paymentsReceived, monthExpenses, reserveFundBalance, openWorkOrders, pendingApprovals, overdueInvoices |

## Finance (read-only in Phase 1)

| Method | Path | Access | Scoping |
|---|---|---|---|
| GET | `/invoices` | any member | owners/tenants: own apartment only |
| GET | `/payments` | any member | owners/tenants: own apartment only |
| GET | `/expenses` | any member | community-wide (transparency) |
| GET | `/reserve-fund` | any member | community-wide |
| GET | `/finance/monthly` | any member | Computed from real payments/expenses/invoices, last 6 months (confirmed payments only) |
| GET | `/finance/summary` | any member | Computed for the current calendar month from real records |

## Work orders & vendors (read-only in Phase 1)

| Method | Path | Access |
|---|---|---|
| GET | `/work-orders` | any member |
| GET | `/work-orders/{id}` | any member (404 cross-tenant) |
| GET | `/vendors` | any member |

## Finance writes (M2)

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/invoices` | manager/admin | Single invoice for an apartment |
| POST | `/invoices/generate` | manager/admin | One per apartment for a period (all, or only `apartmentIds` when provided); idempotent; amount defaults to `community.monthlyMaintenance` |
| POST | `/invoices/bill-owner` | manager/admin | Itemized reimbursement invoice for one apartment (`ledger=reimbursement`, lineItems auto-summed, owner notified) |
| POST | `/invoices/apply-late-fees` | manager/admin | Late-fee invoice per overdue invoice of the period (idempotent, linked via `parentInvoiceId`); returns `apartmentIds` of the charged apartments so receipts can be scoped to them |
| POST | `/invoices/{id}/receipt` | manager/admin | Multipart paper receipt (photo/PDF) → saved as a `Receipts` document scoped to the invoice's apartment (`apartmentIds`, `invoiceId`) |
| PATCH | `/invoices/{id}` | manager/admin | description/amount/dueDate; status recomputed |
| DELETE | `/invoices/{id}` | manager/admin | 409 if payments exist; `?cascade=true` deletes the payments too (both audited) |
| POST | `/payments` | manager/admin | Records payment (or `method: "Credit"` for waivers); recomputes invoice paid/status; rejects overpayment |
| DELETE | `/payments/{id}` | manager/admin | Reversal; recomputes invoice |
| POST | `/payments/report` | owner/tenant (own apartment) | Claims an offline payment → **pending** (not counted); notifies managers; one open report per invoice |
| POST | `/payments/{id}/confirm` | manager/admin | Pending → confirmed; recomputes invoice; notifies reporter |
| POST | `/payments/{id}/reject` | manager/admin | Removes pending claim; notifies reporter |
| POST/PATCH/DELETE | `/expenses[/{id}]` | manager/admin | Expense CRUD |
| POST | `/expenses/{id}/receipt` | manager/admin | Multipart upload → GCS (pdf/jpeg/png/webp, ≤10 MB) |
| GET | `/expenses/{id}/receipt` | any member | Streams the receipt (community-transparent) |
| POST | `/reserve-fund` | manager/admin | Monthly entry; balance auto-computed; 409 on duplicate month |
| GET | `/statements/{apartmentId}.pdf` | own apartment (owners) / any (managers) | Server-side PDF statement |
| GET | `/invoices/export.csv` | any (role-scoped rows) | CSV export |

## Operations (M3)

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/work-orders` | manager/admin | Creates at Reported with initial timeline; notifies members |
| PATCH | `/work-orders/{id}` | manager/admin | title/desc/priority/vendor/assignee/costs |
| POST | `/work-orders/{id}/stage` | manager/admin | Appends timeline event, optional finalCost; **notifies all members (PRD)** |
| POST | `/work-orders/{id}/comments` | any member (not auditor/vendor) | Owner comments |
| POST | `/work-orders/{id}/photos` | manager/admin | Multipart → GCS; GET `/photos/{index}` streams (any member) |
| GET/POST | `/maintenance-requests` | members | Private requests visible only to creator + managers; creation notifies managers |
| PATCH | `/maintenance-requests/{id}/status` | manager/admin | Notifies the creator |
| POST/PATCH/DELETE | `/vendors[/{id}]` | manager/admin | Delete blocked while vendor has open work orders (409) |
| GET/POST | `/feed` | members | List: pinned first; posts return reaction counts + `myReaction`; announcements notify members |
| POST | `/feed/{id}/comments` · `/feed/{id}/react` | members | react kind: like/heart/thanks/none (toggle) |
| POST | `/feed/{id}/pin` | manager/admin | Toggle |
| DELETE | `/feed/{id}` | author or manager/admin | |
| GET | `/notifications` | own | Latest 50 |
| POST | `/notifications/read-all` · `/notifications/{id}/read` | own | |

## Manager service fees (private ledger)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET/PUT | `/manager-fees/enrollments` | manager/admin | Per-apartment amount + active flag (untick when tenant moves out) |
| POST | `/manager-fees/generate` | manager/admin | One `ledger=manager_fee` invoice per active enrollment at its own amount; idempotent per period |

Fee invoices/payments flow through the normal report→confirm path but are
excluded from every community aggregate (summary, monthly, collection %,
collection report, directory dues). Owner sees only their own; statement PDF
shows a separate fee section; manager dashboard gets a separate fee tile.

## Governance (M4)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET/POST | `/polls` | create: manager/admin | List includes counts, `myVote`, auto-close by date; creation notifies members |
| POST | `/polls/{id}/vote` | members with an apartment | **One vote per apartment** (revotable while open); 409 when closed |
| POST | `/polls/{id}/close` · DELETE `/polls/{id}` | manager/admin | |
| GET/POST | `/documents` | upload: manager/admin | Multipart + title/category (+ optional comma-separated `apartment_ids` scope, `invoice_id` link); versioned on GCS. List is visibility-filtered: owners/tenants only see community-wide docs plus ones scoped to their apartments |
| POST | `/documents/{id}/file` | manager/admin | New version (bumps `version`) |
| GET | `/documents/{id}/file` | any member (visibility-scoped) | Streams latest version; 404 for legacy metadata-only entries or docs scoped to another apartment |
| DELETE | `/documents/{id}` | manager/admin | |
| GET/POST/PATCH/DELETE | `/meetings[/{id}]` | write: manager/admin | Creation notifies members |
| POST/GET | `/meetings/{id}/minutes` | upload: manager/admin; read: members | Minutes PDF on GCS |
| GET | `/search?q=` | any member | Cross-module substring search (RBAC-scoped invoices), max 15 results |
| GET | `/reports/collection.pdf` · `/reports/expenses.pdf` · `/reports/vendor-spend.pdf` | manager/admin/auditor | fpdf2 |
| GET | `/audit-log?limit=` | manager/admin/auditor | Newest first, max 500 |

## Notification Queue (M5)

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/notification-queue` | manager/admin | Manually enqueue a notification (WhatsApp/email/in-app) |
| GET | `/notification-queue` | manager/admin | List entries; query params: `status`, `channel`, `event_type`, `limit` |
| POST | `/notification-queue/{id}/retry` | manager/admin | Reset failed/cancelled → pending (409 if not retryable) |
| POST | `/notification-queue/{id}/cancel` | manager/admin | Cancel pending/failed → cancelled (409 if already sent/cancelled) |

Notifications are automatically enqueued by triggers on: invoice creation,
payment confirmation, expense creation, work order creation/stage changes,
and announcements. All enqueues are audit-logged.

## OpenClaw (WhatsApp agent)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/openclaw/notifications/pending` | `X-API-Key` header | Fetch pending notifications (default: WhatsApp); atomically marks as `processing`; query params: `channel`, `limit` (max 50) |
| POST | `/openclaw/notifications/{id}/sent` | `X-API-Key` header | Mark as sent; body: `{sentAt?}` |
| POST | `/openclaw/notifications/{id}/failed` | `X-API-Key` header | Mark as failed; body: `{errorMessage}`; auto-requeues if retries remain |

OpenClaw is a local agent (Mac mini) that polls these endpoints. The API key
is stored in Google Secret Manager (`OPENCLAW_API_KEY`). The Mac mini is never
exposed to the public internet — it initiates all connections outbound to
Cloud Run.

## Health

| Method | Path | Access |
|---|---|---|
| GET | `/health` (alias `/healthz`) | public (no `/api/v1` prefix) — use `/health` on *.run.app; GFE intercepts `/healthz` there |

## Planned (Phase 2+)

Write APIs for invoices/payments/expenses (bulk invoice generation, recurring
charges, statements PDF/CSV), work-order mutations + comments, vendor CRUD,
maintenance requests, feed, polls, documents (GCS signed URLs), meetings,
notifications, global search endpoint, audit-log listing.

**Policy:** update this file in the same change as any API modification.
Breaking changes require owner approval (BOOTSTRAP constitution #10).
