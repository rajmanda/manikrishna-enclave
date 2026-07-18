import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import FinalCta from "@/components/FinalCta";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks } from "@/components/blocks";
import { canonical, CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About — why we're building Nivaasos",
  description:
    "Nivaasos is built on a simple belief: everyone deserves to know what is happening in their community, where their money is going, and who is responsible for the next action. Learn about our vision and values.",
  alternates: { canonical: canonical("/about") },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: `About ${SITE_NAME}`,
          url: canonical("/about"),
          about: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        }}
      />
      <PageHero
        eyebrow="About"
        title="A transparent, organized, intelligent digital home for every residential community"
        answer="Nivaasos exists because of a simple belief: everyone deserves to know what is happening in their community, where their money is going, and who is responsible for the next action."
        breadcrumb={{ label: "About", path: "/about" }}
      />

      <Block>
        <div className="mx-auto max-w-3xl space-y-5 text-[15px] leading-relaxed text-pine-800/90">
          <p>
            Nivaasos began inside a real apartment community in Hyderabad,
            with real monthly collections, real vendor bills, and the real
            frustrations every community knows: decisions buried in group
            chats, payments tracked in one person&apos;s spreadsheet, and
            receipts that vanished exactly when someone asked about them. We
            built the software we wished our own community had — and then
            kept building until other communities wanted it too.
          </p>
          <p>
            The name comes from <em>nivaas</em> — dwelling, home. Our aim is
            for Nivaasos to be the digital home of a residential community:
            the place where its money, its upkeep, its records, and its
            decisions live together, visible to the people they belong to.
          </p>
          <p>
            We hold ourselves to the same standard we offer our customers:
            transparency. That means honest product claims (you&apos;ll find
            our current status stated plainly on the{" "}
            <Link
              href="/product-facts"
              className="font-semibold text-pine-700 hover:underline"
            >
              product-facts page
            </Link>
            ), no invented testimonials or metrics anywhere on this site, and
            security commitments we can actually keep — described on the{" "}
            <Link
              href="/security"
              className="font-semibold text-pine-700 hover:underline"
            >
              security page
            </Link>
            .
          </p>
          <p>
            We&apos;re starting in Hyderabad, India, and building for
            communities everywhere. If that sounds like software your
            community deserves, we&apos;d love to talk:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-pine-700 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </Block>

      <Block
        tone="white"
        heading={{ eyebrow: "What we value", title: "The principles behind the product" }}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Transparency",
              d: "Every number should be able to explain itself — in the product, and in how we talk about the product.",
            },
            {
              t: "Accountability",
              d: "Every action has an owner, a status, and a history. Communities run on trust; records keep trust cheap.",
            },
            {
              t: "Simplicity",
              d: "Committee members and grandparents use this software. If a feature needs a manual, it isn't finished.",
            },
            {
              t: "Community",
              d: "The product serves the whole community — not just its administrators. Residents are users, not subjects.",
            },
          ].map((v) => (
            <div
              key={v.t}
              className="rounded-2xl border border-pine-100 bg-ivory p-5"
            >
              <h3 className="font-semibold text-pine-950">{v.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pine-800/80">
                {v.d}
              </p>
            </div>
          ))}
        </div>
      </Block>

      <RelatedLinks
        links={[
          { label: "Product facts", href: "/product-facts" },
          { label: "Security", href: "/security" },
          { label: "Contact", href: "/contact" },
        ]}
      />
      <FinalCta />
    </>
  );
}
