import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block } from "@/components/blocks";
import { canonical, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern use of the Nivaasos website and application: accounts and authorization, community data ownership, acceptable use, and service changes.",
  alternates: { canonical: canonical("/terms") },
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        answer="These terms govern use of the Nivaasos website and application. They are written to be read — short, plain, and honest."
        breadcrumb={{ label: "Terms of Service", path: "/terms" }}
      />
      <Block>
        <div className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-pine-800/90">
          <p className="text-xs text-pine-600">Last updated: July 2026.</p>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              Accounts and authorization
            </h2>
            <p className="mt-2">
              Access to the {SITE_NAME} application is by community
              authorization: your community's administrator or property
              manager adds you, and your access is limited to your role and
              your community. You agree to use only access you have been
              granted and not to attempt to reach other communities' data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              Community data
            </h2>
            <p className="mt-2">
              Data entered by a community belongs to that community.{" "}
              {SITE_NAME} processes it to provide the service, as described
              in the Privacy Policy. Communities are responsible for the
              accuracy of what they record and for administering their own
              member lists.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              What {SITE_NAME} is — and isn't
            </h2>
            <p className="mt-2">
              {SITE_NAME} is community-management software. It records and
              organizes financial information but is not a bank, payment
              institution, accountant, or auditor, and does not hold or
              transfer community funds. Communities remain responsible for
              their own financial and legal compliance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              Acceptable use
            </h2>
            <p className="mt-2">
              Don&apos;t misuse the service: no attempts to break
              authentication or authorization, no scraping of private data,
              no unlawful content, and no use that disrupts the service for
              others. We may suspend access that violates these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              Service changes and contact
            </h2>
            <p className="mt-2">
              The product will evolve, and features may change as it does.
              The service is provided without warranties of uninterrupted
              availability. Material changes to these terms will update the
              date above. Questions:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-pine-700 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </Block>
    </>
  );
}
