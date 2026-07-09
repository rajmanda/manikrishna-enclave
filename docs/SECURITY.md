# SECURITY.md

Last updated: 2026-07-03

## Authentication

- Google OAuth only. Frontend obtains a Google ID token (Google Identity
  Services); backend verifies signature/audience/expiry against
  `GOOGLE_CLIENT_ID` and requires `email_verified`.
- **Whitelist:** the `users` collection is the whitelist. Unknown emails →
  403. Emails normalized to lowercase; unique index prevents duplicates.
- App session: HS256 JWT (default 24 h) carrying user id/role/community.
  Every request re-loads the user from the database, so whitelist removal or
  role change takes effect on the next request.
- `POST /auth/dev-login` exists only when `DEV_MODE=true`; returns 404
  otherwise. Must be false in staging/production.

## Authorization (RBAC)

- Roles: super_admin, property_manager, community_admin, owner, tenant,
  vendor, auditor.
- Writes require property_manager/community_admin (super_admin implicit);
  `auditor` is read-only by construction (never in a write-role list).
- Tenant isolation: `scoped_community_id` pins every query to the caller's
  community; cross-tenant reads return 404 (existence not leaked). Covered by
  tests (`test_apartments.py`, `test_finance.py`).
- Data-level scoping: owners/tenants receive only their own apartment's
  invoices/payments.

## Audit

Every create/update/delete writes an `audit_log` entry (who, what, when,
details). Indexed by community + timestamp. Viewer UI planned (M4).
Notification queue enqueues are audit-logged (entity: `notification_queue`);
every outbound message is stored before delivery.

## OpenClaw (WhatsApp agent)

- **Machine-to-machine auth:** OpenClaw authenticates via `X-API-Key` header
  (shared secret, not JWT). The key is stored in Google Secret Manager
  (`OPENCLAW_API_KEY`) and injected as an env var on Cloud Run.
- **No inbound exposure:** the Mac mini running OpenClaw polls Cloud Run —
  it is never exposed to the public internet. All connections are outbound.
- **Store-before-send:** every notification is persisted in `notification_queue`
  before OpenClaw picks it up. No message can be sent without a stored record.
- **Atomic pickup:** pending notifications are atomically marked `processing`
  before being returned to prevent double-delivery on concurrent polls.
- **Retry with cap:** failed deliveries auto-requeue up to `max_retries` (3);
  after that the record stays `failed` for manual review.

## Secrets

- Local: `.env` files, gitignored. `.env.example` documents keys only.
- Production (M1): Google Secret Manager → Cloud Run env; GitHub Actions via
  Workload Identity Federation (no SA keys). No secrets in the repository.

## Transport & headers

- Cloud Run terminates TLS (HTTPS only in production).
- CORS allowlist from `CORS_ORIGINS` (localhost:3000 + community.rajmanda.com).

## Known gaps / accepted risks (tracked)

1. JWT in localStorage (XSS-exfiltratable) rather than httpOnly cookie —
   acceptable now (no third-party scripts, React escaping); revisit at M1
   with a cookie-based session if we add any script injection surface.
2. No rate limiting on auth endpoints — add at M1 (Cloud Armor or app-level).
3. No token refresh — 24 h expiry then re-login; fine for this audience.
4. Frontend Google button loads GIS from Google's CDN — expected.
5. No dependency/security scanning in CI yet — add at M1 (npm audit, pip-audit).
6. OpenClaw API key is a simple shared secret — acceptable for a single
   trusted agent; rotate via Secret Manager when needed.

## Reporting

Single-maintainer project; report issues to the owner (raj.manda@gmail.com).
