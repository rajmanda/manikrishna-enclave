import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "For apartment communities & associations",
  description:
    "Move your apartment community off WhatsApp and spreadsheets. Nivaasos gives associations transparent accounting, organized maintenance, reliable records, and communication every member can find later.",
  alternates: { canonical: canonical("/apartment-communities") },
};

export default function ApartmentCommunitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions · Apartment communities"
        title="Run your community with clarity, not chat scroll"
        answer="Nivaasos gives apartment communities and their committees one workspace for accounting, maintenance, records, and communication — replacing the fragile mix of WhatsApp groups, spreadsheets, and paper receipts that makes transparency so hard."
        breadcrumb={{
          label: "Apartment communities",
          path: "/apartment-communities",
        }}
      />

      <Block
        heading={{
          eyebrow: "The transition",
          title: "How can a community move away from WhatsApp and spreadsheets?",
          lede: "Gradually and safely. Keep the group chat for conversation — move the records out of it. Communities typically start with billing, then bring in expenses, maintenance, and documents.",
        }}
      >
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {[
            {
              step: "Start with billing",
              body: "Set up apartments and members, generate the month's maintenance invoices, and let owners see their own balance instead of asking for it.",
            },
            {
              step: "Add expenses & receipts",
              body: "Record spending with receipts as it happens. The expense ledger and reserve fund start explaining themselves.",
            },
            {
              step: "Bring in maintenance & records",
              body: "Requests, work orders, documents, minutes, and polls move in — and the community has one memory instead of many.",
            },
          ].map((s, i) => (
            <div
              key={s.step}
              className="rounded-2xl border border-pine-100 bg-white p-6 shadow-card"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-pine-500">
                Phase {i + 1}
              </span>
              <h3 className="mt-2 font-semibold text-pine-950">{s.step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pine-800/80">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "For committees",
          title: "What committees get",
          lede: "Less manual work, fewer disputes, and records that outlast committee handovers.",
        }}
      >
        <CheckGrid
          cols={3}
          items={[
            "One-click monthly invoice generation for every flat",
            "Collections tracked automatically — who paid, who hasn't",
            "Expense ledger with receipts anyone authorized can verify",
            "Special assessments for projects, with installments",
            "Announcements, polls, documents, and meeting minutes",
            "An audit trail that survives committee changes",
          ]}
        />
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-pine-800/90">
          When residents can answer &ldquo;where did my maintenance fee
          go?&rdquo; themselves — with receipts — committee work turns from
          defending numbers into running the community. See the details on{" "}
          <Link
            href="/community-accounting"
            className="font-semibold text-pine-700 hover:underline"
          >
            community accounting
          </Link>{" "}
          and{" "}
          <Link
            href="/maintenance-management"
            className="font-semibold text-pine-700 hover:underline"
          >
            maintenance management
          </Link>
          .
        </p>
      </Block>

      <RelatedLinks
        links={[
          { label: "For property managers", href: "/property-managers" },
          { label: "Resident maintenance portal", href: "/resident-portal" },
          { label: "How it works", href: "/how-it-works" },
          { label: "Request a demo", href: "/request-demo" },
        ]}
      />
      <FinalCta />
    </>
  );
}
