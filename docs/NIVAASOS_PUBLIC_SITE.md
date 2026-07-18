# NIVAASOS_PUBLIC_SITE.md — public marketing site for nivaasos.com

Status: **built, not deployed** (2026-07-18). Lives in `marketing/` as an
isolated Next.js app. Nothing in the existing frontend/backend was modified.

## 1. Why a separate app (architecture decision)

The existing frontend is deliberately client-rendered behind auth (D-005),
ships `robots.txt: Disallow /`, mounts the login page at `/`, and builds
with per-community branding ("Manikrishna Enclave"). None of that can serve
an indexable, SSR/SSG public site without weakening the app's posture. So:

- **nivaasos.com** → new `marketing/` app: fully static (all 24 routes
  prerendered), zero auth code, zero API access, its own Cloud Run service.
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

## 3. Lead capture — deliberate mailto design

No approved backend endpoint exists for public form submissions, and the
brief forbids fake/unsafe flows. `LeadForm` therefore validates locally and
opens the visitor's mail client with a structured message to
`CONTACT_EMAIL`; the UI states this plainly. **Follow-up plan** (owner
approval needed): add `POST /api/v1/public/leads` (rate-limited, captcha,
no auth, stores into a `leads` collection or the Growth Center CRM DB),
then swap `LeadForm` to fetch + success/duplicate/failure states.

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
8. Later (separate change): map app.nivaasos.com → existing frontend
   service + add domain to OAuth authorized origins; keep
   community.rajmanda.com working until users migrate.

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
- Lead forms are mailto-based pending an approved endpoint (§3).
- `/pricing` intentionally absent — no approved pricing exists.
- Mobile-app readiness items on the app side (refresh tokens, push
  registration, deep links) belong to M6, unchanged by this work.
