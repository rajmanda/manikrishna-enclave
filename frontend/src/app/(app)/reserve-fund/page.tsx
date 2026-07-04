"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, PlusCircle } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { ReserveFundEntry } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";
import { ReserveFundChart } from "@/components/charts";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function AddEntryDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [month, setMonth] = useState("");
  const [contributions, setContributions] = useState("5000");
  const [expensesAmt, setExpensesAmt] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/reserve-fund", {
        method: "POST",
        body: JSON.stringify({
          month,
          contributions: Number(contributions),
          expenses: Number(expensesAmt),
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add entry");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Monthly Entry" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Month (e.g. Jul)</label>
          <input className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Contributions</label>
            <input type="number" min="0" className={inputCls} value={contributions} onChange={(e) => setContributions(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Withdrawals</label>
            <input type="number" min="0" className={inputCls} value={expensesAmt} onChange={(e) => setExpensesAmt(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          The balance is computed automatically from the previous month.
        </p>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Saving…" : "Add entry"}
        </button>
      </form>
    </Modal>
  );
}

export default function ReserveFundPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const [addOpen, setAddOpen] = useState(false);
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
        actions={
          canWrite ? (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> Add entry
            </button>
          ) : undefined
        }
      />

      {addOpen && (
        <AddEntryDialog onClose={() => setAddOpen(false)} onDone={reserve.reload} />
      )}

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
