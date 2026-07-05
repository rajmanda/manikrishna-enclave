"use client";

import { Suspense } from "react";
import { Banknote, Check, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar } from "@/components/FilterBar";
import type { Account, Apartment, Payment, User } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";

function PaymentsPageInner() {
  const payments = useApi<Payment[]>("/payments");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const accounts = useApi<Account[]>("/accounts");
  const { values: f, set: setFilter, clearAll, activeCount } = useUrlFilters({
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
  const pending = visible.filter((p) => p.status === "pending");
  const confirmed = visible.filter((p) => p.status !== "pending");
  const sorted = [...confirmed].sort((a, b) => b.date.localeCompare(a.date));
  const total = confirmed.reduce((s, p) => s + p.amount, 0);

  async function act(p: Payment, action: "confirm" | "reject") {
    if (action === "reject" && !confirm(`Reject the reported payment of ${formatINR(p.amount)}? The owner will be notified.`)) return;
    try {
      await api(`/payments/${p.id}/${action}`, { method: "POST" });
      payments.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
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
            { value: "all", label: "Both ledgers" },
            { value: "community", label: "Community" },
            { value: "manager_fee", label: "Manager fee" },
          ]},
        ]}
        values={f}
        onChange={setFilter}
        onClearAll={clearAll}
        activeCount={activeCount}
      />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Recorded" value={formatINR(total)} tone="positive" />
        <Stat label="Payments" value={String(payments.data.length)} hint="This period" />
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-amber-700">
            Awaiting confirmation ({pending.length})
          </h2>
          <Card className="divide-y divide-amber-100 border-amber-200">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Apt {aptNumber(p.apartmentId)} ·{" "}
                    {ownerNameFor(users.data, apartments.data, p.apartmentId)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatINR(p.amount)} · {p.method} · {formatDate(p.date)}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(p, "confirm")}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" /> Confirm
                  </button>
                  <button
                    onClick={() => act(p, "reject")}
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

      <Card className="divide-y divide-slate-100 animate-rise" key={JSON.stringify(f)}>
        {sorted.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Banknote className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Apt {aptNumber(p.apartmentId)} ·{" "}
                  {ownerNameFor(users.data, apartments.data, p.apartmentId)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(p.date)} · {p.reference}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold">{formatINR(p.amount)}</span>
              <Badge tone="slate">{p.method}</Badge>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="p-5 text-center text-sm text-slate-400">
            {activeCount > 0 ? "Nothing matches these filters." : "No payments recorded."}
          </p>
        )}
      </Card>
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
