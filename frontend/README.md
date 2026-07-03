# CommunityHub — Frontend

Mobile-first community management UI built per the CommunityHub PRD.
First customer: **Mani Krishna Enclave** (seed data only — the app itself is
multi-tenant and community-agnostic; every record is keyed by `communityId`).

**Stack:** Next.js (App Router) · React · TypeScript · TailwindCSS · Recharts

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

Docker (Cloud Run-ready, listens on `$PORT`, default 8080):

```bash
docker build -t communityhub-frontend .
docker run -p 8080:8080 communityhub-frontend
```

## What's implemented (Phase 1 UI + module screens)

| Area | Route | Notes |
|---|---|---|
| Login | `/` | Google OAuth entry point (backend wiring pending) |
| Dashboard | `/dashboard` | Role-aware: Owner view and Manager view with cash-flow, collection % and reserve-fund charts |
| Community (HOA page) | `/community` | Financial summary, expense breakdown pie, expense ledger with split details, apartment directory |
| Work Orders | `/work-orders`, `/work-orders/[id]` | 7-stage timeline (Reported → Closed), priority, vendor, estimate/final cost, photos, owner comments |
| Maintenance | `/maintenance` | Private vs community requests, report-issue bottom sheet |
| Feed | `/feed` | Announcements/questions/suggestions, pinned posts, reactions, comments |
| Polls | `/polls` | Open/closed polls, vote UI, turnout and percentages |
| Invoices | `/invoices` | Owner sees own invoices with Pay button; manager sees all; statement/CSV actions |
| Payments | `/payments` | Manager/auditor only — receipts with method and reference |
| Meetings | `/meetings` | Agenda, attendance, resolutions, PDF/audio links |
| Documents | `/documents` | Category filter + search, version badges |
| Vendors | `/vendors` | Manager/auditor only — ratings, GST, AMC expiry |
| Reserve Fund | `/reserve-fund` | Balance trend chart + monthly history |
| Reports | `/reports` | Monthly/quarterly/yearly report catalog with PDF/CSV actions |
| Global search | top bar | Searches apartments, owners, vendors, invoices, work orders, documents, minutes, expenses |

## Mobile-first design

- Bottom tab bar (Dashboard / Community / Feed / Work Orders / More) on phones;
  persistent sidebar on `lg+` screens.
- Bottom-sheet dialogs, horizontally scrollable filter chips, safe-area insets.
- Stat grids collapse 4→2 columns; all lists are single-column cards on mobile.

## Backend wiring

The app authenticates against the FastAPI backend (`NEXT_PUBLIC_API_URL`,
default `http://localhost:8000/api/v1`) and stores the session JWT in
localStorage. Copy `.env.example` to `.env.local` to configure.

- **Sign-in:** the Google button renders once `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  is set. In dev, quick-login buttons impersonate seeded users (Vishnu /
  Owner 502 / Auditor) via the backend's `/auth/dev-login`; hide them with
  `NEXT_PUBLIC_ENABLE_DEV_LOGIN=false`.
- **Live from the API:** dashboards (aggregates + charts), community page,
  work orders, invoices, payments, vendors, reserve fund, reports chart.
  Owners are scoped server-side to their own invoices/payments.
- **Still seed data** (`src/lib/data.ts`) until their backends land in
  Phase 3/4: feed, polls, maintenance requests, documents, meetings,
  notifications, global search.
- Key files: `src/lib/api.ts` (client), `src/hooks/useApi.ts` (fetch hook),
  `src/context/AuthContext.tsx` (session).

## Roadmap (per PRD)

Phase 2: live invoices/payments/statements APIs · Phase 3: work-order
mutations, vendor CRUD · Phase 4: documents/polls/notifications backends ·
Phase 5: AI features and mobile app (APIs are already shaped for it).
