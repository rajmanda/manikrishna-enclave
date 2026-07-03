"use client";

import { CreditCard, Download, FileDown } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import type { Apartment, Invoice, User } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import { invoiceTone } from "@/lib/tones";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";

export default function InvoicesPage() {
  const { role, user } = useSessionUser();
  const mine = role === "owner" || role === "tenant";
  const invoices = useApi<Invoice[]>("/invoices");
  const apartments = useApi<Apartment[]>(mine ? null : "/apartments");
  const users = useApi<User[]>(mine ? null : "/users");

  if (invoices.error)
    return <ErrorNote message={invoices.error} onRetry={invoices.reload} />;
  if (invoices.loading || !invoices.data) return <PageLoading />;

  const list = invoices.data;
  const sorted = [...list].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const outstanding = list.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const billed = list.reduce((s, i) => s + i.amount, 0);
  const collected = list.reduce((s, i) => s + i.paidAmount, 0);

  return (
    <div className="space-y-5">
      <PageTitle
        title={mine ? "My Invoices" : "Invoices"}
        subtitle={
          mine
            ? `Apartment ${user.apartmentId ? aptNumber(user.apartmentId) : "—"}`
            : "All apartments · monthly maintenance and charges"
        }
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              <FileDown className="h-4 w-4" /> CSV
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              <Download className="h-4 w-4" /> Statement
            </button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Billed" value={formatINR(billed)} />
        <Stat label="Collected" value={formatINR(collected)} tone="positive" />
        <Stat
          label="Outstanding"
          value={formatINR(outstanding)}
          tone={outstanding > 0 ? "negative" : "positive"}
        />
      </div>

      <Card className="divide-y divide-slate-100">
        {sorted.map((inv) => {
          const balance = inv.amount - inv.paidAmount;
          return (
            <div key={inv.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {inv.description} — {inv.period}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {!mine &&
                      `Apt ${aptNumber(inv.apartmentId)} · ${ownerNameFor(users.data, apartments.data, inv.apartmentId)} · `}
                    Due {formatDate(inv.dueDate)}
                    {inv.status === "partial" &&
                      ` · Paid ${formatINR(inv.paidAmount)} of ${formatINR(inv.amount)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold">{formatINR(inv.amount)}</span>
                  <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                </div>
              </div>
              {mine && balance > 0 && (
                <button className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700">
                  <CreditCard className="h-3.5 w-3.5" />
                  Pay {formatINR(balance)}
                </button>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="p-5 text-center text-sm text-slate-400">No invoices yet.</p>
        )}
      </Card>
    </div>
  );
}
