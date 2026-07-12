# DEPLOYMENT.md

Last updated: 2026-07-03 · **Status: LIVE (M1)** — GCP project
`mm-owners-5b8611` (shared with other apps), region `asia-south1`,
repo github.com/rajmanda/manikrishna-enclave (public).

## Topology (as deployed)

| Component | Where | Notes |
|---|---|---|
| Frontend | Cloud Run `communityhub-frontend` | Next.js standalone, port 8080 |
| Backend | Cloud Run `communityhub-backend` | uvicorn, port 8080, `/health` |
| Domain | community.rajmanda.com → **global HTTPS LB** (IP 34.120.210.248) | Domain mappings unsupported in asia-south1, so LB + managed cert + serverless NEGs |
| API routing | Same origin: LB routes `/api/*`, `/health(z)`, `/docs`, `/openapi.json` → API; everything else → frontend | `NEXT_PUBLIC_API_URL=https://community.rajmanda.com/api/v1` |
| Direct URLs | api: communityhub-backend-ht4p2vwsjq-el.a.run.app · frontend: communityhub-frontend-ht4p2vwsjq-el.a.run.app | Useful before DNS cutover |
| Database | MongoDB Atlas cluster0.sod5j | `DB_NAME=communityhub` |
| Images | Artifact Registry `asia-south1-docker.pkg.dev/mm-owners-5b8611/communityhub` | `api:<sha>`, `frontend:<sha>` |
| Secrets | Secret Manager (`communityhub-*` prefix — shared project) | mongodb-uri, jwt-secret, google-client-id |

## One-time manual steps

| Step | Status |
|---|---|
| DNS A record `community` → 34.120.210.248 at rajmanda.com's DNS | ⬜ owner — cert auto-provisions 15–60 min after |
| Atlas Network Access: allow 0.0.0.0/0 (Cloud Run egress IPs are dynamic) | ⬜ owner |
| Google OAuth web client (console → Credentials); authorized origin https://community.rajmanda.com; put ID in `communityhub-google-client-id` secret + GitHub repo variable `GOOGLE_CLIENT_ID`; redeploy | ⬜ owner |
| Terraform state bucket gs://mm-owners-5b8611-tfstate | ✅ created (bootstrap) |

## Environments

| Env | Trigger | DB_NAME | DEV_MODE |
|---|---|---|---|
| dev | local | communityhub_dev (split from prod 2026-07-11) | true |
| production | `gh workflow run deploy.yml` (manual for now) | communityhub | **false** |

Staging: deferred until needed; add a second set of Cloud Run services +
`communityhub_staging` DB when M2 write-features warrant it.

## GitHub Actions (`.github/workflows/`)

1. **ci.yml** — every push/PR: backend pytest (3.11) + frontend build/typecheck.
2. **deploy.yml** — manual dispatch: tests → docker build both images
   (frontend gets `NEXT_PUBLIC_*` build args, dev-login OFF) → push to
   Artifact Registry → `gcloud run deploy` both → health checks.
   Auth via Workload Identity Federation (`github-deployer@` SA, no keys).
   Rollback: redeploy previous Cloud Run revision (console or
   `gcloud run services update-traffic`).

Terraform runs locally for now (`infra/terraform`, state in GCS); move
plan/apply into Actions when infra changes become frequent.

## Local development

```bash
cd backend && cp .env.example .env   # set Atlas URI; SEED_ON_START=true first run
.venv/bin/uvicorn app.main:app --reload
cd frontend && npm run dev           # http://localhost:3000
```

docker-compose.yml exists but currently bundles a local mongo container —
scheduled for rework in M1 to point at Atlas instead (see PROJECT_STATE
known issue #5).

## Production checklist (enforced by config, verified each deploy)

- `DEV_MODE=false` (dev-login returns 404)
- `NEXT_PUBLIC_ENABLE_DEV_LOGIN=false`
- `SEED_ON_START=false` after first boot
- JWT_SECRET ≥32 bytes from Secret Manager
- CORS restricted to https://community.rajmanda.com
