import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  FileText,
  Landmark,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Features — apartment community management software",
  description:
    "Nivaasos features: HOA and maintenance-fee invoicing, expense allocation, owner ledgers, payment reconciliation, maintenance requests, work orders, vendor coordination, documents, announcements, and audit history.",
  alternates: { canonical: canonical("/features") },
};

const GROUPS = [
  {
    icon: Landmark,
    title: "Billing & collections",
    href: "/community-accounting",
    items: [
      "Recurring monthly HOA / maintenance-fee invoices for every apartment",
      "One-time special assessments with installment plans",
      "Late-fee handling linked to the original invoice",
      "Owner credits and advance payments, spent oldest-first",
      "Tenant-paid fees credited correctly to the owner's account",
      "Payment recording with method, reference, and receipt PDFs",
    ],
  },
  {
    icon: Banknote,
    title: "Expenses & funds",
    href: "/community-accounting",
    items: [
      "Expense ledger by month and category with receipt uploads",
      "Fair allocation of shared expenses across apartments",
      "Reserve-fund tracking with reconciliation warnings",
      "Vendor and owner reimbursements kept separate from community funds",
      "Community-wide financial reports and per-apartment statements",
      "Every figure traceable to its supporting records",
    ],
  },
  {
    icon: Wrench,
    title: "Maintenance & vendors",
    href: "/maintenance-management",
    items: [
      "Resident maintenance requests with photos",
      "Work orders with stage-by-stage lifecycle and timeline",
      "Vendor directory and assignment",
      "Estimates, approvals, and final costs on the record",
      "Completed work linked to its expense and receipt",
      "Billing or reimbursement flows when a job affects one apartment",
    ],
  },
  {
    icon: MessageSquare,
    title: "Communication & records",
    href: "/resident-portal",
    items: [
      "Announcements every member receives and can find later",
      "Community feed with comments and reactions",
      "Polls with one vote per apartment",
      "Versioned document storage with role-based visibility",
      "Meeting minutes with agenda and resolutions",
      "In-app notifications for the events that matter",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Access & accountability",
    href: "/security",
    items: [
      "Role-based access: administrators, managers, owners, residents, auditors",
      "Server-side authorization on every request",
      "Each community isolated in its own workspace",
      "Read-only auditor role for independent review",
      "Audit trail on every create, update, and delete",
      "Sign-in restricted to members the community has authorized",
    ],
  },
  {
    icon: FileText,
    title: "Reports & statements",
    href: "/community-accounting",
    items: [
      "Per-apartment statement PDFs with running balances",
      "Collection and expense reports",
      "Vendor-spend summaries",
      "CSV exports for accountants",
      "Owner-facing transparency without manual report preparation",
      "Consistent numbers everywhere — one source of truth",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything your community needs, connected"
        answer="Nivaasos covers the complete operating cycle of an apartment community — billing, collections, expenses, maintenance, vendors, documents, and communication — with role-based access and an audit trail throughout."
        breadcrumb={{ label: "Features", path: "/features" }}
      />
      <Block>
        <div className="grid gap-5 lg:grid-cols-2">
          {GROUPS.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-pine-100 bg-white p-6 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                  <g.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="text-lg font-semibold text-pine-950">
                  {g.title}
                </h2>
              </div>
              <div className="mt-4">
                <CheckGrid items={g.items} cols={2} />
              </div>
              <p className="mt-4 text-sm">
                <Link
                  href={g.href}
                  className="font-semibold text-pine-700 hover:underline"
                >
                  Learn more →
                </Link>
              </p>
            </div>
          ))}
        </div>
      </Block>
      <RelatedLinks
        links={[
          { label: "Product overview", href: "/product" },
          { label: "How it works", href: "/how-it-works" },
          { label: "Mobile app", href: "/mobile-app" },
          { label: "FAQ", href: "/faq" },
        ]}
      />
      <FinalCta />
    </>
  );
}
