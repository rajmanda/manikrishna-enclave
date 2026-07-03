# DATABASE.md

Last updated: 2026-07-03 · MongoDB Atlas · Schema v1

One Atlas cluster serves all environments; environments are separated by
database name (`communityhub_dev`, `communityhub` for prod — see
docs/ENVIRONMENT.md). Documents use string business ids in an `id` field
(Mongo `_id` is left as the auto ObjectId and unused by the app). Field names
are snake_case in the database; the API serializes to camelCase.

Every tenant-owned document carries `community_id`. All queries must be
scoped by it (see `scoped_community_id` in `backend/app/core/security.py`).

## Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `communities` | Tenants | id, name, address, apartment_count |
| `users` | Members **and the login whitelist** | id, community_id, name, email (unique), role, apartment_id?, phone? |
| `apartments` | Units | id, community_id, number (unique per community), floor, owner_ids[] |
| `invoices` | Charges per apartment | id, community_id, apartment_id, period, description, amount, paid_amount, due_date, status (paid/due/overdue/partial) |
| `payments` | Receipts | id, community_id, invoice_id, apartment_id, amount, date, method, reference |
| `expenses` | Community spend | id, community_id, category, description, vendor_id?, amount, paid_date, has_receipt |
| `work_orders` | Common-area jobs | id, community_id, title, description, priority, stage, vendor_id?, assigned_to?, estimate?, final_cost?, reported_date, photo_count, timeline[], comments[] |
| `vendors` | Service providers | id, community_id, name, service, phone, gst?, amc_expiry?, rating, active_contracts |
| `reserve_fund` | Monthly fund entries | community_id, month, contributions, expenses, balance |
| `monthly_finance` | Income/expense series | community_id, month, income, expenses, collection_rate |
| `audit_log` | Every modification | id, community_id, user_id, user_name, action, entity, entity_id, timestamp (ISO), details |

Planned (Phase 3/4): `maintenance_requests`, `feed_posts`, `polls`,
`documents`, `meetings`, `notifications` — Pydantic shapes already exist in
`frontend/src/lib/types.ts`; add matching backend models when implemented.

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

None yet. Before Phase 2 write-APIs land, adopt a lightweight versioned
migration convention (e.g. `backend/app/migrations/NNN_*.py` applied at
startup, version stored in a `meta` collection). Track schema version here.

**Policy:** update this file in the same change as any schema modification.
