# UX_REVIEW.md — CommunityHub Design Review

**Reviewer role:** Lead Product Designer / UX / Frontend Architect / Creative Director
**Date:** 2026-07-06 · **App version:** 0.11.0 · **Reviewed at:** localhost:3000
**Method:** Full source review of the component library (`ui.tsx`, `globals.css`,
`tailwind.config.ts`, `AppShell`, `nav`) + live walkthrough of Login, Manager
Dashboard, Invoices, and the global loading state. Remaining routes assessed from
source (they all consume the same primitives, so the diagnosis generalizes).

> This is an honest, senior-level critique. It is deliberately not polite. The
> product is **competent and coherent** — well above average for an internal tool —
> but it currently reads as a *generic admin dashboard*, not a *commercial SaaS
> product a customer would pay for*. The gap to Stripe/Linear/Vercel is real and
> specific, and it is closable.

---

## Current UI Score

Scores are `current → target`. Current is an honest baseline; target is the bar
for this engagement.

```
Landing Page (login-as-landing)   4.5 → 9.5
Manager Dashboard                 6.5 → 9.5
Owner Dashboard                   6.3 → 9.4
Invoices / Payments               6.8 → 9.4
Work Orders                       6.0 → 9.3
Community Feed / Polls            6.0 → 9.3
Documents / Reports               6.2 → 9.2
Settings / Members                5.8 → 9.2
Mobile                            5.8 → 9.4
Dark Mode                         0.0 → 9.0   (does not exist)
Empty / Loading / Error states    5.0 → 9.3
```

### Per-criterion scorecard (whole product, current baseline)

| Criterion | Score | One-line verdict |
|---|---|---|
| Visual Design | 6 | Clean but anonymous; no point of view. |
| Typography | 5 | One weight jump does all the work; no real type scale, tracking, or rhythm. |
| Spacing | 6 | Safe and consistent, but timid — huge dead zones on desktop, no density control. |
| Color Palette | 5 | Indigo + 6 semantic tints used inconsistently; no neutral system, no surfaces. |
| Information Hierarchy | 6 | Titles read; everything below flattens into equal-weight grey. |
| Accessibility | 5 | Focus states inherited from browser; contrast on `slate-400` text fails AA. |
| Consistency | 7 | The one genuine strength — primitives are reused well. |
| Modern Feel | 5 | 2020-era Tailwind starter aesthetic. |
| Trust / Premium | 4 | Reads as an internal tool, not a product with a price tag. |
| Conversion (landing) | 3 | There is no landing page — the root is a login form. |
| Usability | 7 | Genuinely usable; navigation is legible and role-aware. |
| Mobile Experience | 6 | Responsive, but it's a shrunk desktop, not a designed mobile app. |
| Navigation | 6 | 16-item flat sidebar; no grouping, no hierarchy, no active-state polish. |
| Performance | 7 | Light bundle (no animation lib yet); charts render eagerly, no lazy split. |
| Animation | 3 | One `rise` keyframe. No page transitions, no micro-interactions. |
| Delight | 2 | None. Nothing rewards attention or signals craft. |

**Composite: ~6.4 / 10** — a solid B-minus internal tool. The target is a
product that makes you think *"this was built by Stripe."*

---

## Brutal critique, page by page

### 1. Landing / Login — 4.5
There is **no landing page**. The root route renders a login card. For a
multi-tenant SaaS with a public domain (`community.rajmanda.com`), that is the
single biggest miss: a prospect who lands on the domain sees a padlock, not a
pitch. The login card itself is fine — centered, gradient wash, feature chips —
but it's a *sign-in screen doing a landing page's job*. No hero, no product
preview, no proof, no story, no CTA hierarchy, no footer. Conversion potential: near zero.

### 2. Manager Dashboard — 6.5
Structurally sound, emotionally flat. Problems:
- **Charts look broken.** Collection Rate and Reserve Fund Trend render as empty
  gridlines — either no data or invisible series. A near-empty chart is worse
  than no chart; it signals "this feature doesn't work."
- **Whitespace is undirected.** The cash-flow card is ~700px tall for a 6-bar
  chart. Density is far too low; the screen feels 40% empty.
- **Stat cards are inert.** Uppercase grey label, big number, grey hint. No
  trend arrow, no sparkline, no delta, no color logic tying value to meaning.
- **No hierarchy of importance.** "Outstanding ₹12,700" (money owed — the thing
  a manager cares about most) has the exact same visual weight as "Reserve Fund."
- **The violet "payable to you" banner** is a good idea executed as a flat bar;
  it should be a distinct, ownable module.

### 3. Invoices / Payments — 6.8
The best surface. The dual "Community funds / Personal" summary cards are a
genuinely smart bit of information design. But:
- The list is **9 identical rows of grey** — no zebra, no grouping affordance
  beyond the "Jul 2026" header, no hover depth, no leading visual (icon/avatar).
- Status pills (`paid`/`due`) are tiny and low-contrast; `due` should shout.
- Filter row (Client / Apartment / Status / Ledger) is four look-alike dropdowns
  with no applied-filter feedback.
- The grid/table toggle top-right is undiscoverable (two 16px icons).

### 4. Work Orders — 6.0
Lifecycle is rich (Reported → … → Closed) but the source shows it rendered as
list rows + badges. A staged workflow this good deserves a **visual pipeline /
kanban or a timeline**, not text. Huge upside here.

### 5. Feed / Polls / Documents / Meetings — ~6.0
All consume the same `Card` + `Badge` + list-row pattern. They're consistent,
which is good, and interchangeable, which is the problem — nothing about the
Feed *feels* social, nothing about Documents *feels* like a vault. Same grey
card, different nouns.

### 6. States — 5.0
- **Loading** is a bare centered spinner + "Loading…". No skeletons. Every
  navigation flashes an empty screen then pops content — the cheapest-feeling
  moment in the app.
- **Empty** is a single grey line of text in a card. No illustration, no CTA, no
  guidance. A missed onboarding opportunity on every list.
- **Error** is a red card with "Try again" — functional, unbranded.

### 7. Mobile — 5.8
Responsive via bottom tab bar (good instinct) but it's the desktop UI reflowed.
No FAB, no swipe actions on list rows, no sheet-based navigation, no responsive
type scale, touch targets on filter chips and icon toggles are below 44px.

---

## Measured against the benchmarks

| Product | What they do that this doesn't |
|---|---|
| **Stripe** | Money data *reads* — tabular numerals, right-aligned currency, trend deltas, restraint. Here numbers are proportional-width and left-drifting. |
| **Linear** | Ruthless density + speed + keyboard-first + buttery transitions. Here: low density, mouse-only, no transitions. |
| **Vercel** | Confident black/white neutrals + one accent; deep empty states. Here: indigo-on-slate with weak neutrals and thin empty states. |
| **Notion** | Every surface has a personality. Here every surface is the same card. |
| **Superhuman/Raycast** | Micro-interactions and motion make it feel alive. Here it's static. |
| **Apple** | Type as hierarchy; generous but *purposeful* space. Here space is undirected. |

---

## Root-cause diagnosis (why it feels generic)

1. **No type scale.** `text-xs/sm/base/xl/2xl` + `font-semibold/bold`. No display
   sizes, no tracking, no tabular numerals for money. Typography is doing none of
   the hierarchy work.
2. **Weak neutral + surface system.** `slate-50` bg, `white` cards, `slate-200`
   borders. No layered surfaces, no elevation language, no dark mode tokens.
3. **Accent monoculture.** Indigo used for brand, links, focus, avatars, and
   active nav — so nothing is emphasized because everything is.
4. **No motion system.** Framer Motion isn't installed; there are no transitions,
   so the app never feels responsive to the user.
5. **Density is one-size.** No compact/comfortable modes; desktop wastes space,
   mobile just shrinks.
6. **States are afterthoughts.** Loading/empty/error are the 20% that signals the
   other 80% is trustworthy — and they're the weakest part.

---

## Design Improvement Plan

### 🔴 Critical (do first — highest impact/effort ratio)
- **Design token layer** — real type scale (display→caption), neutral ramp,
  surface/elevation tokens, semantic color roles, radius + shadow scale, motion
  tokens. Wire into `tailwind.config.ts` + CSS variables (enables dark mode).
  *Effort: M.*
- **Upgrade core primitives** (`Card`, `Stat`, `Badge`, `Button`, table row,
  `PageTitle`) to the new system — every page inherits the lift for free.
  *Effort: M.*
- **Skeleton loaders** replacing the spinner; **rich empty states** with icon +
  copy + CTA; branded error state. *Effort: S–M.*
- **Real landing page** at a public route (hero, product preview, features,
  proof, pricing, FAQ, CTA, footer). *Effort: L.*

### 🟡 Important
- **Dashboard redesign** — hero metric row with deltas/sparklines, fix charts,
  "Today's work" + activity feed + collections + reserve modules, real hierarchy.
  *Effort: L.*
- **Motion system** (Framer Motion): page/route transitions, card & button
  hover, list stagger, toast, sidebar. Respect `prefers-reduced-motion`. *Effort: M.*
- **Work Orders pipeline** visualization. *Effort: M.*
- **Navigation grouping** (Overview / Money / Operations / Governance / Admin) +
  polished active state. *Effort: S.*
- **Money typography** — tabular numerals + right alignment across invoices,
  payments, dashboard. *Effort: S.*

### 🟢 Nice to have
- Dark mode toggle in the shell. Command palette (⌘K) upgrade of global search.
  Mobile FAB + swipe actions. Chart polish (gradients, rounded bars, tooltips).
  Confetti/success micro-moments on payment recorded.

---

## Design System (target spec)

Full tokens live in the implementation (`globals.css` CSS variables +
`tailwind.config.ts`). Summary:

- **Type scale:** `display-lg 44/48`, `display 34/40`, `h1 28/34`, `h2 22/28`,
  `h3 18/24`, `body 15/24`, `sm 13/20`, `caption 12/16`. Inter + tabular-nums
  utility for currency. Tighter tracking on display sizes.
- **Neutrals:** 12-step ink ramp (not raw slate) for text/border/surface, tuned
  for both light and dark.
- **Surfaces / elevation:** `surface-0/1/2` + `shadow-xs/sm/md/lg` mapped to
  subtle, layered shadows (Linear-style, not material drop shadows).
- **Color roles:** `brand` (indigo, kept), plus semantic `success/warning/
  danger/info` each with `-subtle/-fg` pairs; accent reserved for true emphasis.
- **Radius:** `sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / full`.
- **Motion:** durations `fast 120 / base 200 / slow 320`; easing
  `standard cubic-bezier(.2,.8,.2,1)`; standard variants for fade-rise, stagger.
- **Components:** Card, Button (primary/secondary/ghost/danger + sizes), Badge,
  Stat (with delta + sparkline slot), Table/row, Input/Select, Dialog/Sheet,
  Toast, Skeleton, EmptyState, ErrorState, Tabs, Avatar, ProgressBar.
- **A11y:** visible `:focus-visible` ring token, AA contrast minimums, 44px min
  touch targets, reduced-motion fallbacks.

---

## Remaining Issues
_(updated each iteration)_
- Charts render empty on the dashboard — needs data/series fix, not just styling.
- No landing page exists.
- No dark mode.
- No skeleton/loading system.
- Framer Motion not installed.
- Money not typeset as money (no tabular numerals / alignment).
- Empty & error states are thin.
- Navigation is a flat 16-item list.

## Next Improvements
1. Land the token layer + primitive upgrade (Critical).
2. Skeletons + empty/error states.
3. Landing page.
4. Dashboard redesign + chart fix.
5. Motion system.
6. Roll system across remaining routes; re-screenshot; re-score.

## Iteration 1 — Foundation + Dashboard (2026-07-06)

**Shipped (local, not yet pushed — awaiting owner confirmation per CLAUDE.md):**
- **Token layer:** `tailwind.config.ts` now carries a real type scale
  (`display-lg/display/display-sm/2xs`), layered low-opacity shadow scale
  (`xs→lg` + `brand-glow`), surface/hairline CSS-variable colors (dark-mode
  ready), motion easing token, and shimmer/fade-rise keyframes.
- **`globals.css`:** surface variables, a single app-wide `:focus-visible` ring
  (accessibility), a `.tabular` numerals utility for money, reduced-motion guards.
- **Primitives (`ui.tsx`), all backward-compatible:** new `Button`
  (primary/secondary/ghost/danger × sm/md), `Skeleton` + `SkeletonCard`, a
  skeleton `PageLoading variant="stats"`, richer `EmptyState` (icon + copy +
  CTA), `Stat` gains optional `delta` pill + left `accent` bar + tabular
  numerals, gradient `Avatar`, animated `ProgressBar`, polished `SectionHeader`.
- **Motion system (`motion.tsx`):** `Stagger`, `FadeIn`, `Pressable` — all
  `prefers-reduced-motion` aware (Framer Motion installed).
- **Manager Dashboard:** brand eyebrow + display title + "Live from the API"
  status pill, hero stat row with colour-coded accent bars and staggered
  entrance, skeleton loading instead of a bare spinner.

**Verification:** `tsc --noEmit` clean (0 errors); live dev-server render
confirmed via browser (skeleton → loaded, accent bars, tabular numerals, motion
all correct). Full `next build` was starved on the sandbox CPU; types are sound
and the running dev server hot-reloaded successfully.

## Iteration 2 — Landing page (2026-07-06)

**Shipped (local, not yet pushed):** a full marketing landing page at the new
public route **`/home`** (`src/app/home/page.tsx`) — sticky glass nav, gradient
hero with an animated dashboard preview mockup, a stats trust bar, a 6-card
feature grid, testimonials, three-tier pricing (with a highlighted plan), an
accordion FAQ, a dark closing-CTA panel and a footer. Built on the iteration-1
tokens; all CTAs route to the existing sign-in (`/`), so the auth flow is
untouched. Promoting `/home` to the domain root is a small, separate change
(relocate the login form to `/login`, point `/` at the landing) — left for owner
approval so nothing about sign-in breaks unreviewed.

**Robustness fix (worth calling out):** the first cut used Framer's
`opacity:0 → 1` entrance on the hero. In a **backgrounded tab** (and with JS
disabled, or reader mode) `requestAnimationFrame` is paused, so the entrance
never runs and the hero stayed invisible. Fixed by making all entrances
**transform-only** (opacity never leaves 1) and converting the scroll reveals to
an `IntersectionObserver` that only *adds* motion — content is now guaranteed
visible with or without JS. This is exactly the "never sacrifice usability for
aesthetics" rule in practice.

**Verification:** `tsc --noEmit` clean; live render of hero, feature grid and
FAQ confirmed in-browser.

## Iteration 3 — Invoices + Work Orders (2026-07-06)

**Shipped (local, not yet pushed):**
- **Work Orders:** a compact 7-step **lifecycle pipeline** on every card
  (Reported → … → Closed) — filled brand while open, emerald once done, with a
  "Step N of 7 · Stage" caption, so status reads at a glance without parsing
  text. Plus staggered card entrance, hover lift, a list-shaped skeleton loader,
  tabular cost figures, and the shared `Button`.
- **Invoices:** money now typeset as money — `tabular` numerals on the summary
  cards and every list-row amount, so columns of currency line up. The page also
  inherited the upgraded `Card`/`Stat`/`Badge`/`PageTitle` for free.

**Verification:** `tsc --noEmit` clean; live render confirmed — pipeline shows
"Step 7 of 7 · Closed" (all emerald) and "Step 3 of 7 · Owner Approval" (3 brand
segments) correctly.

## Iteration 4 — Navigation shell (2026-07-06)

**Shipped (local, not yet pushed):** the flat 16-item sidebar is now grouped into
**Overview / Money / Operations / Governance / Admin** (`nav.ts` gains a `group`
field + `groupedNavItems()`), with section labels and a redesigned active state —
brand pill, a left accent bar, a brand-tinted icon and semibold label, plus
`aria-current="page"` for screen readers. Inactive icons are muted and lift on
hover. Role scoping and mobile bottom-bar behaviour are unchanged.

**Verification:** `tsc --noEmit` clean; live render confirms all five groups and
the active-state treatment.

## Iteration 5 — App-wide page transitions (2026-07-06)

**Shipped (local, not yet pushed):** the shared `(app)/layout.tsx` now wraps page
content in a route-keyed `.animate-enter` container, so **every** authed route
gets a subtle transform-only rise on navigation — one file, lifts all 17 pages'
perceived polish. Transform-only means it's still always-visible (no blank-tab
risk). Verified live: Invoices renders with grouped nav, tabular money and the
entrance, with no regressions from the shared-layout change.

## Score movement

```
Landing Page        4.5 → 9.0
Navigation shell    6.0 → 8.8   (grouped sidebar, polished active state, a11y)
Page transitions    3.0 → 8.5   (route-keyed entrance across every page)
Work Orders         6.0 → 8.3   (visual pipeline, motion, skeleton, tabular)
Invoices            6.8 → 8.0   (tabular money, inherited primitive lift)   (new /home: hero, preview, features, pricing, FAQ, CTA)
Manager Dashboard   6.5 → 7.8   (hierarchy, motion, skeletons, money type)
Loading states      5.0 → 8.5   (real skeletons replace bare spinner)
Empty states        5.0 → 7.5   (icon + copy + CTA scaffold in place)
Shared primitives   —   → lifts every one of the 17 routes for free
```
Target 9.5 needs the remaining iterations (charts, landing page, nav grouping,
per-page rollout).

## Screenshots — Before / After

| Surface | Before | After |
|---|---|---|
| Manager Dashboard | Flat title, inert stat cards, bare-spinner load | Eyebrow + display title, accent-bar hero stats, tabular money, staggered motion |
| Loading state | Single centered spinner | Layout-matched shimmer skeleton grid |
| Login / Landing | ✅ captured (iteration 0) | pending (landing page not yet built) |
| Invoices | ✅ captured (iteration 0) | pending (inherits primitive lift) |

## Design Decisions
_(append-only log)_
- **2026-07-06 — Iteration 0 (audit):** Established baseline scores and root-cause
  diagnosis. Decided the highest-leverage first move is a token + primitive layer
  (not per-page redesigns), so every route inherits the upgrade. Kept indigo brand
  hue (equity + already wired) but rebuilt neutrals, surfaces, type, and motion
  around it. Landing page to be added as a new public route rather than reworking
  the login card into double duty.
- **2026-07-06 — Iteration 1 (foundation + dashboard):** Made all primitive
  changes strictly additive (optional props) so the other 16 routes keep
  compiling untouched — de-risks the rollout. Chose skeletons over spinners
  everywhere as the single cheapest credibility win. Deferred full dark-mode
  conversion (touches every hardcoded `slate/white` class across 17 routes) to a
  dedicated iteration; shipped the token scaffolding for it now.
- **Data bug surfaced, not styling:** the dashboard's Cash Flow / Collection Rate
  / Reserve Fund charts render axes but **no series** — the `/finance/monthly`
  and reserve data appear to return zeros/empty for this view. This is a backend/
  data issue to fix before chart *styling* matters. Flagged; not chased in this
  iteration.
