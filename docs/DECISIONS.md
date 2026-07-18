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

## D-008 · 2026-07-03 · Global HTTPS LB instead of Cloud Run domain mapping
**Decision:** community.rajmanda.com terminates at a global external ALB
(managed cert, serverless NEGs) with `/api/*` routed to the API service.
**Why:** domain mappings are unsupported in asia-south1 (Mumbai, chosen for
user latency), and same-origin app+API eliminates CORS and enables cookie
auth later. **Trade-off:** ~US$18/month forwarding-rule cost.

## D-009 · 2026-07-03 · Namespace everything `communityhub-` in shared GCP project
**Decision:** `mm-owners-5b8611` hosts other apps (estatio-*); all our
resources are named/prefixed communityhub-*. **Why:** first apply collided
with a pre-existing `google-client-id` secret. Never modify resources we
didn't create.

## D-010 · 2026-07-03 · CI owns releases, Terraform owns shape
**Decision:** Cloud Run services ignore image changes in Terraform; GitHub
Actions (WIF, manual dispatch for now) builds/pushes/deploys images tagged
with the git SHA. **Why:** clean separation — infra changes are rare and
reviewed, releases are frequent. **Follow-up:** auto-deploy on main once
trusted.

## D-011 · 2026-07-04 · Credits are payments with method "Credit"
**Decision:** waivers/adjustments are recorded as payments (`method: "Credit"`)
counting toward paid_amount, not as a separate credit ledger.
**Why:** one code path for balance math, visible in payment history and
statements. **Trade-off:** cash reports must exclude method=Credit.

## D-012 · 2026-07-04 · Receipts proxied through the API, not signed URLs
**Decision:** uploads/downloads stream through FastAPI to a private GCS bucket.
**Why:** RBAC stays in one place; no signBlob IAM; receipts are small (≤10 MB).
**Trade-off:** file bytes transit the API; revisit with signed URLs if media
grows (work-order videos in M3 may need them).

## D-013 · 2026-07-04 · fpdf2 for server-side PDFs
**Decision:** statements are generated with fpdf2 (pure-Python).
**Why:** no native dependencies (weasyprint needs system libs in the
container); statements are simple tables. **Trade-off:** limited layout/Unicode
(₹ rendered as "Rs" with core fonts); revisit if design needs grow.

## D-014 · 2026-07-04 · Per-user reaction storage on feed posts
**Decision:** reactions stored as `reactions_by: {user_id: kind}`; the API
returns aggregate counts plus the caller's `myReaction`.
**Why:** correct toggling and one-reaction-per-user without a separate
collection. **Trade-off:** document grows with community size — fine at
apartment scale.

## D-015 · 2026-07-04 · Notification fan-out is synchronous inserts
**Decision:** status changes insert one notification document per recipient
inline with the request. **Why:** ~10 recipients per community; no queue
infrastructure warranted. **Follow-up:** revisit with Cloud Tasks + email in
M4 if fan-out grows.

## D-016 · 2026-07-04 · One vote per apartment, keyed by apartment_id
**Decision:** poll votes stored as `votes_by: {apartment_id: option}`; only
users with an apartment can vote; revoting replaces while open.
**Why:** the PRD's governance unit is the apartment, not the person (couples
share ownership). **Trade-off:** managers without apartments can't vote —
matches how societies actually run.

## D-017 · 2026-07-04 · Search is in-process substring scan, not an index
**Decision:** `/search` scans community-scoped collections in Python.
**Why:** tens-to-hundreds of documents per community — an Atlas Search index
is premature. **Follow-up:** swap to Atlas Search when a community exceeds
~10k documents.

## D-018 · 2026-07-04 · Owners report payments; managers confirm
**Decision:** owners cannot mark invoices paid directly — they submit a
pending payment claim (amount/method/reference) that a manager confirms or
rejects. Pending claims never count toward balances/income/statements.
**Why:** the ledger is the community's collections record; payment truth must
come from the money recipient. Owner-side agency preserved via the claim flow
(replacing WhatsApp payment screenshots). A future payment gateway records
directly as confirmed.

## D-019 · 2026-07-04 · Dual-role via server-side active-role switching
**Decision:** users carry `roles[]` (switchable set) and `role` (active).
`POST /auth/switch-role` updates the active role in the database; every
request re-reads it, so RBAC and data scoping genuinely follow the switch.
**Why:** a client-side "view as" toggle would fake the UI while the API kept
serving manager-scoped data; the owner asked to *experience* the owner view.
**Trade-off:** active role is global per account (all devices/sessions see
the same view) — acceptable, arguably a feature.

## D-020 · 2026-07-04 · Database co-located with compute (Mumbai)
**Decision:** migrated from the shared `cluster0` (far from asia-south1,
~270ms/query) to a dedicated Atlas cluster in AWS Mumbai next to Cloud Run;
multi-query endpoints parallelized with asyncio.gather; API min-instances=1.
**Why:** every request paid 2–7 sequential cross-ocean round-trips — Vishnu
(India) saw 0.5–2.2s per call. Rule: the database lives next to the compute;
clients cross the ocean once, the app would otherwise cross it N times.
**Amends D-004:** still Raj's Atlas account, but a dedicated, region-matched
cluster per app rather than one shared cluster for everything.

## D-021 · 2026-07-04 · Manager fees as a parallel ledger, not a module
**Decision:** invoices/payments carry `ledger: community | manager_fee`; the
entire generation → report → confirm pipeline is shared; every community
aggregate filters to `ledger=community`. Enrollment config (per-apartment
amount + active flag) drives fee generation.
**Why:** owner requirement — private fees to the manager must never mix with
community funds, but flows must be identical. One enum reuses everything and
extends to future ledgers (special assessments, sinking funds).

## D-022 · 2026-07-05 · Account entity for multi-apartment ownership (Raj)
**Decision:** Accounts are the billing/portal unit (own 1..n apartments,
carry portal users); LegalOwner records preserve title holders separately.
Users resolve `apartment_ids` from their account at login; every scoped
surface spans all owned apartments; poll votes cast per owned apartment.
**Why:** BOOTSTRAP rewrite — "never assume one apartment equals one owner"
(Sangam family owns 301+302, Rajaram Manda Family 501+502).
**Note:** designed and implemented by the owner; reviewed + regression-tested.

## D-023 · 2026-07-05 · Filters live in the URL
**Decision:** manager list filters (client/apartment/status/ledger/method,
view mode) are URL search params, not component state.
**Why:** shareable links ("Apt 301 overdue" → WhatsApp), working back button,
bookmarkable views. Client-side filtering only — dataset is small and 2ms
from the API.

## D-024 · 2026-07-05 · Reimbursements as a third ledger value
**Decision:** flat-specific expenses the manager collects personally are
`ledger="reimbursement"` invoices with stored line items (auto-summed).
**Why:** third real money stream from field usage (Vishnu's itemized
WhatsApp bills). Community aggregates filter on `ledger=="community"`, so
new ledger values are excluded by construction — validating D-021's design.

## D-025 · 2026-07-17 · Third-party payments: payer is metadata, never a receivable
**Decision:** when a tenant (or anyone) pays an owner's HOA invoice, we record
ONE payment against the owner's invoice carrying payer attribution
(`payer_type/payer_entity_id/payer_name` + collector/deposit fields) — never a
second tenant invoice, credit note, or owner adjustment. Invoices separate
liability from routing: `responsible_owner_id` is fixed at billing;
`payment_request_recipient_*` may point at the active tenant. Money received
early or beyond a balance lands in `credits` with the funder preserved, so
refunds go back to the actual payer. Posted payments are corrected by
void-and-replace (`status: "voided"` + who/when/why) — every aggregate already
filters `status == "confirmed"`, so voided rows count nowhere by construction.
**Why:** duplicate receivables would double the community's book; a tenant
payment is legally the owner's settlement, so only the source needs recording
(receipt to the payer, "on behalf of owner" on the ledger).
**Trade-off:** occupancy is inferred from the whitelist (tenant user present =
rented); true vacancy isn't tracked — both no-tenant states route requests to
the owner, which is the correct default anyway.
