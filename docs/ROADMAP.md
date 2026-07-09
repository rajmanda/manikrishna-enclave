# ROADMAP.md

Last updated: 2026-07-03. M1 approved and executed 2026-07-03.

## Done

- **M0 — Phase 1 application (2026-07-02):** mobile-first frontend (17
  routes), FastAPI backend (auth/whitelist/RBAC/tenant isolation/audit/
  dashboards + read APIs), frontend↔backend wiring, 28 tests, Dockerfiles.
- **M1 — Foundation & first deploy (2026-07-03):** git + GitHub (public),
  CI green, Terraform-provisioned infra (Cloud Run ×2, Artifact Registry,
  secrets, WIF, HTTPS LB for community.rajmanda.com), first Cloud Run
  deploy, Atlas e2e. **Remaining owner steps:** DNS A record, Atlas network
  access for Cloud Run, Google OAuth client (see PROJECT_STATE.md).

- **M2 — Financial module (2026-07-04):** invoice/payment/expense write
  APIs (bulk generation, late fees, credits, reversals), GCS receipts, PDF
  statements + CSV, reserve-fund entries, migrations convention, manager UI.
  Deferred to later: online payment gateway (open decision), scheduled
  auto-generation (Cloud Scheduler — endpoint is ready and idempotent).

- **M3 — Operations module (2026-07-04):** work-order lifecycle (create,
  stage transitions with member notifications, comments, GCS photos),
  maintenance requests with visibility rules, vendor CRUD, community feed
  (reactions/comments/pins), in-app notifications with live bell.

- **M4 — Governance module (2026-07-04):** polls (one vote per apartment),
  versioned documents on GCS, meeting minutes with PDF upload, report PDFs,
  global search endpoint, audit-log viewer. Frontend now 100% API-driven
  (seed data file deleted). **Deferred:** email/push notification delivery —
  blocked on provider choice (owner decision).

## Upcoming milestones

### M5 — Notification system (PRD Phase 5a)
Queue-based outbound notifications (WhatsApp via OpenClaw, email, in-app).
`notification_queue` collection, management APIs, OpenClaw polling endpoints
(API-key secured), auto-triggers for invoices/payments/expenses/work orders/
announcements. Store-before-send design; no auto-dispatch until audit
logging is validated. **In progress on `feature/whatsapp-notifications`.**

### M6 — Intelligence & mobile (PRD Phase 5b)
Claude-powered meeting summaries & expense forecasts, invoice/receipt OCR,
React Native app, push notifications.

## Milestone detail

| | Goal | Key deliverables | Effort | Depends on | Main risks |
|---|---|---|---|---|---|
| M1 | Production pipeline | git+CI+Terraform+deployed app+real OAuth | 2–3 sessions | GCP project access, Atlas URI, GitHub repo | GCP IAM/domain-mapping friction; OAuth consent setup |
| M4 | Governance & records | polls, documents, minutes, reports, email | 3–4 sessions | M3 | email deliverability; search relevance |
| M5 | Notification queue | notification_queue collection, OpenClaw integration, triggers | 1 session | M4 APIs | OpenClaw reliability; WhatsApp API limits |
| M6 | AI & mobile | AI features, RN app, WhatsApp | open-ended | M1–M5 APIs | external API dependencies |

**Recommended next: M1** — everything else compounds on a deployable,
version-controlled foundation, and it's the Constitution's baseline
(IaC, CI/CD, no manual infra).
