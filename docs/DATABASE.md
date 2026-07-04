# DATABASE.md

Last updated: 2026-07-03 · MongoDB Atlas · Schema v1

The app uses a dedicated Atlas M0 cluster `hyderabad`
(hyderabad.n5kr48f.mongodb.net, AWS Mumbai ap-south-1 — co-located with Cloud
Run; see D-020). Dev and prod share it, DB `manikrishna_enclave`. The app
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
| `invoices` | Charges per apartment | id, community_id, apartment_id, period, description, amount, paid_amount, due_date, status (paid/due/overdue/partial), parent_invoice_id (late fees) |
| `payments` | Receipts | id, community_id, invoice_id, apartment_id, amount, date, method (incl. "Credit"), reference, status (pending/confirmed — owner-reported start pending), reported_by? |
| `expenses` | Community spend | id, community_id, category, description, vendor_id?, amount, paid_date, has_receipt, receipt_path (GCS) |
| `work_orders` | Common-area jobs | id, community_id, title, description, priority, stage, vendor_id?, assigned_to?, estimate?, final_cost?, reported_date, photo_count, timeline[], comments[] |
| `vendors` | Service providers | id, community_id, name, service, phone, gst?, amc_expiry?, rating, active_contracts |
| `reserve_fund` | Monthly fund entries | community_id, month, contributions, expenses, balance |
| ~~`monthly_finance`~~ | Deprecated — the monthly series is computed from payments/expenses/invoices since 0.4.x | (unused) |
| `audit_log` | Every modification | id, community_id, user_id, user_name, action, entity, entity_id, timestamp (ISO), details |

M3 additions: `maintenance_requests` (id, community_id, title, description,
visibility private/community, status, created_by, created_date), `feed_posts`
(id, community_id, author_id, type, text, date, pinned, reactions_by
{user_id→kind}, comments[], attachment_count), `notifications` (id,
community_id, user_id, text, date ISO, read, type). `work_orders` gained
`photos[]` (GCS paths).

M4 additions: `polls` (id, community_id, question, description, open/close
dates, status, option_labels[], votes_by {apartment_id→label} — one vote per
apartment), `documents` (id, community_id, title, category, uploaded_date,
version, size_kb, file_type, path GCS|null, uploaded_by), `meetings` (id,
community_id, title, date, attendance, agenda[], resolutions[], has_pdf,
minutes_path). All PRD collections now exist.

## Indexes (`app/db.py::ensure_indexes`, created at startup)

- `users.email` unique
- `users.community_id`
- `apartments (community_id, number)` unique
- `invoices (community_id, apartment_id)`
- `expenses.community_id`
- `work_orders.community_id`
- `audit_log (community_id, timestamp desc)`

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

Schema version: **4**.

**Policy:** update this file in the same change as any schema modification.
