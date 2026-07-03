# OPERATIONS.md

Last updated: 2026-07-03 · **Status: pre-deployment runbook (fills in at M1)**

## Runbook

| Task | How (current) | How (after M1) |
|---|---|---|
| Start backend | `cd backend && .venv/bin/uvicorn app.main:app --reload` | Cloud Run (auto) |
| Start frontend | `cd frontend && npm run dev` | Cloud Run (auto) |
| Health check | `GET /healthz` | Same, hit by deploy pipeline |
| Seed a fresh DB | `SEED_ON_START=true` once, or `python -m app.seed` | Same, against the env's DB_NAME |
| Whitelist a user | `POST /api/v1/users` as manager | Same (admin UI later) |
| Revoke access | `DELETE /api/v1/users/{id}` | Same — takes effect next request |
| Rotate JWT secret | edit `.env`, restart (logs everyone out) | Update Secret Manager version, redeploy |
| Deploy | n/a | push to main (staging) / tag (prod); rollback = previous Cloud Run revision |
| Inspect audit trail | query `audit_log` in Atlas | Same until the M4 viewer |

## Backups & recovery

MongoDB Atlas automated backups (cluster-level, managed by Raj). Before M2
(financial writes): verify backup schedule + do one test restore into a
scratch DB_NAME, document results here.

## Incident basics

- Auth failures for everyone → check GOOGLE_CLIENT_ID / JWT_SECRET config.
- 5xx from API → Cloud Run logs (`gcloud run services logs read
  communityhub-api`); DB reachability logs at startup ("MongoDB not
  reachable").
- Bad deploy → roll back to previous Cloud Run revision (one command /
  console click).

## Scheduled tasks

None yet. M2 introduces recurring invoice generation — decide then between
Cloud Scheduler → API endpoint vs in-app scheduler (record in DECISIONS.md).
