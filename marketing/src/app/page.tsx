import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Building2,
  ClipboardList,
  FileText,
  Globe2,
  History,
  Landmark,
  LockKeyhole,
  MessageSquareWarning,
  Receipt,
  ShieldCheck,
  Smartphone,
  Table2,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import DashboardMock from "@/components/DashboardMock";
import FaqList from "@/components/FaqList";
import FinalCta from "@/components/FinalCta";
import JsonLd from "@/components/JsonLd";
import PhoneMock from "@/components/PhoneMock";
import { Container, SectionHeading } from "@/components/Section";
import {
  APP_URL,
  AVAILABILITY_STATEMENT,
  canonical,
  DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  TAGLINE,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — One transparent home for your entire community`,
  description:
    "Nivaasos brings residents, owners, community administrators, and property managers together in one transparent platform — payments, expenses, maintenance, communication, and documents, always clear.",
  alternates: { canonical: SITE_URL },
};

const PROBLEMS = [
  {
    icon: MessageSquareWarning,
    title: "Decisions buried in WhatsApp",
    body: "Important approvals and payment confirmations scroll away in a group chat no one can search six months later.",
  },
  {
    icon: Table2,
    title: "Payments in spreadsheets",
    body: "One person maintains the sheet, everyone else asks for screenshots — and nobody is sure which version is current.",
  },
  {
    icon: Receipt,
    title: "Missing receipts",
    body: "Cash paid to a plumber, a paper receipt in someone's drawer. When accounts are questioned, the proof is gone.",
  },
  {
    icon: Users,
    title: "Unclear balances",
    body: "Residents aren't sure what they owe or when it's due; owners can't see whether their tenant's payment reached the community.",
  },
  {
    icon: Globe2,
    title: "No remote visibility",
    body: "Owners who live in another city — or another country — depend on phone calls to know what's happening in their own building.",
  },
  {
    icon: Wrench,
    title: "Maintenance without accountability",
    body: "A complaint is raised, someone says 'noted', and there's no record of who is responsible for what happens next.",
  },
];

const SOLUTION_CARDS = [
  {
    icon: Landmark,
    title: "Community accounting",
    body: "Monthly maintenance charges, special assessments, owner and resident ledgers, reserve funds, and reconciliation — every rupee traceable.",
    href: "/community-accounting",
    linkText: "Explore community accounting software",
  },
  {
    icon: Wrench,
    title: "Maintenance & work orders",
    body: "From a resident's request to a completed work order with the vendor's bill attached — one connected trail with clear ownership.",
    href: "/maintenance-management",
    linkText: "See maintenance management",
  },
  {
    icon: UserCheck,
    title: "Resident portal",
    body: "Every authorized resident sees their own invoices, balances, receipts, notices, and documents — nothing more, nothing less.",
    href: "/resident-portal",
    linkText: "Tour the resident portal",
  },
];

const HOME_FAQS = [
  {
    q: "What is Nivaasos?",
    a: "Nivaasos is a community operations and transparency platform that helps apartment communities manage maintenance fees, expenses, payments, maintenance requests, work orders, documents, and resident communication in one secure system.",
  },
  {
    q: "Who is Nivaasos for?",
    a: "Apartment communities and their committees, professional property managers, apartment owners (including NRI owners living abroad), and residents or tenants who want clear visibility into charges, payments, and maintenance.",
  },
  {
    q: "Is Nivaasos available as a mobile app?",
    a: AVAILABILITY_STATEMENT,
  },
  {
    q: "Can other people see my community's financial data?",
    a: "No. Every community operates in its own secure workspace. Access requires sign-in, and authorization is enforced on the server for every request — financial records, documents, and personal data are visible only to members your community has authorized.",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web browser",
          description: DESCRIPTION,
          url: canonical("/"),
        }}
      />

      {/* ------------------------------------------------ hero */}
      <section className="border-b border-pine-100 bg-white">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-pine-950 sm:text-5xl lg:text-[3.4rem]">
              {TAGLINE}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pine-800/85">
              {SITE_NAME} organizes your community&apos;s payments, expenses,
              maintenance, communication, documents, and responsibilities in
              one secure place — so everyone knows what is happening, where
              the money is going, and who owns the next step.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request-demo"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-pine-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-pine-800"
              >
                Start Your Community
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={APP_URL}
                className="inline-flex items-center justify-center rounded-xl border border-pine-200 bg-white px-6 py-3.5 text-sm font-semibold text-pine-900 hover:border-pine-300 hover:bg-pine-50"
              >
                Resident Login
              </a>
            </div>
            <p className="mt-5 text-sm text-pine-600">
              Built for apartment communities in India — starting in
              Hyderabad, designed for anywhere.
            </p>
          </div>
          <DashboardMock />
        </Container>
      </section>

      {/* ------------------------------------------------ problem */}
      <section className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="The problem today"
            title="Running a community shouldn't feel like detective work"
            lede="Most communities run on goodwill, group chats, and one overworked spreadsheet. Everyone is doing their best — the tools just weren't built for shared money and shared responsibility."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-pine-100 bg-white p-6 shadow-card"
              >
                <p.icon className="h-5 w-5 text-amberglow" aria-hidden />
                <h3 className="mt-3 font-semibold text-pine-950">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pine-800/80">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ solution */}
      <section className="border-y border-pine-100 bg-white py-16 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="The Nivaasos way"
            title="One reliable source of truth for your community"
            lede="Finances, maintenance, documents, and communication stop living in separate apps and separate heads. Everything connects, and every action leaves a clear trail."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {SOLUTION_CARDS.map((c) => (
              <div
                key={c.title}
                className="flex flex-col rounded-2xl border border-pine-100 bg-ivory p-6"
              >
                <c.icon className="h-5 w-5 text-pine-600" aria-hidden />
                <h3 className="mt-3 font-semibold text-pine-950">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-pine-800/80">
                  {c.body}
                </p>
                <Link
                  href={c.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pine-700 hover:underline"
                >
                  {c.linkText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ transparency chain */}
      <section className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="Transparency & accountability"
            title="No unexplained charges. No missing context."
            lede="Nivaasos connects the complete operational workflow, so every rupee on a ledger can explain where it came from and why."
            center
          />
          <div className="mx-auto mt-12 max-w-4xl overflow-x-auto">
            <ol className="flex min-w-max items-center gap-2 sm:min-w-0 sm:justify-center">
              {[
                { icon: Wrench, label: "Maintenance request" },
                { icon: ClipboardList, label: "Work order" },
                { icon: Receipt, label: "Expense + receipt" },
                { icon: FileText, label: "Invoice" },
                { icon: Banknote, label: "Payment" },
                { icon: History, label: "Ledger" },
              ].map((s, i, arr) => (
                <li key={s.label} className="flex items-center gap-2">
                  <div className="flex w-28 flex-col items-center rounded-2xl border border-pine-100 bg-white px-3 py-4 text-center shadow-card">
                    <s.icon className="h-5 w-5 text-pine-600" aria-hidden />
                    <span className="mt-2 text-xs font-semibold leading-snug text-pine-950">
                      {s.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-pine-300"
                      aria-hidden
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-pine-800/80">
            Every record can carry supporting documents, an owner, a status,
            timestamps, approvals, and history. When a resident asks
            &ldquo;what was this charge for?&rdquo;, the answer is one tap
            away — not one committee meeting away.{" "}
            <Link
              href="/how-it-works"
              className="font-semibold text-pine-700 hover:underline"
            >
              See how it works
            </Link>
            .
          </p>
        </Container>
      </section>

      {/* ------------------------------------------------ roles */}
      <section className="border-y border-pine-100 bg-white py-16 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="For every role"
            title="The right visibility for every member"
            lede="One platform, four experiences — each person sees exactly what their role authorizes, from full community books to a single apartment's balance."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {[
              {
                icon: Landmark,
                title: "Community administrators",
                items: [
                  "Generate recurring community invoices",
                  "Allocate expenses fairly across apartments",
                  "Publish financial summaries and track collections",
                  "Send announcements with a permanent record",
                ],
                href: "/apartment-communities",
                linkText: "Nivaasos for apartment communities",
              },
              {
                icon: Building2,
                title: "Property managers",
                items: [
                  "Manage one or many communities from one login",
                  "Track maintenance from request to completion",
                  "Coordinate vendors and record expenses with receipts",
                  "Produce owner and community reports",
                ],
                href: "/property-managers",
                linkText: "Property-manager dashboard",
              },
              {
                icon: Globe2,
                title: "Owners — local and NRI",
                items: [
                  "View apartment-level balances and statements",
                  "Review expenses with supporting receipts",
                  "See tenant payments credited correctly",
                  "Monitor maintenance from anywhere in the world",
                ],
                href: "/nri-property-owners",
                linkText: "Remote oversight for NRI owners",
              },
              {
                icon: UserCheck,
                title: "Residents & tenants",
                items: [
                  "View invoices, balances, and due dates",
                  "Submit maintenance requests with photos",
                  "Receive notices and community announcements",
                  "Access permitted community documents",
                ],
                href: "/resident-portal",
                linkText: "Resident maintenance portal",
              },
            ].map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-pine-100 bg-ivory p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-700 text-white">
                    <r.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="font-semibold text-pine-950">{r.title}</h3>
                </div>
                <ul className="mt-4 space-y-2">
                  {r.items.map((it) => (
                    <li
                      key={it}
                      className="flex items-start gap-2 text-sm text-pine-800/85"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-pine-500"
                      />
                      {it}
                    </li>
                  ))}
                </ul>
                <Link
                  href={r.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pine-700 hover:underline"
                >
                  {r.linkText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ mobile */}
      <section className="py-16 sm:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <PhoneMock />
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="Mobile experience"
              title="The Nivaasos mobile experience is coming next"
              lede="Nivaasos already works beautifully in your phone's browser — and native Android and iOS apps are planned, built on the same secure services and permissions."
            />
            <ul className="mt-6 space-y-2.5">
              {[
                "Mobile-first resident experience",
                "Payment reminders and maintenance updates",
                "Photo uploads for requests and receipts",
                "Community announcements and secure documents",
              ].map((it) => (
                <li
                  key={it}
                  className="flex items-start gap-2.5 text-sm text-pine-800/85"
                >
                  <Smartphone
                    className="mt-0.5 h-4 w-4 shrink-0 text-pine-600"
                    aria-hidden
                  />
                  {it}
                </li>
              ))}
            </ul>
            <Link
              href="/mobile-app"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-pine-700 hover:underline"
            >
              Learn about the mobile app and join the waitlist
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ trust */}
      <section className="border-y border-pine-100 bg-white py-16 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="Trust & commitment"
            title="Your community's data belongs to your community"
            center
          />
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
            {[
              {
                icon: LockKeyhole,
                title: "Access by authorization",
                body: "Every sign-in is checked against your community's member list, and every request is authorized by role on the server — not just hidden in the interface.",
              },
              {
                icon: ShieldCheck,
                title: "Private stays private",
                body: "Financial information is visible only to authorized members. Nothing from your community's workspace ever appears on this public website.",
              },
              {
                icon: History,
                title: "A clear history",
                body: "Creates, updates, and deletions keep an audit trail, so your community can always see who did what, and when.",
              },
            ].map((t) => (
              <div key={t.title} className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-semibold text-pine-950">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pine-800/80">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-pine-700">
            <Link href="/security" className="font-semibold hover:underline">
              Read our security approach
            </Link>
          </p>
        </Container>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="Questions"
            title="Frequently asked questions"
            center
          />
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqList faqs={HOME_FAQS} withSchema />
            <p className="mt-6 text-center text-sm text-pine-700">
              <Link href="/faq" className="font-semibold hover:underline">
                More questions answered in the full FAQ
              </Link>
            </p>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
