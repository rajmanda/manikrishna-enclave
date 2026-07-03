# ARCHITECTURE.md

Last updated: 2026-07-02

## System overview

```
Browser (mobile-first PWA-ready)
   │  HTTPS
   ▼
Next.js frontend ──────────────► FastAPI backend ────► MongoDB Atlas
(Cloud Run, planned)   /api/v1   (Cloud Run, planned)   (managed)
                                     │
                                     ├─► Google OAuth (ID token verify)
                                     ├─► GCS (documents/receipts — planned)
                                     └─► Secret Manager (planned)
```

Both services are containerized (Dockerfiles present) and designed for Cloud
Run behind community.rajmanda.com. Nothing is deployed yet.

## Frontend

- Next.js 15 App Router, TypeScript strict, TailwindCSS 3.4, Recharts,
  lucide-react.
- Route groups: `/` (login) and `(app)/*` (authenticated shell).
- `src/components/shell/AppShell.tsx` — responsive shell: bottom tab bar
  (<lg) + "More" sheet, sidebar (lg+), top bar with global search and
  notifications.
- Data layer: `src/lib/api.ts` (fetch wrapper, JWT bearer, typed errors) +
  `src/hooks/useApi.ts` (loading/error/reload state). No server-side data
  fetching yet — all pages are client components; acceptable for an
  authenticated dashboard, revisit if SEO/SSR ever matters.
- `src/context/AuthContext.tsx` — session restore via `/auth/me`, Google
  Identity Services button (when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set), dev
  quick-login (dev only).
- `src/lib/types.ts` is the wire contract — backend serializes camelCase to
  match it exactly.

## Backend

- FastAPI, async Motor driver, Pydantic v2 models (`app/models.py`) with
  `to_camel` alias generator: snake_case in Python/MongoDB, camelCase JSON.
- Layout: `app/main.py` (app + lifespan + CORS), `app/core/config.py`
  (pydantic-settings), `app/core/security.py` (OAuth verify, JWT,
  `require_roles`, `scoped_community_id`), `app/db.py` (connection +
  indexes + `get_db` DI), `app/audit.py`, `app/routers/*` (one per module),
  `app/seed.py` (idempotent seed).
- Multi-tenancy: every collection carries `community_id`; all queries are
  scoped server-side. Super admin may cross tenants explicitly.
- String business ids (`apt-101`, `wo-1`, uuid-suffixed for new records)
  rather than ObjectIds — stable across systems and URL-friendly.

## Cross-cutting decisions

See docs/DECISIONS.md. Highlights: whitelist-as-users-collection auth (D-002),
camelCase wire contract (D-003), Atlas for all environments (D-004),
client-side rendering for the app shell (D-005).

## Planned (not built)

- `infra/terraform/` — Cloud Run ×2, Artifact Registry, Secret Manager, GCS,
  IAM, domain mapping.
- `.github/workflows/` — lint → test → build → push → deploy per
  docs/DEPLOYMENT.md.
- GCS-backed uploads (work-order photos, receipts, documents) via signed URLs.
- Server-side PDF generation (statements, reports) in the backend.
