import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import PhoneMock from "@/components/PhoneMock";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { APP_URL, canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Resident portal — invoices, requests & notices for residents",
  description:
    "How does a resident portal work? Nivaasos gives residents and tenants a secure sign-in to view invoices and balances, submit maintenance requests with photos, receive notices, and access permitted community documents.",
  alternates: { canonical: canonical("/resident-portal") },
};

export default function ResidentPortalPage() {
  return (
    <>
      <PageHero
        eyebrow="Resident portal"
        title="A clear, simple portal for every resident"
        answer="A resident portal gives each resident a secure, personal view of community life: their invoices and balances, their maintenance requests, community notices, and permitted documents. In Nivaasos, residents sign in with their existing Google account — no new password to remember — and see exactly what concerns them."
        breadcrumb={{ label: "Resident portal", path: "/resident-portal" }}
      />

      <Block>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-pine-950 sm:text-3xl">
              What residents can do
            </h2>
            <div className="mt-6">
              <CheckGrid
                cols={2}
                items={[
                  "See invoices, balances, and due dates at a glance",
                  "Report a payment and get a receipt once confirmed",
                  "Submit maintenance requests with photos",
                  "Follow a request's progress to completion",
                  "Read announcements and community notices",
                  "Access permitted community documents",
                  "Understand community expenses and the reserve fund",
                  "Vote in community polls — one vote per apartment",
                ]}
              />
            </div>
            <p className="mt-8 text-sm leading-relaxed text-pine-800/90">
              Owners get a superset of this view, including apartment-level
              ledgers and statements — see{" "}
              <Link
                href="/nri-property-owners"
                className="font-semibold text-pine-700 hover:underline"
              >
                remote oversight for owners
              </Link>
              . Already a member of a Nivaasos community?{" "}
              <a
                href={APP_URL}
                className="font-semibold text-pine-700 hover:underline"
              >
                Sign in here
              </a>
              .
            </p>
          </div>
          <PhoneMock />
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Privacy by design",
          title: "Residents see their own records — and only their own",
          lede: "Authorization is enforced on the server for every request. A resident's sign-in shows their apartment's invoices and requests, community-wide summaries their community chooses to share, and nothing belonging to anyone else.",
        }}
      >
        <p className="max-w-3xl text-sm leading-relaxed text-pine-800/90">
          Access is by invitation: only people a community has authorized can
          sign in at all, and removing a member revokes access immediately.
          Read more on the{" "}
          <Link
            href="/security"
            className="font-semibold text-pine-700 hover:underline"
          >
            security page
          </Link>
          .
        </p>
      </Block>

      <RelatedLinks
        links={[
          { label: "Mobile app plans", href: "/mobile-app" },
          { label: "For apartment communities", href: "/apartment-communities" },
          { label: "Maintenance management", href: "/maintenance-management" },
          { label: "FAQ", href: "/faq" },
        ]}
      />
      <FinalCta />
    </>
  );
}
