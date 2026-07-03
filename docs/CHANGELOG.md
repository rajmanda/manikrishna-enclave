# CHANGELOG.md

All notable changes. Format loosely follows Keep a Changelog; versions will
begin at 0.1.0 with the first deployment (M1).

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
