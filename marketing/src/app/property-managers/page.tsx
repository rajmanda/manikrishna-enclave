import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "For property managers — manage multiple communities in one place",
  description:
    "Nivaasos gives property managers a professional dashboard for one or many communities: billing, collections, work orders, vendor coordination, expenses with receipts, and owner reporting — with a clean audit trail.",
  alternates: { canonical: canonical("/property-managers") },
};

export default function PropertyManagersPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions · Property managers"
        title="Look as professional as your work is"
        answer="Nivaasos gives independent property managers and management companies one dashboard for every community they serve: generate invoices, track collections, run maintenance from request to completion, coordinate vendors, record expenses with receipts, and hand owners transparent reports — without preparing them by hand."
        breadcrumb={{ label: "Property managers", path: "/property-managers" }}
      />

      <Block
        heading={{
          eyebrow: "Portfolio",
          title: "One login, every community you manage",
          lede: "Each community lives in its own isolated workspace; you switch between them without mixing records. A portfolio view rolls up collections, outstanding dues, and open work across communities.",
        }}
      >
        <CheckGrid
          cols={3}
          items={[
            "Manage one or many communities from a single account",
            "Per-community books that never blend",
            "Portfolio rollup: collections, dues, open work orders",
            "Work orders from request to completion with timelines",
            "Vendor coordination and spend history",
            "Expenses recorded on-site with the receipt photographed",
            "Owner and community reports generated, not compiled",
            "Personal service fees tracked separately from community funds",
            "Every action attributed and audit-logged",
          ]}
        />
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Trust",
          title: "Transparency is a competitive advantage",
          lede: "Owners — especially those living far away — choose managers they can verify. Nivaasos lets your clients see payments credited, receipts attached, and jobs progressing without calling you for updates.",
        }}
      >
        <p className="max-w-3xl text-sm leading-relaxed text-pine-800/90">
          Owner-reported payments come to you for confirmation, tenant
          payments are credited to the right owner with the payer on record,
          and receipts you photograph at entry time become the community's
          permanent proof. Learn how owners experience this on the{" "}
          <Link
            href="/nri-property-owners"
            className="font-semibold text-pine-700 hover:underline"
          >
            NRI owners page
          </Link>
          .
        </p>
      </Block>

      <RelatedLinks
        links={[
          { label: "Maintenance management", href: "/maintenance-management" },
          { label: "Community accounting software", href: "/community-accounting" },
          { label: "For apartment communities", href: "/apartment-communities" },
          { label: "Request a demo", href: "/request-demo" },
        ]}
      />
      <FinalCta
        title="Bring your next community onto Nivaasos."
        body="Whether you manage one building or a growing portfolio, start with a demo and see the manager's dashboard end to end."
      />
    </>
  );
}
