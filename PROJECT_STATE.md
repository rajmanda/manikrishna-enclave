# PROJECT_STATE.md

Last updated: 2026-07-12

| Field | Value |
|---|---|
| Current version | 0.12.0 |
| Current milestone | **M4 Governance — complete. PRD Phases 1–4 fully shipped.** Next: M5 (AI, mobile) or hardening |
| Current sprint | Launch readiness (real owner emails, notifications decision) |
| Current branch | feature/community-switching (off main post-PR#3) |
| Last completed feature | Design-system + UI overhaul (tokens, primitives, Framer Motion, `/home` landing, grouped nav, page transitions — see `UX_REVIEW.md`) + per-deployment branding ("Manikrishna Enclave") |
| Current feature | Money-chain integrity (bore well fix): Jun anchor amended +2,700 (prod+dev, audited), /reserve-fund/reconciliation endpoint + Reserve page warnings (unanchored activity, collections without expense), closed-month notes in payment/expense dialogs, chain links MR→WO→expense/invoices with WO Money panel + prefilled creation flows (155 tests) — awaiting confirmation before push. Merged (PR #7): Expense-entry UX fix (manager complaint): dedicated /expenses page + Money-nav entry, Dashboard quick-actions row with dialog deep-links, receipt picker inside Add Expense dialog, form polish. Previously merged (PR #6): Platform Insights — super-admin CEO dashboard at `/insights` (adoption funnel, daily engagement from audit trail, module usage, financial pulse, per-community health, whitelist-adoption chase list; `GET /insights/platform` + `users.last_login`/`login_count` stamping, 149 tests). Also merged in PR #6 — Invoice receipts: upload/photograph paper receipts from all four invoice dialogs and the invoice sheet (past invoices); saved to Documents with apartment-scoped visibility (`POST /invoices/{id}/receipt`, `documents.apartment_ids`/`invoice_id`, visibility-filtered list/download), 4 new tests (145 total). Previous: Setup Assistant (guided 3-step community onboarding, /setup + setup router, household naming) + community switching (super admin acts inside any owned community) + multi-community memberships (same email across communities: per-community whitelist uniqueness, switch-membership endpoint, AppShell community dropdown). Previous: multi-community portfolio console (super-admin): `GET /communities/portfolio/stats` + `/portfolio` page, 4 new tests (112 total). Presentation page rebuilt as role-based decks (6 audiences) with persistent CTAs, WhatsApp-alerts slide, privacy slide, Early Access badges on portfolio claims |
| Next priority | Owner onboarding: collect real owner emails and whitelist them; then notifications provider decision |
| Deployment status | **Live at https://community.rajmanda.com** (Cloud Run, asia-south1) |
| Database version | Schema v6 (migrations 001-006); Atlas `hyderabad.n5kr48f` (AWS Mumbai), DB `communityhub` (prod, live since 2026-07-12 IST) / `communityhub_dev` (local); legacy `manikrishna_enclave` in ~1-week bake before drop |
| Infrastructure version | Terraform applied — 35 resources (incl. GCS media bucket), state in gs://mm-owners-5b8611-tfstate |
| Last deployment | 2026-07-06 via deploy.yml (manual dispatch) |

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

## Seed data status

None — `frontend/src/lib/data.ts` deleted in M4; every screen is API-driven.

## Known issues

1. ~~Dev and prod share DB~~ ✅ 2026-07-11: data ported to generic DBs and
   **prod cutover completed 2026-07-12 07:59 IST** (terraform apply; backend
   revision 00041 serving `communityhub`, health 200, OpenClaw poller
   confirmed live; jobs backup/cleanup updated too). Local dev on
   `communityhub_dev`. Old `manikrishna_enclave` DB retained read-only for a
   ~1-week bake (check its audit_log stays frozen), then dump + drop.
   Pre-cutover JSON backup: backend/pre_cutover_manikrishna_enclave_2026-07-11.json.
2. Atlas invoice `inv-2606-502` shows ₹5,500 vs seed's ₹3,500 — DB predates/
   was edited outside the seed; treat Atlas as source of truth.
3. No staging environment yet (deliberate — add when M2 warrants).
4. Terraform runs locally, not in CI (deliberate for now).
5. No rate limiting on /auth/*; JWT in localStorage (D-006) — M2 window.
6. In-app notifications static; no pagination on list endpoints.

## Open decisions

- Payment gateway for M2 (or record-only first).
- Staging topology when needed.
