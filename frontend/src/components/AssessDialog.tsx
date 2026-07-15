"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Apartment } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { uploadEach, uploadFileTo } from "@/lib/upload";

/** Owner assessment batch: per-apartment allocation table, equal split of
 * the budget by default, every row editable, tick apartments in or out. */
export function AssessDialog({
  caseId,
  caseTitle,
  budget,
  fundingMethod,
  apartments,
  onClose,
  onDone,
}: {
  caseId: string;
  caseTitle: string;
  budget: number;
  fundingMethod?: string | null;
  apartments: Apartment[];
  onClose: () => void;
  onDone: () => void;
}) {
  const sorted = [...apartments].sort((a, b) => a.number.localeCompare(b.number));
  // Funding method drives the defaults: "selected_apartments" starts with
  // nothing ticked; reserve/no-recovery cases warn that billing is unusual.
  const startTicked = fundingMethod !== "selected_apartments";
  const noBilling = fundingMethod === "reserve" || fundingMethod === "no_recovery";
  const equal = sorted.length > 0 ? Math.round((budget || 0) / sorted.length) : 0;
  const [rows, setRows] = useState(
    sorted.map((a) => ({ apartmentId: a.id, number: a.number, included: startTicked, amount: String(equal || ""), installments: 1 }))
  );
  const [period, setPeriod] = useState(
    new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
  );
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState(caseTitle);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const included = rows.filter((r) => r.included && Number(r.amount) > 0);
  const total = included.reduce((s, r) => s + Number(r.amount), 0);

  function update(i: number, patch: Partial<{ included: boolean; amount: string; installments: number }>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function splitEqually() {
    const active = rows.filter((r) => r.included).length;
    if (!active || !budget) return;
    const share = String(Math.round(budget / active));
    setRows(rows.map((r) => (r.included ? { ...r, amount: share } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ created: number; skipped: number }>(
        `/cost-cases/${caseId}/assessments`,
        {
          method: "POST",
          body: JSON.stringify({
            period,
            dueDate,
            description,
            allocations: included.map((r) => ({
              apartmentId: r.apartmentId,
              amount: Number(r.amount),
              installments: r.installments,
            })),
          }),
        }
      );
      if (res.skipped > 0)
        alert(`${res.created} invoice(s) created; ${res.skipped} apartment(s) already assessed for ${period} were skipped.`);
      if (receipts.length > 0 && res.created > 0) {
        // Supporting paper receipts land in Documents, visible only to the
        // assessed apartments (same behavior as Create Community Invoices).
        const failed = await uploadEach(receipts, (f, i) =>
          uploadFileTo("/documents", f, {
            title: `Receipt — ${description} (${period})${receipts.length > 1 ? ` #${i + 1}` : ""}`,
            category: "Receipts",
            apartment_ids: included.map((r) => r.apartmentId).join(","),
          })
        );
        if (failed > 0)
          alert(`Invoices created, but ${failed} receipt upload${failed > 1 ? "s" : ""} failed — you can add them from the Documents view.`);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate assessments");
      setBusy(false);
    }
  }

  return (
    <Modal title="Bill owners for this case" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {noBilling && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            This case is funded {fundingMethod === "reserve" ? "from the reserve" : "without owner recovery"} —
            billing owners is unusual for it. Continue only if the funding plan changed.
          </p>
        )}
        <p className="text-xs text-slate-500">
          One invoice per ticked apartment, linked to this cost case. Amounts
          default to an equal split{budget ? ` of the ${formatINR(budget)} budget` : ""} —
          edit any row for a custom allocation.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Period</label>
            <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Due date</label>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelCls}>Invoice title</label>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Allocation per apartment</label>
            <span className="flex gap-3">
              <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, included: true })))} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Select all
              </button>
              <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, included: false })))} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                Clear all
              </button>
              <button type="button" onClick={splitEqually} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Split equally
              </button>
            </span>
          </div>
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {rows.map((r, i) => (
              <div key={r.apartmentId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.included}
                  onChange={(e) => update(i, { included: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span className={`w-16 font-medium ${r.included ? "" : "text-slate-400 line-through"}`}>
                  Apt {r.number}
                </span>
                <input
                  type="number"
                  min="0"
                  value={r.amount}
                  disabled={!r.included}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  className="ml-auto w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm disabled:bg-slate-50 disabled:text-slate-300"
                />
                <select
                  value={r.installments}
                  disabled={!r.included}
                  onChange={(e) => update(i, { installments: Number(e.target.value) })}
                  title="Installments (monthly)"
                  className="w-16 rounded-lg border border-slate-200 px-1 py-1 text-xs disabled:bg-slate-50 disabled:text-slate-300"
                >
                  {[1, 2, 3, 6, 12].map((n) => (
                    <option key={n} value={n}>{n === 1 ? "once" : `${n}×`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="mt-2 flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
            <span>Total ({included.length} apartment{included.length === 1 ? "" : "s"})</span>
            <span>{formatINR(total)}</span>
          </p>
          {budget > 0 && total !== budget && total > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              {total > budget ? "Over" : "Under"} the approved budget by {formatINR(Math.abs(total - budget))}
            </p>
          )}
        </div>
        <ReceiptPicker
          files={receipts}
          onChange={setReceipts}
          label="Paper receipts (optional — saved to Documents, visible to the assessed apartments)"
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !dueDate || total <= 0} className={primaryBtnCls}>
          {busy ? "Generating…" : `Generate ${included.length} invoice${included.length === 1 ? "" : "s"} (${formatINR(total)})`}
        </button>
      </form>
    </Modal>
  );
}
