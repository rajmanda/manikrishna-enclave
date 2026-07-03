# PROJECT_STATE.md

Last updated: 2026-07-03

| Field | Value |
|---|---|
| Current version | 0.1.0 |
| Current milestone | **M1 Foundation — deployed**; next: M1 close-out (owner DNS/OAuth steps) → M2 Financial module |
| Current sprint | M1 |
| Current branch | main (github.com/rajmanda/manikrishna-enclave, public) |
| Last completed feature | First cloud deployment: Terraform infra + GitHub Actions deploy to Cloud Run |
| Current feature | — |
| Next priority | Owner manual steps below, then M2 (invoice/payment/expense write APIs) |
| Deployment status | **Live on Cloud Run** (asia-south1); custom domain pending DNS |
| Database version | Schema v1; Atlas `cluster0.sod5j`, DB `manikrishna_enclave` (seeded) |
| Infrastructure version | Terraform applied — 33 resources, state in gs://mm-owners-5b8611-tfstate |
| Last deployment | 2026-07-03 via deploy.yml (manual dispatch) |

## Live URLs

- Frontend: https://communityhub-frontend-ht4p2vwsjq-el.a.run.app
- API: https://communityhub-api-ht4p2vwsjq-el.a.run.app (`/healthz`, `/docs`)
- community.rajmanda.com → LB IP 34.120.210.248 (awaiting DNS record)

## Owner action items (blockers for M1 close-out)

1. **DNS:** A record `community` → `34.120.210.248` at rajmanda.com's DNS
   host (managed TLS cert provisions itself 15–60 min after).
2. **Atlas Network Access:** allow `0.0.0.0/0` so Cloud Run can connect
   (its egress IPs are dynamic). Until then the deployed API can't reach the DB.
3. **Google OAuth client:** create a Web client in GCP Console → Credentials
   (authorized origin `https://community.rajmanda.com`), then
   `gcloud secrets versions add communityhub-google-client-id --data-file=-`
   with the client ID, set GitHub repo variable `GOOGLE_CLIENT_ID` to the
   same value, and re-run Deploy.
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

Feed, polls, maintenance, documents, meetings, notifications, global search
(backends land M3/M4).

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
