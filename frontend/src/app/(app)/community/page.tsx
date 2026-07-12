"use client";

// The "HOA Page" — visible to every owner. All data comes from the API;
// invoices are RBAC-scoped server-side, so owners see dues badges only for
// their own apartment while managers see everyone's.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, PlusCircle, ReceiptText } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import type {
  Apartment,
  CommunitySummary,
  Expense,
  Invoice,
  MonthlyFinance,
  ReserveFundEntry,
  User,
  Vendor,
} from "@/lib/types";
import { currentMonthLabel, formatDate, formatINR } from "@/lib/format";
import { aptNumber } from "@/lib/lookup";
import { Modal } from "@/components/Modal";
import { ExpensesModal } from "@/components/ExpensesModal";
import { ReserveModal } from "@/components/ReserveModal";
import { AddExpenseDialog } from "@/components/expenses";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  SectionHeader,
  Stat,
} from "@/components/ui";
import { ExpensePie } from "@/components/charts";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

export default function CommunityPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const [addOpen, setAddOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<string | null>(null);
  const summary = useApi<CommunitySummary>("/finance/summary");
  const expenses = useApi<Expense[]>("/expenses");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const invoices = useApi<Invoice[]>("/invoices");
  const vendors = useApi<Vendor[]>("/vendors");
  const monthly = useApi<MonthlyFinance[]>("/finance/monthly");
  const reserve = useApi<ReserveFundEntry[]>("/reserve-fund");
  const [incomeModal, setIncomeModal] = useState(false);
  const [monthExpenseModal, setMonthExpenseModal] = useState(false);
  const [duesModal, setDuesModal] = useState(false);
  const [reserveModal, setReserveModal] = useState(false);

  const error = summary.error ?? expenses.error ?? apartments.error ?? users.error;
  if (error) return <ErrorNote message={error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data || !expenses.data || !apartments.data)
    return <PageLoading />;

  const s = summary.data;
  const expenseList = expenses.data;
  const apartmentList = [...apartments.data].sort((a, b) =>
    a.number.localeCompare(b.number)
  );

  const byCategory = new Map<string, number>();
  for (const e of expenseList) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  // The full grouped ledger lives on /expenses — here just the freshest few.
  const recentExpenses = [...expenseList]
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
    .slice(0, 6);
  const pieData = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Owners only receive their own invoices from the API, so dues badges
  // appear only where the caller is allowed to see them.
  const duesByApartment = new Map<string, number>();
  for (const inv of (invoices.data ?? []).filter(
    (i) => (i.ledger ?? "community") === "community"
  )) {
    duesByApartment.set(
      inv.apartmentId,
      (duesByApartment.get(inv.apartmentId) ?? 0) + (inv.amount - inv.paidAmount)
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Mani Krishna Enclave"
        subtitle={`${apartmentList.length} apartments · Community financials`}
      />

      {/* Financial summary — /finance/summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Income (${currentMonthLabel()})`}
          value={formatINR(s.monthIncome)}
          tone="positive"
          hint="Tap for month-by-month"
          onClick={() => setIncomeModal(true)}
        />
        <Stat
          label={`Expenses (${currentMonthLabel()})`}
          value={formatINR(s.monthExpenses)}
          tone="negative"
          hint="Tap for line items"
          onClick={() => setMonthExpenseModal(true)}
        />
        <Stat
          label="Outstanding Dues"
          value={formatINR(s.outstandingDues)}
          hint="Tap for the breakup"
          onClick={() => setDuesModal(true)}
        />
        <Stat
          label="Community Reserve"
          value={formatINR(s.reserveFundBalance)}
          tone="positive"
          hint="Tap for the story"
          onClick={() => setReserveModal(true)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Expense breakdown chart */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Expense Breakdown</h2>
          <p className="mb-1 text-xs text-slate-400">Tap a slice for the line items</p>
          <ExpensePie data={pieData} onSliceClick={setCategoryModal} />
        </Card>

        {/* Recent expenses — full ledger lives at /expenses */}
        <section className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Expenses</h2>
            {canWrite && (
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add expense
              </button>
            )}
          </div>
          <Card className="divide-y divide-slate-100">
            {recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{e.description}</p>
                    <Badge tone="slate">{e.category}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Paid {formatDate(e.paidDate)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatINR(e.amount)}</p>
              </div>
            ))}
            {recentExpenses.length === 0 && (
              <p className="p-5 text-center text-sm text-slate-400">
                No expenses recorded yet.
              </p>
            )}
            <Link
              href="/expenses"
              className="flex items-center justify-between p-4 text-sm font-semibold text-brand-600 hover:bg-slate-50 hover:text-brand-700"
            >
              <span>
                Full ledger — {expenseList.length} expense{expenseList.length === 1 ? "" : "s"},{" "}
                {formatINR(expenseList.reduce((sum, e) => sum + e.amount, 0))} all-time
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </section>
      </div>

      {/* Apartment directory */}
      <section>
        <SectionHeader title="Apartments & Owners" />
        <div className="grid gap-3 sm:grid-cols-2">
          {apartmentList.map((apt) => {
            const owner = users.data?.find((u) => u.id === apt.ownerIds[0]);
            const due = duesByApartment.get(apt.id);
            return (
              <Card key={apt.id} className="flex items-center gap-3 p-4">
                <Avatar name={owner?.name ?? apt.number} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{owner?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    Apartment {apt.number} · Floor {apt.floor}
                  </p>
                </div>
                {due !== undefined &&
                  (due > 0 ? (
                    <Badge tone="red">{formatINR(due)} due</Badge>
                  ) : (
                    <Badge tone="green">
                      <ReceiptText className="mr-1 h-3 w-3" /> Paid
                    </Badge>
                  ))}
              </Card>
            );
          })}
        </div>
      </section>

      {categoryModal && (
        <ExpensesModal
          title={`${categoryModal} expenses`}
          expenses={expenseList.filter((e) => e.category === categoryModal)}
          onClose={() => setCategoryModal(null)}
        />
      )}

      {incomeModal && (
        <Modal title="Community Income" onClose={() => setIncomeModal(false)}>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Month</span>
              <span className="text-right">Collected</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(monthly.data ?? []).map((m) => (
                <div key={m.month} className="grid grid-cols-2 items-center gap-2 px-3 py-2.5 text-xs">
                  <span className="font-medium">{m.month}</span>
                  <span className="text-right font-semibold text-emerald-600">
                    {formatINR(m.income)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Money received into community funds each month — confirmed
            maintenance payments only. Fees paid to the manager are not
            included.
          </p>
        </Modal>
      )}
      {monthExpenseModal && (
        <ExpensesModal
          title={`Expenses — ${currentMonthLabel()}`}
          expenses={expenseList.filter((e) =>
            e.paidDate.startsWith(new Date().toISOString().slice(0, 7))
          )}
          onClose={() => setMonthExpenseModal(false)}
        />
      )}
      {duesModal && (
        <Modal title="Outstanding Dues" onClose={() => setDuesModal(false)}>
          {(() => {
            const rows = [...duesByApartment.entries()]
              .filter(([, total]) => total > 0)
              .sort((a, b) => b[1] - a[1]);
            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  {canWrite
                    ? "Everything collected — no dues."
                    : "No dues on your apartments."}
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {rows.map(([aptId, total]) => (
                  <div key={aptId} className="flex items-center justify-between gap-3 py-2.5">
                    <p className="text-sm font-medium">Apt {aptNumber(aptId)}</p>
                    <p className="text-sm font-semibold text-red-600">{formatINR(total)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">Total</p>
                  <p className="text-sm font-bold text-red-600">
                    {formatINR(rows.reduce((sum, [, t]) => sum + t, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          {!canWrite && (
            <p className="mt-3 text-xs text-slate-500">
              You can only see dues for your own apartment(s); the community
              total on the tile includes all flats.
            </p>
          )}
          <Link
            href="/invoices"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to invoices →
          </Link>
        </Modal>
      )}
      {reserveModal && (
        <ReserveModal
          entries={reserve.data ?? []}
          onClose={() => setReserveModal(false)}
        />
      )}

      {addOpen && (
        <AddExpenseDialog
          vendors={vendors.data}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            expenses.reload();
            summary.reload();
          }}
        />
      )}
    </div>
  );
}
