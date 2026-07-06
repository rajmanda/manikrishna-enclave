"use client";

import { Suspense, useState } from "react";
import { Banknote, Check, Trash2, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { useSessionUser } from "@/context/AuthContext";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar } from "@/components/FilterBar";
import type { Account, Apartment, Invoice, Payment, User } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import { ledgerAccent } from "@/lib/tones";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";
import { InvoiceSheet } from "@/components/InvoiceSheet";

function PaymentsPageInner() {
  const { role } = useSessionUser();
  const canDelete = role === "super_admin" || role === "property_manager";
  const canWrite = ["property_manager", "community_admin", "super_admin"].includes(role);
  const mine = role === "owner" || role === "tenant";
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const payments = useApi<Payment[]>("/payments");
  const invoices = useApi<Invoice[]>("/invoices");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const accounts = useApi<Account[]>("/accounts");
  const { values: f, set: setFilter, setMany, clearAll, activeCount } = useUrlFilters({
    client: "all", apt: "all", method: "all", ledger: "all",
  });

  if (payments.error)
    return <ErrorNote message={payments.error} onRetry={payments.reload} />;
  if (payments.loading || !payments.data) return <PageLoading />;

  const accountApts = new Set(
    f.client === "all"
      ? []
      : accounts.data?.find((a) => a.id === f.client)?.apartmentIds ?? []
  );
  const visible = payments.data.filter(
    (p) =>
      (f.apt === "all" || p.apartmentId === f.apt) &&
      (f.method === "all" || p.method === f.method) &&
      (f.ledger === "all" || (p.ledger ?? "community") === f.ledger) &&
      (f.client === "all" || accountApts.has(p.apartmentId))
  );
  const invoiceById = new Map((invoices.data ?? []).map((i) => [i.id, i]));
  // What a payment row is titled: the invoice it settles, not just the flat.
  function paymentTitle(p: Payment): string {
    const inv = invoiceById.get(p.invoiceId);
    if (!inv) return `Apt ${aptNumber(p.apartmentId)}`;
    return `${inv.description} — ${inv.period}`;
  }

  const pending = visible.filter((p) => p.status === "pending");
  const confirmed = visible.filter((p) => p.status !== "pending");
  const sorted = [...confirmed].sort((a, b) => b.date.localeCompare(a.date));

  // Group by the month the payment was received, newest first (insertion
  // order follows the date sort above).
  function monthLabel(date: string): string {
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return "Other";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  const monthGroups = (() => {
    const map = new Map<string, Payment[]>();
    for (const p of sorted) {
      const key = monthLabel(p.date);
      const items = map.get(key) ?? [];
      items.push(p);
      map.set(key, items);
    }
    return [...map.entries()].map(([month, items]) => ({ month, items }));
  })();
  const communityTotal = confirmed
    .filter((p) => (p.ledger ?? "community") === "community")
    .reduce((s, p) => s + p.amount, 0);
  const personalTotal = confirmed
    .filter((p) => (p.ledger ?? "community") !== "community")
    .reduce((s, p) => s + p.amount, 0);

  async function act(p: Payment, action: "confirm" | "reject") {
    if (action === "reject" && !confirm(`Reject the reported payment of ${formatINR(p.amount)}? The owner will be notified.`)) return;
    try {
      await api(`/payments/${p.id}/${action}`, { method: "POST" });
      payments.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function reverse(p: Payment) {
    if (!confirm(`Reverse this payment of ${formatINR(p.amount)} (${p.method}, ${formatDate(p.date)})?\n\nThe amount is added back to the invoice's outstanding balance. This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      await api(`/payments/${p.id}`, { method: "DELETE" });
      payments.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to reverse payment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle title="Payments Received" subtitle="All payment records with references" />

      <FilterBar
        filters={[
          { key: "client", label: "Client", options: [
            { value: "all", label: "All clients" },
            ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name })),
          ]},
          { key: "apt", label: "Apartment", options: [
            { value: "all", label: "All apartments" },
            ...[...(apartments.data ?? [])]
              .filter((a) => f.client === "all" || accountApts.has(a.id))
              .sort((a, b) => a.number.localeCompare(b.number))
              .map((a) => ({ value: a.id, label: `Apt ${a.number}` })),
          ]},
          { key: "method", label: "Method", options: [
            { value: "all", label: "Any method" },
            { value: "UPI", label: "UPI" },
            { value: "Bank Transfer", label: "Bank Transfer" },
            { value: "Cash", label: "Cash" },
            { value: "Cheque", label: "Cheque" },
            { value: "Credit", label: "Credit / Waiver" },
          ]},
          { key: "ledger", label: "Ledger", options: [
            { value: "all", label: "All ledgers" },
            { value: "community", label: "Community" },
            { value: "manager_fee", label: "Manager fee" },
            { value: "reimbursement", label: "Reimbursement" },
          ]},
        ]}
        values={f}
        onChange={(key, value) => {
          if (key === "client" && value !== "all") {
            const apts = accounts.data?.find((a) => a.id === value)?.apartmentIds ?? [];
            setMany({ client: value, ...(apts.includes(f.apt) ? {} : { apt: "all" }) });
          } else {
            setFilter(key, value);
          }
        }}
        onClearAll={clearAll}
        activeCount={activeCount}
      />

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Community Funds Received"
          value={formatINR(communityTotal)}
          tone="positive"
          hint="Never mixed with personal money"
        />
        <Stat
          label="Personal — Fees & Reimbursements"
          value={formatINR(personalTotal)}
          hint="Payable to the manager"
        />
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-amber-700">
            Awaiting confirmation ({pending.length})
          </h2>
          <Card className="divide-y divide-amber-100 border-amber-200">
            {pending.map((p) => (
              <div
                key={p.id}
                onClick={() => setDetailId(p.invoiceId)}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 hover:bg-amber-50/40 ${ledgerAccent(p.ledger)}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{paymentTitle(p)}</p>
                  <p className="text-xs text-slate-500">
                    {ownerNameFor(users.data, apartments.data, p.apartmentId)} ·{" "}
                    {formatINR(p.amount)} · {p.method} · {formatDate(p.date)}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      act(p, "confirm");
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" /> Confirm
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      act(p, "reject");
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="space-y-5" key={JSON.stringify(f)}>
        {monthGroups.map(({ month, items }) => {
          const gc = items
            .filter((p) => (p.ledger ?? "community") === "community")
            .reduce((s, p) => s + p.amount, 0);
          const gp = items
            .filter((p) => (p.ledger ?? "community") !== "community")
            .reduce((s, p) => s + p.amount, 0);
          return (
            <section key={month} className="animate-rise">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold text-slate-700">{month}</h2>
                <p className="text-xs text-slate-400">
                  {items.length} payment{items.length === 1 ? "" : "s"}
                  {gc > 0 && <> · community <span className="font-medium text-emerald-600">{formatINR(gc)}</span></>}
                  {gp > 0 && <> · personal <span className="font-medium text-slate-600">{formatINR(gp)}</span></>}
                </p>
              </div>
              <Card className="divide-y divide-slate-100">
                {items.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setDetailId(p.invoiceId)}
                    className={`flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-slate-50/60 ${ledgerAccent(p.ledger)}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Banknote className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{paymentTitle(p)}</p>
                        <p className="truncate text-xs text-slate-500">
                          {ownerNameFor(users.data, apartments.data, p.apartmentId)} ·{" "}
                          {formatDate(p.date)}
                          {p.reference && ` · ${p.reference}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold">{formatINR(p.amount)}</span>
                      <Badge tone="slate">{p.method}</Badge>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reverse(p);
                          }}
                          disabled={deletingId === p.id}
                          title="Reverse payment"
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          );
        })}
        {sorted.length === 0 && (
          <Card>
            <p className="p-5 text-center text-sm text-slate-400">
              {activeCount > 0 ? "Nothing matches these filters." : "No payments recorded."}
            </p>
          </Card>
        )}
      </div>

      {detailId && (() => {
        const inv = invoices.data?.find((i) => i.id === detailId);
        return inv ? (
          <InvoiceSheet
            invoice={inv}
            payments={payments.data ?? []}
            invoices={invoices.data ?? []}
            users={users.data}
            apartments={apartments.data}
            canWrite={canWrite}
            mine={mine}
            onClose={() => setDetailId(null)}
            onChanged={() => {
              payments.reload();
              invoices.reload();
            }}
            onOpenInvoice={(i) => setDetailId(i.id)}
          />
        ) : null;
      })()}
    </div>
  );
}


export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PaymentsPageInner />
    </Suspense>
  );
}
