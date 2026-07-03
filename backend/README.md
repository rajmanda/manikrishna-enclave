# CommunityHub — Backend (FastAPI)

Phase 1 API: Google OAuth with email whitelisting, JWT sessions, role-based
access control, multi-tenant data isolation, audit logging, and dashboard
aggregates. API-first per the PRD — the same endpoints will serve the future
mobile app.

**Stack:** FastAPI · Motor (MongoDB Atlas) · Pydantic v2 · google-auth · PyJWT

## Run locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env          # then start MongoDB (or use docker-compose at repo root)
.venv/bin/uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- With `SEED_ON_START=true`, Mani Krishna Enclave is seeded on first boot
  (idempotent). Or run `python -m app.seed`.
- With `DEV_MODE=true`, `POST /api/v1/auth/dev-login {"email": ...}` issues a
  token for any seeded user — e.g. `vishnu@communityhub.app` — without Google
  OAuth. Disabled outside dev.

Tests:

```bash
.venv/bin/python -m pytest
```

## API surface (Phase 1)

| Endpoint | Access | Notes |
|---|---|---|
| `POST /api/v1/auth/google` | public | Verifies Google ID token, rejects non-whitelisted emails (403) |
| `POST /api/v1/auth/dev-login` | dev only | Impersonate a seeded user |
| `GET /api/v1/auth/me` | any role | Current session user |
| `GET/POST /api/v1/communities`, `GET .../{id}` | create: super_admin | Community list scoped to own tenant |
| `GET/POST/PATCH/DELETE /api/v1/apartments` | write: manager/admin | Duplicate numbers rejected; audit-logged |
| `GET/POST/PATCH/DELETE /api/v1/users` | write: manager/admin | POST = whitelist an email; DELETE = revoke access immediately |
| `GET /api/v1/dashboard/owner` | owner | Outstanding balance, open work orders, expenses, reserve fund |
| `GET /api/v1/dashboard/manager` | manager/auditor | Collections, payments, approvals, overdue counts |
| `GET /healthz` | public | Liveness for Cloud Run |

Conventions:

- **camelCase JSON** on the wire, matching `frontend/src/lib/types.ts` 1:1
  (snake_case internally and in MongoDB).
- **Multi-tenant:** every document carries `community_id`; non-super-admin
  requests are always scoped to their own community.
- **RBAC:** `auditor` is read-only; write endpoints require
  property_manager / community_admin / super_admin.
- **Audit log:** every create/update/delete lands in the `audit_log`
  collection with user, action, entity, and timestamp.

## Auth flow

1. Frontend gets a Google ID token (Google Identity Services) and posts it to
   `/auth/google`.
2. Backend verifies the token against `GOOGLE_CLIENT_ID`, then looks up the
   email in `users` — that collection **is** the whitelist.
3. On success the client receives an app JWT (`JWT_EXPIRES_MINUTES`). Every
   request re-loads the user, so removing someone from the whitelist revokes
   access immediately.

## Docker / Cloud Run

```bash
docker build -t communityhub-api .
docker run -p 8080:8080 --env-file .env communityhub-api
```

Secrets (`MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`) come from Google
Secret Manager in staging/production; `DEV_MODE` must be `false` there.

## Next phases

Phase 2 adds invoice/payment/expense/reserve-fund write APIs and server-side
PDF statements; Phase 3 work-order and vendor mutations; Phase 4 documents
(GCS signed URLs), polls, and notifications. The MongoDB schema for all of
these already exists in `app/models.py` and the seed data.
