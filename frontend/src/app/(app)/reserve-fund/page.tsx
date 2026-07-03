"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { ReserveFundEntry } from "@/lib/types";
import { formatINR } from "@/lib/format";
import {
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";
import { ReserveFundChart } from "@/components/charts";

export default function ReserveFundPage() {
  const reserve = useApi<ReserveFundEntry[]>("/reserve-fund");

  if (reserve.error)
    return <ErrorNote message={reserve.error} onRetry={reserve.reload} />;
  if (reserve.loading || !reserve.data) return <PageLoading />;

  const entries = reserve.data;
  if (entries.length === 0)
    return <ErrorNote message="No reserve fund history yet." />;

  const latest = entries[entries.length - 1];
  const opening = entries[0].balance - entries[0].contributions + entries[0].expenses;
  const totalIn = entries.reduce((s, r) => s + r.contributions, 0);
  const totalOut = entries.reduce((s, r) => s + r.expenses, 0);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Reserve Fund"
        subtitle="Community savings for major repairs and emergencies"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Current Balance" value={formatINR(latest.balance)} tone="positive" />
        <Stat label="Opening" value={formatINR(opening)} />
        <Stat label="Contributions YTD" value={formatINR(totalIn)} tone="positive" hint="₹500/apt monthly" />
        <Stat label="Withdrawals YTD" value={formatINR(totalOut)} tone="negative" />
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Balance Trend</h2>
        <ReserveFundChart data={entries} />
      </Card>

      <Card className="divide-y divide-slate-100">
        <div className="p-4">
          <h2 className="text-sm font-semibold">Monthly History</h2>
        </div>
        {[...entries].reverse().map((r) => (
          <div key={r.month} className="flex items-center justify-between gap-3 p-4">
            <p className="w-10 text-sm font-semibold">{r.month}</p>
            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" /> {formatINR(r.contributions)}
              </span>
              {r.expenses > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <ArrowDownRight className="h-3.5 w-3.5" /> {formatINR(r.expenses)}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold">{formatINR(r.balance)}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
