"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Globe,
  Home,
  KeyRound,
  LayoutGrid,
  Lock,
  LucideIcon,
  Megaphone,
  MessageSquare,
  Percent,
  Receipt,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
  Vote,
  Wrench,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Audience definitions                                                */
/* ------------------------------------------------------------------ */

type AudienceKey =
  | "manager"
  | "committee"
  | "portfolio"
  | "owner"
  | "tenant"
  | "auditor";

interface Audience {
  key: AudienceKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  tagline: string;
  /** query string appended to /get-started links for this audience */
  ctaQuery: string;
  ctaLabel: string;
}

const AUDIENCES: Audience[] = [
  {
    key: "manager",
    label: "Property Manager",
    shortLabel: "Manager",
    icon: Briefcase,
    tagline: "I run day-to-day operations for a community",
    ctaQuery: "?role=manager",
    ctaLabel: "Get My Free Sandbox",
  },
  {
    key: "committee",
    label: "RWA Committee / Admin",
    shortLabel: "Committee",
    icon: Users,
    tagline: "I'm a President, Treasurer, or Secretary of our association",
    ctaQuery: "?role=president",
    ctaLabel: "Get My Free Sandbox",
  },
  {
    key: "portfolio",
    label: "Management Company / Builder",
    shortLabel: "Portfolio",
    icon: LayoutGrid,
    tagline: "I oversee multiple communities or hand over new projects",
    ctaQuery: "?plan=portfolio",
    ctaLabel: "Talk to Our Team",
  },
  {
    key: "owner",
    label: "Apartment Owner",
    shortLabel: "Owner",
    icon: KeyRound,
    tagline: "I own a flat and want to know where my money goes",
    ctaQuery: "?role=owner",
    ctaLabel: "See It For Yourself",
  },
  {
    key: "tenant",
    label: "Tenant / Resident",
    shortLabel: "Tenant",
    icon: Home,
    tagline: "I live in a community and want hassle-free living",
    ctaQuery: "?role=tenant",
    ctaLabel: "See It For Yourself",
  },
  {
    key: "auditor",
    label: "Auditor / CA",
    shortLabel: "Auditor",
    icon: Search,
    tagline: "I audit society accounts and need clean records",
    ctaQuery: "?role=auditor",
    ctaLabel: "Explore The Audit Trail",
  },
];

const audienceByKey = (key: AudienceKey) =>
  AUDIENCES.find((a) => a.key === key)!;

/* ------------------------------------------------------------------ */
/* Small shared building blocks                                        */
/* ------------------------------------------------------------------ */

function FeatureRow({
  icon: Icon,
  title,
  desc,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2 flex-wrap">
          {title}
          {badge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
              {badge}
            </span>
          )}
        </h4>
        <p className="text-slate-600 text-sm">{desc}</p>
      </div>
    </div>
  );
}

function SplitSlide({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
      <div className="space-y-5">{left}</div>
      {right}
    </div>
  );
}

function InlineCta({ audience }: { audience: Audience }) {
  return (
    <Link
      href={`/get-started${audience.ctaQuery}`}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-brand-glow hover:bg-brand-700 transition-all"
    >
      {audience.ctaLabel} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Product mockups (reused across audience decks)                      */
/* ------------------------------------------------------------------ */

function InvoiceMockup() {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
      <div className="flex justify-between items-start pb-4 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold text-slate-400">INVOICE</span>
          <h4 className="text-sm font-bold text-slate-800">INV-2026-07-101</h4>
          <span className="text-[10px] text-slate-500">Lotus Enclave • Flat 101</span>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
          Outstanding
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Monthly Maintenance</span>
          <span className="font-mono font-semibold">₹3,500.00</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Generator Fuel Surcharge</span>
          <span className="font-mono font-semibold">₹500.00</span>
        </div>
        <div className="flex justify-between text-red-500">
          <span className="font-medium">Late Fee (Overdue 10 days)</span>
          <span className="font-mono font-semibold">₹100.00</span>
        </div>
        <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-sm text-slate-900">
          <span>Total Amount Due</span>
          <span className="font-mono">₹4,100.00</span>
        </div>
      </div>

      <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white transition-all hover:bg-brand-700 shadow-xs">
        <FileText className="h-4 w-4" /> Download PDF Invoice
      </button>
    </div>
  );
}

function LedgerMockup() {
  return (
    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-white p-3 rounded-2xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">This Month's Inflow</span>
          <span className="text-lg font-bold text-emerald-600 tabular font-mono">₹38,500</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Outflow (Expenses)</span>
          <span className="text-lg font-bold text-slate-800 tabular font-mono">₹14,200</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase block">Recent Expenses</span>

        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h5 className="text-xs font-bold text-slate-800">Water Tanker Supply (5 loads)</h5>
            <span className="text-[10px] text-slate-500">Paid to AquaPure Solutions • July 5</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold font-mono text-slate-800 block">₹7,500.00</span>
            <span className="text-[9px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-md font-semibold cursor-pointer">
              View Receipt
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h5 className="text-xs font-bold text-slate-800">Watchman Monthly Salary</h5>
            <span className="text-[10px] text-slate-500">Paid to Security Staff • July 1</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold font-mono text-slate-800 block">₹6,000.00</span>
            <span className="text-[9px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-md font-semibold cursor-pointer">
              View Receipt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkOrderMockup() {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase">WORK ORDER #WO-094</span>
          <h4 className="text-sm font-bold text-slate-800">Borewell Motor Rewinding</h4>
        </div>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          In Progress
        </span>
      </div>

      <div className="space-y-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <User className="h-3.5 w-3.5" />
          <span>Assigned Vendor: <strong>Apex Power Systems</strong></span>
        </div>

        <div className="py-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Pipeline Status</span>
          <div className="flex items-center justify-between text-[9px] font-semibold text-slate-400">
            <span className="text-emerald-600 flex items-center gap-0.5">✓ Reported</span>
            <span className="h-px bg-emerald-200 flex-1 mx-1" />
            <span className="text-emerald-600 flex items-center gap-0.5">✓ Approved</span>
            <span className="h-px bg-blue-200 flex-1 mx-1" />
            <span className="text-blue-600 font-bold">● In Progress</span>
            <span className="h-px bg-slate-200 flex-1 mx-1" />
            <span>Completed</span>
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold uppercase">
            Photo
          </div>
          <div>
            <span className="font-bold text-slate-700 block">Estimate Approved</span>
            <span className="text-slate-500 text-[10px]">Cost: ₹4,500 • Approved by RWA Secretary</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PollMockup() {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-4">
      <div>
        <span className="text-[10px] text-slate-400 font-bold uppercase">ACTIVE SOCIETY POLL</span>
        <h4 className="text-sm font-bold text-slate-800 leading-snug">
          Increase monthly maintenance reserve contribution by ₹500 starting next quarter?
        </h4>
        <p className="text-[10px] text-slate-500 mt-1">Closes: July 15, 2026 • 1 Vote per Apartment</p>
      </div>

      <div className="space-y-3">
        <div className="relative border border-brand-200 bg-brand-50/50 p-3 rounded-2xl cursor-pointer">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Yes, approve the increase</span>
            <span className="text-brand-600">70% (7 votes)</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: "70%" }} />
          </div>
        </div>

        <div className="relative border border-slate-200 p-3 rounded-2xl cursor-pointer">
          <div className="flex justify-between items-center text-xs text-slate-600">
            <span>No, keep current rate</span>
            <span className="font-semibold text-slate-800">30% (3 votes)</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-400 rounded-full" style={{ width: "30%" }} />
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10px] text-slate-500 text-center">
        Your flat (Apt 101) has successfully voted: <strong>Yes</strong>
      </div>
    </div>
  );
}

function AuditTrailMockup() {
  const rows = [
    { who: "Suresh (Manager)", what: "Recorded expense: Water Tanker ₹7,500", when: "Jul 5, 10:42 AM", tone: "text-slate-700" },
    { who: "Karan (Admin)", what: "Approved work order WO-094 estimate", when: "Jul 3, 6:15 PM", tone: "text-slate-700" },
    { who: "Suresh (Manager)", what: "Generated 10 invoices for July cycle", when: "Jul 1, 9:00 AM", tone: "text-slate-700" },
    { who: "System", what: "Late fee auto-applied to Flat 202", when: "Jul 1, 12:01 AM", tone: "text-amber-700" },
  ];
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <ShieldCheck className="h-5 w-5 text-brand-600" />
        <div>
          <h4 className="text-sm font-bold text-slate-800">Immutable Audit Log</h4>
          <span className="text-[10px] text-slate-500">Append-only • No edits, no deletions</span>
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs flex justify-between items-start gap-2">
            <div>
              <span className={`font-bold block ${r.tone}`}>{r.what}</span>
              <span className="text-[10px] text-slate-500">{r.who}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">{r.when}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" /> Every record is timestamped and tamper-evident
      </div>
    </div>
  );
}

function PortfolioMockup() {
  const communities = [
    { name: "Lotus Enclave", units: 10, collected: 96 },
    { name: "Greenwood Heights", units: 24, collected: 91 },
    { name: "Sai Residency", units: 16, collected: 88 },
  ];
  return (
    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-md space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase block">Portfolio Console</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
          Early Access Preview
        </span>
      </div>
      {communities.map((c) => (
        <div key={c.name} className="bg-white p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div>
            <h5 className="text-xs font-bold text-slate-800">{c.name}</h5>
            <span className="text-[10px] text-slate-500">{c.units} units • July cycle billed</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold font-mono text-emerald-600 block">{c.collected}%</span>
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Collected</span>
          </div>
        </div>
      ))}
      <div className="bg-brand-50 border border-brand-100 p-3 rounded-2xl text-center">
        <span className="text-[10px] font-semibold text-brand-700">
          + Add a new community in under 10 minutes
        </span>
      </div>
    </div>
  );
}

function NoticeFeedMockup() {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Megaphone className="h-5 w-5 text-brand-600" />
        <h4 className="text-sm font-bold text-slate-800">Community Feed</h4>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
        <span className="text-[10px] font-bold text-brand-600 uppercase">Notice • Today</span>
        <h5 className="text-xs font-bold text-slate-800 mt-0.5">Water supply maintenance on Saturday</h5>
        <p className="text-[10px] text-slate-500 mt-1">
          Borewell motor service scheduled 10 AM – 1 PM. Please store water in advance.
        </p>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
        <span className="text-[10px] font-bold text-emerald-600 uppercase">Update • Yesterday</span>
        <h5 className="text-xs font-bold text-slate-800 mt-0.5">Lift AMC service completed ✓</h5>
        <p className="text-[10px] text-slate-500 mt-1">
          Both lifts serviced and certified. Next service due October 2026.
        </p>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Poll • 2 days ago</span>
        <h5 className="text-xs font-bold text-slate-800 mt-0.5">Diwali celebration budget — vote now</h5>
      </div>
    </div>
  );
}

function WhatsAppMockup() {
  const messages = [
    { emoji: "🧾", text: "Your July maintenance invoice (₹4,100) is ready. Tap to view & download the PDF.", time: "9:02 AM" },
    { emoji: "✅", text: "Payment of ₹3,500 received for Flat 101. Your receipt is attached. Thank you!", time: "11:47 AM" },
    { emoji: "🔧", text: "Update: Work order WO-094 (Borewell Motor) is now marked Completed. Photos available in the portal.", time: "4:15 PM" },
    { emoji: "📢", text: "Announcement: Water supply maintenance this Saturday, 10 AM – 1 PM. Please store water in advance.", time: "6:30 PM" },
  ];
  return (
    <div className="bg-[#e5ddd5] p-4 rounded-3xl border border-slate-200 shadow-md space-y-3 relative overflow-hidden">
      <div className="flex items-center gap-2.5 bg-emerald-700 -m-4 mb-0 p-3 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-700 shrink-0">
          <Building2 className="h-4 w-4" />
        </span>
        <div>
          <h4 className="text-xs font-bold text-white">NivaasOS Updates</h4>
          <span className="text-[9px] text-emerald-100">Official community alerts • Notifications only</span>
        </div>
      </div>
      <div className="space-y-2.5 pt-2">
        {messages.map((m, i) => (
          <div key={i} className="bg-white p-2.5 rounded-xl rounded-tl-none shadow-xs max-w-[92%] text-[11px] text-slate-700 leading-snug">
            <span className="mr-1">{m.emoji}</span>
            {m.text}
            <span className="block text-right text-[8px] text-slate-400 mt-0.5">{m.time} ✓✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacyMockup() {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
      <div className="flex items-center gap-3 text-slate-800 font-bold border-b border-slate-100 pb-3">
        <ShieldCheck className="h-6 w-6 text-brand-600" />
        <div>
          <h4 className="text-sm font-bold text-slate-800">Our Data Protection Pledge</h4>
          <span className="text-[10px] text-slate-500 font-normal">Your community's data belongs to your community</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <span className="font-bold block text-slate-800">Aditya Rao</span>
            <span className="text-slate-500 font-mono text-[10px]">aditya.rao@gmail.com</span>
          </div>
          <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
            Whitelisted (Apt 101)
          </span>
        </div>

        <div className="bg-red-50 p-2.5 rounded-xl border border-red-100 flex items-center justify-between text-red-700">
          <div>
            <span className="font-bold block text-red-900">Unknown Account</span>
            <span className="text-red-600 font-mono text-[10px]">unauthorized@domain.com</span>
          </div>
          <span className="text-[9px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-semibold">
            Blocked Access
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-2.5">
          <Lock className="h-4 w-4 text-brand-600 mx-auto mb-1" />
          <span className="text-[10px] font-semibold text-slate-600 block">Encrypted in transit (TLS)</span>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-2.5">
          <Globe className="h-4 w-4 text-brand-600 mx-auto mb-1" />
          <span className="text-[10px] font-semibold text-slate-600 block">Google Cloud + MongoDB Atlas</span>
        </div>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 text-center">
        <span className="text-[11px] font-bold text-brand-800">
          Never sold. Never shared. Never mined for ads.
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slide types & shared slides                                         */
/* ------------------------------------------------------------------ */

interface Slide {
  title: string;
  subtitle: string;
  content: ReactNode;
}

function whatsappSlide(): Slide {
  return {
    title: "Smart WhatsApp Alerts",
    subtitle: "We ended the WhatsApp chaos — and kept WhatsApp",
    content: (
      <SplitSlide
        left={
          <>
            <FeatureRow
              icon={MessageSquare}
              title="Updates Where People Already Are"
              desc="New invoices, payment confirmations, work-order progress, and official announcements are delivered straight to residents' WhatsApp — no new app habit needed, and elders feel right at home."
            />
            <FeatureRow
              icon={Megaphone}
              title="Signal, Not Noise"
              desc="These are one-way official alerts from the system — not another argument group. The chaos stays gone; only the updates that matter arrive."
            />
            <FeatureRow
              icon={Check}
              title="Every Channel Covered"
              desc="Each alert also lands in the portal and email, so whether someone lives on WhatsApp or checks the dashboard weekly, nobody misses a thing."
            />
          </>
        }
        right={<WhatsAppMockup />}
      />
    ),
  };
}

function privacySlide(): Slide {
  return {
    title: "Data Protection & Privacy",
    subtitle: "Bank-grade discipline for your community's data",
    content: (
      <SplitSlide
        left={
          <>
            <FeatureRow
              icon={ShieldCheck}
              title="Whitelist-Only Access"
              desc="Only email addresses your admin adds can sign in. Everyone else is blocked at the door — no open registrations, no strangers."
            />
            <FeatureRow
              icon={UserCheck}
              title="Role-Based Access Control"
              desc="Managers, committee members, owners, tenants, and auditors each see exactly what their role permits — nothing more."
            />
            <FeatureRow
              icon={Lock}
              title="Isolated & Auditable"
              desc="Every community's data is strictly isolated from every other community, and every change is written to a permanent audit trail. Designed around India's DPDP Act principles."
            />
          </>
        }
        right={<PrivacyMockup />}
      />
    ),
  };
}

function ctaSlide(audience: Audience): Slide {
  return {
    title: "Simple, SaaS-Based Pricing",
    subtitle: "Start running your society professionally today",
    content: (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch h-full max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-3xl border-2 border-brand-500 shadow-md space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <h4 className="text-lg font-bold text-slate-800">Community</h4>
                <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  Popular
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1">For active RWAs. 30 days free, card required to start.</p>
              <div className="text-2xl font-black text-slate-900 font-mono mt-3">
                ₹2,999<span className="text-xs font-normal text-slate-500"> / month</span>
              </div>
              <ul className="text-xs space-y-2 text-slate-600 mt-4">
                <li className="flex items-center gap-1.5 font-semibold text-brand-600"><Check className="h-3.5 w-3.5" /> 30-Day Free Trial</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Unlimited Apartments</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Work Orders & Vendors</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Polls & Voting</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Reserve Fund Accounting</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Document Vault & Minutes</li>
              </ul>
            </div>
            <Link
              href={`/get-started${audience.key === "portfolio" ? "?role=manager" : audience.ctaQuery}`}
              className="mt-6 block w-full text-center rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm transition-colors"
            >
              Start 30-Day Trial
            </Link>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 hover:border-brand-400 transition-colors flex flex-col justify-between">
            <div>
              <h4 className="text-lg font-bold text-slate-800">Portfolio</h4>
              <p className="text-slate-500 text-xs mt-1">For professional estate managers & builders.</p>
              <div className="text-2xl font-black text-slate-900 font-mono mt-3">
                Custom
              </div>
              <ul className="text-xs space-y-2 text-slate-600 mt-4">
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Multi-Community Console</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Consolidated Invoicing</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> WhatsApp bot alerts (paid AI add-on)</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> White-label Domains</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> 24/7 Dedicated Support</li>
              </ul>
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                Console, consolidated invoicing & white-label are in early access — shaped hands-on with our first portfolio partners.
              </p>
            </div>
            <Link
              href="/get-started?plan=portfolio"
              className="mt-6 block w-full text-center rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Talk to us
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          * 30-day trials require card verification to prevent abuse. Cancel anytime during the trial with zero charges or obligations.
        </p>
      </>
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Audience decks                                                      */
/* ------------------------------------------------------------------ */

function introSlide(
  audience: Audience,
  headline: string,
  bullets: { title: string; desc: string }[],
  highlights: { stat: string; label: string }[]
): Slide {
  return {
    title: `NivaasOS for ${audience.label}s`,
    subtitle: headline,
    content: (
      <SplitSlide
        left={
          <>
            {bullets.map((b) => (
              <div key={b.title}>
                <h3 className="text-xl font-bold text-slate-800">{b.title}</h3>
                <p className="text-slate-600 leading-relaxed">{b.desc}</p>
              </div>
            ))}
            <div className="pt-2">
              <InlineCta audience={audience} />
            </div>
          </>
        }
        right={
          <div className="bg-brand-900 p-8 rounded-3xl shadow-lg text-white space-y-6 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl"
            />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-3 py-1 text-xs font-semibold text-brand-200 relative z-10">
              <Sparkles className="h-3.5 w-3.5" /> Why {audience.shortLabel}s love NivaasOS
            </span>
            <div className="space-y-5 relative z-10">
              {highlights.map((h) => (
                <div key={h.label} className="border-b border-brand-800 pb-4 last:border-0 last:pb-0">
                  <span className="text-2xl font-black tracking-tight block">{h.stat}</span>
                  <span className="text-xs text-brand-200 font-medium">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />
    ),
  };
}

function buildDeck(audience: Audience): Slide[] {
  switch (audience.key) {
    case "manager":
      return [
        introSlide(
          audience,
          "Run every building like a pro — without drowning in follow-ups",
          [
            {
              title: "Stop chasing payments on WhatsApp",
              desc: "Invoices go out in one click, late fees apply themselves, and residents can see exactly what they owe — so you don't have to keep asking.",
            },
            {
              title: "Prove every rupee, effortlessly",
              desc: "Attach a receipt photo to each expense as you record it. When an owner asks \"where did the money go?\", the answer is already published.",
            },
            {
              title: "Look brilliant in every committee meeting",
              desc: "Walk in with a live ledger, collection rates, and work-order status. No more all-nighters assembling Excel reports.",
            },
          ],
          [
            { stat: "1 click", label: "to bill every flat for the month" },
            { stat: "0 lost receipts", label: "every expense carries its proof" },
            { stat: "10 minutes", label: "to set up a new community" },
          ]
        ),
        {
          title: "Automated Invoices & Collections",
          subtitle: "Get paid on time with zero tracking friction",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Receipt} title="1-Click Bulk Generation" desc="Generate monthly recurring maintenance bills for all flats simultaneously, with customizable calculation metrics." />
                  <FeatureRow icon={Percent} title="Auto Late Fees & Credits" desc="Apply fine percentages automatically on overdue balances, with granular control over grace periods." />
                  <FeatureRow icon={FileText} title="Digital PDF Statements" desc="Residents receive clean itemized invoices they can download or print, complete with past payment logs." />
                </>
              }
              right={<InvoiceMockup />}
            />
          ),
        },
        {
          title: "Work Orders & Vendor Management",
          subtitle: "Track community repairs from reported to resolved",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Wrench} title="Complete Lifecycle Pipeline" desc="Move every issue — lift, generator, plumbing — through Estimate → Approval → In Progress → Closed, with nothing falling through the cracks." />
                  <FeatureRow icon={User} title="Your Vendor Black Book" desc="Electricians, plumbers, AMC agencies — contacts, contracts, ratings, and payout history in one place." />
                  <FeatureRow icon={MessageSquare} title="Fewer Phone Calls" desc="Residents see status updates automatically, so 'any update on the lift?' calls stop reaching your phone." />
                </>
              }
              right={<WorkOrderMockup />}
            />
          ),
        },
        {
          title: "Reports That Do Your Talking",
          subtitle: "A live ledger the whole community can verify",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={BarChart3} title="Live Financial Summary" desc="Monthly income, expenses, outstanding collections, and reserve fund balances — always current, never reconstructed." />
                  <FeatureRow icon={Check} title="Verifiable Receipts" desc="Owners click to view the actual bill behind every expense. Trust is built in, not asked for." />
                  <FeatureRow icon={ShieldCheck} title="Immutable Audit Trail" desc="Every action you take is permanently logged — your best defence against 'who approved this?' disputes." />
                </>
              }
              right={<LedgerMockup />}
            />
          ),
        },
        whatsappSlide(),
        privacySlide(),
        ctaSlide(audience),
      ];

    case "committee":
      return [
        introSlide(
          audience,
          "Lead your society with total transparency — and zero accusations",
          [
            {
              title: "End the AGM shouting matches",
              desc: "When every rupee of income and expense is published with receipts, there is nothing left to argue about. Volunteers stop being suspects.",
            },
            {
              title: "Decisions made in the open",
              desc: "Major calls — maintenance hikes, big repairs, festival budgets — go to a digital vote. One flat, one vote, results computed automatically.",
            },
            {
              title: "Hand over cleanly",
              desc: "When your committee term ends, the next team inherits a complete, organized digital record — not a carton of loose papers.",
            },
          ],
          [
            { stat: "100%", label: "of expenses published with receipts" },
            { stat: "1 flat = 1 vote", label: "fair, tamper-proof digital polls" },
            { stat: "Forever", label: "every decision preserved in the audit log" },
          ]
        ),
        {
          title: "Transparent Community Ledger",
          subtitle: "Show residents exactly where the money is spent",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={BarChart3} title="Live Financial Summary" desc="Monthly income, expenses, outstanding collections, and reserve fund balances updated dynamically." />
                  <FeatureRow icon={Check} title="Verifiable Receipts" desc="Receipts are uploaded to the cloud with every expense. Residents click to view and verify — no more 'trust me'." />
                  <FeatureRow icon={ShieldCheck} title="Immutable Audit Trail" desc="Every addition, edit, or payment record is written to a permanent audit history that cannot be manipulated." />
                </>
              }
              right={<LedgerMockup />}
            />
          ),
        },
        {
          title: "Democratic Governance & Polls",
          subtitle: "Make community decisions in the open, not behind closed doors",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Vote} title="1 Flat = 1 Vote Rules" desc="Ensure fair decisions. The system allows exactly one vote per flat, even if one owner owns multiple units." />
                  <FeatureRow icon={MessageSquare} title="AGM Meeting Minutes" desc="Store agendas, resolution drafts, attendance registries, and meeting recordings. Fully searchable for later audits." />
                  <FeatureRow icon={FileText} title="Digital Document Vault" desc="Keep building plans, insurance policies, AMC contracts, and bylaws in a secure, version-controlled repository." />
                </>
              }
              right={<PollMockup />}
            />
          ),
        },
        {
          title: "Automated Dues & Collections",
          subtitle: "Healthy finances without awkward conversations",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Receipt} title="Bills Go Out On Time, Every Time" desc="Monthly invoices are generated for all flats in one click — no treasurer burnout, no missed cycles." />
                  <FeatureRow icon={Percent} title="Late Fees Without the Friction" desc="The system applies agreed late fees automatically. The rules do the enforcing, not a neighbour." />
                  <FeatureRow icon={BarChart3} title="Collection Health at a Glance" desc="See outstanding dues per flat instantly and watch your collection rate climb month over month." />
                </>
              }
              right={<InvoiceMockup />}
            />
          ),
        },
        whatsappSlide(),
        privacySlide(),
        ctaSlide(audience),
      ];

    case "portfolio":
      return [
        introSlide(
          audience,
          "One console. Every community. Complete control.",
          [
            {
              title: "Scale without multiplying headcount",
              desc: "Standardize invoicing, expenses, and maintenance workflows across every property you manage — one playbook, many communities.",
            },
            {
              title: "Win new mandates with transparency",
              desc: "Pitch RWAs with live, verifiable books instead of promises. Communities switch to managers they can audit.",
            },
            {
              title: "Your brand, front and centre",
              desc: "White-label domains put your agency's name on the portal every resident opens — daily brand visibility included.",
            },
          ],
          [
            { stat: "∞ communities", label: "managed from a single console" },
            { stat: "10 minutes", label: "to onboard each new property" },
            { stat: "White-label", label: "your brand on every resident's screen" },
          ]
        ),
        {
          title: "Multi-Community Console",
          subtitle: "Your entire portfolio on a single screen",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={LayoutGrid} title="Portfolio Dashboard" badge="Early Access" desc="Collection rates, outstanding dues, and open work orders for every community, side by side." />
                  <FeatureRow icon={Building2} title="Strict Data Isolation" desc="Each community's data is fully isolated — residents of one property can never see another's records." />
                  <FeatureRow icon={ClipboardCheck} title="Standardized Operations" desc="Roll out the same invoicing rules, expense categories, and workflows across every property you win." />
                </>
              }
              right={<PortfolioMockup />}
            />
          ),
        },
        {
          title: "Consolidated Billing & White-Label",
          subtitle: "Built for professional estate management businesses",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Receipt} title="Consolidated Invoicing" badge="Early Access" desc="Bill all your communities from one place, and track your own management fees per property." />
                  <FeatureRow icon={Globe} title="White-Label Domains" badge="Early Access" desc="Run the portal on your own domain with your agency branding — residents see your name, powered by our engine." />
                  <FeatureRow icon={ShieldCheck} title="Audit-Ready by Default" desc="Every community you manage carries a permanent audit trail — your professionalism, provable to any committee." />
                </>
              }
              right={<InvoiceMockup />}
            />
          ),
        },
        whatsappSlide(),
        privacySlide(),
        ctaSlide(audience),
      ];

    case "owner":
      return [
        introSlide(
          audience,
          "Know exactly where your maintenance money goes",
          [
            {
              title: "See every rupee, with proof",
              desc: "Open the live ledger anytime and view the actual receipt behind every expense — watchman salary, water tankers, lift repairs, all of it.",
            },
            {
              title: "Your voice, actually counted",
              desc: "Vote on maintenance hikes and big repairs from your phone. One flat, one vote — decisions stop happening behind closed doors.",
            },
            {
              title: "Perfect for NRI & remote owners",
              desc: "Living in another city or country? Check your flat's dues, download statements, and vote in society decisions from anywhere in the world.",
            },
          ],
          [
            { stat: "24×7", label: "access to your society's live books" },
            { stat: "Every receipt", label: "one tap away, from anywhere" },
            { stat: "Your vote", label: "counted from any timezone" },
          ]
        ),
        {
          title: "Transparent Community Ledger",
          subtitle: "Your society's books, open to you at all times",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={BarChart3} title="Live Income & Expenses" desc="See this month's collections, spending, and reserve fund balance the moment they change — not once a year at the AGM." />
                  <FeatureRow icon={Check} title="Tap to Verify" desc="Every expense links to its uploaded receipt. Verify the water tanker bill yourself in two taps." />
                  <FeatureRow icon={ShieldCheck} title="Records Nobody Can Rewrite" desc="The audit trail is permanent and append-only, so history stays honest." />
                </>
              }
              right={<LedgerMockup />}
            />
          ),
        },
        {
          title: "Your Voice in Every Decision",
          subtitle: "Democratic, verifiable community governance",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Vote} title="Vote From Your Phone" desc="Maintenance hikes, lift replacements, festival budgets — cast your flat's vote in seconds, wherever you are." />
                  <FeatureRow icon={MessageSquare} title="Meeting Minutes On Record" desc="Missed the AGM? Read the minutes, resolutions, and attendance — all archived and searchable." />
                  <FeatureRow icon={FileText} title="Society Documents On Demand" desc="Bylaws, building plans, insurance policies — download what you need without chasing the secretary." />
                </>
              }
              right={<PollMockup />}
            />
          ),
        },
        {
          title: "Your Dues, Crystal Clear",
          subtitle: "No surprises, no disputes, no paper chase",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Receipt} title="Itemized Monthly Invoices" desc="See exactly what you're being charged and why — maintenance, surcharges, and any late fees, line by line." />
                  <FeatureRow icon={FileText} title="Statements & PDF Receipts" desc="Download clean PDF invoices and full payment history anytime — handy for records and tax filing." />
                  <FeatureRow icon={ShieldCheck} title="Elder-Friendly by Design" desc="Large text, high contrast, and one-tap downloads — built so every generation in the family can use it." />
                </>
              }
              right={<InvoiceMockup />}
            />
          ),
        },
        whatsappSlide(),
        privacySlide(),
        ctaSlide(audience),
      ];

    case "tenant":
      return [
        introSlide(
          audience,
          "Community living, minus the chaos",
          [
            {
              title: "Report issues without the runaround",
              desc: "Leaking pipe in the common area? Raise it in the app and watch it move from reported to fixed — no hunting for the manager's number.",
            },
            {
              title: "Never miss what matters",
              desc: "Water cuts, lift maintenance, community events — every notice reaches you in one feed instead of being buried in a WhatsApp group.",
            },
            {
              title: "Know your dues, keep your proof",
              desc: "Clear itemized bills and downloadable receipts for everything you pay — no disputes when it's time to settle with your landlord.",
            },
          ],
          [
            { stat: "1 feed", label: "every notice that affects your home" },
            { stat: "Live status", label: "on every complaint you raise" },
            { stat: "PDF proof", label: "of every payment you make" },
          ]
        ),
        {
          title: "Raise It, Track It, Done",
          subtitle: "Maintenance requests with real accountability",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Wrench} title="Transparent Repair Pipeline" desc="See exactly where your complaint stands — reported, approved, in progress, or completed — with photos of finished work." />
                  <FeatureRow icon={MessageSquare} title="Automatic Status Updates" desc="Get notified as things move. No follow-up calls, no 'we'll look into it'." />
                  <FeatureRow icon={User} title="Verified Vendors" desc="Repairs are handled by the community's registered vendors, with costs approved on the record." />
                </>
              }
              right={<WorkOrderMockup />}
            />
          ),
        },
        {
          title: "One Feed for Your Whole Community",
          subtitle: "Notices, updates, and events — without the group-chat noise",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={Megaphone} title="Official Notices Only" desc="Water supply schedules, maintenance windows, and community announcements — from the people actually running the property." />
                  <FeatureRow icon={Check} title="Updates You Can Trust" desc="When the lift is fixed or the generator serviced, you'll see it confirmed — with proof, not rumours." />
                  <FeatureRow icon={Vote} title="Community Events & Polls" desc="Festival plans, event budgets, shared decisions — stay in the loop and have your say where invited." />
                </>
              }
              right={<NoticeFeedMockup />}
            />
          ),
        },
        whatsappSlide(),
        privacySlide(),
        ctaSlide(audience),
      ];

    case "auditor":
      return [
        introSlide(
          audience,
          "Audit a society in hours, not weeks",
          [
            {
              title: "No more shoebox of receipts",
              desc: "Every expense is digitally recorded with its receipt attached at the moment of entry. The evidence trail builds itself all year round.",
            },
            {
              title: "An audit log you can actually trust",
              desc: "Append-only, timestamped, and tamper-evident. You see who did what and when — including the edits someone might prefer you didn't.",
            },
            {
              title: "Read-only access, formally scoped",
              desc: "Your auditor login can inspect everything and modify nothing — clean separation of duties, enforced by the system itself.",
            },
          ],
          [
            { stat: "Append-only", label: "audit log — nothing deleted, ever" },
            { stat: "Read-only", label: "auditor role enforced by the system" },
            { stat: "365 days", label: "of organized records, not year-end chaos" },
          ]
        ),
        {
          title: "The Immutable Audit Trail",
          subtitle: "Every action, permanently on the record",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={ShieldCheck} title="Tamper-Evident History" desc="Every create, update, and payment is logged with actor and timestamp. There is no 'quietly fixing' the books." />
                  <FeatureRow icon={Search} title="Trace Any Transaction" desc="Follow any rupee from invoice to payment to ledger entry, with the supporting document attached at each step." />
                  <FeatureRow icon={UserCheck} title="Separation of Duties" desc="Role-based access means the person recording expenses can't erase history, and auditors can't alter what they inspect." />
                </>
              }
              right={<AuditTrailMockup />}
            />
          ),
        },
        {
          title: "Clean Books, Ready to Verify",
          subtitle: "Ledgers, statements, and documents in one place",
          content: (
            <SplitSlide
              left={
                <>
                  <FeatureRow icon={BarChart3} title="Structured Ledger" desc="Income, expenses, outstanding dues, and reserve fund movements — categorized consistently across the whole year." />
                  <FeatureRow icon={FileText} title="Statements & Documents" desc="PDF statements, meeting minutes, contracts, and policies stored in a version-controlled vault — everything an audit needs, retrievable in seconds." />
                  <FeatureRow icon={Check} title="Receipts at the Source" desc="Each expense entry links to its uploaded bill. Vouching becomes a click, not a treasure hunt." />
                </>
              }
              right={<LedgerMockup />}
            />
          ),
        },
        privacySlide(),
        ctaSlide(audience),
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Audience picker (landing view)                                      */
/* ------------------------------------------------------------------ */

function AudiencePicker({ onSelect }: { onSelect: (key: AudienceKey) => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-brand-glow"
      >
        <Building2 className="h-8 w-8" />
      </motion.div>

      <div className="space-y-3">
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900"
        >
          NivaasOS
        </motion.h1>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl md:text-2xl font-bold bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent"
        >
          The Operating System for Gated Communities & RWAs
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-slate-600 max-w-xl mx-auto"
        >
          Ditch the WhatsApp arguments, chaotic Excel sheets, and lost paper bills.
          One source of truth your whole community actually trusts.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full space-y-4"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Choose your view — see what NivaasOS does for you
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUDIENCES.map((a, idx) => (
            <motion.button
              key={a.key}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 + idx * 0.07 }}
              onClick={() => onSelect(a.key)}
              className="group bg-white border border-slate-200 rounded-3xl p-5 text-left hover:border-brand-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                  <a.icon className="h-5 w-5" />
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">{a.label}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{a.tagline}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex items-center gap-2 text-xs text-slate-400"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
        Whitelist-secured · Role-based access · Permanent audit trail · Your data is never sold
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const VALID_AUDIENCES = new Set(AUDIENCES.map((a) => a.key));

export default function PresentationPage() {
  const [audienceKey, setAudienceKey] = useState<AudienceKey | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const params = new URLSearchParams(window.location.search);
    const param = params.get("audience");
    if (param && VALID_AUDIENCES.has(param as AudienceKey)) {
      setAudienceKey(param as AudienceKey);
    }
  }, []);

  const selectAudience = (key: AudienceKey | null) => {
    setAudienceKey(key);
    setCurrentSlide(0);
    const url = new URL(window.location.href);
    if (key) {
      url.searchParams.set("audience", key);
    } else {
      url.searchParams.delete("audience");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const audience = audienceKey ? audienceByKey(audienceKey) : null;
  const slides = audience ? buildDeck(audience) : [];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!audience) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, audienceKey]);

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-semibold animate-pulse">Loading presentation...</div>
      </div>
    );
  }

  const isLastSlide = audience && currentSlide === slides.length - 1;
  const headerCtaHref = `/get-started${audience ? audience.ctaQuery : ""}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans select-none overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md px-5 py-3.5 flex justify-between items-center shadow-xs gap-3">
        <button
          onClick={() => selectAudience(null)}
          className="flex items-center gap-2 shrink-0"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-brand-glow">
            <Building2 className="h-4.5 w-4.5" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-800 hidden sm:inline">
            NivaasOS
          </span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {audience && (
            <>
              <select
                value={audienceKey!}
                onChange={(e) => selectAudience(e.target.value as AudienceKey)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 focus:ring-1 focus:ring-brand-500 max-w-[150px]"
                aria-label="Switch audience view"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.key} value={a.key}>
                    For: {a.shortLabel}
                  </option>
                ))}
              </select>
              <span className="text-xs font-semibold text-slate-500 hidden md:inline whitespace-nowrap">
                Slide {currentSlide + 1} of {slides.length}
              </span>
            </>
          )}
          <Link
            href={headerCtaHref}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-brand-glow hover:bg-brand-700 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" /> Get Free Sandbox
          </Link>
          <Link
            href="/home"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
          >
            <Home className="h-3.5 w-3.5" /> Landing Page
          </Link>
        </div>
      </header>

      {/* Main Slide Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
        {!audience ? (
          <AudiencePicker onSelect={selectAudience} />
        ) : (
          <div className="w-full max-w-6xl min-h-[500px] flex flex-col justify-between">
            {/* Slide Header Indicator */}
            <div className="mb-4 text-center">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-600">
                {slides[currentSlide].title}
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                {slides[currentSlide].subtitle}
              </h2>
            </div>

            {/* Slide Active Content Box */}
            <div className="flex-1 flex items-center justify-center py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${audienceKey}-${currentSlide}`}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="w-full"
                >
                  {slides[currentSlide].content}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Action Navigation Controls */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
              <button
                onClick={handlePrev}
                disabled={currentSlide === 0}
                className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  currentSlide === 0
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <ChevronLeft className="h-5 w-5" /> Previous
              </button>

              {/* Dot Navigator */}
              <div className="hidden sm:flex gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      idx === currentSlide ? "w-8 bg-brand-600" : "w-2.5 bg-slate-300"
                    }`}
                  />
                ))}
              </div>

              {!isLastSlide ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-brand-glow hover:bg-brand-700 transition-all"
                >
                  Next <ChevronRight className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={() => selectAudience(null)}
                  className="flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition-all"
                >
                  <RotateCcw className="h-4 w-4" /> Choose Another View
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating CTA — visible on every slide except the pricing close */}
      <AnimatePresence>
        {audience && !isLastSlide && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.4 }}
            className="fixed bottom-6 right-6 z-50 hidden sm:block"
          >
            <Link
              href={`/get-started${audience.ctaQuery}`}
              className="group flex items-center gap-3 rounded-2xl bg-brand-600 pl-4 pr-5 py-3 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 transition-all"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                <Sparkles className="h-4 w-4" />
              </span>
              <span>
                <span className="text-xs font-bold block leading-tight">
                  {audience.ctaLabel}
                </span>
                <span className="text-[10px] text-brand-200 block leading-tight">
                  60-second setup · no obligation
                </span>
              </span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar (Bottom Edge) */}
      {audience && (
        <div className="h-1.5 bg-slate-200 w-full">
          <div
            className="h-full bg-brand-600 transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
