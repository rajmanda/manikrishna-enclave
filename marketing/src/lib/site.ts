/**
 * Single source of truth for public site facts. Everything here is rendered
 * into visible copy and structured data — keep it accurate. Never add
 * private application data, community names, or resident information.
 */

export const SITE_NAME = "Nivaasos";
export const SITE_URL = "https://nivaasos.com";

/** Authenticated application (Resident Login target). Do NOT redeploy the
 * marketing site with this default until community.nivaasos.com has DNS +
 * an ACTIVE cert + the OAuth origin registered — the live site keeps its
 * previously-baked URL until then. Override via NEXT_PUBLIC_APP_URL. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://community.nivaasos.com";

/** Google OAuth client ID — the SAME client the resident app uses. When set
 * (and nivaasos.com is added to that client's authorized JavaScript
 * origins), the Resident Login popup renders Google sign-in directly and
 * hands the credential to the app, skipping the app's login page. When
 * unset, the popup falls back to linking to the app's sign-in page. */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/** Public contact mailbox. Interim: the owner's Gmail until a
 * hello@nivaasos.com mailbox exists — then change this one default (or set
 * NEXT_PUBLIC_CONTACT_EMAIL). See docs/NIVAASOS_PUBLIC_SITE.md. */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "rajmanda@gmail.com";

/** Public lead-capture endpoint (POST, no auth) on the app's API — the ONE
 * backend call the marketing site makes. CTA forms submit here so leads
 * land in the Growth Center CRM; on any failure the form falls back to the
 * mailto flow. Set to an empty string to disable and go mailto-only. */
export const LEADS_API_URL =
  process.env.NEXT_PUBLIC_LEADS_API_URL ??
  "https://community.rajmanda.com/api/v1/public/leads";

export const TAGLINE = "One transparent home for your entire community.";

export const DESCRIPTION =
  "Nivaasos is a community operations and transparency platform that helps apartment communities manage maintenance fees, expenses, payments, maintenance requests, work orders, documents, and resident communication in one secure system.";

/** Product-status line reused on /product-facts, /mobile-app and llms.txt.
 * Update it whenever real availability changes. */
export const AVAILABILITY_STATEMENT =
  "As of July 2026, Nivaasos provides a responsive web experience that works on desktop, tablet, and mobile browsers. Native Android and iOS applications are planned but are not yet available in application stores.";

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_PRODUCT: NavLink[] = [
  { label: "Product overview", href: "/product" },
  { label: "Features", href: "/features" },
  { label: "Community accounting", href: "/community-accounting" },
  { label: "Maintenance management", href: "/maintenance-management" },
  { label: "Resident portal", href: "/resident-portal" },
  { label: "Mobile app", href: "/mobile-app" },
];

export const NAV_SOLUTIONS: NavLink[] = [
  { label: "Apartment communities", href: "/apartment-communities" },
  { label: "Property managers", href: "/property-managers" },
  { label: "NRI property owners", href: "/nri-property-owners" },
];

export const NAV_COMPANY: NavLink[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Product facts", href: "/product-facts" },
  { label: "Security", href: "/security" },
  { label: "FAQ", href: "/faq" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const NAV_LEGAL: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

/** Every indexable public page, used by sitemap.ts. Keep in sync when
 * adding or removing pages. Private/app routes must never appear here. */
export const PUBLIC_ROUTES: string[] = [
  "/",
  "/product",
  "/features",
  "/how-it-works",
  "/community-accounting",
  "/maintenance-management",
  "/resident-portal",
  "/apartment-communities",
  "/property-managers",
  "/nri-property-owners",
  "/mobile-app",
  "/security",
  "/product-facts",
  "/faq",
  "/about",
  "/contact",
  "/request-demo",
  "/privacy",
  "/terms",
];

export function canonical(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}
