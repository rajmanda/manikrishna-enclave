# CONTRIBUTING.md

Last updated: 2026-07-03. Solo-maintainer project (Raj) with AI agents doing
much of the implementation — these rules bind both.

## Setup

```bash
# backend
cd backend && python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env        # add the Atlas URI; SEED_ON_START=true on first run

# frontend
cd frontend && npm install && cp .env.example .env.local
```

Run: `uvicorn app.main:app --reload` + `npm run dev`. Sign in with a dev
quick-login account.

## Workflow (once git/GitHub land in M1)

- Trunk-based: short-lived feature branches → PR → squash-merge to `main`.
- `main` deploys to staging automatically; production by tag.
- Conventional-ish commit subjects: `feat:`, `fix:`, `docs:`, `infra:`,
  `test:`, `chore:`.
- Every PR satisfies the checklist in docs/AI_AGENT_GUIDE.md — including the
  documentation table. Docs drift fails review.

## Quality gates

```bash
cd backend && .venv/bin/python -m pytest     # must pass
cd frontend && npm run build                 # must pass (typecheck included)
```

## Ground rules

- No secrets in the repo — `.env*` stay local / Secret Manager.
- No breaking API/DB changes without owner approval.
- New endpoints ship with RBAC + tenant-isolation tests and audit logging.
- Keep it mobile-first: check every screen at phone width.
