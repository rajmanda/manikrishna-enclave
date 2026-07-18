import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block } from "@/components/blocks";
import { canonical, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Nivaasos handles personal information on this website and in the Nivaasos application: what we collect, why, who can see it, and how to reach us.",
  alternates: { canonical: canonical("/privacy") },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        answer="This policy explains, in plain language, how Nivaasos handles personal information — on this public website and inside the Nivaasos application."
        breadcrumb={{ label: "Privacy Policy", path: "/privacy" }}
      />
      <Block>
        <div className="prose-sm mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-pine-800/90">
          <p className="text-xs text-pine-600">Last updated: July 2026.</p>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              On this website (nivaasos.com)
            </h2>
            <p className="mt-2">
              The public website does not require an account and does not
              display any community&apos;s private data. If you contact us or
              join a waitlist, the forms on this site open your own email
              application — the information you choose to send (such as your
              name, email, and community details) reaches us as an ordinary
              email, and we use it only to respond to your request. We do not
              sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              In the {SITE_NAME} application
            </h2>
            <p className="mt-2">
              The application stores the information a community needs to
              operate: member names and contact emails, apartment
              assignments and roles, invoices, payments, expenses,
              maintenance records, documents, and an audit history of
              actions. This data is entered by and belongs to the community;
              it is visible only to members that community has authorized,
              according to their role. Sign-in uses Google authentication —
              we never receive or store your Google password.
            </p>
            <p className="mt-2">
              Application data is hosted with established cloud
              infrastructure providers. We use it to provide the service —
              not for advertising, and never to publish anything on this
              public website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pine-950">
              Your choices
            </h2>
            <p className="mt-2">
              Community members who want their information corrected or
              removed should contact their community administrator or
              property manager, who controls the community&apos;s member
              list. For anything else — questions, corrections, or concerns
              about this policy — email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-pine-700 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p className="mt-2">
              As {SITE_NAME} grows, this policy will be extended and
              refined; material changes will update the date at the top of
              this page.
            </p>
          </section>
        </div>
      </Block>
    </>
  );
}
