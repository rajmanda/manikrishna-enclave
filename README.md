# CommunityHub

Multi-tenant community management SaaS for apartment associations — invoices,
work orders, documents, polls and a community feed in one mobile-first app.
Seed customer: **Mani Krishna Enclave**. Target: community.rajmanda.com.

| | |
|---|---|
| Frontend | Next.js 15 · TypeScript · Tailwind — [frontend/](frontend/) |
| Backend | FastAPI · MongoDB Atlas — [backend/](backend/) |
| Infra | Terraform → Cloud Run (asia-south1), GitHub Actions CI/CD — [infra/terraform/](infra/terraform/) |
| Status | v0.1.0 deployed to Cloud Run — see [PROJECT_STATE.md](PROJECT_STATE.md) |

## Start here

1. [BOOTSTRAP.md](BOOTSTRAP.md) — project constitution
2. [CLAUDE.md](CLAUDE.md) — session protocol & hard rules
3. [PROJECT_STATE.md](PROJECT_STATE.md) — where things stand
4. [docs/](docs/) — architecture, API, database, roadmap, security, and more

## Quick start (local)

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env          # set your MongoDB Atlas URI; SEED_ON_START=true first run
.venv/bin/uvicorn app.main:app --reload

cd frontend && npm install && npm run dev    # http://localhost:3000
```

Sign in with a dev quick-login account (e.g. Vishnu, property manager).

Tests: `cd backend && .venv/bin/python -m pytest` (28 passing).
