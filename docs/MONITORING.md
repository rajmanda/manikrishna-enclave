# MONITORING.md

Last updated: 2026-07-03 · **Status: planned (implements with M1)**

## Current state

Local development only: uvicorn/Next console logs; startup logs DB
reachability; `/healthz` exposes status + environment. No metrics, alerting,
or tracing yet.

## Plan (M1, using GCP built-ins — no extra vendors)

| Layer | Tool | What |
|---|---|---|
| Logs | Cloud Logging (automatic on Cloud Run) | Structured JSON logs; correlate by request; keep 30d |
| Metrics | Cloud Monitoring | Request count/latency/5xx per service (built-in Cloud Run metrics) |
| Uptime | Cloud Monitoring uptime checks | `/healthz` (api) + `/` (frontend) every 5 min from 3 regions |
| Alerts | Alerting → email raj.manda@gmail.com | 5xx rate >2% (5 min), p95 latency >2s, uptime check fails, deploy failure (GitHub Actions notification) |
| DB | Atlas built-in monitoring + alerts | Connections, storage, slow queries |
| Errors | Cloud Error Reporting | Uncaught exceptions grouped |

## Backend logging conventions (to adopt in M1)

- `logging` JSON formatter in production; include request path, user id,
  community id (never tokens/PII beyond ids).
- Log every 403 (whitelist/RBAC denial) at INFO — these are signal, not noise.
- Audit log stays in MongoDB (it's product data, not telemetry).

## Later (M3+)

Basic product analytics (owner weekly actives, feature usage) — decide
tooling when needed; privacy-first, no third-party trackers on residents.
