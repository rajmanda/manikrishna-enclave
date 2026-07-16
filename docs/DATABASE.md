# DATABASE.md

Last updated: 2026-07-03 · MongoDB Atlas · Schema v1

The app uses a dedicated Atlas M0 cluster `hyderabad`
(hyderabad.n5kr48f.mongodb.net, AWS Mumbai ap-south-1 — co-located with Cloud
Run; see D-020). Prod uses DB `communityhub`, local dev uses `communityhub_dev` (ported from `manikrishna_enclave` 2026-07-11; old DB retained as fallback). The app
connects as the least-privilege `rajmanda` user (readWriteAnyDatabase);
credentials live in Secret Manager (`communityhub-atlas-mumbai-*`). The
original `cluster0.sod5j` holds a frozen pre-migration copy (2026-07-04). Documents use string business ids in an `id` field
(Mongo `_id` is left as the auto ObjectId and unused by the app). Field names
are snake_case in the database; the API serializes to camelCase.

Every tenant-owned document carries `community_id`. All queries must be
scoped by it (see `scoped_community_id` in `backend/app/core/security.py`).

## Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `communities` | Tenants | id, name, address, apartment_count, monthly_maintenance |
| `users` | Members **and the login whitelist** | id, community_id, name, email (unique), role (active), roles[] (switchable set), apartment_id?, phone? |
| `apartments` | Units | id, community_id, number (unique per community), floor, owner_ids[] |
| `invoices` | Charges per apartment | id, community_id, apartment_id, period, description, amount, paid_amount, due_date, status, parent_invoice_id (late fees), ledger (community \| manager_fee \| reimbursement), line_items[] |
| `payments` | Receipts | id, community_id, invoice_id, apartment_id, amount, date, method (incl. "Credit"), reference, status (pending/confirmed — owner-reported start pending), reported_by? |
| `expenses` | Community spend | id, community_id, category, description, vendor_id?, amount, paid_date, has_receipt, receipt_path (GCS) |
| `work_orders` | Common-area jobs | id, community_id, title, description, priority, stage, vendor_id?, assigned_to?, estimate?, final_cost?, reported_date, photo_count, timeline[], comments[] |
| `vendors` | Service providers | id, community_id, name, service, phone, gst?, amc_expiry?, rating, active_contracts |
| `reserve_fund` | Monthly fund entries | community_id, month, contributions, expenses, balance |
| ~~`monthly_finance`~~ | Deprecated — the monthly series is computed from payments/expenses/invoices since 0.4.x | (unused) |
| `accounts` | Billing/portal entity owning 1..n apartments (Raj's model) | id, community_id, name (unique per community), apartment_ids[] |
| `legal_owners` | Legal title holders per apartment | id, community_id, apartment_id, name, ownership_percentage |
| `fee_enrollments` | Manager-fee config | community_id, apartment_id, amount, active |
| `audit_log` | Every modification | id, community_id, user_id, user_name, action, entity, entity_id, timestamp (ISO), details |

M3 additions: `maintenance_requests` (id, community_id, title, description,
visibility private/community, status, created_by, created_date), `feed_posts`
(id, community_id, author_id, type, text, date, pinned, reactions_by
{user_id→kind}, comments[], attachment_count), `notifications` (id,
community_id, user_id, text, date ISO, read, type). `work_orders` gained
`photos[]` (GCS paths).

Cost cases (2026-07-13, migration 007): `cost_cases` collection (one financial event; children link via cost_case_id on work_orders/expenses/invoices); `expenses.status` draft|posted — only posted counts in reserve/totals.

Money-chain links (2026-07-12): `work_orders.maintenance_request_id`, `expenses.work_order_id`, `invoices.work_order_id` — a job's request, spend, and cost-recovery invoices reference each other.

Adoption tracking (2026-07-12): `users.last_login` (ISO, None = never) and
`users.login_count` are stamped on every login for all memberships of the
email; they power the super-admin Platform Insights dashboard.

M4 additions: `polls` (id, community_id, question, description, open/close
dates, status, option_labels[], votes_by {apartment_id→label} — one vote per
apartment), `documents` (id, community_id, title, category, uploaded_date,
version, size_kb, file_type, path GCS|null, uploaded_by, apartment_ids
None/[]=community-wide else visible only to those apartments' owners,
invoice_id set on invoice receipts), `meetings` (id,
community_id, title, date, attendance, agenda[], resolutions[], has_pdf,
minutes_path). All PRD collections now exist.

M5 additions: `notification_queue` — outbound notification queue for
WhatsApp/email/in-app delivery via OpenClaw agent.

| Field | Type | Notes |
|---|---|---|
| notification_id | string (unique) | `ntf-<hex>` |
| community_id | string | Tenant key |
| recipient_type | string | owner / tenant / manager |
| recipient_account_id | string? | Billing account |
| recipient_user_id | string? | Portal user |
| recipient_name | string | Display name |
| recipient_phone | string? | WhatsApp number |
| channel | string | `whatsapp` \| `email` \| `in_app` |
| event_type | string | `invoice_created` \| `payment_reminder` \| `payment_received` \| `common_expense_created` \| `work_order_created` \| `work_order_status_updated` \| `owner_approval_required` \| `announcement_posted` \| `direct_message` |
| title | string | Short title |
| message | string | Full message body |
| payload | dict | Event-specific structured data |
| status | string | `pending` \| `processing` \| `sent` \| `failed` \| `cancelled` |
| provider | string? | e.g. `openclaw`, `sendgrid` |
| retry_count | int | Current retry attempt |
| max_retries | int | Default 3 |
| scheduled_at | ISO? | Deferred delivery |
| sent_at | ISO? | Delivery timestamp |
| failed_at | ISO? | Last failure timestamp |
| error_message | string? | Last error |
| created_at | ISO | Record creation |
| updated_at | ISO | Last modification |

`messages` — direct messages, one thread per resident with the property
manager(s): id (`msg-<hex>`), community_id, thread_user_id (the resident's
user id — the thread key), sender_id, sender_name, sender_role, text, date
(ISO datetime), read (marked when the counterparty fetches the thread).

## Indexes (`app/db.py::ensure_indexes`, created at startup)

- `users.email` unique
- `users.community_id`
- `apartments (community_id, number)` unique
- `invoices (community_id, apartment_id)`
- `expenses.community_id`
- `work_orders.community_id`
- `audit_log (community_id, timestamp desc)`
- `notification_queue (status, channel, scheduled_at)` — polling
- `notification_queue (community_id, created_at desc)` — listing
- `notification_queue.notification_id` unique

## Work order stages

`Reported → Estimate Received → Owner Approval → In Progress → Inspection →
Completed → Closed` (embedded `timeline[]` records stage/date/note).

## Seed

`backend/app/seed.py` — idempotent (skips if community `mke` exists). Run via
`python -m app.seed` or `SEED_ON_START=true`. Contains Mani Krishna Enclave:
10 apartments/owners, Vishnu (property_manager), an auditor, June-2026
invoices/payments/expenses, 8 vendors, 5 work orders, reserve fund and
monthly finance history. Owner emails are placeholders — replace with real
Google emails via `PATCH /users/{id}`.

## Migrations

`backend/app/migrations.py` — append-only (version, coroutine) list applied at
startup; current version in `meta` ({"id": "schema", "version": N}).

| # | Migration |
|---|---|
| 001 | `communities.monthly_maintenance` default 3500 |
| 002 | Backfill M3 collections (feed, maintenance) into pre-M3 databases |
| 003 | Backfill M4 collections (polls, documents, meetings) |
| 004 | `users.roles` backfilled to `[role]` |
| 005 | `invoices/payments.ledger` backfilled to `community` |
| 006 | Apartment number baked into invoice descriptions |

Schema version: **6**. `notification_queue` is a new collection (no migration
needed — it starts empty and indexes are created at startup).

**Policy:** update this file in the same change as any schema modification.
