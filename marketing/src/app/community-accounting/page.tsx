import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Community accounting software for apartment associations",
  description:
    "Track monthly maintenance fees, special assessments, expenses, owner ledgers, reserve funds, and reconciliation. Nivaasos gives apartment associations transparent, apartment-level accounting.",
  alternates: { canonical: canonical("/community-accounting") },
};

export default function CommunityAccountingPage() {
  return (
    <>
      <PageHero
        eyebrow="Community accounting"
        title="Transparent accounting for apartment communities"
        answer="Nivaasos tracks every rupee a community bills, collects, and spends: recurring maintenance fees, special assessments, expenses with receipts, apartment-level ledgers, reserve funds, and reconciliation — so residents can verify where community money goes."
        breadcrumb={{ label: "Community accounting", path: "/community-accounting" }}
      />

      <Block
        heading={{
          eyebrow: "Billing",
          title: "How does an apartment association track monthly maintenance fees?",
          lede: "With one click, Nivaasos generates the month's maintenance invoice for every apartment. Each invoice shows what it's for, when it's due, and what's been paid — and each apartment's ledger keeps the running balance.",
        }}
      >
        <CheckGrid
          cols={3}
          items={[
            "Recurring HOA / maintenance-fee invoices per apartment",
            "One-time special assessments with installment plans",
            "Late fees linked to their original invoice",
            "Owner credits and advance payments applied oldest-first",
            "Tenant-paid fees credited to the owner's account, with the payer on the receipt",
            "Per-apartment statement PDFs and CSV exports",
          ]}
        />
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Expenses",
          title: "How can apartment expenses be divided transparently?",
          lede: "Record each expense once — with its receipt — and allocate it across apartments by a clear rule. Every owner can see the expense, the supporting document, and their share.",
        }}
      >
        <CheckGrid
          cols={3}
          items={[
            "Expense ledger grouped by month and category",
            "Receipt photos or PDFs attached at entry time",
            "Fair allocation of shared costs across apartments",
            "Reserve-fund tracking with monthly reconciliation",
            "Vendor and owner reimbursements kept separate from community funds",
            "Warnings when collections lack a matching recorded expense",
          ]}
        />
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-pine-800/90">
          Payments and expenses stay connected to the work that caused them:
          a repair job's collections, vendor bill, and receipts are linked,
          so an association&apos;s financial report explains itself. See how
          the full chain works on the{" "}
          <Link
            href="/maintenance-management"
            className="font-semibold text-pine-700 hover:underline"
          >
            maintenance management page
          </Link>
          .
        </p>
      </Block>

      <Block
        heading={{
          eyebrow: "Glossary",
          title: "Terms your community will see",
        }}
      >
        <dl className="grid gap-5 sm:grid-cols-2">
          {[
            {
              t: "Maintenance charge / HOA fee",
              d: "The recurring amount each apartment contributes toward shared running costs like security, cleaning, water, and electricity for common areas.",
            },
            {
              t: "Special assessment",
              d: "A one-time collection for a specific project — a borewell repair, painting, a new lift — billed separately from the monthly fee, often in installments.",
            },
            {
              t: "Reserve fund",
              d: "The community's savings: what remains after expenses are paid from collections, held for future repairs and emergencies.",
            },
            {
              t: "Owner ledger",
              d: "The running account of one apartment: every invoice raised, every payment received, and the resulting balance.",
            },
            {
              t: "Owner credit",
              d: "Money an owner has paid beyond current dues — for example an advance — held on their account and applied to future invoices.",
            },
            {
              t: "Reconciliation",
              d: "Checking that recorded collections, expenses, and the reserve balance agree — so gaps are found by the system, not by an argument.",
            },
          ].map((g) => (
            <div
              key={g.t}
              className="rounded-2xl border border-pine-100 bg-white p-5 shadow-card"
            >
              <dt className="font-semibold text-pine-950">{g.t}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-pine-800/80">
                {g.d}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-xs leading-relaxed text-pine-600">
          Nivaasos is community-management software. It is not a bank, a
          payment institution, an auditor, or a regulated financial
          institution.
        </p>
      </Block>

      <RelatedLinks
        links={[
          { label: "All features", href: "/features" },
          { label: "Maintenance management", href: "/maintenance-management" },
          { label: "For apartment communities", href: "/apartment-communities" },
          { label: "For property managers", href: "/property-managers" },
        ]}
      />
      <FinalCta />
    </>
  );
}
