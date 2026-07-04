# CHANGELOG.md

All notable changes. Format loosely follows Keep a Changelog; versions will
begin at 0.1.0 with the first deployment (M1).

## [0.3.0] — 2026-07-04 · M3 Operations module

- Work orders: create (notifies members), update, stage transitions with
  timeline events + optional final cost (notifies members per PRD), owner
  comments, photo upload to GCS + streaming fetch.
- Maintenance requests: full backend (private/community visibility rules),
  creation notifies managers, status changes notify the creator.
- Vendors: CRUD with open-work-order delete guard.
- Community feed backend: posts, per-user reactions with toggle, comments,
  pin/unpin, author-or-manager delete; announcements notify members.
- In-app notifications: per-user collection, list/read/read-all endpoints;
  live bell in the shell with unread badge and mark-all-read.
- Migration 002 backfills feed/maintenance seed data into pre-M3 databases.
- Frontend: feed/maintenance/work-orders/vendors pages fully wired (dialogs,
  comment forms, stage updates, photo upload/display); seed data now used
  only by polls/documents/meetings/search (M4).
- Tests 40 → 54.

## [0.2.0] — 2026-07-04 · M2 Financial module

- Invoice writes: create, bulk generation per period (idempotent, defaults to
  community.monthlyMaintenance), late fees (linked via parentInvoiceId),
  update with status recompute, delete (blocked if payments exist).
- Payments: record (UPI/bank/cash/cheque/Credit-waiver) with automatic
  invoice status recomputation and overpayment rejection; reversal endpoint.
- Expenses: CRUD + receipt upload/download via private GCS bucket
  (proxied, pdf/jpeg/png/webp ≤10 MB); receipts community-readable.
- Reserve fund: monthly entry endpoint with auto-computed balance.
- Statements: server-side PDF per apartment (fpdf2) + invoices CSV export,
  both RBAC-scoped.
- Migrations convention (app/migrations.py, meta.version); migration 001.
- Frontend: Generate/Record-payment/Late-fee dialogs, expense add/delete +
  receipt attach/view, reserve entry form, working Statement PDF and CSV
  downloads.
- Terraform: private versioned GCS media bucket + API service access.
- Tests 28 → 40.

## [0.1.0] — 2026-07-03 · M1 Foundation

- Git repository initialized and pushed to github.com/rajmanda/manikrishna-enclave.
- GitHub Actions: ci.yml (backend pytest + frontend build, green) and
  deploy.yml (WIF auth, docker build/push to Artifact Registry, Cloud Run
  deploy, health checks; manual dispatch).
- Terraform (`infra/terraform`, state in GCS): Cloud Run ×2, Artifact
  Registry, Secret Manager (communityhub-* — project is shared), runtime +
  deployer service accounts, GitHub OIDC Workload Identity Federation,
  global HTTPS load balancer for community.rajmanda.com with same-origin
  /api/* routing (domain mappings unsupported in asia-south1). 33 resources.
- First production deploy to Cloud Run (asia-south1).
- Atlas e2e verified locally (login, dashboards, scoping, whitelist 403).
- docker-compose reworked: Atlas-only (local mongo container removed);
  frontend Dockerfile accepts NEXT_PUBLIC_* build args.
- Docs: DEPLOYMENT/TERRAFORM rewritten as-built; ADRs D-008..D-010.

## [Unreleased]

### 2026-07-03
- Documentation bootstrap per BOOTSTRAP.md: CLAUDE.md, PROJECT_STATE.md,
  README.md, and the full docs/ set (19 files).

### 2026-07-02 — Frontend↔API integration
- Frontend: real auth session (AuthContext, localStorage JWT, session restore
  via /auth/me, logout); login page with Google Identity Services button
  (when configured) + dev quick-login; dev account switcher in shell.
- Frontend: dashboard, community, work orders (list/detail), invoices,
  payments, vendors, reserve fund, reports chart now fetch from the API with
  loading/error/retry states. Removed simulated RoleContext.
- Backend: read endpoints — /invoices, /payments (owner-scoped), /expenses,
  /reserve-fund, /finance/monthly, /finance/summary, /work-orders(+/{id}),
  /vendors. Payment gained community_id; Vendor/MonthlyFinance models added.
- Seed: payments, vendor gst/amc/active_contracts, monthly finance, seeded
  auditor account.
- Tests: 18 → 28.

### 2026-07-02 — Backend Phase 1
- FastAPI + Motor backend: Google OAuth verification with users-collection
  whitelist, JWT sessions, RBAC dependencies, tenant isolation, audit log,
  CRUD for communities/apartments/users, owner & manager dashboards,
  idempotent Mani Krishna Enclave seed, Cloud Run Dockerfile,
  docker-compose.yml, 18 pytest tests.

### 2026-07-02 — Frontend Phase 1
- Next.js 15 + TypeScript + Tailwind mobile-first app, 17 routes covering all
  PRD modules (dashboards, HOA page, work orders, maintenance, feed, polls,
  invoices, payments, meetings, documents, vendors, reserve fund, reports,
  global search), responsive shell (bottom tabs / sidebar), Recharts charts,
  seed data, Cloud Run Dockerfile.
