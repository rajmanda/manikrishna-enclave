# CHANGELOG.md

All notable changes. Format loosely follows Keep a Changelog; versions will
begin at 0.1.0 with the first deployment (M1).

## [Unreleased] — marketing CTAs → Growth Center CRM

- **Public lead capture into the Growth Center CRM (2026-07-21)** — every
  nivaasos.com CTA form (demo / start / waitlist / contact) now POSTs to a
  new unauthenticated endpoint `POST /api/v1/public/leads`
  (`backend/app/routers/public_leads.py`) instead of only opening the
  visitor's email app. Each submission creates a `growth_leads` entry in
  the super admin's Growth Center CRM (`source: "website"`, tags
  `["website", <kind>]`, stage `new`, next-action set so it appears in the
  follow-up tracker), logs a lead activity + growth audit entry, and
  enqueues a WhatsApp heads-up to the operator via the OpenClaw queue.
  Abuse controls: hidden honeypot field (fake success, nothing stored),
  per-IP (5/h) and global (200/h) in-memory rate limits, field length
  caps, minimal response body. `LeadSource` gains `"website"`.
  `marketing/src/components/LeadForm.tsx` falls back to the previous
  mailto flow whenever the endpoint fails (or `NEXT_PUBLIC_LEADS_API_URL`
  is set empty), and its privacy copy now states details are sent to
  Nivaasos. Backend default `cors_origins` adds nivaasos.com origins +
  localhost:3100 (marketing dev). Tests: `tests/test_public_leads.py`
  (6 new, suite 240 passed); marketing build clean; flow exercised
  end-to-end against Atlas dev.
- **Mailto removed from CTA forms (2026-07-22, owner decision)** — the
  marketing `LeadForm` no longer opens the visitor's email app under any
  circumstance; submissions go ONLY to the public lead endpoint / CRM. On
  failure the form shows a retry message with the contact address as plain
  text. Button icon Mail→Send; privacy copy trimmed accordingly.
- **Resident Login → community.nivaasos.com (2026-07-22)** — repo variable
  `MARKETING_APP_URL` set to `https://community.nivaasos.com`
  (`nivaasos-community-cert` ACTIVE, host serving 200), so the marketing
  site's Resident Login popup/link now targets the nivaasos app domain
  instead of community.rajmanda.com. Reminder: Google sign-in on that
  domain needs https://community.nivaasos.com (+ https://nivaasos.com for
  the popup) in the OAuth client's Authorized JavaScript origins (owner).
- **Rollout (2026-07-22)** — backend/frontend shipped via deploy.yml
  (owner dispatch); Terraform `CORS_ORIGINS` on the API service gained
  `https://nivaasos.com` + `https://www.nivaasos.com` (applied, preflight
  verified — the env overrides the code default and had blocked browser
  POSTs); marketing site redeployed via deploy.yml `deploy_marketing=true`
  so nivaasos.com serves the new CRM-backed form (the first manual image
  from 2026-07-19 was still mailto-only).

## [Unreleased] — resident-login popup + mobile modal fix

- **Resident Login popup on nivaasos.com (2026-07-18)** — header, hero and
  final-CTA "Resident Login" buttons now open a popup
  (`marketing/src/components/ResidentLogin.tsx`) instead of navigating to
  the app's login page. With `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set (and
  nivaasos.com registered as an authorized JS origin on the same OAuth
  client), the popup renders Google sign-in directly and hands the ID
  token to the app via `#gcred=` fragment; the app login page
  (`frontend/src/app/page.tsx`) consumes it once, scrubs the URL, and
  exchanges it through the existing `/auth/google` flow → straight to the
  dashboard. Without the client ID the popup falls back to a link (old
  behavior, one extra click). Marketing still makes no backend/API calls.
  Footer/contact/product-facts login *text links* stay plain links.
- **Mobile modal fix (2026-07-18)** — shared app `Modal` is now a centered
  dialog on every viewport (was a flush bottom sheet on phones, which read
  as "scroll down to find it" and had no side margins): overlay gets
  `p-4` + safe-area padding, panel uses new `.modal-panel-max`
  (`85dvh` with `85vh` fallback) so it never hides behind mobile browser
  toolbars. Applies to all tile popups on /community and every other
  Modal-based dialog.

## [Unreleased] — nivaasos marketing site

- **Nivaasos public marketing site (2026-07-18)** — new isolated
  `marketing/` Next.js app for the nivaasos.com domain (public brand for
  the CommunityHub platform). Fully static (24 prerendered routes, no auth,
  no API access): landing page (hero with fictional "Greenwood Residency"
  dashboard mock, problem/solution, transparency chain MR→WO→expense→
  invoice→payment→ledger, role benefits, mobile section, trust, FAQ) plus
  18 dedicated intent pages (/product, /features, /community-accounting,
  /maintenance-management, /resident-portal, /apartment-communities,
  /property-managers, /nri-property-owners, /mobile-app, /how-it-works,
  /security, /product-facts, /faq, /about, /contact, /request-demo,
  /privacy, /terms). SEO/AEO: per-page metadata + canonicals, JSON-LD
  (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList,
  About/ContactPage — parse-validated), robots.ts (search + AI-search
  crawlers allowed; training-crawler policy = documented owner decision),
  sitemap.ts (public canonical pages only), llms.txt, custom 404,
  answer-first copy, internal-link strips. Accessibility: skip link,
  keyboard nav, focus rings, reduced motion, no-JS FAQ accordions. Lead
  forms are honest mailto flows pending an approved public endpoint.
  No app/backend/infra files touched; deployment (Terraform host rule +
  DNS) documented but NOT executed — see docs/NIVAASOS_PUBLIC_SITE.md.
  Build verified: static output, ~106 kB first-load JS, leak-grep clean.

## [Unreleased] — feature/growth-center

- **Growth Center Leads CRM + Firecrawl discovery (2026-07-18)** —
  lightweight sales CRM at `/super-admin/growth-center/crm` inside the
  same isolated boundary (`growth_leads`/`growth_lead_activities`
  collections in the Growth Center DB): 9-stage pipeline (new → … →
  won/lost with lost-reason capture), per-lead activity timeline,
  follow-up tracker (`next_follow_up_at`/`next_action`, overdue/due-today
  /due-week overview + filters, first outreach auto-advances new →
  contacted), manual lead capture (source-tagged: Facebook, LinkedIn,
  WhatsApp, referral…), and **web lead discovery via Firecrawl**
  (`FIRECRAWL_API_KEY`, 503 when unset): operator-typed query + area →
  public-web search → phone/email extraction (Indian formats) →
  human-reviewed import with domain/phone/email dedupe; social networks
  are never scraped. New dep `httpx`; dev proxy covers the namespace.
  6 new tests (233 total).

- **Growth Center — isolated Super Admin marketing workspace (2026-07-18)**
  — internal business-development module at `/super-admin/growth-center`
  (nav: Super Admin → Growth Center, super_admin only) with its own API
  namespace `/api/super-admin/growth-center` and its own MongoDB database
  (`GROWTH_CENTER_MONGO_URI`; unset ⇒ 503, **never** falls back to the
  operational DB). Stores marketing strategy and sales copy only:
  playbooks with editable sections, outreach/follow-up templates,
  objection-handling scripts, personas, module-local audit trail
  (`growth_` collections). Seeds a default Hyderabad property-manager
  acquisition playbook (7 lead magnets, qualification framework,
  micro-conversion path, 5-step outreach sequences across
  WhatsApp/email/LinkedIn/Facebook, 10 objection scripts, pilot-pricing
  positioning, 3 personas). Draft/Under-Review/Approved/Archived
  lifecycle, duplicate, rename, one-level restore, copy message/sequence,
  Markdown/text/JSON export, module-scoped search. NO interaction with
  operational data — the only approved reuse is authentication/role
  verification (`app.core.security`) and visual components; a static test
  fails the suite if the package imports operational code. 17 new tests
  (227 total: role matrix 401/403, no-fallback-on-missing-config,
  operational-DB fingerprint unchanged, search/export leak checks). Docs:
  `docs/GROWTH_CENTER.md`. Operational files touched: `app/main.py`
  (router include only), `shell/nav.ts` (nav item + "Super Admin" group).

## [Unreleased] — feature/community-switching

- **Owner-reported claims can name the actual payer (2026-07-17)** — the
  owner-side "I've paid this" and Pay-multiple dialogs gained a "Who paid?"
  select (I paid myself · My tenant — name, resolved from the whitelist ·
  Someone else + free-text name). The claim stays ONE pending payment on
  the owner's invoice; Vishnu's notification and the pending claim card
  show "Paid by X (tenant) on behalf of owner" so he can verify before
  confirming, and confirming stamps him as `collectedBy` (+ collection
  date). Books tally identically on the owner side, manager side and
  community ledger — payer is metadata, never a second receivable (D-025).
  3 new tests (209 total).

- **Tenant pays on behalf of owner (third-party payments, 2026-07-17)** —
  the monthly HOA invoice stays the OWNER's receivable, but Vishnu can now
  record who actually paid it. Separated concepts: responsible owner
  (liability, never moves) · payment-request recipient (owner or the
  apartment's active tenant) · payer (owner/tenant/other) · collector ·
  receipt recipient.
  *Invoices* gain `responsiblePartyType/responsibleOwnerId`,
  `paymentRequestRecipientType/Id` (Generate dialog offers a per-apartment
  "Payment requested from" select on rented flats; PATCH re-routes later;
  vacant/no-tenant flats always default to owner), occupancy snapshot and
  `billingPeriodMonth/Year`. *Payments* gain payer attribution
  (payerType/payerEntityId/payerName), collected-by (defaults to the
  recording manager), collection date, deposit status/date and notes; the
  Record Payment dialog grew matching fields incl. a "Tenant paid on
  behalf of owner" option listing the flat's whitelisted tenant. A tenant
  payment settles the owner's invoice (partial → Partially Paid, remainder
  stays on the owner), credits the owner's ledger with "Paid by X (tenant)
  on behalf of owner" shown on the invoice sheet, payments page and the
  statement PDF's new Paid-By column — never as a discount/waiver/owner
  credit — and the tenant sees the same informational rows (no tenant
  receivable is ever created). **Receipts:** `GET
  /payments/{id}/receipt.pdf` — receipt no, apartment, amount, method,
  reference, billing period, owner invoice no, "collected by", and an
  on-behalf-of-owner statement; download buttons on payment rows.
  **Overpayment:** manager-recorded overpayment now banks the excess as
  advance credit funded by the payer (was a hard 400).
  **Advance payments:** new `POST /payments/advance` + Payments-page
  dialog holds money received before its invoice exists as owner-account
  credit with the payer preserved; apply-credit now carries the funder
  onto the resulting payments. **Refunds:** `POST /credits/{id}/refund`
  (+ per-entry Refund buttons on the manager's credits card) returns an
  unapplied credit to whoever funded it. **Void-and-replace:** posted
  payments are no longer deleted from the UI — `POST /payments/{id}/void`
  keeps the row (who/when/why, struck-through in history, excluded from
  every total) and restores the invoice balance. **Migration 008**
  stamps all existing invoices/payments/credits (tenant-reported rows
  reclassified as tenant-paid; same invoices, same amounts/dates/refs)
  and stores a reclassification/needs-review report
  (`GET /payments/migration-report`). 13 new tests (206 total).

- **Fix: POST /users dropped accountId (2026-07-17)** — `create_user`
  never persisted `account_id`, so any member whitelisted via the API
  (including extra emails added through the comma-delimited member
  dialog) lost their multi-apartment Account link and saw only their
  single `apartment_id` after login. Now persisted; regression test
  `test_created_member_keeps_account_link` covers create → login →
  both apartments visible.

- **Removed: manager-side Combined Payment (2026-07-17)** — the Invoices-page
  "Combined payment" button, `CombinedPaymentDialog`, and
  `POST /payments/allocate` are gone. Owner decision: the tool allowed
  allocating one amount across invoices of unrelated apartments, and any
  excess landed as advance credit on whichever apartment held the
  newest-due invoice — too easy to misbook. The owner-side equivalent
  (`POST /payments/report-batch`, scoped to the reporter's own apartments
  and manager-confirmed) remains the supported way to settle several
  invoices with one transfer; managers record payments per invoice via
  `POST /payments`.

- **Paid invoices hidden from the manager's delete button (2026-07-16)** —
  the backend already blocks property managers from deleting paid-off
  invoices (403, super admins may still); the Invoices UI now mirrors the
  rule and hides the delete icon (table row, card, invoice sheet) for
  property managers when an invoice is fully paid.

- **Bulk whitelist via comma-delimited emails (2026-07-16)** — the
  Add/Edit Member dialog accepts several emails separated by commas (or
  spaces/semicolons) and whitelists them all with the shared
  role/apartment/account; names start from each email's local part
  (`raj.manda@…` → "Raj Manda", editable afterwards). In edit mode the
  first email stays with the member being edited, the rest become new
  members. Already-whitelisted addresses are skipped and reported without
  aborting the rest.

- **Pay multiple invoices in one shot + advance credits (2026-07-16)** —
  owners can now settle any number of invoices with ONE transfer: tick
  invoices directly on their cards — a sticky pay bar totals the selection
  (select-all, clear) and opens the payment dialog (oldest-first allocation
  preview) → `POST /payments/report-batch` creates one PENDING payment per invoice
  (identical rows to paying individually — balancing unchanged) sharing a
  `batchId`; the Payments page groups the batch into one card the manager
  confirms/rejects in one click (`/payments/batch/{id}/confirm|reject`,
  per-invoice recompute each, one aggregate notification + WhatsApp).
  **Overpayment → advance credit:** paying more than owed (single report,
  batch report, or manager's Combined payment) banks the excess in the new
  `credits` collection (pending until the batch is confirmed).
  **Batches are ALL-OR-NONE:** one transfer either arrived or it didn't, so
  portions of a batch cannot be confirmed/rejected individually (400) — the
  manager decides the whole claim; rejecting discards its pending credit.
  Rejections persist as `payment_rejections`, shown on the owner's invoice
  card with the manager's reason. Money-conservation guards: confirming a
  payment never overshoots its invoice (the excess is banked as credit) and
  apply-credit skips invoices with pending claims. (An owner-initiated
  "correction request" flow was prototyped and removed pending a better
  design — misbooked payments are handled by the manager's reverse for now.)
  **Pay from credit:**
  `GET /credits` + `POST /payments/apply-credit` spend the balance FIFO on
  open invoices oldest-first as confirmed Credit-method payments (no
  confirmation round-trip — the money is already held). UI: owner
  "Advance Credit" tile + entries modal with one-tap apply, credit-aware
  Pay-multiple dialog ("use my credit first", excess preview), manager
  "Advance credits held" card with per-apartment apply, overpayment hints
  in the single-report and Combined dialogs. 7 new tests + 2 updated
  (188 total); smoke-tested end-to-end against Atlas dev.

- **Cost Cases (Phase 1+2)** — one entity per complete financial event
  connecting Maintenance Request → Work Order → Vendor Bill/Expense →
  Owner Assessments → Payments → Reconciliation (plan:
  docs/COST_CASES_PLAN.md). New `cost_cases` collection + `/cost-cases`
  API (create/list/detail/close-with-guard/reopen); children link via
  `cost_case_id` on work orders, expenses, invoices; all case totals
  computed live. `expenses.status` (draft|posted): a DRAFT is a vendor
  bill under review and never touches the reserve/books — completing a
  work order auto-creates one (idempotent); `POST /expenses/{id}/post`
  puts it in the books. Migration 007 backfills legacy expenses as posted
  and reconstructs the historical "Bore well repair work" case (10
  invoices + [Migrated] work order linked; NO expense fabricated).
  UI: Cost Cases nav page + detail screen (reconciliation table,
  timeline, related records, owner assessments, post-to-books, guarded
  close); reserve warning is now actionable ("₹10,800 collected … no
  final vendor expense posted" → open cost case / add expense). 5 new
  tests (160 total).


- **Money-chain integrity (bore well discrepancy):** three-part fix after
  ₹2,700 of June bore well collections silently vanished from the reserve.
  (1) *Data*: June closing entry amended 20,000→22,700 contributions
  (balance 700→3,400) in prod+dev, audited. (2) *Reconciliation*: new
  `GET /reserve-fund/reconciliation` compares the anchor month's closing
  figures against recorded payments/expenses and lists **collections
  without a recorded expense** (special billing drives where owners paid
  but the job's spend was never entered — matched by work-order link or
  description words); Reserve Fund page shows amber warning banners, and
  Record Payment / Add Expense dialogs warn when the date falls in an
  already-closed month. (3) *Chain links*: `work_orders.maintenance_request_id`
  (creating a WO from a request flips it to In Progress),
  `expenses.work_order_id`, `invoices.work_order_id` (incl. bulk generate).
  Work-order page gains a Money panel (estimate/final/expenses recorded/
  billed/collected + "collected but no expense" warning) with "Record
  expense for this job" (prefilled dialog) and "Bill owners for this job"
  (prefilled generate dialog); maintenance requests get a "Create work
  order" action that prefils the WO dialog. 6 new tests (155 total).
- **Reserve fairness caveat for everyone:** wherever the reserve balance is
  shown (owner dashboard, manager dashboard, Community page, Reserve Fund
  page), ALL roles now see a one-line amber note when the books have known
  gaps — "The reserve figure is provisional — money was collected for
  'Bore well repair work' but its expense hasn't been recorded yet."
  (`ReserveCaveat` component driven by `/reserve-fund/reconciliation`;
  disappears automatically once the books reconcile).

- **Expense entry made findable (manager feedback):** new dedicated
  `/expenses` page (Money nav group, all roles) with title-bar "Add
  expense", month/category ledger, and Spent-this-month / All-time /
  Missing-receipts tiles; manager Dashboard gains a Quick Actions row
  (Record expense · Record payment · Create invoices · Bill owner) with
  deep links (`/expenses?add=1`, `/invoices?dialog=generate|billowner`)
  that auto-open the right dialog; Community page's ledger slimmed to a
  Recent Expenses card linking to the full ledger. Add Expense dialog
  reworked: amount+date first, category starts unselected (no more
  everything-is-Miscellaneous), description placeholder, and an inline
  receipt picker (upload or take a photo — compressed client-side) so
  receipt capture happens at entry time instead of as a second step.
  Expense ledger/dialog extracted to `src/components/expenses.tsx`.

- **Platform Insights — the super-admin "CEO dashboard" (`/insights`):**
  adoption funnel (whitelisted → logged in ever → active 30d → active 7d),
  daily engagement chart from the audit trail, feature-usage breakdown by
  module, financial pulse (community-ledger billed/collected/collection %),
  per-community health table, and a whitelist-adoption chase list
  (filter: never logged in / active 7d, search, login counts) — built for
  the real-owner-onboarding push. Backed by new super-admin-only
  `GET /insights/platform`, strictly portfolio-scoped. Login tracking added:
  `users.last_login` + `login_count` stamped on every login across all of
  the email's memberships (starts from this release — older accounts show
  "never" until they next log in). Nav gets an Insights entry (Admin group,
  super_admin). 4 new tests (149 total).

- **Invoice receipts (paper receipt upload / take a picture):** every invoice
  dialog on `/invoices` (Create invoices, Bill owner, Service fees, Late
  fees) gets an optional receipt picker — choose a file or open the phone
  camera — and the invoice detail sheet gets a Receipts section so managers
  can attach receipts to past invoices too. Receipts are saved in Documents
  under a "Receipts" category. New `POST /invoices/{id}/receipt` stores the
  file scoped to the invoice's apartment; `documents` gained `apartment_ids`
  (None = community-wide) and `invoice_id`. Document list & download are now
  visibility-filtered: owners/tenants see community docs plus only their own
  apartments' docs (managers/admins/auditor see all); the Documents view
  badges apartment-scoped files. Bulk flows scope sensibly: community
  invoices → community-wide (or the selected apartments), service fees →
  enrolled apartments, bill-owner → that apartment, late fees → only the
  charged apartments (who paid late is private; `apply-late-fees` now
  returns `apartmentIds` for this). 4 new tests (145 total).
- **Multi-file receipts + delete:** the receipt picker in all four invoice
  dialogs now holds any number of files (per-file remove, "Add another
  file", multi-select file dialog, numbered titles `#2 #3…`), and the
  invoice sheet's Receipts section gets a manager-only delete button
  (confirm dialog; removes the document from Documents too) alongside the
  existing attach buttons.
- **Dev-mode local file storage:** with `DEV_MODE` on and no `GCS_BUCKET`,
  `app/storage.py` now reads/writes `backend/.local_media/` (gitignored,
  path-traversal-guarded) instead of returning 503, so upload/download flows
  are testable locally without GCS credentials. Production behavior
  unchanged (hard 503 when the bucket is unset).
- **Client-side image compression on all uploads:** new `src/lib/upload.ts`
  — images over 1.5 MB are downscaled to ≤2048px JPEG before upload
  (browsers transcode phone HEIC captures into files far larger than the
  gallery shows, tripping the 10 MB API cap and the Next dev-proxy body
  limit); anything still over 10 MB gets a clear client-side error instead
  of a mid-flight failure. Receipt pickers, invoice-sheet attach, and both
  Documents-view upload paths now share this helper.
- **Fix — invoice tile drill-downs ignored filters:** on `/invoices`, the
  "Community funds" and "Personal — fees & reimbursements" breakdown modals
  listed the whole community's invoices even when the manager had an
  apartment (or status/client) filter applied; tiles and modals now read the
  same filtered list. Audited every clickable stat tile across invoices,
  payments, dashboard, reserve-fund, and community pages — this was the only
  mismatch.
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
- **Cascade community deletion (super-admin):** `DELETE /communities/{id}` —
  owned communities only, never your home community; removes every
  community-scoped document across 20 collections. Memberships are
  per-community docs, so the same email's memberships in OTHER communities
  survive by design. Deletion audited under the actor's home community with
  per-collection cascade counts. Portfolio cards get a delete action behind
  a type-the-name confirmation modal. 5 new tests (141 total).
- **Setup Assistant (guided community onboarding):** new `/setup` page —
  three plain-language steps (Add your flats → Who lives in each flat? →
  Who manages this community?) with progress bar and completion screen.
  One row per flat (owner name/email/phone, optional tenant) is sent to the
  new `POST /setup/residents` batch endpoint, which creates the household
  (account), whitelist user, and 100% legal-title record per flat in one
  call with per-row error reporting. `GET /setup/status` drives progress;
  the manager dashboard shows a "Finish setting up — n of 3 steps" card for
  incomplete communities; creating a community from the Portfolio now lands
  directly in the assistant. "Account" is presented as **Household**
  everywhere user-facing (Ownership page relabeled). 5 new tests (136).
- **Add Apartments UI (Ownership page):** bulk dialog (comma/line-separated
  unit numbers, floor auto-derived from the number, duplicate warnings,
  partial-failure reporting) — previously apartments only existed via the
  seed, leaving fresh communities impossible to populate from the UI. Plus
  an empty-state callout guiding the setup order (apartments → accounts →
  members).
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
