# PROJECT_STATE.md

Last updated: 2026-07-03

| Field | Value |
|---|---|
| Current version | 0.3.0 |
| Current milestone | **M3 Operations — complete**; next: M4 Governance (polls, documents, minutes, reports, email) |
| Current sprint | M3 complete |
| Current branch | main (github.com/rajmanda/manikrishna-enclave, public) |
| Last completed feature | M3: work-order lifecycle, maintenance requests, vendor CRUD, feed, notifications |
| Current feature | — |
| Next priority | M4 Governance module |
| Deployment status | **Live at https://community.rajmanda.com** (Cloud Run, asia-south1) |
| Database version | Schema v2 (migrations 001-002); Atlas `cluster0.sod5j`, DB `manikrishna_enclave` |
| Infrastructure version | Terraform applied — 35 resources (incl. GCS media bucket), state in gs://mm-owners-5b8611-tfstate |
| Last deployment | 2026-07-03 via deploy.yml (manual dispatch) |

## Live URLs

- Frontend: https://communityhub-frontend-ht4p2vwsjq-el.a.run.app
- API: https://communityhub-backend-ht4p2vwsjq-el.a.run.app (`/health`, `/docs`)
- https://community.rajmanda.com — live (LB 34.120.210.248, cert ACTIVE)

## Owner action items (blockers for M1 close-out)

1. ~~DNS~~ ✅ done 2026-07-04 — cert ACTIVE, https://community.rajmanda.com live.
2. ~~Atlas Network Access~~ ✅ already allowed (cluster shared with other Cloud
   Run apps); verified via clean API startup logs.
3. ~~Google OAuth client~~ ✅ done 2026-07-04 — client ID in Secret Manager
   (v2), GitHub variable, and local envs; Google sign-in live.
4. **Recommended:** rotate the Atlas password (it was shared in a chat
   session) and update the `communityhub-mongodb-uri` secret + local .env.
5. Replace placeholder owner emails with real Google accounts
   (`PATCH /api/v1/users/{id}`).

## Completed so far

- Phase 1 app: mobile-first frontend (17 routes) + FastAPI backend (OAuth
  whitelist, RBAC, tenant isolation, audit log, dashboards, read APIs),
  frontend↔API integration, 28 tests. Atlas e2e verified locally.
- M1: git repo + GitHub (public), CI (backend tests + frontend build, green),
  Terraform (Cloud Run ×2, Artifact Registry, communityhub-* secrets, WIF,
  global HTTPS LB with same-origin /api/* routing), deploy workflow via WIF,
  first production deploy with health checks, full docs/ set.

## Still on seed data (frontend)

Polls, documents, meetings, global search (backends land M4).

## Known issues

1. Dev and prod currently share DB `manikrishna_enclave` — consider a
   separate dev DB name after M1 close-out.
2. Atlas invoice `inv-2606-502` shows ₹5,500 vs seed's ₹3,500 — DB predates/
   was edited outside the seed; treat Atlas as source of truth.
3. No staging environment yet (deliberate — add when M2 warrants).
4. Terraform runs locally, not in CI (deliberate for now).
5. No rate limiting on /auth/*; JWT in localStorage (D-006) — M2 window.
6. In-app notifications static; no pagination on list endpoints.

## Open decisions

- Payment gateway for M2 (or record-only first).
- Staging topology when needed.
