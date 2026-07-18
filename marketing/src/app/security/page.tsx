import type { Metadata } from "next";
import Link from "next/link";
import { History, KeyRound, Layers, LockKeyhole, UserX, Eye } from "lucide-react";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks } from "@/components/blocks";
import { canonical, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security — how Nivaasos protects community data",
  description:
    "How Nivaasos protects community data: invitation-only sign-in, role-based authorization enforced on the server, strict per-community isolation, audit history, and a public website that never touches private records.",
  alternates: { canonical: canonical("/security") },
};

const PRACTICES = [
  {
    icon: KeyRound,
    title: "Invitation-only sign-in",
    body: "There is no open registration. A community authorizes its members, and only those people can sign in — using Google sign-in, so Nivaasos never stores their passwords. Removing a member revokes access immediately.",
  },
  {
    icon: LockKeyhole,
    title: "Authorization on the server",
    body: "Every request is checked against the member's community and role before any data is returned. Permissions are enforced in the application and data layer — not merely hidden in the interface — so changing a URL or API call cannot expose someone else's records.",
  },
  {
    icon: Layers,
    title: "Strict community isolation",
    body: "Every record belongs to exactly one community, and all queries are scoped to it. Communities cannot see each other's data, and administrators reach only the communities they are authorized for.",
  },
  {
    icon: Eye,
    title: "Role-appropriate visibility",
    body: "Administrators, managers, owners, residents, and auditors each see what their role allows. The auditor role is read-only by design, so independent review never requires write access.",
  },
  {
    icon: History,
    title: "Audit history",
    body: "Creates, updates, and deletions are recorded in an audit trail — who did what and when — giving communities durable accountability across committee and manager changes.",
  },
  {
    icon: UserX,
    title: "Public and private, fully separated",
    body: "This marketing website has no access to application data. All product illustrations here use fictional demonstration content, private application pages are excluded from search indexing, and privacy is enforced by authentication and authorization — never by obscurity.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Community data belongs to the community"
        answer="Nivaasos protects community data with invitation-only sign-in, role-based authorization enforced on the server for every request, strict per-community isolation, and an audit history of changes. The public website is completely separate from the authenticated application and never displays private records."
        breadcrumb={{ label: "Security", path: "/security" }}
      />

      <Block>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRACTICES.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-pine-100 bg-white p-6 shadow-card"
            >
              <p.icon className="h-5 w-5 text-pine-600" aria-hidden />
              <h2 className="mt-3 font-semibold text-pine-950">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-pine-800/80">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Our commitments",
          title: "What we promise — and what we don't claim",
        }}
      >
        <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-pine-800/90">
          <p>
            We commit to these principles: your community&apos;s data belongs
            to your community; access is controlled by role and
            authorization; financial information is visible only to
            authorized users; private community information is never
            displayed publicly; and actions maintain a clear history.
          </p>
          <p>
            We deliberately avoid security buzzwords we haven&apos;t earned.
            You won&apos;t find claims of certifications or compliance
            standards on this site unless they are implemented and verified.
            If you have a security question — or believe you&apos;ve found a
            vulnerability — write to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-pine-700 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will respond.
          </p>
          <p>
            For how we handle personal information on this website and in
            the product, see the{" "}
            <Link
              href="/privacy"
              className="font-semibold text-pine-700 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </Block>

      <RelatedLinks
        links={[
          { label: "How it works", href: "/how-it-works" },
          { label: "Product facts", href: "/product-facts" },
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Contact", href: "/contact" },
        ]}
      />
      <FinalCta />
    </>
  );
}
