import type { Metadata } from "next";
import FinalCta from "@/components/FinalCta";
import FaqList from "@/components/FaqList";
import PageHero from "@/components/PageHero";
import { Block, RelatedLinks } from "@/components/blocks";
import { AVAILABILITY_STATEMENT, canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ — apartment community management questions, answered",
  description:
    "Answers to common questions about Nivaasos and apartment community management: maintenance-fee tracking, special assessments, expense transparency, tenant payments, resident portals, and data privacy.",
  alternates: { canonical: canonical("/faq") },
};

const FAQS = [
  {
    q: "What is apartment community management software?",
    a: "Software that runs the shared operations of an apartment community in one system: billing maintenance fees, tracking payments and expenses, managing maintenance requests and work orders, storing documents, and communicating with residents — with role-based access so each member sees what they're authorized to see. Nivaasos is community management software with a particular focus on financial transparency.",
  },
  {
    q: "How can an apartment association track monthly maintenance fees?",
    a: "By generating a recurring invoice for every apartment each month and recording payments against those invoices. In Nivaasos this is one click: each apartment gets its invoice, owners see their own balance and due date, payments (including tenant-paid ones) are recorded with method and reference, and the association sees who has paid and who hasn't — without maintaining a spreadsheet.",
  },
  {
    q: "How should special assessments be collected from apartment owners?",
    a: "As a separate, clearly labeled one-time invoice — not mixed into the monthly fee — ideally with installment options and a visible link to the project being funded. Nivaasos bills special assessments per apartment, tracks collection progress, and connects the collected money to the project's work order and final expense so owners can see what the assessment actually paid for.",
  },
  {
    q: "How can apartment expenses be divided transparently?",
    a: "Record each expense once with its receipt, state the allocation rule, and let every owner see both. Nivaasos keeps an expense ledger by month and category with attached receipts, allocates shared costs across apartments, and keeps apartment-specific charges (like a private repair) on that apartment's ledger instead of the community's.",
  },
  {
    q: "What should an apartment association financial report include?",
    a: "At minimum: what was billed and collected, what was spent (by category, with receipts available), outstanding dues, and the reserve-fund position — for a stated period. Nivaasos produces these views continuously from the underlying records, so a 'report' is a live, verifiable summary rather than a manually assembled document.",
  },
  {
    q: "How can residents verify where community maintenance funds are spent?",
    a: "By having read access to the expense ledger and its receipts. In Nivaasos, authorized residents can open community expenses, see the supporting documents, and trace a charge back to the maintenance request and work order that caused it — the answer to 'where did the money go?' is in the system, not in a committee member's memory.",
  },
  {
    q: "How does a resident maintenance portal work?",
    a: "A resident signs in, reports an issue with photos, and follows its progress as the manager classifies it, assigns a vendor, and completes the work order. The resident also sees their invoices, balances, notices, and permitted documents. In Nivaasos, sign-in uses the resident's existing Google account and access is limited to what their community has authorized.",
  },
  {
    q: "How should tenant-paid maintenance fees be credited to an owner?",
    a: "The invoice remains the owner's responsibility, and the tenant's payment settles it on the owner's behalf — recorded with the tenant named as payer. Nivaasos does exactly this: the owner's ledger shows the payment credited with 'paid by tenant on behalf of owner,' the receipt goes to the person who paid, and no duplicate receivable is ever created.",
  },
  {
    q: "How can an apartment community move away from WhatsApp and spreadsheets?",
    a: "Incrementally: keep chat for conversation and move records out of it. Most communities start by setting up apartments and members and running one month's billing in Nivaasos, then add expenses with receipts, then maintenance and documents. Because every member sees their own balance, the 'please share the sheet' messages stop on their own.",
  },
  {
    q: "Is Nivaasos available on Android and iOS?",
    a: AVAILABILITY_STATEMENT,
  },
  {
    q: "Who can see my community's data?",
    a: "Only members your community has authorized, each within their role. Communities are strictly isolated from one another, authorization is enforced on the server for every request, and this public website has no access to any community's records.",
  },
  {
    q: "Does Nivaasos handle the money itself?",
    a: "No. Nivaasos records and reconciles payments, but it is not a bank or payment institution. Communities collect money through their existing methods (UPI, bank transfer, cash, cheque) and record them in Nivaasos, where managers confirm owner-reported payments before they count.",
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions communities actually ask"
        answer="Direct answers about Nivaasos and about running an apartment community well — fees, assessments, expense transparency, tenant payments, portals, and privacy."
        breadcrumb={{ label: "FAQ", path: "/faq" }}
      />
      <Block>
        <div className="mx-auto max-w-3xl">
          <FaqList faqs={FAQS} withSchema />
        </div>
      </Block>
      <RelatedLinks
        links={[
          { label: "Product facts", href: "/product-facts" },
          { label: "Community accounting software", href: "/community-accounting" },
          { label: "How it works", href: "/how-it-works" },
          { label: "Contact us", href: "/contact" },
        ]}
      />
      <FinalCta />
    </>
  );
}
