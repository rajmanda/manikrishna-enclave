# Growth Center — Super Admin business-development workspace

An internal strategy-and-copywriting module for the SaaS operator: B2B
marketing strategy, lead magnets, qualification questions, outreach and
follow-up sequences, objection-handling scripts, and pilot-pricing
positioning for selling the platform to Hyderabad property managers.

It is **not** part of property-management operations and is invisible to
owners, tenants, property managers, vendors, community admins and auditors.

## Security boundary (the design priority)

**Isolation rule:** the Growth Center never reads, writes, references or
aggregates operational data — no communities, apartments, users, invoices,
payments, expenses, work orders, documents, notifications, ledgers, reports
or statistics. The only things it takes from the main application are:

1. The authenticated user's identity and server-verified role
   (`app/core/security.py` — the single approved backend import).
2. Shared visual components on the frontend (`ui.tsx`, `Modal.tsx`,
   `AuthContext` for identity/role).

Enforcement:

- **Backend package** `backend/app/growth_center/` — own settings, own Motor
  client, own Pydantic models, own audit trail. A static test
  (`tests/test_growth_center.py::test_growth_center_never_imports_operational_code`)
  fails the suite if any file in the package imports operational code.
- **Dedicated database** via `GROWTH_CENTER_MONGO_URI` (+ optional
  `GROWTH_CENTER_DB_NAME`, default `growth_center`). Collections:
  `growth_playbooks`, `growth_templates`, `growth_personas`,
  `growth_audit_log`. If the variable is unset every endpoint returns
  **503 with a configuration message — there is no fallback** to the
  operational connection.
- **API namespace** `/api/super-admin/growth-center` (outside `/api/v1`).
- **Authorization**: every endpoint depends on `require_super_admin`, which
  re-loads the user from the whitelist per request (browser-supplied roles
  are never trusted). Non-super-admin → `403`; unauthenticated → `401`.
- **Frontend**: nav item appears only for `super_admin` (nav.ts role
  filter); the pages are wrapped in `SuperAdminGate`, which renders an
  access-denied card and fires **no** Growth Center API calls for other
  roles. The module has its own fetch client (`api.ts`) and hook
  (`useGrowth.ts`) — it does not use `src/lib/api.ts` or `src/hooks/useApi.ts`.
- **Audit**: playbook/template/persona create-edit-approve-archive-restore,
  copies and exports are recorded in `growth_audit_log` **inside** the
  Growth Center database; the operational `audit_log` is untouched.
- **No outbound integration**: no send buttons, no Gmail/WhatsApp/CRM sync,
  no owner/tenant imports. AI generation is not wired up yet; when added it
  must use only content typed into this module (no operational data in
  prompts) via a server-side abstraction.

## Configuration

```bash
# backend/.env
GROWTH_CENTER_MONGO_URI=mongodb+srv://…   # dedicated DB (same cluster OK, different db name)
GROWTH_CENTER_DB_NAME=growth_center       # optional, default shown
```

Unset ⇒ the UI shows a configuration error card; the API returns 503.

Local dev: the frontend uses a relative `NEXT_PUBLIC_API_URL` proxied by
Next.js rewrites, so `next.config.ts` also proxies
`/api/super-admin/growth-center/*` to the local backend. In production the
load balancer routes `/api/*` to the backend before Next sees it, which
covers this namespace too.

## Feature summary

- Route `/super-admin/growth-center` (nav: **Super Admin → Growth Center**),
  plus `/super-admin/growth-center/playbook/[id]` editor.
- Overview stats (module data only): playbooks, outreach templates,
  objection responses, draft/approved counts, personas, last edited.
- Tabs: Market Strategy · Acquisition Funnel · Outreach Sequences ·
  Post-Demo Follow-Up · Objection Handling · Pilot & Pricing ·
  Saved Playbooks · Settings (config + personas + module audit trail).
- Content lifecycle: Draft → Under Review → Approved → Archived; rename,
  duplicate (playbook duplication also copies its templates), one-level
  restore of the previous save, created/updated timestamps.
- Copy single messages or whole sequences to the clipboard (copies are
  audit-logged); export a playbook as Markdown, plain text or JSON.
- Search and filters scoped strictly to Growth Center content.
- Default seeded content: the **Hyderabad Property-Manager Acquisition
  Playbook** (market strategy, 7 lead magnets, qualification framework,
  micro-conversion path, pilot/pricing positioning), 14 outreach/follow-up
  templates across WhatsApp/email/LinkedIn/Facebook, 10 objection-handling
  scripts, and 3 marketing personas. Seeding is idempotent
  (`gpb-default-hyderabad`) and happens lazily on first super-admin access.

## Leads CRM (`/super-admin/growth-center/crm`)

A lightweight CRM for the operator's own sales prospects (property
managers/agencies to sell the platform to). Same boundary: super-admin
only, stored in `growth_leads` / `growth_lead_activities` inside the
Growth Center database. These prospects are unrelated to the operational
`leads` collection (inbound app signups) and never touch it.

- **Pipeline**: new → contacted → responded → qualified → demo_scheduled →
  demo_done → pilot_proposed → won / lost (lost requires a reason; the
  first logged outreach auto-advances new → contacted).
- **Follow-up tracker**: every lead carries `next_follow_up_at` +
  `next_action`; overview counts overdue / due-today / due-this-week /
  unscheduled; list filters by due bucket; logging an activity can
  reschedule the next follow-up in the same call. Full per-lead activity
  timeline (call/WhatsApp/email/meeting/demo/proposal/stage changes).
- **Discovery (Firecrawl)**: `POST /crm/discover` sends ONLY the
  operator-typed query (e.g. "property management services Gachibowli
  Hyderabad contact") to Firecrawl's search API, scrapes the public
  results, and regex-extracts Indian phone numbers and emails into
  candidates for human review; `POST /crm/import` stores the selected
  ones, deduplicating on website domain / phone / email.
  **LinkedIn/Facebook/Instagram results are skipped** — both platforms
  prohibit scraping; leads found there are added manually with the
  matching source tag. Requires `FIRECRAWL_API_KEY` (503 without it; the
  rest of the CRM works regardless). No application data is ever sent to
  Firecrawl.

## Tests

`backend/tests/test_growth_center.py` (17 tests): super-admin access; 403
for property manager, owner, auditor, tenant, community admin and
cross-community manager; 401 unauthenticated and for forged tokens; 503
without configuration **and** proof the operational DB is untouched by the
attempt; full CRUD/search/export exercise with operational-collection
fingerprint unchanged; search/export leak checks against seeded operational
identifiers; default-content assertions; restore-previous-version; audit
trail confined to the growth DB; static import-boundary and
operational-reference scans of the package source.
