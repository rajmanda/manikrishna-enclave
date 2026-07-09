# CLAUDE.md — CommunityHub

Multi-tenant SaaS for apartment communities. Seed customer: Mani Krishna
Enclave (10 apartments, property manager Vishnu). Target:
community.rajmanda.com on Google Cloud Run.

## Session protocol

At the start of every session read, in order:
1. This file
2. PROJECT_STATE.md
3. docs/ROADMAP.md
4. docs/CHANGELOG.md
5. docs/DECISIONS.md

Follow the Project Constitution in BOOTSTRAP.md. Documentation is part of the
Definition of Done — update PROJECT_STATE.md, docs/CHANGELOG.md, and any
affected docs/ file with every meaningful change.

## Architecture (current)

- `frontend/` — Next.js 15 (App Router) + TypeScript + Tailwind 3.4 + Recharts.
  Mobile-first: bottom tab bar on phones, sidebar on `lg+`. Client-side data
  fetching via `src/hooks/useApi.ts` → `src/lib/api.ts`; session JWT in
  localStorage via `src/context/AuthContext.tsx`.
- `backend/` — FastAPI + Motor (MongoDB Atlas), Pydantic v2. Routers in
  `app/routers/`, RBAC in `app/core/security.py`, audit trail in
  `app/audit.py`, idempotent seed in `app/seed.py`. Serves camelCase JSON
  matching `frontend/src/lib/types.ts` 1:1 (snake_case internally).
  Outbound notification queue (`app/notification_service.py`) stores
  WhatsApp/email/in-app messages in `notification_queue` collection;
  OpenClaw agent (Mac mini) polls pending entries via API-key-secured
  endpoints (`app/routers/openclaw.py`).
- `infra/terraform/`, `.github/workflows/` — **not built yet**.

## Hard rules

- **Deploy workflow (owner rule):** test every change locally first (pytest,
  build, and exercise the flow against Atlas where possible). Present the
  result and **wait for Raj's explicit confirmation before committing or
  pushing** — pushes trigger CI/deploy builds. Batch doc-only changes with
  the next confirmed push.

- **Multi-tenant:** every document carries `community_id`; non-super-admin
  queries are always scoped server-side. Never hardcode Mani Krishna Enclave
  outside `backend/app/seed.py` / `frontend/src/lib/data.ts`.
- **Whitelist auth:** the `users` collection IS the whitelist. Unknown Google
  accounts must get 403.
- **RBAC:** `auditor` is read-only everywhere. Writes require
  property_manager / community_admin / super_admin via `require_roles`.
- **Audit:** every create/update/delete calls `record_audit`.
- **MongoDB Atlas only** — the owner uses one Atlas cluster for dev and prod
  (separate `DB_NAME`s). Never introduce local/mock MongoDB at runtime
  (mongomock-motor inside pytest is fine).
- **API-first:** new business logic goes in the backend under `/api/v1`,
  designed to serve a future mobile app.
- `DEV_MODE` / dev-login and `NEXT_PUBLIC_ENABLE_DEV_LOGIN` must be OFF in
  staging/production.

## Commands

```bash
# backend (Python 3.11 venv at backend/.venv)
cd backend && .venv/bin/python -m pytest            # 28 tests
.venv/bin/uvicorn app.main:app --reload             # needs .env with Atlas URI

# frontend
cd frontend && npm run dev                          # http://localhost:3000
npm run build                                       # production build + typecheck
```

## Key docs

docs/ARCHITECTURE.md · docs/API.md · docs/DATABASE.md · docs/SECURITY.md ·
docs/ROADMAP.md · docs/DEPLOYMENT.md · docs/AI_AGENT_GUIDE.md
