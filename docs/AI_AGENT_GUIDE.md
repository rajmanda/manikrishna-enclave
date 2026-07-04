# AI_AGENT_GUIDE.md

Rules for AI agents (Claude Code) working in this repository. CLAUDE.md is
the session entrypoint; this file is the working standard.

## Coding standards

- **TypeScript:** strict mode; no `any`; types come from
  `frontend/src/lib/types.ts` (the wire contract). Components small and
  composable; shared primitives in `src/components/ui.tsx`; Tailwind only
  (no CSS files besides globals.css).
- **Python:** Pydantic v2 models in `app/models.py`; routers thin — query,
  validate, audit, return models; shared logic in `app/core/`. snake_case
  internally, camelCase on the wire via the `APIModel` base.
- Match surrounding style; comments only for non-obvious constraints.

## Architecture rules

1. Every tenant-owned query goes through community scoping — no exceptions.
2. Every write endpoint: `require_roles(...)` + `record_audit(...)`.
3. New business logic lands in the backend under `/api/v1` (API-first);
   the frontend consumes it via `useApi`/`api()`.
4. Never hardcode Mani Krishna Enclave outside seed files.
5. Runtime database is MongoDB Atlas only (D-004). mongomock in pytest only.
6. Breaking API/schema changes need owner approval first.

## Documentation policy (part of every change)

| You changed… | Update |
|---|---|
| anything meaningful | PROJECT_STATE.md + docs/CHANGELOG.md |
| architecture | CLAUDE.md + docs/ARCHITECTURE.md |
| an endpoint | docs/API.md |
| a collection/index | docs/DATABASE.md |
| deployment/infra | docs/DEPLOYMENT.md / docs/TERRAFORM.md |
| an architectural choice | docs/DECISIONS.md (append a D-nnn) |
| scope/plan | docs/ROADMAP.md + docs/FEATURES.md |

## Deploy workflow (owner rule — binding)

Never commit or push unverified work. Sequence: implement → verify locally
(backend pytest, frontend build, run the flow end-to-end locally against the
real database when feasible) → show Raj the evidence → **wait for his
confirmation** → then commit, push, and dispatch deploy. Doc-only changes are
batched with the next confirmed push, never pushed alone.

## Testing requirements

New endpoint ⇒ happy path + RBAC denial + tenant isolation (+ audit assert
for writes). Run `cd backend && .venv/bin/python -m pytest` and
`cd frontend && npm run build` before declaring done. Fix, don't skip,
failing tests.

## Definition of Done

Code + tests passing + docs updated (table above) + API/DB documented +
Terraform updated if infra changed + CI green (once M1 lands).

## Pull Request checklist

- [ ] Tests pass locally (backend pytest, frontend build)
- [ ] Docs updated per the table above
- [ ] No secrets, no `console.log`/`print` debugging left
- [ ] RBAC + community scoping on any new endpoint
- [ ] Audit logging on any new write
- [ ] Mobile layout checked (bottom nav, small screens)
- [ ] No breaking API change without approval
