import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "For NRI property owners — monitor your apartment in India remotely",
  description:
    "How can an NRI owner monitor an apartment in India? Nivaasos gives owners abroad a live, authorized view of balances, tenant payments, expenses with receipts, and maintenance — no phone-call chasing.",
  alternates: { canonical: canonical("/nri-property-owners") },
};

export default function NriOwnersPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions · NRI owners"
        title="Your apartment in India, visible from anywhere"
        answer="An NRI owner monitors their apartment through an authorized, always-current view: what's billed, what the tenant paid and when it was credited, what the community spent (with receipts), and how maintenance work is progressing — instead of depending on late-night phone calls and forwarded screenshots."
        breadcrumb={{ label: "NRI property owners", path: "/nri-property-owners" }}
      />

      <Block
        heading={{
          eyebrow: "Remote oversight",
          title: "What you can see from abroad",
        }}
      >
        <CheckGrid
          cols={2}
          items={[
            "Apartment-level ledger: every invoice, payment, and balance",
            "Tenant-paid maintenance fees credited correctly to your account, with the payer named on the record",
            "Community expenses with supporting receipts you can open yourself",
            "Maintenance requests and work orders on your property, with photos and status",
            "Statements you can download any time, from any timezone",
            "Announcements and decisions on the record — not lost in a group chat you left",
          ]}
        />
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "How tenant payments work",
          title: "How should tenant-paid fees be credited to an owner?",
          lede: "The invoice stays the owner's responsibility, and a tenant's payment settles it on the owner's behalf — recorded with who actually paid.",
        }}
      >
        <p className="max-w-3xl text-sm leading-relaxed text-pine-800/90">
          In Nivaasos, the monthly maintenance invoice is always the
          owner&apos;s receivable. When your tenant pays it, the payment is
          recorded against your invoice with the tenant named as the payer —
          your ledger shows &ldquo;paid by tenant on behalf of owner,&rdquo;
          the receipt goes to the person who paid, and no confusing second
          bill is ever created. You see it credited from wherever you are.
          The same clarity applies to advances, credits, and refunds — see{" "}
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
          { label: "Security", href: "/security" },
          { label: "Request a demo", href: "/request-demo" },
        ]}
      />
      <FinalCta
        title="Stop managing your property by phone call."
        body="Ask your community or property manager about Nivaasos — or request a demo and we'll show you the owner's view."
      />
    </>
  );
}
