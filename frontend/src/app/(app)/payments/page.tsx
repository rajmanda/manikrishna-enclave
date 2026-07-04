"use client";

import { Banknote, Check, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Apartment, Payment, User } from "@/lib/types";
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

export default function PaymentsPage() {
  const payments = useApi<Payment[]>("/payments");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");

  if (payments.error)
    return <ErrorNote message={payments.error} onRetry={payments.reload} />;
  if (payments.loading || !payments.data) return <PageLoading />;

  const pending = payments.data.filter((p) => p.status === "pending");
  const confirmed = payments.data.filter((p) => p.status !== "pending");
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

      <Card className="divide-y divide-slate-100">
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
          <p className="p-5 text-center text-sm text-slate-400">No payments recorded.</p>
        )}
      </Card>
    </div>
  );
}
