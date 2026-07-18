import type { Metadata } from "next";
import { CalendarCheck, MessagesSquare, Rocket } from "lucide-react";
import LeadForm from "@/components/LeadForm";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks } from "@/components/blocks";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Request a demo — start your community on Nivaasos",
  description:
    "Request a Nivaasos demo or start your apartment community: tell us about your community and we'll walk you through billing, expenses, maintenance, and the resident experience.",
  alternates: { canonical: canonical("/request-demo") },
};

export default function RequestDemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Get started"
        title="See Nivaasos with your community's eyes"
        answer="Tell us a little about your community and we'll set up a walkthrough: billing and collections, expenses with receipts, maintenance from request to completion, and what owners and residents will see. If you're ready, the same conversation starts your community's workspace."
        breadcrumb={{ label: "Request a demo", path: "/request-demo" }}
      />
      <Block>
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-6">
            {[
              {
                icon: MessagesSquare,
                t: "1 · Tell us about your community",
                d: "Size, city, how you run things today, and what hurts most — WhatsApp bookkeeping, collections, maintenance chaos.",
              },
              {
                icon: CalendarCheck,
                t: "2 · Get a guided walkthrough",
                d: "We demo the manager's, owner's, and resident's views with fictional data, focused on your situation.",
              },
              {
                icon: Rocket,
                t: "3 · Start your community",
                d: "If it fits, we set up your workspace and the guided setup assistant takes you from flats to first invoices.",
              },
            ].map((s) => (
              <div key={s.t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-semibold text-pine-950">{s.t}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-pine-800/80">
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-pine-100 bg-white p-6 shadow-card">
            <LeadForm kind="demo" />
          </div>
        </div>
      </Block>
      <RelatedLinks
        links={[
          { label: "How it works", href: "/how-it-works" },
          { label: "For apartment communities", href: "/apartment-communities" },
          { label: "For property managers", href: "/property-managers" },
          { label: "FAQ", href: "/faq" },
        ]}
      />
    </>
  );
}
