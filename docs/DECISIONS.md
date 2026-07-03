# DECISIONS.md

Architectural Decision Records. Append-only; never rewrite history.

## D-001 · 2026-07-02 · String business ids instead of ObjectIds
**Decision:** documents use a string `id` field (`apt-101`, `wo-1`,
uuid-suffixed for new records); Mongo `_id` unused by the app.
**Why:** URL-friendly, stable across frontend/backend/seed, readable in audit
logs. **Trade-off:** must maintain our own uniqueness (unique indexes).

## D-002 · 2026-07-02 · The users collection IS the whitelist
**Decision:** no separate whitelist store; login succeeds iff the verified
Google email exists in `users`. Every authenticated request re-loads the user.
**Why:** one source of truth; deleting a user revokes access immediately;
whitelist management is just user CRUD. **Trade-off:** a DB read per request
— negligible at this scale.

## D-003 · 2026-07-02 · camelCase wire contract, snake_case internals
**Decision:** Pydantic `to_camel` alias generator; API JSON matches
`frontend/src/lib/types.ts` exactly; Python and MongoDB stay snake_case.
**Why:** frontend types work unchanged; both codebases keep native idioms.

## D-004 · 2026-07-02 · MongoDB Atlas for every environment (owner decision)
**Decision:** one Atlas cluster for dev, staging and prod, separated by
database name. No local MongoDB, no Docker Mongo, no runtime mock DBs
(mongomock-motor allowed inside pytest only).
**Why:** owner's explicit preference — matches production exactly, zero local
setup. **Trade-off:** dev requires network + careful DB_NAME hygiene.
**Follow-up:** rework docker-compose.yml which still bundles a mongo service.

## D-005 · 2026-07-02 · Client-side rendering behind auth
**Decision:** all app pages are client components using a fetch hook; no SSR
data fetching.
**Why:** everything sits behind login (no SEO need); keeps the API the single
data path (API-first, mobile-ready). **Trade-off:** no server rendering of
data; revisit only if first-paint metrics matter.

## D-006 · 2026-07-02 · JWT in localStorage (revisit at M1)
**Decision:** store the session token in localStorage rather than an httpOnly
cookie for now. **Why:** simplest correct integration while frontend and API
are separate origins; no third-party script surface. **Trade-off:** XSS
exfiltration risk — tracked in docs/SECURITY.md; reevaluate when domains are
finalized in M1.

## D-007 · 2026-07-03 · Phase 1 ships read-only module APIs
**Decision:** expose GET endpoints for finance/work-orders/vendors ahead of
their write phases so the UI runs on live data; writes land in M2/M3.
**Why:** end-to-end integration early, real RBAC scoping in the UI, no
throwaway frontend code. **Trade-off:** some UI actions (Pay, comment,
vote) are visibly inert until their phase.
