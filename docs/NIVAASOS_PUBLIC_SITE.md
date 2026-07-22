# NIVAASOS_PUBLIC_SITE.md — public marketing site for nivaasos.com

Status: **built, not deployed** (2026-07-18). Lives in `marketing/` as an
isolated Next.js app. Nothing in the existing frontend/backend was modified.

## 1. Why a separate app (architecture decision)

The existing frontend is deliberately client-rendered behind auth (D-005),
ships `robots.txt: Disallow /`, mounts the login page at `/`, and builds
with per-community branding ("Manikrishna Enclave"). None of that can serve
an indexable, SSR/SSG public site without weakening the app's posture. So:

- **nivaasos.com** → new `marketing/` app: fully static (all 24 routes
  prerendered), zero auth code, its own Cloud Run service. Its ONLY API
  call is the public lead-capture POST (§3) — no authenticated or
  community-data endpoints, ever.
- **Authenticated app** → unchanged at community.rajmanda.com. When the
  owner decides to serve it as **app.nivaasos.com**, that is a pure
  LB/DNS/cert addition — documented in §7; nothing in this phase touches it.
- Community workspaces (`/c/{slug}`) remain a future app-side feature; the
  master brief's model is compatible with today's community switching.

Benefits: strict public/private separation (the marketing bundle *cannot*
leak private data — it has no data path), independent deploys, SEO-correct
robots per host, and the app keeps its deny-all robots.txt.

## 2. What was built

- 19 indexable pages + robots.txt + sitemap.xml + llms.txt + custom 404.
- Every page: unique title/description, self-canonical, Open Graph, one H1,
  answer-first intro, breadcrumb (visible + BreadcrumbList JSON-LD),
  internal links with descriptive anchors, CTA.
- JSON-LD: Organization + WebSite (site-wide), SoftwareApplication (home),
  FAQPage (home + /faq — visible content only), AboutPage, ContactPage,
  BreadcrumbList. Validated (parse-checked) at build; no fabricated
  ratings/reviews/pricing.
- Fictional demo data only: **Greenwood Residency** (24 units, 21 paid, 3
  pending, 2 requests) in the dashboard/phone mocks. Build-output grep
  confirms no real community/resident names in any HTML.
- Accessibility: skip link, semantic landmarks, keyboard-usable menus with
  aria-expanded, `:focus-visible` rings, reduced-motion support, no-JS FAQ
  accordions (native `<details>`), labeled form fields with error states.
- Performance: fully static HTML, ~106 kB first-load JS, system font stack
  (no font downloads), no images (mocks are DOM), no third-party scripts.

### Page inventory / keyword & intent map

| Route | Primary intent / keywords |
|---|---|
| `/` | nivaasos, apartment community management platform |
| `/product` | what is Nivaasos, community operations platform |
| `/features` | apartment community management software features |
| `/community-accounting` | apartment association accounting, track maintenance fees, special assessments, divide expenses transparently |
| `/maintenance-management` | society maintenance tracking, work orders, vendor expenses |
| `/resident-portal` | resident maintenance portal, how does a resident portal work |
| `/apartment-communities` | move community off WhatsApp/spreadsheets, RWA software |
| `/property-managers` | property manager dashboard, manage multiple communities |
| `/nri-property-owners` | NRI monitor apartment in India remotely |
| `/mobile-app` | nivaasos mobile app, waitlist (accurate "planned" status) |
| `/how-it-works` | how to set up community management software |
| `/security` | community data protection (no unverified claims) |
| `/product-facts` | AI-friendly verifiable facts, dated availability statement |
| `/faq` | 12 real customer questions, FAQPage schema |
| `/about`, `/contact`, `/request-demo`, `/privacy`, `/terms` | brand/trust/lead-gen/legal |

Internal-linking: header/footer reach every page; each page ends with a
"Related" strip; body copy cross-links with descriptive anchors
(e.g. "community accounting software", "resident maintenance portal").

## 3. Lead capture — CRM endpoint with mailto fallback (2026-07-21)

Every CTA form (`LeadForm`, kinds demo/start/waitlist/contact) POSTs to the
app API's **public lead endpoint** — `POST /api/v1/public/leads`
(`backend/app/routers/public_leads.py`, no auth). Submissions become sales
prospects in the super admin's **Growth Center CRM**: a `growth_leads`
entry (`source: "website"`, tags `["website", <kind>]`, stage `new`, a
next-action so it surfaces in the follow-up tracker), a lead activity, a
growth audit entry, and a WhatsApp heads-up via the OpenClaw notification
queue. Abuse controls: hidden honeypot field (`website`) that fake-succeeds
without storing, per-IP (5/h) + global (200/h) in-memory rate limits,
strict field length caps, and a response body that leaks nothing
(`{"received": true}`).

There is deliberately NO mailto flow (owner decision 2026-07-22: never
open the visitor's mail app — we just want their information recorded).
If the endpoint is unreachable or errors, the form shows a retry message
with `CONTACT_EMAIL` as plain text; nothing else happens. This replaces
the earlier mailto design and is the ONE backend call the site makes;
everything
else remains fully static. **Deploy prerequisite ✅ done 2026-07-22:** the
backend's `CORS_ORIGINS` is set by Terraform (`infra/terraform/
cloud_run.tf`, overrides the code default) and now includes
`https://nivaasos.com` + `https://www.nivaasos.com` (applied + preflight
verified). The marketing site must be redeployed via deploy.yml with
`deploy_marketing=true` for form changes to reach nivaasos.com.

## 4. Crawler policy

`src/app/robots.ts` allows `*` plus explicit allows for search/user-directed
AI crawlers (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User).
**Training crawlers (GPTBot, ClaudeBot, Google-Extended): OWNER DECISION,
not yet made.** Currently they inherit `*` = allowed. To disallow, add
explicit `disallow` rules in robots.ts. Re-verify official crawler UA names
against vendor docs at deploy time. robots.txt is *not* a privacy control —
the private app relies on auth, not robots.

## 5. Configuration

| Env (build-time) | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://community.rajmanda.com` | Resident Login target; flip to app.nivaasos.com later |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `hello@nivaasos.com` | All contact/lead mailtos |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(unset)* | Same OAuth client as the app. When set, the Resident Login popup renders Google sign-in on nivaasos.com; unset = popup links to the app sign-in page |
| `NEXT_PUBLIC_LEADS_API_URL` | `https://community.rajmanda.com/api/v1/public/leads` | Public lead-capture endpoint (§3) — the only place CTA submissions go |

### Resident Login popup (2026-07-18)

Header/hero/final-CTA "Resident Login" buttons open a popup
(`src/components/ResidentLogin.tsx`) instead of navigating to the app's
login page (removes the extra hop). With `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
set, the popup renders the Google Identity Services button; on success it
forwards the Google ID token to the app as a URL **fragment**
(`{APP_URL}/#gcred=…` — fragments never reach a server or its logs). The
app's login page consumes the fragment once, scrubs it via
`history.replaceState`, and exchanges it through the existing
`/auth/google` endpoint. The sign-in flow itself makes **zero backend/API
calls from the marketing site** (the site's only API call is the public
lead-capture POST, §3) — the only external script is Google's
`gsi/client`, loaded only while the popup is open. Webview detection (WhatsApp/Instagram in-app
browsers) shows an "open in browser" note, mirroring the app's login page.
**Owner action before this works in prod:** add `https://nivaasos.com` to
the Google OAuth client's Authorized JavaScript origins and set
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the marketing build.

## 6. Before launch (owner checklist)

1. Contact mailbox: **interim = rajmanda@gmail.com** (owner decision
   2026-07-18, rendered site-wide). Later, create `hello@nivaasos.com`
   and switch the default in `marketing/src/lib/site.ts` (or set
   `NEXT_PUBLIC_CONTACT_EMAIL` at build time).
2. Review `/privacy` and `/terms` drafts (plain-language, honest, but not
   lawyer-reviewed).
3. Decide the training-crawler policy (§4).
4. Approve deployment (§7) — DNS + Terraform are owner-gated.
5. Optional: og-image (1200×630) — currently no image card; add
   `opengraph-image` later.

## 7. Deployment — infra APPLIED 2026-07-19; image deploy pending

Terraform applied (owner-requested; 5 added / 4 changed / 0 destroyed;
community.rajmanda.com verified serving before and after):
1. ✅ Cloud Run service `nivaasos-marketing` (asia-south1, min 0/max 2,
   frontend runtime SA, placeholder image, public invoker, image
   lifecycle-ignored per D-010) — `infra/terraform/marketing.tf`.
2. ✅ Separate managed cert `nivaasos-cert` (apex only — www.nivaasos.com
   has no DNS record yet; add DNS + cert domain together later). Existing
   `communityhub-cert` deliberately untouched: editing a managed cert's
   domain list forces replacement and would drop the app's TLS.
3. ✅ Shared LB reused: host rule `nivaasos.com` → path matcher
   `marketing` → `nivaasos-marketing-backend` (serverless NEG). No /api/*
   on this host; community.rajmanda.com rules unchanged. Both certs on
   `communityhub-https-proxy` (SNI selects). HTTP→HTTPS redirect is
   host-agnostic and already covers nivaasos.com.
4. ✅ DNS: A nivaasos.com → 34.120.210.248 (owner, 2026-07-19).
5. Found in shared project: pre-existing unattached cert `nivaasosdotcom`
   (ACTIVE, not created by us, not referenced anywhere) — left alone per
   D-009; owner may delete.
6. ✅ First image deployed manually 2026-07-19 (owner-requested): Cloud
   Build → `communityhub/nivaasos-marketing:manual-20260719` → revision
   00002 serving 100%. Site verified live on https://nivaasos.com (all
   routes, robots, sitemap, llms.txt, 404). **Pending:** deploy.yml
   `marketing` job so future releases ship via CI like the app.
7. Rollback: `gcloud run services update-traffic nivaasos-marketing
   --to-revisions=PREV=100` for releases; removing the host rule + cert
   from Terraform reverts routing without touching the app's resources.
8. **App domain transition (started 2026-07-19, owner decision:
   community.nivaasos.com, not app.nivaasos.com):** Terraform applied —
   `nivaasos-community-cert` + community.nivaasos.com added to the app's
   host rule (frontend + /api/*), CORS_ORIGINS covers both app domains.
   deploy.yml now bakes a RELATIVE API base (`/api/v1`) so the same
   frontend build works on both domains; login-page copy is host-agnostic.
   Marketing's Resident Login default → https://community.nivaasos.com in
   source, but the LIVE marketing site intentionally still points at
   community.rajmanda.com until cutover. **Owner actions required:**
   (a) ✅ DNS: A community.nivaasos.com → 34.120.210.248 (verified
   resolving + serving 2026-07-18); (b) Google OAuth client: add
   https://community.nivaasos.com AND https://nivaasos.com (for the
   Resident Login popup) to Authorized JavaScript origins — STILL PENDING
   (verified 2026-07-18: GSI "origin is not allowed" on
   community.nivaasos.com). deploy.yml's marketing job now bakes
   `NEXT_PUBLIC_APP_URL` = community.rajmanda.com (override via repo
   variable `MARKETING_APP_URL` at cutover) and
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = the shared `GOOGLE_CLIENT_ID` variable.
   **Cutover order once (a)+(b) done:** deploy frontend via deploy.yml
   (relative API base) → verify login on community.nivaasos.com → deploy
   marketing (login flips) → keep community.rajmanda.com serving until
   users migrate. **2026-07-22:** `MARKETING_APP_URL` repo variable set to
   `https://community.nivaasos.com` (cert ACTIVE, host serving) — Resident
   Login on nivaasos.com now targets community.nivaasos.com. Google
   sign-in there still depends on owner action (b): the OAuth client must
   list https://community.nivaasos.com and https://nivaasos.com as
   Authorized JavaScript origins.

## 8. Post-launch checklist

- Google Search Console: add property `nivaasos.com` (DNS TXT
  verification), submit `https://nivaasos.com/sitemap.xml`, URL-inspect `/`
  and 2–3 key pages, watch Coverage for errors.
- Bing Webmaster Tools: import from GSC or verify by DNS; submit sitemap.
- IndexNow: **deferred** — content changes only at deploy time; revisit if
  a blog/resources section ships. (Bing supports it; Google doesn't.)
- Validate structured data with Google Rich Results test on `/` and `/faq`.
- Lighthouse (mobile) on `/`: expect LCP well under 2.5s (static HTML, no
  images); verify CLS ≈ 0, INP fine (minimal JS).
- Confirm robots.txt + sitemap.xml serve correctly on the live domain; spot
  check `site:nivaasos.com` after a week.
- Verify community.rajmanda.com still serves deny-all robots.txt.
- Analytics decision (privacy-conscious; e.g. GSC-only at first) — owner.

## 9. Testing done locally (2026-07-18)

- `npx next build` clean: 24/24 routes prerendered static, type-check pass.
- Prerendered HTML contains full content (H1s, copy, nav) — no empty shell.
- All JSON-LD blocks parse as valid JSON (scripted check over built HTML).
- Grep over built HTML: no "Manikrishna/Mani Krishna", no resident/owner
  names from the operational community.
- robots.txt and sitemap.xml outputs inspected (contents in §4, all 19
  canonical URLs present, no private routes).

## 10. Known gaps / next phase

- No resources/guides section yet (`/resources`, `/guides`) — planned as a
  content phase; the FAQ carries question-intent for now.
- No og-image; no llms.txt automation (keep in sync manually when pages
  change — it lives at `marketing/public/llms.txt`).
- Lead forms POST to the Growth Center CRM via the public endpoint, with
  mailto fallback (§3). No captcha yet — honeypot + rate limits only;
  revisit if spam appears. Rate limits are in-memory (single Cloud Run
  instance assumption).
- `/pricing` intentionally absent — no approved pricing exists.
- Mobile-app readiness items on the app side (refresh tokens, push
  registration, deep links) belong to M6, unchanged by this work.
