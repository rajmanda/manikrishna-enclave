# PRODUCTION_READINESS.md

Last updated: 2026-07-03. Gate: all ❌ below resolved before real residents
use community.rajmanda.com. Re-review at the end of each milestone.

## Checklist

### Must-have before go-live (M1 exit criteria)

- [ ] Git repository + GitHub, protected `main`
- [ ] CI running backend tests + frontend build on every change
- [ ] Terraform-provisioned infra (no manual resources)
- [ ] Deployed to Cloud Run staging + production, domain mapped + TLS
- [ ] Google OAuth client configured; login verified with a real Google account
- [ ] `DEV_MODE=false`, `NEXT_PUBLIC_ENABLE_DEV_LOGIN=false`, `SEED_ON_START=false` in prod
- [ ] Secrets in Secret Manager only; JWT_SECRET rotated from dev value
- [ ] Real owner emails whitelisted (replace ownerNNN@example.com)
- [ ] E2E smoke against Atlas prod DB (login → dashboard → invoices)
- [ ] Atlas backup schedule verified + one test restore documented
- [ ] Uptime checks + 5xx/latency alerts wired to owner email
- [ ] docker-compose.yml reworked (Atlas, not local mongo) or removed
- [ ] CORS locked to production origin

### Should-have (M2 window)

- [ ] Rate limiting on /auth/*
- [ ] Dependency scanning in CI (npm audit, pip-audit)
- [ ] Migrations convention before first schema change
- [ ] Pagination strategy for list endpoints
- [ ] Frontend error boundary + graceful API-down page
- [ ] Revisit JWT-in-localStorage (D-006)

### Current risk register

| Risk | Severity | Mitigation |
|---|---|---|
| No version control — a bad edit is unrecoverable | **High** | M1 first task: git init + push |
| Financial data with no backup verification | High | Atlas backup check before M2 writes |
| Dev-login shipped enabled by default | Medium | Config-gated; prod checklist enforces off; CI check planned |
| Single Atlas cluster shared across envs | Medium | Strict DB_NAME discipline; consider separate prod cluster later |
| Solo maintainer | Medium | This documentation set is the mitigation |
