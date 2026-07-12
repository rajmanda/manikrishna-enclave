# CHANGELOG.md

All notable changes. Format loosely follows Keep a Changelog; versions will
begin at 0.1.0 with the first deployment (M1).

## [Unreleased] — feature/community-switching

- **Community switching (super-admin):** new `POST /auth/switch-community` —
  a super admin steps into any owned community; the issued JWT carries an
  `act_cid` claim (home community stays in `community_id`), and
  `get_current_user` re-validates ownership on EVERY request (revoking
  ownership instantly drops the acting session back to home). While acting,
  all reads and writes across every router operate in the acting community,
  and the full portfolio scope is retained. 6 new tests (122 total).
- **Frontend:** `switchCommunity` in AuthContext; "Manage this community"
  button + "Currently managing" state on `/portfolio` cards; AppShell now
  shows the acting community's name.
- **Multi-community memberships (one email, many communities):** email is now
  unique PER COMMUNITY (compound index `community_id+email`, legacy global
  `email_1` index auto-dropped at startup) — the same person can be e.g.
  manager of two societies, or owner in one and tenant in another, with one
  user doc per membership. Login is deterministic across memberships; new
  `GET /auth/memberships` and `POST /auth/switch-membership` move the session
  between them (identity = email). AppShell gains a community dropdown when
  more than one membership exists. 7 new tests (129 total).

## [Unreleased] — feature/multi-community

- **BREAKING — super admins are no longer global:** new `owned_community_ids`
  scoping (`user.community_id` + new `user.community_ids` list). Super admins
  reach only communities they own; independent super admins are fully isolated
  from each other. Enforced in `scoped_community_id` (403 on non-owned
  request), `GET/POST /communities`, `GET /communities/{id}`, portfolio stats,
  and the super-admin deletes (invoices, work orders, maintenance requests —
  previously deletable across ANY community by id). Creating a community
  auto-adds it to the creator's portfolio. 4 new isolation tests (116 total).
  Existing single-super-admin data needs no migration (home community is
  always owned).
- **`Add Community` UI:** button + modal on `/portfolio` calling
  `POST /communities`.
- **Generic database names + dev/prod split:** data ported from
  `manikrishna_enclave` to `communityhub` (prod) and `communityhub_dev`
  (local dev) via new `backend/scripts/port_db.py` (copies collections +
  indexes, verifies counts, non-destructive). Local `.env` now uses
  `communityhub_dev`; terraform `db_name` default → `communityhub`, applied
  to prod 2026-07-12 IST (zero-downtime revision roll, verified via health +
  OpenClaw poller traffic). Legacy DB in ~1-week bake before drop.
- **Portfolio console (super-admin):** new `GET /api/v1/communities/portfolio/stats`
  returns a per-community rollup (units, invoiced/collected/outstanding on the
  community ledger only, collection rate, open invoices, open work orders).
  Super-admin only via `require_roles()`; verified 401 unauthenticated / 403
  for other roles. 4 new tests (112 total).
- **Frontend `/portfolio` page:** super-admin nav entry (Admin group) with
  portfolio totals row and per-community cards (collection-rate progress
  bars, outstanding, open items). E2E verified against Atlas dev data.
- **Presentation page rebuilt as role-based marketing decks:** audience picker
  (Property Manager, RWA Committee, Management Company/Builder, Owner, Tenant,
  Auditor) with deep links (`?audience=`), per-audience slides, dedicated Data
  Protection & Privacy slide, WhatsApp-alerts slide, persistent header +
  floating CTAs feeding `/get-started` with pre-filled role, Early Access
  badges on portfolio-tier claims. `/get-started` accepts `?role=` and adds
  Tenant and Auditor options.

## [0.13.0] — 2026-07-08

- **Queue-based notification system (M5):** outbound WhatsApp/email/in-app
  notifications via a new `notification_queue` MongoDB collection. CommunityHub
  stores every notification before delivery; an on-premise agent (OpenClaw on
  a Mac mini) polls pending WhatsApp entries and reports delivery status.
- **New collection:** `notification_queue` with 22 fields (notification_id,
  community_id, recipient details, channel, event_type, status lifecycle,
  retry tracking, timestamps). Three compound indexes for efficient polling
  and listing.
- **Management APIs:** `POST/GET /notification-queue` (create, list with
  status/channel/event_type filters), `/retry` (reset failed→pending),
  `/cancel` (prevent pickup). All manager/admin-authenticated.
- **OpenClaw polling APIs:** `GET /openclaw/notifications/pending` (atomic
  pickup: marks as processing to prevent double-delivery),
  `POST /openclaw/notifications/{id}/sent` and `/failed` (auto-requeues
  if retries remain). Secured via `X-API-Key` header (Secret Manager).
- **Notification triggers (store only, no auto-send):** invoice created
  (single, bulk, bill-owner), payment confirmed, common expense created,
  work order created, work order stage changed (special case: owner approval
  required), announcement posted. Each trigger audit-logged.
- **Notification service module:** centralized `enqueue_notification()` with
  fan-out helpers (`enqueue_for_community_members`,
  `enqueue_for_apartment_owners`). Every enqueue creates an audit_log entry.
- **Security:** OpenClaw uses a shared API key (no JWT/OAuth needed for
  machine-to-machine). Mac mini never exposed to public internet — all
  connections are outbound to Cloud Run.

## [0.12.0] — 2026-07-06

- **Design system + UI overhaul (frontend):** introduced a reusable token layer
  (type scale, layered shadow scale, surface CSS variables, motion easing) in
  `tailwind.config.ts` + `globals.css`; added an app-wide `:focus-visible` ring
  and a `.tabular` numerals utility for money. Upgraded shared primitives in
  `components/ui.tsx` (new `Button`, `Skeleton`/`SkeletonCard`, skeleton
  `PageLoading` variant, richer `EmptyState`, `Stat` delta/accent, gradient
  `Avatar`) — all backward-compatible. Added `components/motion.tsx`
  (`Stagger`/`FadeIn`/`Pressable`) on Framer Motion, all reduced-motion aware.
  Redesigned the **Manager Dashboard** (hero, accent stat row, skeleton
  loading, motion); added a **marketing landing page** at `/home` (hero +
  animated preview, features, testimonials, pricing, FAQ, CTA) with
  always-visible transform-only entrances; added a **Work Orders lifecycle
  pipeline** + tabular costs; **tabular money** on Invoices; **grouped
  sidebar navigation** (Overview/Money/Operations/Governance/Admin) with a
  polished active state + `aria-current`; and route-keyed **page transitions**
  via the shared `(app)` layout. Full audit, scores and before/after tracked in
  `UX_REVIEW.md`. Adds `framer-motion` dependency.
- **Modal fix:** the shared `<Modal>` now renders through a React portal to
  `document.body` (with background-scroll lock + Escape-to-close), so overlays
  are always viewport-anchored. Fixes modals opening off-screen / requiring a
  scroll — a transformed ancestor (the page-transition wrapper) had been making
  `position: fixed` resolve against the page instead of the viewport.

- **Deployment branding:** new `NEXT_PUBLIC_APP_NAME` (lib/brand.ts) renames
  the app per deployment — landing page, browser tab title, sidebar brand,
  API-unreachable error. community.rajmanda.com builds as "Manikrishna
  Enclave" (deploy.yml build-arg, overridable via APP_NAME repo variable);
  default stays "CommunityHub" so no community name is hardcoded in shared
  code. Sidebar hides the community subtitle when it would repeat the brand.

## [0.11.0] — 2026-07-06

- **Payments page opened to owners/tenants:** now in their nav as "My
  Payments" — API was already scoped to their own apartments. Owner
  adaptations: client filter hidden (accounts endpoint is manager-only),
  apartment filter only for multi-flat owners, stats relabeled
  ("Maintenance Paid" / "Paid to Manager"), pending claims show an
  "awaiting manager confirmation" badge instead of Confirm/Reject buttons.
- **Owner invoices aggregates:** headline Billed / Paid / Balance Due strip
  above the per-ledger panels, following the selected apartment tab.
- **Ledger badges on payment rows:** payments now carry the same
  Community/Manager fee/Reimbursement badge as invoices (shared LedgerBadge
  component in ui.tsx, also used by the invoice sheet).
- **Clickable stat tiles on invoices & payments pages:** owner's
  Billed/Paid/Balance Due strip opens itemized modals (rows tap through to
  the invoice sheet); the two payment-total tiles (both roles) open the
  matching confirmed-payment lists, each row opening the settled invoice.
- **Owner dashboard charts:** "Community Money (6 months)" card — the
  income-vs-expenses bars plus the reserve trend (reusing the manager's
  chart components; both endpoints were already member-visible) — and a
  new "My Payments (6 months)" green bar chart of the owner's own confirmed
  payments, where a missing bar means an unpaid month.

## [0.10.0] — 2026-07-06

- **Dashboard tiles open details:** all four owner tiles and the manager's
  key money tiles are now tappable (chevron affordance, hover state).
  Owner: Outstanding Balance → unpaid invoices with ledger badges + total
  due; Open Work Orders → open list linking to each work order; Community
  Expenses → current month's line items ("See all months →" link);
  Community Reserve → new ReserveModal with balance, collected/spent/balance
  month table and plain-words definition. Manager: Outstanding Collections →
  per-apartment dues sorted largest first; Payments Received → month-by-month
  community receipts with all-time total; Expenses and Reserve Fund same as
  owner. Community page tiles too: Income → monthly collected table;
  Expenses → current month line items; Outstanding Dues → per-flat breakup
  (owners see only their own flats, with a note); Community Reserve → story
  modal. `Stat`/`Card` gained an optional `onClick`.

- **Expense Ledger made readable:** community page ledger is now grouped —
  "By month" (default: newest first) or "By category" (biggest spend first,
  matching the pie chart; rows show a month badge instead). Groups are
  collapsible (newest/biggest starts open, the rest show a one-line
  count + total summary), each open group ends with a bold total row, and
  the all-time footer is relabeled "All months total". Empty state added.

## [0.9.0] — 2026-07-06

- **Live-computed community reserve:** the reserve is no longer a static
  manual snapshot. The last manual reserve entry is the anchor; confirmed
  community-ledger payments after it add, expenses subtract (fees and
  reimbursements excluded). Dashboards, finance summary and the reserve
  history all share the calculation; the history view derives per-month rows
  for post-anchor months. Manual entries now act as reconciliation anchors
  based on the live balance.
- **Invoice detail sheet:** tapping any invoice (invoices page, both views) or
  any payment (payments page) opens a bottom sheet — invoice header with
  ledger/status badges, billed/paid/balance with progress bar, reimbursement
  line items, full payment history (pending claims with inline
  confirm/reject, confirmed payments with reverse), late-fee parent/child
  links, and role-appropriate actions (record payment / I've paid / delete).
- **Payments Received grouped by month received** with per-month
  community/personal totals in each header.
- **Payment rows titled by the invoice they settle** (description + period)
  instead of only apartment + member name; owner name moved to the detail
  line.
- Data cleanup (prod): stale couple-style member names on 402/501/502
  replaced with one spouse per flat (Vijayaram / Rajaram / Sushma).

## [0.8.1] — 2026-07-05

- **Fix — Create Community Invoices had no title field:** the form silently
  sent a hardcoded "Monthly Maintenance" description (the input was never
  rendered), so custom titles ended up typed into Period. The dialog now
  leads with "What is this invoice for?" (prefilled, with a live preview of
  the owner-facing label) and Period is relabeled "Period (billing month)".

## [0.8.0] — 2026-07-05

- **Ownership console (super_admin):** new /ownership page — billing accounts
  with multi-apartment configuration (one account per apartment enforced),
  "who owns which flat" coverage grid with unassigned-apartment warning,
  legal title holders CRUD (name, ownership %), portal-user linkage shown per
  account and editable via Members → Account select. Account/LegalOwner
  write APIs are super_admin-only; deletes guarded by linked users.
- **Manager delete privileges (UI):** invoice delete button now shows for
  property_manager (was super_admin-only) in both boxes and table views;
  payments page gains a reverse button (property_manager/super_admin) that
  deletes the payment and restores the invoice's outstanding balance. No API
  change — both endpoints already accepted WRITE_ROLES.
- **Cascade delete for paid invoices:** `DELETE /invoices/{id}?cascade=true`
  deletes the invoice together with its payments (separate audit entries for
  each). The UI confirm dialog states how many payments (and their total)
  will be deleted; without cascade the 409 protection is unchanged.

## [0.7.0] — 2026-07-05

- **Ledger clarity suite:** invoices/payments summary panels split Community
  vs Personal (fees + reimbursements) — no blended totals anywhere; month-box
  headers show per-ledger dues; subtle color-coded left edges on every row
  (sky=community, violet=fee, amber=reimbursement); cascading Client →
  Apartment filter; "Generate" renamed "Create invoices"; owner dashboard
  "Reserve Fund" → "Community Reserve — not your balance".
- **Backup/restore validated:** full round-trip into a scratch DB (20
  collections, all counts matched); restore script now drops ALL collections
  (true snapshot semantics) + `--yes` flag; fresh post-Account baseline taken.
- **Bill an Owner — itemized reimbursements:** manager records flat-specific
  expenses (electricity, paperwork, repairs) as one itemized invoice
  (`ledger=reimbursement`, line items auto-summed, breakdown shown on the
  invoice row and to the owner). Owner is notified; same report→confirm
  payment path; fully excluded from community aggregates. Dashboard tile now
  covers fees + reimbursements; statements section renamed "Payable to the
  Property Manager"; new ledger filter option.

## [0.6.0] — 2026-07-05

- **Account & LegalOwner domain model (by Raj):** billing/portal Accounts own
  one or many apartments ("never assume one apartment = one owner"); users
  resolve apartment_ids via their account at login; all scoping (invoices,
  payments, dashboards, statements, search, polls) spans owned apartments;
  poll votes cast once per owned apartment; legal title holders preserved
  separately. Prod migrated: 8 accounts, 15 legal owners.
- **Modern filtering for managers:** URL-shareable faceted filters
  (Client/Apartment/Status/Ledger on Invoices; Client/Apartment/Method/Ledger
  on Payments) with active-filter chips, reactive totals, sortable desktop
  table with Boxes/Table toggle, subtle motion (reduced-motion aware).
  New GET /accounts powers per-client filtering.
- **Apartment-labeled invoices:** descriptions baked as "… - Apt N" at every
  creation path (idempotency preserved); migration 006 relabeled existing
  invoices. Generate dialog gained a description field ("What is this
  invoice for?"); invoice period is now correctable via PATCH.
- **Multi-apartment owner UX:** per-apartment tabs, "Apartments 501, 502"
  headers, per-apartment Statement buttons + consolidated account statement
  PDF (fees included, grand total), polls plural wording.
- Month-grouped invoice boxes keyed by due month; Community/Manager-fee
  badges; meeting attendee picker and poll deletion (by Raj).
- Migrations 005-006 (schema v6-equivalent labels). Backend tests 89 → 92.

## Older 0.6.0 draft — 2026-07-04
- Invoices page groups invoices into per-month boxes with billed/due
  subtotals per period (like the Meetings layout).
- **Manager service fees (private ledger):** per-apartment enrollment config
  (amount + active), one-click fee generation, identical payment
  report→confirm flow, complete exclusion from all community aggregates;
  ledger badges, dashboard fee tile, statement fee section, CSV ledger
  column. Migration 005 (schema v5). Tests 85 → 89.

## [0.5.1] — 2026-07-04 · Latency

- **Database moved to Mumbai** (new Atlas cluster `hyderabad`, AWS ap-south-1,
  beside the Cloud Run region): server-side latency dropped from 0.5–2.2s per
  endpoint to ~100ms; app connects as least-privilege `rajmanda` user; all 17
  collections migrated with verified counts; old cluster retained as frozen
  fallback.
- **Query parallelization** (`asyncio.gather`) in dashboards, badges, finance
  summary/monthly, search and polls: a 7-query endpoint now costs the same as
  a 1-query endpoint (2 round-trips total).
- **min-instances = 1** on the API (Terraform) — no more cold starts.

## [0.5.0] — 2026-07-04

- **Super-user support:** accounts can hold any number of switchable roles;
  the switcher becomes a "View as" dropdown beyond 3 roles; the Members
  dialog preserves custom role sets.
- **Members admin page** and **dual-role View-as switching** (below).
- **Self-explanatory finance cards:** "Expenses (Jul)" with previous-month
  hint (e.g. "Jun: ₹19,300") on both dashboards and the community page.
- **Clickable expense graphs:** dashboard cash-flow chart (tap a month) and
  community expense pie (tap a slice) open a line-items modal with totals.
- **Maintenance request deletion** (super_admin only, platform-level).
- Dev account switcher is now dynamic (reads live members — immune to email
  changes); login-page quick buttons point at real accounts.
- Migration 004 (users.roles, schema v4). Backend tests 70 → 85.

### Details
- **Dual-role & View-as switcher:** users can hold multiple roles
  (`roles[]`); a Manager/Owner toggle in the top bar switches the active role
  server-side so all dashboards, scoping and permissions genuinely follow.
  Owner view requires an assigned apartment. Migration 004 (schema v4).
- **Members admin page:** whitelist management UI — add/edit/remove members,
  change Google emails (unique, normalized, audited; old address stops
  working immediately), assign apartments and roles, grant the owner-view
  toggle to managers.

## [0.4.1] — 2026-07-04
- **Nav badges & actionable notifications:** state-driven red badges on the
  left nav / mobile tab bar (Invoices = unpaid count, role-scoped; Payments =
  pending confirmations for managers; "More" shows a dot when a hidden item
  has a badge). Manager dashboard gains an amber "payments awaiting your
  confirmation" card. All notifications now deep-link to the relevant page.
- **Owner payment reporting:** owners tap "I've paid this" on an invoice
  (amount/date/method/reference) → pending payment, managers notified;
  manager Confirm applies it (recompute + owner notified), Reject removes it
  with notification. Pending payments never count toward balances, income,
  or statements. One open report per invoice.
- **Financial figures computed from real data:** /finance/summary and
  /finance/monthly now derive from payments/expenses/invoices (current
  calendar month; 6-month series); dashboard "Monthly Expenses" is
  current-month; demo `monthly_finance` seeding removed. Fixes Month
  Expenses showing ₹0.
- Community page ledger renamed "Expense Ledger".
- Invoice generation supports a specific apartment subset (`apartmentIds`);
  the Generate dialog gained an All / Select-apartments picker with owner
  names and per-apartment checkboxes.

## [0.4.0] — 2026-07-04 · M4 Governance module

- Polls: create (notifies members), one-vote-per-apartment with revoting,
  auto-close by date + manual close, results with turnout and myVote.
- Documents: versioned uploads to GCS (v1, v2, …), latest-version download,
  category filter + search, delete; legacy seed entries marked
  "not digitised yet".
- Meetings: CRUD (creation notifies members), agenda/resolutions editing,
  minutes PDF upload/download.
- Global search endpoint across apartments/members/vendors/invoices
  (RBAC-scoped)/work orders/documents/minutes/expenses/feed; search overlay
  now server-backed with debounce.
- Report PDFs: collection, expense, vendor-spend (manager/auditor only);
  reports page wired to real downloads.
- Audit-log endpoint + viewer page (manager/admin/auditor nav item).
- fpdf2 output sanitized to latin-1 (em-dashes no longer crash PDFs).
- Migration 003 backfills governance collections; schema v3.
- Frontend fully API-driven — `src/lib/data.ts` deleted.
- Tests 54 → 64.

## [0.3.0] — 2026-07-04 · M3 Operations module

- Work orders: create (notifies members), update, stage transitions with
  timeline events + optional final cost (notifies members per PRD), owner
  comments, photo upload to GCS + streaming fetch.
- Maintenance requests: full backend (private/community visibility rules),
  creation notifies managers, status changes notify the creator.
- Vendors: CRUD with open-work-order delete guard.
- Community feed backend: posts, per-user reactions with toggle, comments,
  pin/unpin, author-or-manager delete; announcements notify members.
- In-app notifications: per-user collection, list/read/read-all endpoints;
  live bell in the shell with unread badge and mark-all-read.
- Migration 002 backfills feed/maintenance seed data into pre-M3 databases.
- Frontend: feed/maintenance/work-orders/vendors pages fully wired (dialogs,
  comment forms, stage updates, photo upload/display); seed data now used
  only by polls/documents/meetings/search (M4).
- Tests 40 → 54.

## [0.2.0] — 2026-07-04 · M2 Financial module

- Invoice writes: create, bulk generation per period (idempotent, defaults to
  community.monthlyMaintenance), late fees (linked via parentInvoiceId),
  update with status recompute, delete (blocked if payments exist).
- Payments: record (UPI/bank/cash/cheque/Credit-waiver) with automatic
  invoice status recomputation and overpayment rejection; reversal endpoint.
- Expenses: CRUD + receipt upload/download via private GCS bucket
  (proxied, pdf/jpeg/png/webp ≤10 MB); receipts community-readable.
- Reserve fund: monthly entry endpoint with auto-computed balance.
- Statements: server-side PDF per apartment (fpdf2) + invoices CSV export,
  both RBAC-scoped.
- Migrations convention (app/migrations.py, meta.version); migration 001.
- Frontend: Generate/Record-payment/Late-fee dialogs, expense add/delete +
  receipt attach/view, reserve entry form, working Statement PDF and CSV
  downloads.
- Terraform: private versioned GCS media bucket + API service access.
- Tests 28 → 40.

## [0.1.0] — 2026-07-03 · M1 Foundation

- Git repository initialized and pushed to github.com/rajmanda/manikrishna-enclave.
- GitHub Actions: ci.yml (backend pytest + frontend build, green) and
  deploy.yml (WIF auth, docker build/push to Artifact Registry, Cloud Run
  deploy, health checks; manual dispatch).
- Terraform (`infra/terraform`, state in GCS): Cloud Run ×2, Artifact
  Registry, Secret Manager (communityhub-* — project is shared), runtime +
  deployer service accounts, GitHub OIDC Workload Identity Federation,
  global HTTPS load balancer for community.rajmanda.com with same-origin
  /api/* routing (domain mappings unsupported in asia-south1). 33 resources.
- First production deploy to Cloud Run (asia-south1).
- Atlas e2e verified locally (login, dashboards, scoping, whitelist 403).
- docker-compose reworked: Atlas-only (local mongo container removed);
  frontend Dockerfile accepts NEXT_PUBLIC_* build args.
- Docs: DEPLOYMENT/TERRAFORM rewritten as-built; ADRs D-008..D-010.

## [Unreleased]

### 2026-07-03
- Documentation bootstrap per BOOTSTRAP.md: CLAUDE.md, PROJECT_STATE.md,
  README.md, and the full docs/ set (19 files).

### 2026-07-02 — Frontend↔API integration
- Frontend: real auth session (AuthContext, localStorage JWT, session restore
  via /auth/me, logout); login page with Google Identity Services button
  (when configured) + dev quick-login; dev account switcher in shell.
- Frontend: dashboard, community, work orders (list/detail), invoices,
  payments, vendors, reserve fund, reports chart now fetch from the API with
  loading/error/retry states. Removed simulated RoleContext.
- Backend: read endpoints — /invoices, /payments (owner-scoped), /expenses,
  /reserve-fund, /finance/monthly, /finance/summary, /work-orders(+/{id}),
  /vendors. Payment gained community_id; Vendor/MonthlyFinance models added.
- Seed: payments, vendor gst/amc/active_contracts, monthly finance, seeded
  auditor account.
- Tests: 18 → 28.

### 2026-07-02 — Backend Phase 1
- FastAPI + Motor backend: Google OAuth verification with users-collection
  whitelist, JWT sessions, RBAC dependencies, tenant isolation, audit log,
  CRUD for communities/apartments/users, owner & manager dashboards,
  idempotent Mani Krishna Enclave seed, Cloud Run Dockerfile,
  docker-compose.yml, 18 pytest tests.

### 2026-07-02 — Frontend Phase 1
- Next.js 15 + TypeScript + Tailwind mobile-first app, 17 routes covering all
  PRD modules (dashboards, HOA page, work orders, maintenance, feed, polls,
  invoices, payments, meetings, documents, vendors, reserve fund, reports,
  global search), responsive shell (bottom tabs / sidebar), Recharts charts,
  seed data, Cloud Run Dockerfile.
