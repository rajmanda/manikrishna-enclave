import type { Metadata } from "next";
import Link from "next/link";
import FinalCta from "@/components/FinalCta";
import LeadForm from "@/components/LeadForm";
import PageHero from "@/components/PageHero";
import PhoneMock from "@/components/PhoneMock";
import { Block, CheckGrid, RelatedLinks } from "@/components/blocks";
import { AVAILABILITY_STATEMENT, canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mobile app — the Nivaasos mobile experience is coming next",
  description:
    "Nivaasos works today in your phone's browser; native Android and iOS apps are planned on the same secure services. See what's coming and join the mobile app waitlist.",
  alternates: { canonical: canonical("/mobile-app") },
};

export default function MobileAppPage() {
  return (
    <>
      <PageHero
        eyebrow="Mobile"
        title="The Nivaasos mobile experience is coming next"
        answer={AVAILABILITY_STATEMENT}
        breadcrumb={{ label: "Mobile app", path: "/mobile-app" }}
      />

      <Block>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <PhoneMock />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-pine-950 sm:text-3xl">
              What the mobile apps will bring
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-pine-800/90">
              The web experience is already mobile-first — residents use it
              from their phones every day. The planned native apps add the
              conveniences a browser can&apos;t:
            </p>
            <div className="mt-6">
              <CheckGrid
                cols={2}
                items={[
                  "Push notifications for what matters",
                  "Payment reminders before due dates",
                  "Maintenance updates as jobs progress",
                  "Community announcements instantly",
                  "Camera uploads for issues and receipts",
                  "Secure document access on the go",
                  "Apartment and community dashboards",
                  "The same permissions as the web — exactly",
                ]}
              />
            </div>
            <p className="mt-6 text-sm leading-relaxed text-pine-800/90">
              One platform rule we won&apos;t break: web, Android, and iOS
              share the same backend services, permission rules, workflows,
              and financial calculations. Nothing exists &ldquo;only in the
              app.&rdquo; Read about the architecture on{" "}
              <Link
                href="/how-it-works"
                className="font-semibold text-pine-700 hover:underline"
              >
                how it works
              </Link>
              .
            </p>
          </div>
        </div>
      </Block>

      <Block
        tone="white"
        heading={{
          eyebrow: "Waitlist",
          title: "Be first to know when the apps arrive",
          lede: "Join the waitlist and we'll notify you when the Android and iOS apps are available.",
        }}
      >
        <div className="mx-auto max-w-xl">
          <LeadForm kind="waitlist" />
        </div>
      </Block>

      <RelatedLinks
        links={[
          { label: "Resident maintenance portal", href: "/resident-portal" },
          { label: "Product facts", href: "/product-facts" },
          { label: "All features", href: "/features" },
        ]}
      />
      <FinalCta />
    </>
  );
}
