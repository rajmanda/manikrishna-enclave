# ENVIRONMENT.md

Last updated: 2026-07-07

## Backend (`backend/.env`, from `.env.example`)

| Variable | Default | Notes |
|---|---|---|
| ENVIRONMENT | dev | dev / staging / production |
| MONGODB_URI | — | **Atlas connection string (required)** — one cluster for all envs |
| DB_NAME | communityhub_dev | `communityhub_staging` / `communityhub` per env |
| GOOGLE_CLIENT_ID | "" | OAuth web client ID; required for /auth/google |
| JWT_SECRET | dev default | ≥32 bytes; Secret Manager in staging/prod |
| JWT_EXPIRES_MINUTES | 1440 | |
| DEV_MODE | true | Enables /auth/dev-login. **false outside local dev** |
| SEED_ON_START | false | true once per fresh database, then off |
| CORS_ORIGINS | localhost:3000, community.rajmanda.com | comma-separated |

## Frontend (`frontend/.env.local`, from `.env.example`)

| Variable | Default | Notes |
|---|---|---|
| NEXT_PUBLIC_API_URL | /api/v1 | Backend base URL. Relative in dev: the Next dev server proxies /api/v1/* to localhost:8000 (rewrite in next.config.ts), so phones on an ngrok tunnel work without CORS. Prod builds bake the full LB URL. |
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | "" | Renders the Google button when set (same client ID as backend) |
| NEXT_PUBLIC_ENABLE_DEV_LOGIN | true | **false in staging/prod** — hides quick-login & account switcher |

NEXT_PUBLIC_* values are baked in at build time — per-environment builds.

## Toolchain

- Node ≥20 (dev machine: 25.x), npm 11
- Python 3.11 venv at `backend/.venv`
- No Docker required locally (Atlas is remote); Dockerfiles are for Cloud Run

## Secrets policy

`.env*` files are gitignored. Real values live only in local .env files and
(from M1) Google Secret Manager. Never commit or log them.
