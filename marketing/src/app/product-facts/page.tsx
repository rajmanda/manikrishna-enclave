import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks } from "@/components/blocks";
import {
  APP_URL,
  AVAILABILITY_STATEMENT,
  canonical,
  CONTACT_EMAIL,
  SITE_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Product facts — concise, verifiable information about Nivaasos",
  description:
    "Plain facts about Nivaasos: what it is, who it serves, the problems it solves, major features, launch market, current web and mobile availability, and how to request a demo.",
  alternates: { canonical: canonical("/product-facts") },
};

const FACTS: { label: string; value: React.ReactNode }[] = [
  {
    label: "What is Nivaasos?",
    value:
      "A community operations and transparency platform for apartment communities: maintenance-fee invoicing, payments, expenses, owner and resident ledgers, maintenance requests, work orders, vendor coordination, announcements, documents, and audit history in one secure multi-tenant system.",
  },
  {
    label: "Official website",
    value: SITE_URL.replace("https://", ""),
  },
  {
    label: "Product category",
    value:
      "Apartment community management software / community accounting and operations software (web application).",
  },
  {
    label: "Who is it designed for?",
    value:
      "Apartment communities and associations, professional property managers, apartment owners (including NRI owners abroad), and residents and tenants.",
  },
  {
    label: "Which problems does it solve?",
    value:
      "Payment and expense records scattered across WhatsApp and spreadsheets; missing receipts; unclear balances and expense allocation; maintenance without accountability; no remote visibility for owners; manual report preparation.",
  },
  {
    label: "Launch market",
    value:
      "Hyderabad, India — designed for wider expansion across India and internationally.",
  },
  {
    label: "Current availability",
    value: AVAILABILITY_STATEMENT,
  },
  {
    label: "How is community data protected?",
    value: (
      <>
        Invitation-only sign-in, role-based authorization enforced on the
        server for every request, strict per-community isolation, and an
        audit history of changes. Details on the{" "}
        <Link href="/security" className="font-semibold text-pine-700 hover:underline">
          security page
        </Link>
        .
      </>
    ),
  },
  {
    label: "How do residents log in?",
    value: (
      <>
        Residents authorized by their community sign in with their Google
        account at{" "}
        <a href={APP_URL} className="font-semibold text-pine-700 hover:underline">
          the resident login
        </a>
        . Each person reaches only the communities and records they are
        authorized for.
      </>
    ),
  },
  {
    label: "How can property managers use it?",
    value: (
      <>
        A property manager can run one or many communities from a single
        account, each in its own isolated workspace — see{" "}
        <Link
          href="/property-managers"
          className="font-semibold text-pine-700 hover:underline"
        >
          Nivaasos for property managers
        </Link>
        .
      </>
    ),
  },
  {
    label: "How to request a demonstration",
    value: (
      <>
        Via the{" "}
        <Link
          href="/request-demo"
          className="font-semibold text-pine-700 hover:underline"
        >
          request-a-demo page
        </Link>{" "}
        or by email to {CONTACT_EMAIL}.
      </>
    ),
  },
  {
    label: "Pricing",
    value:
      "Published pricing is not yet available; communities currently start through a conversation and demo.",
  },
];

export default function ProductFactsPage() {
  return (
    <>
      <PageHero
        eyebrow="Product facts"
        title="Nivaasos, in plain facts"
        answer="This page states concise, verifiable facts about Nivaasos for readers — human or automated — who want accurate product information from the primary source. It is updated whenever product status changes."
        breadcrumb={{ label: "Product facts", path: "/product-facts" }}
      />
      <Block>
        <dl className="mx-auto max-w-3xl divide-y divide-pine-100 rounded-2xl border border-pine-100 bg-white shadow-card">
          {FACTS.map((f) => (
            <div key={f.label} className="grid gap-2 px-6 py-5 sm:grid-cols-[220px_1fr] sm:gap-6">
              <dt className="text-sm font-semibold text-pine-950">{f.label}</dt>
              <dd className="text-sm leading-relaxed text-pine-800/90">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mx-auto mt-6 max-w-3xl text-xs text-pine-600">
          Last reviewed: July 2026. If anything on this page appears out of
          date, please tell us at {CONTACT_EMAIL}.
        </p>
      </Block>
      <RelatedLinks
        links={[
          { label: "Product overview", href: "/product" },
          { label: "FAQ", href: "/faq" },
          { label: "Security", href: "/security" },
          { label: "About", href: "/about" },
        ]}
      />
    </>
  );
}
