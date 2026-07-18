import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks, Steps } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Maintenance management — requests, work orders & vendor tracking",
  description:
    "Track community maintenance from a resident's request to the completed work order, vendor bill, and updated ledger. Nivaasos gives every repair clear ownership, status, and history.",
  alternates: { canonical: canonical("/maintenance-management") },
};

export default function MaintenanceManagementPage() {
  return (
    <>
      <PageHero
        eyebrow="Maintenance management"
        title="Every repair, from request to receipt"
        answer="Nivaasos manages the complete maintenance lifecycle: a resident reports an issue, a manager classifies it and assigns a vendor, the work order moves through approval and completion, and the final expense — with its receipt — lands in the community's books, automatically connected."
        breadcrumb={{
          label: "Maintenance management",
          path: "/maintenance-management",
        }}
      />

      <Block
        heading={{
          eyebrow: "The lifecycle",
          title: "How does a maintenance request become a settled expense?",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <Steps
            steps={[
              {
                title: "A resident submits an issue",
                body: "With a description and photos, from their phone. The request is on the record from minute one — not buried in a group chat.",
              },
              {
                title: "The manager reviews and classifies it",
                body: "Is it urgent? Common-area or apartment-specific? The request gets an owner and a status everyone can see.",
              },
              {
                title: "A vendor is assigned and an estimate approved",
                body: "The work order tracks who is doing the job, the estimate, and any approvals — with the timeline of every stage change.",
              },
              {
                title: "The work is completed and the expense recorded",
                body: "The vendor's bill and receipt attach to the work order. Completing the job creates the draft expense so nothing is forgotten.",
              },
              {
                title: "The right party is billed and ledgers update",
                body: "A common-area repair goes to community expenses; an apartment-specific job can be billed to that owner or reimbursed appropriately. Payments settle it, and the books stay consistent.",
              },
            ]}
          />
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "For managers",
          title: "How can a property manager track work orders and vendor expenses?",
          lede: "One screen shows every open job, its stage, its vendor, and its money — estimates, recorded expenses, amounts billed and collected.",
        }}
      >
        <CheckGrid
          cols={3}
          items={[
            "Work-order pipeline with stage-by-stage timeline",
            "Vendor directory with assignment and history",
            "Photos on requests and work orders",
            "Estimates, final costs, and approvals on the record",
            "A money panel per job: spent, billed, collected",
            "Warnings when money was collected but no expense recorded",
          ]}
        />
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-pine-800/90">
          Because work orders link to their expenses and invoices, the
          question &ldquo;what did that repair actually cost us?&rdquo; has
          one answer, backed by receipts — part of the same chain described
          under{" "}
          <Link
            href="/community-accounting"
            className="font-semibold text-pine-700 hover:underline"
          >
            community accounting
          </Link>
          .
        </p>
      </Block>

      <RelatedLinks
        links={[
          { label: "Resident maintenance portal", href: "/resident-portal" },
          { label: "For property managers", href: "/property-managers" },
          { label: "All features", href: "/features" },
          { label: "How it works", href: "/how-it-works" },
        ]}
      />
      <FinalCta />
    </>
  );
}
