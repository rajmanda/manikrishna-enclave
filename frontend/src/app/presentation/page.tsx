"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Home,
  MessageSquare,
  Percent,
  Plus,
  Receipt,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Vote,
  Wrench,
} from "lucide-react";

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const SLIDES = [
    // Slide 0: Hero Title
    {
      title: "Introducing NivaasOS",
      subtitle: "The Operating System for Gated Communities & RWAs in India",
      content: (
        <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto h-full">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-brand-glow mb-2"
          >
            <Building2 className="h-10 w-10" />
          </motion.div>
          
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900"
          >
            Introducing NivaasOS
          </motion.h1>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent"
          >
            Run Your Society In The Open
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-slate-600"
          >
            Ditch the WhatsApp arguments, chaotic Excel sheets, and lost paper bills. Give owners and managers one source of truth they actually trust.
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex gap-4 pt-4"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> Built for Indian Apartment Associations (RWAs)
            </span>
          </motion.div>
        </div>
      ),
    },

    // Slide 1: The Problem
    {
      title: "The Problem: WhatsApp + Excel Chaos",
      subtitle: "Why managing a community is a headache today",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800">Scattered Communications</h3>
            <p className="text-slate-600 leading-relaxed">
              Dues notifications, plumbing complaints, and budget announcements get buried in three different WhatsApp groups. Residents argue, and context is lost.
            </p>
            <h3 className="text-xl font-bold text-slate-800">Zero Transparency</h3>
            <p className="text-slate-600 leading-relaxed">
              When residents don't see where their maintenance fees go, they lose trust. Excel sheets shared once a year are hard to verify and lead to finger-pointing.
            </p>
            <h3 className="text-xl font-bold text-slate-800">Audit Nightmare</h3>
            <p className="text-slate-600 leading-relaxed">
              Lost receipts, manual payment collection registers, and paper invoices make Annual General Audits a week-long headache for RWA volunteers.
            </p>
          </div>

          <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200 space-y-4 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 left-0 bg-red-50 border-b border-red-200 p-2 text-center text-xs font-semibold text-red-600 flex items-center justify-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> The Current RWA Reality
            </div>
            
            <div className="pt-6 space-y-3">
              {/* WhatsApp mockup bubble */}
              <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-xs border border-slate-200 text-xs text-slate-700 max-w-[85%]">
                <span className="font-bold text-green-600 text-[10px] block">Apt 302 (Rohan)</span>
                "Why has watchman salary gone up? Did we vote on this? Who approved this repairs expense?"
              </div>

              {/* WhatsApp mockup bubble 2 */}
              <div className="bg-white p-3 rounded-2xl rounded-tr-none shadow-xs border border-slate-200 text-xs text-slate-700 max-w-[85%] ml-auto bg-green-50">
                <span className="font-bold text-slate-800 text-[10px] block">Manager (Suresh)</span>
                "Sir, details are in the Excel I shared on June 15th. Please check the email inbox."
              </div>

              {/* Excel mockup table */}
              <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 overflow-x-auto">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2">excel_maintenance_2026.xlsx</span>
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-left border-b border-slate-100">
                      <th className="p-1">Flat</th>
                      <th className="p-1">Dues</th>
                      <th className="p-1">Paid Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-1 font-mono">101</td>
                      <td className="p-1">₹3,500</td>
                      <td className="p-1 text-green-600 font-semibold">Yes (GPay)</td>
                    </tr>
                    <tr className="border-b border-slate-100 text-red-500">
                      <td className="p-1 font-mono">202</td>
                      <td className="p-1">₹7,000</td>
                      <td className="p-1 font-semibold">Overdue (Unpaid?)</td>
                    </tr>
                    <tr>
                      <td className="p-1 font-mono">301</td>
                      <td className="p-1">₹3,500</td>
                      <td className="p-1 text-amber-500 font-semibold">Check cash?</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // Slide 2: Invoices & Collections
    {
      title: "1. Automated Invoices & collections",
      subtitle: "Get paid on time with zero tracking friction",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <Receipt className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">1-Click Bulk Generation</h4>
                <p className="text-slate-600 text-sm">Generate monthly recurring maintenance bills for all flats simultaneously, with customizable calculation metrics.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <Percent className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Auto Late Fees & Credits</h4>
                <p className="text-slate-600 text-sm">Apply fine percentages automatically on overdue balances, with granular control over grace periods.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Digital PDF Statements</h4>
                <p className="text-slate-600 text-sm">Residents receive clean itemized invoices they can download or print, complete with past payment logs.</p>
              </div>
            </div>
          </div>

          {/* Interactive Invoice Card mockup */}
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
        </div>
      ),
    },

    // Slide 3: Expense Transparency
    {
      title: "2. Transparent Community Ledger",
      subtitle: "Show residents exactly where the money is spent",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Live Financial Summary</h4>
                <p className="text-slate-600 text-sm">Monthly income, expenses, outstanding collections, and reserve fund balances updated dynamically.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Verifiable Receipts</h4>
                <p className="text-slate-600 text-sm">Managers upload photos/documents of receipts directly to the cloud. Residents click to view and verify.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Immutable Audit Trail</h4>
                <p className="text-slate-600 text-sm">Every addition, edit, or payment record is written to a permanent audit history that cannot be manipulated.</p>
              </div>
            </div>
          </div>

          {/* Ledger Dashboard Mockup */}
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
        </div>
      ),
    },

    // Slide 4: Maintenance & Work Orders
    {
      title: "3. Common Area Work Orders",
      subtitle: "Track community repairs from reported to resolved",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <Wrench className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Complete Lifecycle Pipeline</h4>
                <p className="text-slate-600 text-sm">Organize maintenance issues (Lift, Generator, Plumbing) through status stages: Estimate $\rightarrow$ Approval $\rightarrow$ In Progress $\rightarrow$ Closed.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <User className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Vendor Management</h4>
                <p className="text-slate-600 text-sm">Save electrician, plumber, and AMC agency contracts, contact info, ratings, and past payout statements.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Status Alerts for Residents</h4>
                <p className="text-slate-600 text-sm">Owners are automatically notified of estimate details and completion states, reducing phone call queries.</p>
              </div>
            </div>
          </div>

          {/* Work Order Card Mockup */}
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

              {/* Progress Stepper mockup */}
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
        </div>
      ),
    },

    // Slide 5: Governance & Voting
    {
      title: "4. Democratic Governance & Polls",
      subtitle: "Make community decisions in the open, not behind closed doors",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <Vote className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">1 Flat = 1 Vote Rules</h4>
                <p className="text-slate-600 text-sm">Ensure fair decisions. The system allows exactly one vote per flat, even if one owner owns multiple units.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">AGM Meeting Minutes</h4>
                <p className="text-slate-600 text-sm">Store agendas, resolution drafts, attendance registries, and meeting recordings. Fully searchable for later audits.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Digital Document Vault</h4>
                <p className="text-slate-600 text-sm">Keep building plans, insurance policy files, AMC contracts, and bylaws in a secure, version-controlled repository.</p>
              </div>
            </div>
          </div>

          {/* Voting Mockup Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">ACTIVE SOCIETY POLL</span>
              <h4 className="text-sm font-bold text-slate-800 leading-snug">
                Increase monthly maintenance reserve contribution by ₹500 starting next quarter?
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Closes: July 15, 2026 • 1 Vote per Apartment</p>
            </div>

            <div className="space-y-3">
              {/* Option 1 */}
              <div className="relative border border-brand-200 bg-brand-50/50 p-3 rounded-2xl cursor-pointer">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Yes, approve the increase</span>
                  <span className="text-brand-600">70% (7 votes)</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: "70%" }} />
                </div>
              </div>

              {/* Option 2 */}
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
        </div>
      ),
    },

    // Slide 6: Elder-Friendly & Security
    {
      title: "Google Security & Elder Simplicity",
      subtitle: "Ensuring safety and ease of use for all age groups",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Google OAuth Sign-In</h4>
                <p className="text-slate-600 text-sm">No complex passwords or usernames to forget. Simply tap "Sign in with Google" to access the portal securely.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Strict Member Whitelisting</h4>
                <p className="text-slate-600 text-sm">Only email addresses added by the admin can access the portal. Unknown accounts are instantly blocked, ensuring true privacy.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shrink-0">
                <HelpCircle className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Elder-First Layout</h4>
                <p className="text-slate-600 text-sm">High contrast text, large touch targets, simplified actions, and 1-tap PDF downloads for users who prefer printed copies.</p>
              </div>
            </div>
          </div>

          {/* Whitelist Alert Mockup */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <div className="flex items-center gap-3 text-slate-800 font-bold border-b border-slate-100 pb-3">
              <ShieldCheck className="h-6 w-6 text-brand-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">Owner Whitelist Security</h4>
                <span className="text-[10px] text-slate-500 font-normal">Granular control over who accesses what</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-slate-800">Aditya Rao</span>
                  <span className="text-slate-500 font-mono text-[10px]">aditya.rao@gmail.com</span>
                </div>
                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                  Whitelisted (Apt 101)
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-slate-800">Karan Mehta</span>
                  <span className="text-slate-500 font-mono text-[10px]">karan.mehta@gmail.com</span>
                </div>
                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                  Admin (Apt 502)
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
          </div>
        </div>
      ),
    },

    // Slide 7: Value & Call to Action
    {
      title: "Simple, SaaS-Based Pricing",
      subtitle: "Start running your society professionally today",
      content: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch h-full max-w-3xl mx-auto">
            {/* Plan 1: Community */}
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
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600 animate-pulse" /> Unlimited Apartments</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Work Orders & Vendors</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Polls & Voting</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Reserve Fund Accounting</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Document Vault & Minutes</li>
                </ul>
              </div>
              <Link
                href="/get-started"
                className="mt-6 block w-full text-center rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm transition-colors"
              >
                Start 30-Day Trial
              </Link>
            </div>

            {/* Plan 2: Portfolio */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 hover:border-brand-400 transition-colors flex flex-col justify-between">
              <div>
                <h4 className="text-lg font-bold text-slate-800">Portfolio</h4>
                <p className="text-slate-500 text-xs mt-1">For professional estate managers.</p>
                <div className="text-2xl font-black text-slate-900 font-mono mt-3">
                  Custom
                </div>
                <ul className="text-xs space-y-2 text-slate-600 mt-4">
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Multi-Community Console</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Consolidated Invoicing</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> White-label Domains</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> 24/7 Dedicated Support</li>
                </ul>
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
    },
  ];

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
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
      if (e.key === "ArrowRight" || e.key === "Space") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide]);

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-semibold animate-pulse">Loading presentation...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans select-none overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-5 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-brand-glow">
            <Building2 className="h-4.5 w-4.5" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-800">
            NivaasOS Presentation
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">
            Slide {currentSlide + 1} of {SLIDES.length}
          </span>
          <Link
            href="/get-started"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-brand-glow hover:bg-brand-700"
          >
            Get Started
          </Link>
          <Link
            href="/home"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Home className="h-3.5 w-3.5" /> Landing Page
          </Link>
        </div>
      </header>

      {/* Main Slide Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-6xl min-h-[500px] flex flex-col justify-between">
          
          {/* Slide Header Indicator */}
          {currentSlide > 0 && (
            <div className="mb-4 text-center">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-600">
                {SLIDES[currentSlide].title}
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                {SLIDES[currentSlide].subtitle}
              </h2>
            </div>
          )}

          {/* Slide Active Content Box */}
          <div className="flex-1 flex items-center justify-center py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="w-full"
              >
                {SLIDES[currentSlide].content}
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
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    idx === currentSlide ? "w-8 bg-brand-600" : "w-2.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>

            {currentSlide < SLIDES.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-brand-glow hover:bg-brand-700 transition-all"
              >
                Next <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentSlide(0)}
                className="flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition-all"
              >
                <RotateCcw className="h-4 w-4 animate-spin-slow" /> Start Over
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Progress Bar (Bottom Edge) */}
      <div className="h-1.5 bg-slate-200 w-full">
        <div
          className="h-full bg-brand-600 transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
