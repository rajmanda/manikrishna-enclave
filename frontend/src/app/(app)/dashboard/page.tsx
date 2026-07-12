"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Download,
  Megaphone,
  MessageCircle,
  Wrench,
} from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { ExpensesModal } from "@/components/ExpensesModal";
import { ReserveModal } from "@/components/ReserveModal";
import type {
  Expense,
  FeedPost,
  Invoice,
  ManagerDashboardData,
  Meeting,
  MonthlyFinance,
  OwnerDashboardData,
  Payment,
  ReserveFundEntry,
  SetupStatus,
  User,
  WorkOrder,
} from "@/lib/types";
import { aptNumber, userName } from "@/lib/lookup";
import { currentMonthLabel, formatDate, formatINR } from "@/lib/format";
import { invoiceTone, stageTone } from "@/lib/tones";
import { Modal } from "@/components/Modal";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  SectionHeader,
  Stat,
} from "@/components/ui";
import {
  CashFlowChart,
  CollectionChart,
  MyPaymentsChart,
  ReserveFundChart,
} from "@/components/charts";
import { FadeIn, Stagger } from "@/components/motion";

const quickActions = [
  { label: "Pay Invoice", icon: CreditCard, href: "/invoices" },
  { label: "Report Issue", icon: AlertTriangle, href: "/maintenance" },
  { label: "Statement", icon: Download, href: "/invoices" },
  { label: "Message Vishnu", icon: MessageCircle, href: "/feed" },
];

const OPEN_STAGES = [
  "Reported",
  "Estimate Received",
  "Owner Approval",
  "In Progress",
  "Inspection",
];

function OwnerDashboard() {
  const { user } = useSessionUser();
  const summary = useApi<OwnerDashboardData>("/dashboard/owner");
  const invoices = useApi<Invoice[]>("/invoices");
  const payments = useApi<Payment[]>("/payments");
  const workOrders = useApi<WorkOrder[]>("/work-orders");
  const feed = useApi<FeedPost[]>("/feed");
  const meetings = useApi<Meeting[]>("/meetings");
  const users = useApi<User[]>("/users");
  const monthly = useApi<MonthlyFinance[]>("/finance/monthly");
  const expenses = useApi<Expense[]>("/expenses");
  const reserve = useApi<ReserveFundEntry[]>("/reserve-fund");
  const [expenseModal, setExpenseModal] = useState(false);
  const [reserveModal, setReserveModal] = useState(false);
  const [balanceModal, setBalanceModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [workOrderModal, setWorkOrderModal] = useState(false);

  const closeBalanceModal = () => {
    setBalanceModal(false);
    setSelectedInvoiceId(null);
  };

  const error = summary.error ?? invoices.error ?? workOrders.error;
  if (error) return <ErrorNote message={error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data) return <PageLoading variant="stats" />;

  const s = summary.data;
  const openWorkOrders = (workOrders.data ?? []).filter((w) =>
    OPEN_STAGES.includes(w.stage)
  );
  const announcements = (feed.data ?? []).filter((p) => p.type === "announcement");
  const nextMeeting = (meetings.data ?? []).find((m) => m.resolutions.length === 0);
  const firstName = user.name.split(" ")[0];

  // My confirmed payments bucketed into the last 6 calendar months — a gap
  // in the bars is an unpaid month, visible at a glance.
  const myPaymentSeries = (() => {
    const now = new Date();
    const out: { month: string; paid: number }[] = [];
    for (let back = 5; back >= 0; back--) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        month: d.toLocaleDateString("en-US", { month: "short" }),
        paid: (payments.data ?? [])
          .filter((p) => p.status !== "pending" && p.date.startsWith(prefix))
          .reduce((sum, p) => sum + p.amount, 0),
      });
    }
    return out;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Apartment{(user.apartmentIds?.length ?? 0) > 1 ? "s" : ""}{" "}
          {(user.apartmentIds?.length
            ? user.apartmentIds
            : user.apartmentId
              ? [user.apartmentId]
              : []
          )
            .map((a) => a.replace("apt-", ""))
            .sort()
            .join(", ")}{" "}
          · Here&apos;s what&apos;s happening in your community.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {quickActions.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[11px] font-medium text-slate-600 sm:text-xs">
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* Key numbers — from /dashboard/owner */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Outstanding Balance"
          value={formatINR(s.outstandingBalance)}
          tone={s.outstandingBalance > 0 ? "negative" : "positive"}
          hint={s.outstandingBalance > 0 ? "Tap to see what's due" : "All clear"}
          onClick={() => setBalanceModal(true)}
        />
        <Stat
          label="Open Work Orders"
          value={String(s.openWorkOrders)}
          hint="Tap for the list"
          onClick={() => setWorkOrderModal(true)}
        />
        <Stat
          label={`Community Expenses (${currentMonthLabel()})`}
          value={formatINR(s.monthExpenses)}
          hint="Tap to see where it went"
          onClick={() => setExpenseModal(true)}
        />
        <Stat
          label="Community Reserve"
          value={formatINR(s.reserveFundBalance)}
          tone="positive"
          hint="Shared fund — tap for the story"
          onClick={() => setReserveModal(true)}
        />
      </div>

      {/* Community health + my own record, at a glance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Community Money (6 months)</h2>
          <p className="mb-1 text-xs text-slate-400">
            What the community collected vs spent
          </p>
          {monthly.data && <CashFlowChart data={monthly.data} />}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-sm font-semibold">Community Reserve Trend</h3>
            {reserve.data && <ReserveFundChart data={reserve.data} />}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">My Payments (6 months)</h2>
          <p className="mb-1 text-xs text-slate-400">
            Your confirmed payments — a missing bar is an unpaid month
          </p>
          <MyPaymentsChart data={myPaymentSeries} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My invoices */}
        <section>
          <SectionHeader title="My Invoices" action="View all" href="/invoices" />
          <Card className="divide-y divide-slate-100">
            {(invoices.data ?? []).slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.description}</p>
                  <p className="text-xs text-slate-500">
                    {inv.period} · Due {formatDate(inv.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatINR(inv.amount)}</span>
                  <Badge tone={inv.status === "paid" ? "green" : inv.status === "overdue" ? "red" : "amber"}>
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
            {invoices.data?.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No invoices yet.</p>
            )}
          </Card>
        </section>

        {/* Payment history */}
        <section>
          <SectionHeader title="Payment History" action="View all" href="/invoices" />
          <Card className="divide-y divide-slate-100">
            {(payments.data ?? []).slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{formatINR(p.amount)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(p.date)} · {p.method} · {p.reference}
                  </p>
                </div>
                <Badge tone={p.status === "pending" ? "amber" : "green"}>
                  {p.status === "pending" ? "pending" : "received"}
                </Badge>
              </div>
            ))}
            {payments.data?.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No payments yet.</p>
            )}
          </Card>
        </section>

        {/* Open work orders */}
        <section>
          <SectionHeader title="Open Work Orders" action="View all" href="/work-orders" />
          <Card className="divide-y divide-slate-100">
            {openWorkOrders.slice(0, 3).map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{wo.title}</p>
                    <p className="text-xs text-slate-500">
                      {wo.priority} priority
                      {wo.estimate ? ` · Est. ${formatINR(wo.estimate)}` : ""}
                    </p>
                  </div>
                </div>
                <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
              </Link>
            ))}
            {openWorkOrders.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No open work orders.</p>
            )}
          </Card>
        </section>

        {/* Announcements + meetings */}
        <section>
          <SectionHeader title="Announcements & Notices" action="Open feed" href="/feed" />
          <Card className="divide-y divide-slate-100">
            {announcements.slice(0, 2).map((post) => (
              <div key={post.id} className="flex gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-slate-700">{post.text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {userName(users.data, post.authorId)} · {formatDate(post.date)}
                  </p>
                </div>
              </div>
            ))}
            {nextMeeting && (
              <div className="flex gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{nextMeeting.title}</p>
                  <p className="text-xs text-slate-500">
                    Upcoming · {formatDate(nextMeeting.date)}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>

      {expenseModal && (
        <Modal title="Community Expenses Breakdown" onClose={() => setExpenseModal(false)}>
          {(() => {
            const expList = expenses.data ?? [];
            
            // Group by Month (using paidDate "YYYY-MM")
            const expByMonth = new Map<string, number>();
            for (const e of expList) {
              const d = new Date(e.paidDate + "T00:00:00");
              const month = isNaN(d.getTime())
                ? "Other"
                : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              expByMonth.set(month, (expByMonth.get(month) ?? 0) + e.amount);
            }
            const expMonthRows = [...expByMonth.entries()].slice(-6);

            // Group by Category
            const expByCat = new Map<string, number>();
            for (const e of expList) {
              const cat = e.category || "Other";
              expByCat.set(cat, (expByCat.get(cat) ?? 0) + e.amount);
            }
            const expCatRows = [...expByCat.entries()].sort((a, b) => b[1] - a[1]);

            return (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl font-bold text-slate-800">
                    {formatINR(expList.filter(e => e.paidDate.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, e) => s + e.amount, 0))}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Expenses recorded for {currentMonthLabel()}</p>
                </div>

                {/* Category Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Category (All Time)</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-3 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left col-span-2">Category</span>
                      <span>Spent</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {expCatRows.map(([cat, val]) => (
                        <div key={cat} className="grid grid-cols-3 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700 col-span-2">{cat}</span>
                          <span className="font-semibold text-slate-800">{formatINR(val)}</span>
                        </div>
                      ))}
                      {expCatRows.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400">No expenses recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Monthly Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Month</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Month</span>
                      <span>Spent</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {expMonthRows.map(([month, val]) => (
                        <div key={month} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{month}</span>
                          <span className="font-semibold text-slate-800">{formatINR(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Current Month items */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Month Items</h3>
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {expList.filter(e => e.paidDate.startsWith(new Date().toISOString().slice(0, 7))).map((e) => (
                      <div key={e.id} className="flex justify-between items-start py-2 text-xs">
                        <div>
                          <p className="font-medium text-slate-800">{e.description}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {e.category} · {formatDate(e.paidDate)}
                          </p>
                        </div>
                        <span className="font-semibold text-slate-800">{formatINR(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/community"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Go to community expenses →
                </Link>
              </div>
            );
          })()}
        </Modal>
      )}
      {reserveModal && (
        <ReserveModal
          entries={reserve.data ?? []}
          onClose={() => setReserveModal(false)}
        />
      )}
      {balanceModal && (
        <Modal 
          title={selectedInvoiceId ? "Invoice Details" : "Outstanding Balance Details"} 
          onClose={selectedInvoiceId ? () => setSelectedInvoiceId(null) : closeBalanceModal}
        >
          {(() => {
            const dueInvoices = (invoices.data ?? []).filter((i) => i.amount - i.paidAmount > 0);
            
            const monthLabel = (dueDate: string): string => {
              const d = new Date(dueDate + "T00:00:00");
              if (isNaN(d.getTime())) return "Other";
              return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
            };

            // If an invoice is selected, render its details drilldown view!
            if (selectedInvoiceId) {
              const inv = dueInvoices.find((i) => i.id === selectedInvoiceId);
              if (!inv) return <p className="text-sm text-slate-500">Invoice not found.</p>;
              
              const balance = inv.amount - inv.paidAmount;
              
              return (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedInvoiceId(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    ← Back to Outstanding Balance
                  </button>
                  
                  <div className="space-y-2 border-b border-slate-100 pb-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Invoice</p>
                    <h3 className="text-base font-bold text-slate-800">{inv.description}</h3>
                    <p className="text-xs text-slate-500">Period: {monthLabel(inv.dueDate)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Amount</p>
                      <p className="text-sm font-semibold text-slate-700">{formatINR(inv.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Balance Due</p>
                      <p className="text-sm font-bold text-red-600">{formatINR(balance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Due Date</p>
                      <p className="text-xs text-slate-600">{formatDate(inv.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Status</p>
                      <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>Ledger: <span className="font-semibold text-slate-700">{inv.ledger || "Community"}</span></p>
                    {inv.paidAmount > 0 && (
                      <p>Paid Amount: <span className="font-semibold text-emerald-600">{formatINR(inv.paidAmount)}</span></p>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <Link
                      href="/invoices"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Manage & Report Payment
                    </Link>
                  </div>
                </div>
              );
            }
            
            // Group by Month (period)
            const byMonth = new Map<string, { community: number; personal: number }>();
            for (const i of dueInvoices) {
              const month = monthLabel(i.dueDate);
              const isComm = (i.ledger ?? "community") === "community";
              const cur = byMonth.get(month) ?? { community: 0, personal: 0 };
              if (isComm) cur.community += i.amount - i.paidAmount;
              else cur.personal += i.amount - i.paidAmount;
              byMonth.set(month, cur);
            }
            const monthRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

            // Group by Category
            const byCategory = new Map<string, number>();
            for (const i of dueInvoices) {
              let cat = "Community Maintenance";
              if (i.ledger === "manager_fee") cat = "Manager Service Fee";
              if (i.ledger === "reimbursement") cat = "Reimbursement";
              byCategory.set(cat, (byCategory.get(cat) ?? 0) + (i.amount - i.paidAmount));
            }
            const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

            if (dueInvoices.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  Nothing due — you&apos;re all clear. 🎉
                </p>
              );

            return (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {formatINR(dueInvoices.reduce((s, i) => s + (i.amount - i.paidAmount), 0))}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Your total outstanding balance due</p>
                </div>

                {/* Monthly Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Month</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-4 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Month</span>
                      <span>Community</span>
                      <span>Personal</span>
                      <span>Total</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {monthRows.map(([month, val]) => (
                        <div key={month} className="grid grid-cols-4 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{month}</span>
                          <span className="text-slate-600">{formatINR(val.community)}</span>
                          <span className="text-slate-600">{formatINR(val.personal)}</span>
                          <span className="font-semibold text-red-600">{formatINR(val.community + val.personal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Category</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Category</span>
                      <span>Outstanding</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {catRows.map(([cat, val]) => (
                        <div key={cat} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{cat}</span>
                          <span className="font-semibold text-red-600">{formatINR(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Individual invoices */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Invoices Dues (Tap to view details)</h3>
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {dueInvoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className="flex justify-between items-start w-full py-2 text-xs hover:bg-slate-50 rounded px-1 transition text-left"
                      >
                        <div>
                          <p className="font-medium text-slate-800 hover:text-brand-600">{inv.description}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Due {formatDate(inv.dueDate)} · {inv.period}
                          </p>
                        </div>
                        <span className="font-semibold text-red-600 shrink-0 ml-2">{formatINR(inv.amount - inv.paidAmount)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Link
                  href="/invoices"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Go to my invoices →
                </Link>
              </div>
            );
          })()}
        </Modal>
      )}
      {workOrderModal && (
        <Modal title="Open Work Orders Breakdown" onClose={() => setWorkOrderModal(false)}>
          {(() => {
            const openWos = openWorkOrders;
            
            // Group by Month (using reportedDate "YYYY-MM")
            const woByMonth = new Map<string, number>();
            for (const w of openWos) {
              const d = new Date(w.reportedDate);
              const month = isNaN(d.getTime())
                ? "Other"
                : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              woByMonth.set(month, (woByMonth.get(month) ?? 0) + 1);
            }
            const woMonthRows = [...woByMonth.entries()];

            // Group by Priority
            const woByPriority = new Map<string, number>();
            for (const w of openWos) {
              const pri = w.priority || "medium";
              const label = pri.charAt(0).toUpperCase() + pri.slice(1);
              woByPriority.set(label, (woByPriority.get(label) ?? 0) + 1);
            }
            const woPriorityRows = [...woByPriority.entries()].sort((a, b) => b[1] - a[1]);

            if (openWos.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  No open work orders — everything&apos;s in shape.
                </p>
              );

            return (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl font-bold text-slate-800">{openWos.length}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Total open maintenance and work requests</p>
                </div>

                {/* Priority Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Priority</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Priority</span>
                      <span>Open Requests</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {woPriorityRows.map(([pri, val]) => (
                        <div key={pri} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{pri}</span>
                          <span className="font-semibold text-slate-800">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monthly Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Month Reported</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Month</span>
                      <span>Open Requests</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {woMonthRows.map(([month, val]) => (
                        <div key={month} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{month}</span>
                          <span className="font-semibold text-slate-800">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* List of open work orders */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Open Items</h3>
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {openWos.map((wo) => (
                      <Link
                        key={wo.id}
                        href={`/work-orders/${wo.id}`}
                        className="flex justify-between items-start py-2 text-xs hover:bg-slate-50 px-1 rounded transition-colors"
                      >
                        <div>
                          <p className="font-medium text-brand-600 hover:underline">{wo.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Priority: {wo.priority} · Reported {formatDate(wo.reportedDate)}
                          </p>
                        </div>
                        <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
                      </Link>
                    ))}
                  </div>
                </div>

                <Link
                  href="/work-orders"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Go to all work orders →
                </Link>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function monthPrefixFromIndex(index: number, seriesLength: number): string {
  // Series is the last N months ending in the current one.
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (seriesLength - 1 - index));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ManagerDashboard() {
  const summary = useApi<ManagerDashboardData>("/dashboard/manager");
  const monthly = useApi<MonthlyFinance[]>("/finance/monthly");
  const reserve = useApi<ReserveFundEntry[]>("/reserve-fund");
  const workOrders = useApi<WorkOrder[]>("/work-orders");
  const expenses = useApi<Expense[]>("/expenses");
  const invoices = useApi<Invoice[]>("/invoices");
  const payments = useApi<Payment[]>("/payments");
  const [monthModal, setMonthModal] = useState<{ prefix: string; label: string } | null>(null);
  const [reserveModal, setReserveModal] = useState(false);
  const [collectionsModal, setCollectionsModal] = useState(false);
  const [receivedModal, setReceivedModal] = useState(false);
  const [feeOutstandingModal, setFeeOutstandingModal] = useState(false);
  const [feeCollectedModal, setFeeCollectedModal] = useState(false);

  const error = summary.error ?? monthly.error ?? reserve.error ?? workOrders.error;
  if (error) return <ErrorNote message={error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data) return <PageLoading variant="stats" />;

  const s = summary.data;
  const pendingApprovals = (workOrders.data ?? []).filter((w) =>
    ["Estimate Received", "Owner Approval"].includes(w.stage)
  );
  const openWOs = (workOrders.data ?? []).filter((w) =>
    OPEN_STAGES.includes(w.stage)
  );

  return (
    <Stagger className="space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-widest text-brand-600">
            Mani Krishna Enclave
          </p>
          <h1 className="mt-1 text-display-sm text-slate-900">Manager Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            A live overview of collections, operations and reserves.
          </p>
        </div>
        {/* 
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live from the API
        </span>
        */}
      </FadeIn>

      {s.pendingPaymentConfirmations > 0 && (
        <Link
          href="/payments"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition hover:border-amber-300"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {s.pendingPaymentConfirmations} payment
                {s.pendingPaymentConfirmations === 1 ? "" : "s"} awaiting your
                confirmation
              </p>
              <p className="text-xs text-amber-700">
                Owners have reported paying — review and confirm receipt
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-amber-600" />
        </Link>
      )}

      {(s.feeOutstanding > 0 || s.feeCollected > 0) && (
        <FadeIn className="grid grid-cols-2 gap-3 max-w-2xl">
          <Stat
            label="Personal Fees Due"
            value={formatINR(s.feeOutstanding)}
            tone="negative"
            accent="bg-violet-500"
            hint="Payable to you · tap for per-flat dues"
            onClick={() => setFeeOutstandingModal(true)}
          />
          <Stat
            label="Personal Fees Paid"
            value={formatINR(s.feeCollected)}
            tone="positive"
            accent="bg-violet-500"
            hint="Payable to you · tap for month-by-month"
            onClick={() => setFeeCollectedModal(true)}
          />
        </FadeIn>
      )}

      <FadeIn className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Outstanding Collections"
          value={formatINR(s.outstandingCollections)}
          tone="negative"
          accent="bg-red-500"
          hint={`${s.overdueInvoices} overdue · tap for per-flat dues`}
          onClick={() => setCollectionsModal(true)}
        />
        <Stat
          label="Payments Received"
          value={formatINR(s.paymentsReceived)}
          tone="positive"
          accent="bg-emerald-500"
          hint="All time · tap for month-by-month"
          onClick={() => setReceivedModal(true)}
        />
        <Stat
          label={`Expenses (${currentMonthLabel()})`}
          value={formatINR(s.monthExpenses)}
          accent="bg-amber-500"
          hint="Tap for line items"
          onClick={() =>
            setMonthModal({
              prefix: new Date().toISOString().slice(0, 7),
              label: currentMonthLabel(),
            })
          }
        />
        <Stat
          label="Reserve Fund"
          value={formatINR(s.reserveFundBalance)}
          tone="positive"
          accent="bg-brand-500"
          hint="Tap for the month-by-month story"
          onClick={() => setReserveModal(true)}
        />
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Cash Flow (6 months)</h2>
          <p className="mb-1 text-xs text-slate-400">Tap a month for the expense line items</p>
          {monthly.data && (
            <CashFlowChart
              data={monthly.data}
              onMonthClick={(index, label) =>
                setMonthModal({
                  prefix: monthPrefixFromIndex(index, monthly.data!.length),
                  label,
                })
              }
            />
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Collection Rate</h2>
          {monthly.data && <CollectionChart data={monthly.data} />}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-sm font-semibold">Reserve Fund Trend</h3>
            {reserve.data && <ReserveFundChart data={reserve.data} />}
          </div>
        </Card>

        <section>
          <SectionHeader
            title={`Pending Approvals (${pendingApprovals.length})`}
            action="Work orders"
            href="/work-orders"
          />
          <Card className="divide-y divide-slate-100">
            {pendingApprovals.map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{wo.title}</p>
                  <p className="text-xs text-slate-500">
                    {wo.estimate ? `Estimate ${formatINR(wo.estimate)}` : "Awaiting estimate"}
                  </p>
                </div>
                <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
              </Link>
            ))}
            {pendingApprovals.length === 0 && (
              <p className="p-4 text-sm text-slate-500">Nothing pending.</p>
            )}
          </Card>
        </section>

        <section>
          <SectionHeader
            title={`Open Work Orders (${openWOs.length})`}
            action="View all"
            href="/work-orders"
          />
          <Card className="divide-y divide-slate-100">
            {openWOs.slice(0, 4).map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <p className="truncate text-sm font-medium">{wo.title}</p>
                <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
              </Link>
            ))}
          </Card>
        </section>
      </div>

      {monthModal && (
        <ExpensesModal
          title={`Expenses — ${monthModal.label}`}
          expenses={(expenses.data ?? []).filter((e) =>
            e.paidDate.startsWith(monthModal.prefix)
          )}
          onClose={() => setMonthModal(null)}
          moreHref="/community"
          moreLabel="See all months"
        />
      )}
      {reserveModal && (
        <ReserveModal
          entries={reserve.data ?? []}
          onClose={() => setReserveModal(false)}
        />
      )}
      {collectionsModal && (
        <Modal title="Outstanding Collections" onClose={() => setCollectionsModal(false)}>
          {(() => {
            const perApt = new Map<string, { total: number; count: number }>();
            for (const inv of (invoices.data ?? []).filter(
              (i) =>
                (i.ledger ?? "community") === "community" &&
                i.amount - i.paidAmount > 0
            )) {
              const cur = perApt.get(inv.apartmentId) ?? { total: 0, count: 0 };
              cur.total += inv.amount - inv.paidAmount;
              cur.count += 1;
              perApt.set(inv.apartmentId, cur);
            }
            const rows = [...perApt.entries()].sort((a, b) => b[1].total - a[1].total);
            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  Everything collected — no community dues.
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {rows.map(([aptId, { total, count }]) => (
                  <div key={aptId} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Apt {aptNumber(aptId)}</p>
                      <p className="text-xs text-slate-500">
                        {count} open invoice{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">{formatINR(total)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">Total outstanding</p>
                  <p className="text-sm font-bold text-red-600">
                    {formatINR(rows.reduce((sum, [, r]) => sum + r.total, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          <Link
            href="/invoices?view=table"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to invoices →
          </Link>
        </Modal>
      )}
      {receivedModal && (
        <Modal title="Payments Received" onClose={() => setReceivedModal(false)}>
          {(() => {
            const confirmed = (payments.data ?? []).filter(
              (p) =>
                p.status !== "pending" &&
                (p.ledger ?? "community") === "community"
            );
            const byMonth = new Map<string, { total: number; count: number }>();
            for (const p of [...confirmed].sort((a, b) => b.date.localeCompare(a.date))) {
              const d = new Date(p.date + "T00:00:00");
              const key = isNaN(d.getTime())
                ? "Other"
                : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              const cur = byMonth.get(key) ?? { total: 0, count: 0 };
              cur.total += p.amount;
              cur.count += 1;
              byMonth.set(key, cur);
            }
            const rows = [...byMonth.entries()];
            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  No payments received yet.
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {rows.map(([month, { total, count }]) => (
                  <div key={month} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{month}</p>
                      <p className="text-xs text-slate-500">
                        {count} payment{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatINR(total)}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">All time</p>
                  <p className="text-sm font-bold text-emerald-600">
                    {formatINR(confirmed.reduce((sum, p) => sum + p.amount, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          <p className="mt-3 text-xs text-slate-500">
            Community funds only — your fees and reimbursements are tracked
            separately.
          </p>
          <Link
            href="/payments"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to payments →
          </Link>
        </Modal>
      )}
      {feeOutstandingModal && (
        <Modal title="Outstanding Personal Fees" onClose={() => setFeeOutstandingModal(false)}>
          {(() => {
            const perApt = new Map<string, { total: number; count: number }>();
            for (const inv of (invoices.data ?? []).filter(
              (i) =>
                (i.ledger ?? "community") !== "community" &&
                i.amount - i.paidAmount > 0
            )) {
              const cur = perApt.get(inv.apartmentId) ?? { total: 0, count: 0 };
              cur.total += inv.amount - inv.paidAmount;
              cur.count += 1;
              perApt.set(inv.apartmentId, cur);
            }
            const rows = [...perApt.entries()].sort((a, b) => b[1].total - a[1].total);
            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  All personal fees & reimbursements collected!
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {rows.map(([aptId, { total, count }]) => (
                  <div key={aptId} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Apt {aptNumber(aptId)}</p>
                      <p className="text-xs text-slate-500">
                        {count} open invoice{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-violet-600">{formatINR(total)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">Total outstanding</p>
                  <p className="text-sm font-bold text-violet-600">
                    {formatINR(rows.reduce((sum, [, r]) => sum + r.total, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          <Link
            href="/invoices?view=table"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to invoices →
          </Link>
        </Modal>
      )}
      {feeCollectedModal && (
        <Modal title="Personal Fees Collected" onClose={() => setFeeCollectedModal(false)}>
          {(() => {
            const confirmed = (payments.data ?? []).filter(
              (p) =>
                p.status !== "pending" &&
                (p.ledger ?? "community") !== "community"
            );
            const byMonth = new Map<string, { total: number; count: number }>();
            for (const p of [...confirmed].sort((a, b) => b.date.localeCompare(a.date))) {
              const d = new Date(p.date + "T00:00:00");
              const key = isNaN(d.getTime())
                ? "Other"
                : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              const cur = byMonth.get(key) ?? { total: 0, count: 0 };
              cur.total += p.amount;
              cur.count += 1;
              byMonth.set(key, cur);
            }
            const rows = [...byMonth.entries()];
            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  No personal fees collected yet.
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {rows.map(([month, { total, count }]) => (
                  <div key={month} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{month}</p>
                      <p className="text-xs text-slate-500">
                        {count} payment{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatINR(total)}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">Total collected</p>
                  <p className="text-sm font-bold text-emerald-600">
                    {formatINR(confirmed.reduce((sum, p) => sum + p.amount, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          <Link
            href="/payments"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to payments →
          </Link>
        </Modal>
      )}
    </Stagger>
  );
}

function SetupNudge() {
  const status = useApi<SetupStatus>("/setup/status");
  if (!status.data) return null;
  const s = status.data;
  const step1 = s.apartments > 0;
  const step2 = step1 && s.flatsWithHousehold >= s.apartments;
  const step3 = s.managers > 0;
  const done = [step1, step2, step3].filter(Boolean).length;
  if (done === 3) return null;
  return (
    <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50/60 p-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Finish setting up this community — {done} of 3 steps done
          </p>
          <p className="text-xs text-slate-500">
            {!step1
              ? "Start by adding your flats."
              : !step2
                ? `${s.apartments - s.flatsWithHousehold} flat${s.apartments - s.flatsWithHousehold === 1 ? "" : "s"} still need residents.`
                : "Add a manager to run day-to-day operations."}
          </p>
        </div>
      </div>
      <Link
        href="/setup"
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Continue setup <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

export default function DashboardPage() {
  const { role } = useSessionUser();
  if (role === "owner" || role === "tenant") return <OwnerDashboard />;
  return (
    <>
      {role !== "auditor" && <SetupNudge />}
      <ManagerDashboard />
    </>
  );
}
