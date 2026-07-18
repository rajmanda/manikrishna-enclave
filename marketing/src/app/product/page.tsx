import type { Metadata } from "next";
import Link from "next/link";
import DashboardMock from "@/components/DashboardMock";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Product overview — community operations & transparency platform",
  description:
    "What is Nivaasos? A community operations platform where apartment communities manage fees, expenses, payments, maintenance, work orders, documents, and communication in one secure workspace.",
  alternates: { canonical: canonical("/product") },
};

export default function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title="What is Nivaasos?"
        answer="Nivaasos is a community operations and transparency platform: apartment communities manage maintenance fees, expenses, payments, maintenance requests, work orders, documents, and resident communication in one secure system, with every member seeing exactly what their role authorizes."
        breadcrumb={{ label: "Product", path: "/product" }}
      />

      <Block
        heading={{
          eyebrow: "Why it exists",
          title: "Shared money and shared responsibility need shared truth",
          lede: "A community's finances and upkeep are collective by nature, but the usual tools — group chats, spreadsheets, paper receipts — are personal by design. Nivaasos replaces scattered records with one connected workspace the whole community can rely on.",
        }}
      >
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="space-y-5 text-sm leading-relaxed text-pine-800/90">
            <p>
              Every apartment community answers the same questions every
              month: who has paid, what did we spend, who approved it, and
              what happens next on that leaking pipe? Nivaasos makes those
              answers self-serve. Charges, payments, expenses, and
              maintenance live as connected records — not messages — so the
              answer to &ldquo;why?&rdquo; is always attached to the number
              itself.
            </p>
            <p>
              The platform is multi-tenant: each community operates in its
              own isolated workspace with its own members, roles, and
              records. A property manager can serve several communities from
              one login while each community's data stays strictly its own.
            </p>
            <p>
              Nivaasos is web-based today and designed API-first, so the
              planned{" "}
              <Link
                href="/mobile-app"
                className="font-semibold text-pine-700 hover:underline"
              >
                Android and iOS apps
              </Link>{" "}
              will use the same secure services, permissions, and financial
              rules as the web experience.
            </p>
          </div>
          <DashboardMock />
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Capabilities",
          title: "Everything a community runs on",
          lede: "Explore the detailed feature areas, or see the complete list on the features page.",
        }}
      >
        <CheckGrid
          cols={3}
          items={[
            "Recurring maintenance-fee invoicing",
            "Special assessments & installments",
            "Owner and resident ledgers",
            "Payment tracking & reconciliation",
            "Expense recording with receipts",
            "Reserve-fund tracking",
            "Maintenance requests & work orders",
            "Vendor coordination",
            "Announcements & community feed",
            "Documents & meeting minutes",
            "Role-based access for every member",
            "Audit history on every change",
          ]}
        />
        <p className="mt-8 text-sm">
          <Link
            href="/features"
            className="font-semibold text-pine-700 hover:underline"
          >
            See the full feature list →
          </Link>
        </p>
      </Block>

      <RelatedLinks
        links={[
          { label: "Community accounting software", href: "/community-accounting" },
          { label: "Maintenance management", href: "/maintenance-management" },
          { label: "Resident maintenance portal", href: "/resident-portal" },
          { label: "How it works", href: "/how-it-works" },
          { label: "Product facts", href: "/product-facts" },
        ]}
      />
      <FinalCta />
    </>
  );
}
