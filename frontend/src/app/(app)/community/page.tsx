"use client";

// The "HOA Page" — visible to every owner. All data comes from the API;
// invoices are RBAC-scoped server-side, so owners see dues badges only for
// their own apartment while managers see everyone's.

import { Paperclip, ReceiptText } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type {
  Apartment,
  CommunitySummary,
  Expense,
  Invoice,
  User,
  Vendor,
} from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { vendorFor } from "@/lib/lookup";
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

export default function CommunityPage() {
  const summary = useApi<CommunitySummary>("/finance/summary");
  const expenses = useApi<Expense[]>("/expenses");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const invoices = useApi<Invoice[]>("/invoices");
  const vendors = useApi<Vendor[]>("/vendors");

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
  const pieData = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Owners only receive their own invoices from the API, so dues badges
  // appear only where the caller is allowed to see them.
  const duesByApartment = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
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
        <Stat label="Month Income" value={formatINR(s.monthIncome)} tone="positive" />
        <Stat label="Month Expenses" value={formatINR(s.monthExpenses)} tone="negative" />
        <Stat label="Outstanding Dues" value={formatINR(s.outstandingDues)} />
        <Stat label="Reserve Fund" value={formatINR(s.reserveFundBalance)} tone="positive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Expense breakdown chart */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Expense Breakdown</h2>
          <ExpensePie data={pieData} />
        </Card>

        {/* Expense ledger */}
        <section className="lg:col-span-3">
          <SectionHeader title="Expenses This Month" />
          <Card className="divide-y divide-slate-100">
            {expenseList.map((e) => {
              const vendor = vendorFor(vendors.data, e.vendorId);
              return (
                <div key={e.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{e.description}</p>
                      <Badge tone="slate">{e.category}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {vendor ? `${vendor.name} · ` : ""}
                      Paid {formatDate(e.paidDate)} · Split equally across{" "}
                      {apartmentList.length} apartments (
                      {formatINR(Math.round(e.amount / apartmentList.length))}/apt)
                    </p>
                    {e.hasReceipt && (
                      <button className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                        <Paperclip className="h-3 w-3" /> View receipt
                      </button>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatINR(e.amount)}</p>
                </div>
              );
            })}
            <div className="flex items-center justify-between bg-slate-50/60 p-4">
              <p className="text-sm font-semibold">Total</p>
              <p className="text-sm font-bold">
                {formatINR(expenseList.reduce((sum, e) => sum + e.amount, 0))}
              </p>
            </div>
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
    </div>
  );
}
