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
  const [workOrderModal, setWorkOrderModal] = useState(false);

  const error = summary.error ?? invoices.error ?? workOrders.error;
  if (error) return <ErrorNote message={error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data) return <PageLoading />;

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
        <ExpensesModal
          title={`Community expenses — ${currentMonthLabel()}`}
          expenses={(expenses.data ?? []).filter((e) =>
            e.paidDate.startsWith(new Date().toISOString().slice(0, 7))
          )}
          onClose={() => setExpenseModal(false)}
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
      {balanceModal && (
        <Modal title="Outstanding Balance" onClose={() => setBalanceModal(false)}>
          {(() => {
            const due = (invoices.data ?? [])
              .filter((i) => i.amount - i.paidAmount > 0)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            if (due.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  Nothing due — you&apos;re all clear. 🎉
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {due.map((inv) => (
                  <div key={inv.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{inv.description}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                        {inv.ledger === "manager_fee" && <Badge tone="violet">Manager fee</Badge>}
                        {inv.ledger === "reimbursement" && <Badge tone="amber">Reimbursement</Badge>}
                        Due {formatDate(inv.dueDate)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-red-600">
                      {formatINR(inv.amount - inv.paidAmount)}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">Total due</p>
                  <p className="text-sm font-bold text-red-600">
                    {formatINR(due.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          <Link
            href="/invoices"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to my invoices →
          </Link>
        </Modal>
      )}
      {workOrderModal && (
        <Modal title="Open Work Orders" onClose={() => setWorkOrderModal(false)}>
          {openWorkOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No open work orders — everything&apos;s in shape.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {openWorkOrders.map((wo) => (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{wo.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{wo.priority} priority</p>
                  </div>
                  <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/work-orders"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            All work orders →
          </Link>
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

  const error = summary.error ?? monthly.error ?? reserve.error ?? workOrders.error;
  if (error) return <ErrorNote message={error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data) return <PageLoading />;

  const s = summary.data;
  const pendingApprovals = (workOrders.data ?? []).filter((w) =>
    ["Estimate Received", "Owner Approval"].includes(w.stage)
  );
  const openWOs = (workOrders.data ?? []).filter((w) =>
    OPEN_STAGES.includes(w.stage)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Live overview from the API</p>
      </div>

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
        <Card className="flex flex-wrap items-center justify-between gap-2 border-violet-200 bg-violet-50/50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Payable to you — fees & reimbursements (separate from community funds)
            </p>
            <p className="mt-1 text-sm text-violet-900">
              Collected {formatINR(s.feeCollected)} · Outstanding {formatINR(s.feeOutstanding)}
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Outstanding Collections"
          value={formatINR(s.outstandingCollections)}
          tone="negative"
          hint={`${s.overdueInvoices} overdue · tap for per-flat dues`}
          onClick={() => setCollectionsModal(true)}
        />
        <Stat
          label="Payments Received"
          value={formatINR(s.paymentsReceived)}
          tone="positive"
          hint="All time · tap for month-by-month"
          onClick={() => setReceivedModal(true)}
        />
        <Stat
          label={`Expenses (${currentMonthLabel()})`}
          value={formatINR(s.monthExpenses)}
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
          hint="Tap for the month-by-month story"
          onClick={() => setReserveModal(true)}
        />
      </div>

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
    </div>
  );
}

export default function DashboardPage() {
  const { role } = useSessionUser();
  return role === "owner" || role === "tenant" ? (
    <OwnerDashboard />
  ) : (
    <ManagerDashboard />
  );
}
