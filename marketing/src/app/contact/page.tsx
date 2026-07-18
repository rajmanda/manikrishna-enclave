import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import LeadForm from "@/components/LeadForm";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks } from "@/components/blocks";
import { APP_URL, canonical, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — talk to the Nivaasos team",
  description:
    "Contact Nivaasos about your apartment community, a demo, partnership, or support. Email us or use the contact form — we respond to every message.",
  alternates: { canonical: canonical("/contact") },
};

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: `Contact ${SITE_NAME}`,
          url: canonical("/contact"),
        }}
      />
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        answer={`The fastest way to reach the Nivaasos team is email: ${CONTACT_EMAIL}. Use the form below and we'll get back to you about demos, onboarding your community, partnerships, or support.`}
        breadcrumb={{ label: "Contact", path: "/contact" }}
      />
      <Block>
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-5 text-sm leading-relaxed text-pine-800/90">
            <div>
              <h2 className="font-semibold text-pine-950">General & sales</h2>
              <p className="mt-1">
                Questions about the product, pricing conversations, or
                bringing your community aboard —{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold text-pine-700 hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-pine-950">Residents</h2>
              <p className="mt-1">
                If you live in a community that uses Nivaasos, sign in at{" "}
                <a
                  href={APP_URL}
                  className="font-semibold text-pine-700 hover:underline"
                >
                  the resident login
                </a>
                . Can&apos;t sign in? Contact your community administrator or
                property manager — they control who has access.
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-pine-950">Security reports</h2>
              <p className="mt-1">
                Believe you&apos;ve found a vulnerability? Please email us
                with details — we take reports seriously and will respond.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-pine-100 bg-white p-6 shadow-card">
            <LeadForm kind="contact" />
          </div>
        </div>
      </Block>
      <RelatedLinks
        links={[
          { label: "Request a demo", href: "/request-demo" },
          { label: "FAQ", href: "/faq" },
          { label: "About", href: "/about" },
        ]}
      />
    </>
  );
}
