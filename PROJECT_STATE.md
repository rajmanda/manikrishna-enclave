# PROJECT_STATE.md

Last updated: 2026-07-02

| Field | Value |
|---|---|
| Current version | 0.1.0 (pre-release) |
| Current milestone | M0 complete (Phase 1 app) → next: M1 Foundation (git, CI/CD, Terraform) |
| Current sprint | Documentation bootstrap |
| Current branch | n/a — **git not initialized yet** |
| Last completed feature | Frontend wired to backend API (auth session, live data on 8 screens) |
| Current feature | Documentation bootstrap per BOOTSTRAP.md |
| Next priority | Awaiting owner approval of roadmap (proposed: M1 Foundation) |
| Deployment status | Not deployed — local only |
| Database version | Schema v1 (13 collections, seed idempotent); no migrations framework |
| Infrastructure version | None — Terraform not written |
| Last deployment | Never |

## Completed so far

- **Frontend (17 routes):** login, role-aware dashboards, community/HOA page,
  work orders (list + 7-stage detail), maintenance, feed, polls, invoices,
  payments, meetings, documents, vendors, reserve fund, reports, global
  search. Mobile-first, production build clean.
- **Backend (Phase 1 + read APIs):** Google OAuth + whitelist + JWT, RBAC,
  tenant isolation, audit log, CRUD for communities/apartments/users,
  dashboards, read endpoints for invoices/payments/expenses/reserve fund/
  monthly finance/work orders/vendors. 28 pytest tests passing.
- **Integration:** frontend authenticates against backend; dashboard,
  community, work orders, invoices, payments, vendors, reserve fund and
  reports fetch live data with owner-scoping enforced server-side.
- Dockerfiles for both services (Cloud Run-ready), root docker-compose.yml.

## Still on seed data (frontend `src/lib/data.ts`)

Feed, polls, maintenance requests, documents, meetings, notifications,
global search — their backend modules are Phase 3/4.

## Known issues

1. Not a git repository; no CI/CD, no Terraform, never deployed.
2. E2E against Atlas not yet run — `backend/.env` needs the owner's Atlas URI.
3. Google OAuth client ID not yet created (dev-login used meanwhile).
4. Seed owner emails are placeholders (`ownerNNN@example.com`).
5. docker-compose.yml contains a local mongo service that contradicts the
   Atlas-only decision (docs/DECISIONS.md D-004) — to be removed/reworked.
6. In-app "notifications" are static seed data; no email/push delivery.
7. No pagination on list endpoints (fine at 10 apartments; revisit for scale).

## Open decisions

- Staging strategy: same Atlas cluster with `communityhub_staging` DB vs
  separate cluster.
- Payment gateway choice for Phase 2 online payments (or record-only at first).
- Monorepo GitHub repo name and visibility.
