"use client";

import { Banknote } from "lucide-react";
import { useApi } from "@/hooks/useApi";
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

  const sorted = [...payments.data].sort((a, b) => b.date.localeCompare(a.date));
  const total = payments.data.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <PageTitle title="Payments Received" subtitle="All payment records with references" />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Recorded" value={formatINR(total)} tone="positive" />
        <Stat label="Payments" value={String(payments.data.length)} hint="This period" />
      </div>

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
