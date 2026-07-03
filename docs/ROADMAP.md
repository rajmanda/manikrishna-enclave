# ROADMAP.md

Last updated: 2026-07-03. Milestones proposed 2026-07-03 — pending owner
approval (see PROJECT_STATE.md).

## Done

- **M0 — Phase 1 application (2026-07-02):** mobile-first frontend (17
  routes), FastAPI backend (auth/whitelist/RBAC/tenant isolation/audit/
  dashboards + read APIs), frontend↔backend wiring, 28 tests, Dockerfiles.

## Proposed milestones

### M1 — Foundation & first deploy
Git repo + GitHub, CI (lint/test/build), Terraform (Artifact Registry, Cloud
Run ×2, Secret Manager, GCS, IAM, domain mapping), deploy to
community.rajmanda.com, real Google OAuth client, Atlas e2e, real owner
emails, kill dev-mode paths in prod config.

### M2 — Financial module (PRD Phase 2)
Write APIs + UI: invoice CRUD, bulk/recurring generation, payment recording,
credits & late fees, statements (server-side PDF) and CSV export, expense
CRUD with receipt upload (GCS), reserve fund entries. Migrations convention.

### M3 — Operations module (PRD Phase 3)
Work-order lifecycle mutations (stage transitions, comments, photo upload),
maintenance requests, vendor CRUD + ratings, community feed backend.
In-app notifications on status changes.

### M4 — Governance module (PRD Phase 4)
Polls/voting backend, documents with versioning (GCS), meeting minutes,
reports (PDF), email notifications, global search endpoint, audit-log viewer.

### M5 — Intelligence & mobile (PRD Phase 5)
Claude-powered meeting summaries & expense forecasts, invoice/receipt OCR,
WhatsApp integration, React Native app, push notifications.

## Milestone detail

| | Goal | Key deliverables | Effort | Depends on | Main risks |
|---|---|---|---|---|---|
| M1 | Production pipeline | git+CI+Terraform+deployed app+real OAuth | 2–3 sessions | GCP project access, Atlas URI, GitHub repo | GCP IAM/domain-mapping friction; OAuth consent setup |
| M2 | Money flows digitally | invoice/payment/expense writes, PDFs, GCS receipts | 3–4 sessions | M1 (deploy target), migrations | PDF layout scope creep; correctness of balances |
| M3 | Ops without WhatsApp | WO mutations, maintenance, vendors, feed | 3–4 sessions | M2 patterns (uploads, migrations) | media upload UX on mobile |
| M4 | Governance & records | polls, documents, minutes, reports, email | 3–4 sessions | M3 | email deliverability; search relevance |
| M5 | AI & mobile | AI features, RN app, WhatsApp | open-ended | M1–M4 APIs | external API dependencies |

**Recommended next: M1** — everything else compounds on a deployable,
version-controlled foundation, and it's the Constitution's baseline
(IaC, CI/CD, no manual infra).
