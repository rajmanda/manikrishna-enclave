# DEPLOYMENT.md

Last updated: 2026-07-03 · **Status: designed, not yet implemented (M1)**

Nothing is deployed. This documents the target pipeline; update as M1 lands.

## Topology

| Component | Where | Notes |
|---|---|---|
| Frontend | Cloud Run `communityhub-frontend` | Next.js standalone image, port 8080 |
| Backend | Cloud Run `communityhub-api` | uvicorn, port 8080, `/healthz` |
| Domain | community.rajmanda.com → frontend | Cloud Run domain mapping (Terraform) |
| API routing | `NEXT_PUBLIC_API_URL` → backend service URL (later: path-based via LB if needed) |
| Database | MongoDB Atlas (existing cluster) | `DB_NAME` separates envs |
| Images | Artifact Registry | tagged with git SHA |
| Secrets | Secret Manager → Cloud Run env | MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID |

## Environments

| Env | Trigger | DB_NAME | DEV_MODE |
|---|---|---|---|
| dev | local | communityhub_dev | true |
| staging | push to main | communityhub_staging | **false** |
| production | manual promotion / tag | communityhub | **false** |

## GitHub Actions (planned `.github/workflows/`)

1. **ci.yml** (PRs + main): frontend `npm ci && npm run build` (includes
   typecheck) + lint; backend `pytest`.
2. **deploy.yml** (main → staging; tag → prod): build both Docker images →
   push to Artifact Registry → `terraform plan/apply` (infra) → deploy Cloud
   Run revisions → hit `/healthz` and `/` → auto-rollback to previous
   revision on failure.

Auth to GCP via Workload Identity Federation (no service-account keys in
GitHub). No secrets in the repository, ever.

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
