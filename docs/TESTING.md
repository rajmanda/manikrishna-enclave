# TESTING.md

Last updated: 2026-07-03

## Backend — pytest (28 tests, all passing)

```bash
cd backend && .venv/bin/python -m pytest
```

- Stack: pytest + pytest-asyncio (auto mode) + httpx `ASGITransport` +
  mongomock-motor (in-memory Mongo **for tests only** — runtime always uses
  Atlas, see docs/DECISIONS.md D-004).
- `tests/conftest.py` seeds Mani Krishna Enclave plus a second community
  ("Other Towers") and a super_admin; provides per-role auth-header fixtures
  via dev-login.
- Coverage by area:
  - `test_auth.py` — whitelist enforcement, dev login, /me, missing/garbage
    tokens, immediate revocation, google endpoint failure mode.
  - `test_rbac.py` — role gates on writes, auditor read-only, whitelist
    management, super_admin-only community creation, dashboard access +
    aggregate correctness.
  - `test_apartments.py` — tenant isolation, CRUD, duplicate rejection,
    audit-trail assertions.
  - `test_finance.py` — owner vs manager scoping, summary numbers, work-order
    visibility/isolation, vendors, seeded auditor.

## Frontend

- `npm run build` — type-checks (TS strict) and compiles all 17 routes; this
  is the current gate.
- No component/E2E tests yet.

## Conventions

- Every new endpoint ships with: a happy-path test, an RBAC-denial test, and
  a tenant-isolation test where applicable.
- Assert audit-log entries for new write endpoints.
- Test names describe behavior (`test_owner_sees_only_own_invoices`).

## Gaps → planned

| Gap | Plan |
|---|---|
| No CI running tests | M1: GitHub Actions on every PR/push |
| No frontend unit tests | M2: Vitest + React Testing Library for lib/ and critical components |
| No E2E browser tests | M2/M3: Playwright against a staging deploy (login → dashboard → invoice flow) |
| No coverage reporting | M1: pytest-cov threshold in CI |
