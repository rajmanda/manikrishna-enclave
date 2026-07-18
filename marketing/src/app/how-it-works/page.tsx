import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks, Steps } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works — from registration to a transparent community",
  description:
    "How Nivaasos works: register your community, add apartments and members, invite them securely, then manage payments, expenses, maintenance, documents, and communication with role-based visibility.",
  alternates: { canonical: canonical("/how-it-works") },
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Up and running in five steps"
        answer="A community gets started on Nivaasos by registering its workspace, adding apartments and people, and inviting members securely. From then on, payments, expenses, maintenance, documents, and communication are managed in one place — and every authorized member gets the right level of visibility."
        breadcrumb={{ label: "How it works", path: "/how-it-works" }}
      />

      <Block>
        <div className="mx-auto max-w-3xl">
          <Steps
            steps={[
              {
                title: "Register the community",
                body: "Your community gets its own secure digital workspace with a unique address. Everything that happens inside it belongs to your community alone — no other community can ever see it.",
              },
              {
                title: "Add apartments, owners, residents, and managers",
                body: "A guided setup assistant walks you through adding each flat, who owns it, who lives in it, and who manages the community — including households that own more than one apartment.",
              },
              {
                title: "Invite members securely",
                body: "Access works as an authorized member list: only people your community has added can sign in, using their existing Google account. Removing someone revokes their access immediately.",
              },
              {
                title: "Run the community day to day",
                body: "Generate monthly invoices, record payments and expenses with receipts, track maintenance requests through to completed work orders, publish announcements, and store documents — all in one connected system.",
              },
              {
                title: "Give everyone the right visibility",
                body: "Administrators and managers see the full books. Owners see their apartments' balances and community summaries. Residents see their own invoices and requests. An auditor role can review everything without changing anything.",
              },
            ]}
          />
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Behind the scenes",
          title: "One workspace per community, enforced on the server",
          lede: "Multi-tenant isolation is a property of the architecture, not a display setting.",
        }}
      >
        <div className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-pine-800/90">
          <p>
            Every record in Nivaasos belongs to exactly one community, and
            every request a member makes is checked on the server against
            their community and role before any data is returned. Changing a
            web address, identifier, or API call can never expose another
            community&apos;s records — authorization is enforced in the data
            layer, not merely hidden in the interface.
          </p>
          <p>
            The same rules power every current and future client: the web
            app today, and the planned{" "}
            <Link
              href="/mobile-app"
              className="font-semibold text-pine-700 hover:underline"
            >
              Android and iOS apps
            </Link>{" "}
            tomorrow. Read more about our approach on the{" "}
            <Link
              href="/security"
              className="font-semibold text-pine-700 hover:underline"
            >
              security page
            </Link>
            .
          </p>
        </div>
      </Block>

      <RelatedLinks
        links={[
          { label: "Product overview", href: "/product" },
          { label: "Community accounting software", href: "/community-accounting" },
          { label: "Resident maintenance portal", href: "/resident-portal" },
          { label: "Security", href: "/security" },
        ]}
      />
      <FinalCta />
    </>
  );
}
