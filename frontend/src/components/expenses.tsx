"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { api, ApiError, apiBlob } from "@/lib/api";
import { uploadFileTo } from "@/lib/upload";
import { useApi } from "@/hooks/useApi";
import type { DeliveryFailureSummary, Expense, ReserveReconciliation, Vendor } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { Badge, Card } from "@/components/ui";
import { DeliveryFailureBadge } from "@/components/DeliveryStatus";

export const EXPENSE_CATEGORIES = [
  "Electricity", "Water", "Watchman", "Lift", "Generator",
  "Repairs", "Garden", "Cleaning", "Miscellaneous",
];

export function vendorFor(vendors: Vendor[] | undefined, id?: string) {
  return id ? vendors?.find((v) => v.id === id) : undefined;
}

/** Warns when a payment/expense date falls inside a month already closed in
 * the reserve ledger — such entries don't move the live reserve until the
 * closing entry is amended (how the June bore well money went missing). */
export function ClosedMonthNote({ date }: { date: string }) {
  const recon = useApi<ReserveReconciliation>("/reserve-fund/reconciliation");
  const cutoff = recon.data?.anchorCutoff;
  if (!cutoff || !date || date.slice(0, 10) > cutoff) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        This date falls in {recon.data?.anchorMonth}, a month already closed in
        the reserve ledger. The amount won&apos;t change the live reserve — the
        Reserve Fund page will flag it so the {recon.data?.anchorMonth} closing
        entry can be amended.
      </span>
    </p>
  );
}

export function AddExpenseDialog({
  vendors,
  onClose,
  onDone,
  initial,
}: {
  vendors: Vendor[] | undefined;
  onClose: () => void;
  onDone: () => void;
  /** Prefill (e.g. "Record expense" from a work order); workOrderId links
   * the expense into the money chain. */
  initial?: {
    category?: string;
    description?: string;
    amount?: number;
    vendorId?: string;
    workOrderId?: string;
    costCaseId?: string;
  };
}) {
  // No default category — "Miscellaneous" as a default turns the ledger
  // into a dumping ground.
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [receipts, setReceipts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const expense = await api<Expense>("/expenses", {
        method: "POST",
        body: JSON.stringify({
          category,
          description,
          amount: Number(amount),
          paidDate,
          ...(vendorId ? { vendorId } : {}),
          ...(initial?.workOrderId ? { workOrderId: initial.workOrderId } : {}),
          ...(initial?.costCaseId ? { costCaseId: initial.costCaseId } : {}),
        }),
      });
      if (receipts[0]) {
        try {
          await uploadFileTo(`/expenses/${expense.id}/receipt`, receipts[0]);
        } catch {
          alert("Expense saved, but the receipt upload failed — you can attach it from the ledger.");
        }
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add expense");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount</label>
            <input
              type="number"
              min="1"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="₹"
              autoFocus
              required
            />
          </div>
          <div>
            <label className={labelCls}>Paid date</label>
            <input type="date" className={inputCls} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>Select category…</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. June electricity bill, plumber visit…"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Vendor (optional)</label>
          <select className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">— none —</option>
            {(vendors ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <ReceiptPicker
          files={receipts}
          onChange={(f) => setReceipts(f.slice(-1))}
          label="Receipt (optional — photo or PDF)"
        />
        <ClosedMonthNote date={paidDate} />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !category} className={primaryBtnCls}>
          {busy ? "Saving…" : `Add ${formatINR(Number(amount) || 0)} expense`}
        </button>
      </form>
    </Modal>
  );
}

export function ReceiptActions({
  expense,
  canWrite,
  onChanged,
}: {
  expense: Expense;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function viewReceipt() {
    const blob = await apiBlob(`/expenses/${expense.id}/receipt`);
    window.open(URL.createObjectURL(blob), "_blank");
  }

  async function upload(file: File) {
    setBusy(true);
    try {
      await uploadFileTo(`/expenses/${expense.id}/receipt`, file);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="mt-1.5 inline-flex items-center gap-3">
      {expense.hasReceipt && (
        <button onClick={viewReceipt} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          <Paperclip className="h-3 w-3" /> View receipt
        </button>
      )}
      {canWrite && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />
            {busy ? "Uploading…" : expense.hasReceipt ? "Replace" : "Attach receipt"}
          </button>
        </>
      )}
    </span>
  );
}

export function expenseMonthLabel(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime())
    ? "Other"
    : dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Month/category grouped expense ledger with receipts and delete —
 * shared by the Expenses page (workhorse) and anywhere else that needs it. */
export function ExpenseLedger({
  expenses,
  vendors,
  apartmentCount,
  canWrite,
  view,
  onChanged,
  deliveryFailures,
  onDeliveryResent,
}: {
  expenses: Expense[];
  vendors: Vendor[] | undefined;
  apartmentCount: number;
  canWrite: boolean;
  view: "month" | "category";
  onChanged: () => void;
  deliveryFailures?: Map<string, DeliveryFailureSummary>;
  onDeliveryResent?: () => void;
}) {
  // Keyed by view+label; unset = default (only the first group starts open).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const ledgerGroups = (() => {
    const map = new Map<string, Expense[]>();
    if (view === "category") {
      for (const e of [...expenses].sort((a, b) => b.amount - a.amount)) {
        map.set(e.category, [...(map.get(e.category) ?? []), e]);
      }
      return [...map.entries()]
        .map(([label, items]) => ({ label, items }))
        .sort(
          (a, b) =>
            b.items.reduce((s, e) => s + e.amount, 0) -
            a.items.reduce((s, e) => s + e.amount, 0)
        );
    }
    for (const e of [...expenses].sort((a, b) =>
      b.paidDate.localeCompare(a.paidDate)
    )) {
      const key = expenseMonthLabel(e.paidDate);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  })();

  return (
    <div className="space-y-3" key={view}>
      {ledgerGroups.map(({ label, items }, index) => {
        const groupTotal = items.reduce((sum, e) => sum + e.amount, 0);
        const groupKey = `${view}:${label}`;
        const isOpen = openGroups[groupKey] ?? index === 0;
        return (
          <div key={label} className="animate-rise">
            <button
              onClick={() =>
                setOpenGroups((prev) => ({ ...prev, [groupKey]: !isOpen }))
              }
              className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1 text-left hover:bg-slate-50"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
                {label}
              </span>
              <span className="text-xs text-slate-400">
                {items.length} expense{items.length === 1 ? "" : "s"} ·{" "}
                <span className="font-semibold text-slate-600">
                  {formatINR(groupTotal)}
                </span>
              </span>
            </button>
            {isOpen && (
              <Card className="divide-y divide-slate-100">
                {items.map((e) => {
                  const vendor = vendorFor(vendors, e.vendorId);
                  return (
                    <div key={e.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{e.description}</p>
                          <Badge tone="slate">
                            {view === "category" ? expenseMonthLabel(e.paidDate) : e.category}
                          </Badge>
                          {e.status === "draft" && (
                            <Badge tone="violet">draft — not in books</Badge>
                          )}
                          {e.reversalOf && <Badge tone="amber">reversal</Badge>}
                          {e.reversedBy && <Badge tone="slate">reversed</Badge>}
                          <DeliveryFailureBadge
                            failure={deliveryFailures?.get(`expense:${e.id}`)}
                            onResent={onDeliveryResent ?? (() => {})}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {vendor ? `${vendor.name} · ` : ""}
                          Paid {formatDate(e.paidDate)}
                          {apartmentCount > 0 && (
                            <>
                              {" "}· Split equally across {apartmentCount} apartments (
                              {formatINR(Math.round(e.amount / apartmentCount))}/apt)
                            </>
                          )}
                        </p>
                        <ReceiptActions expense={e} canWrite={canWrite} onChanged={onChanged} />
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <p className="text-sm font-semibold">{formatINR(e.amount)}</p>
                        {canWrite && !e.reversedBy && !e.reversalOf && e.status !== "draft" && (
                          <button
                            aria-label={`Correct ${e.description}`}
                            title="Correct amount (system posts reversal + corrected entry)"
                            onClick={async () => {
                              const raw = prompt(
                                `Correct amount for "${e.description}"?\n\nThe system will post a reversal of ${formatINR(-e.amount)} and a corrected entry automatically.`,
                                String(e.amount)
                              );
                              if (raw == null) return;
                              const amount = Number(raw);
                              if (!amount || amount <= 0 || amount === e.amount) return;
                              try {
                                await api(`/expenses/${e.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ amount }),
                                });
                                onChanged();
                              } catch (err) {
                                alert(err instanceof ApiError ? err.message : "Failed");
                              }
                            }}
                            className="text-slate-300 hover:text-brand-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canWrite && !e.reversedBy && !e.reversalOf && (
                          <button
                            aria-label={`Remove ${e.description}`}
                            onClick={async () => {
                              // Drafts delete; posted money gets a ledger-safe
                              // reversal entry instead (books stay intact).
                              const posted = e.status !== "draft";
                              const msg = posted
                                ? `Cancel "${e.description}" completely?\n\nThe system posts a reversal entry of ${formatINR(-e.amount)} — the books stay intact and the pair nets to zero. (To fix a wrong amount, use the pencil instead.)`
                                : `Delete draft "${e.description}"?`;
                              if (!confirm(msg)) return;
                              try {
                                await api(
                                  posted ? `/expenses/${e.id}/reverse` : `/expenses/${e.id}`,
                                  { method: posted ? "POST" : "DELETE" }
                                );
                                onChanged();
                              } catch (err) {
                                alert(err instanceof ApiError ? err.message : "Failed");
                              }
                            }}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between bg-slate-50/60 p-4">
                  <p className="text-sm font-semibold">{label} total</p>
                  <p className="text-sm font-bold">{formatINR(groupTotal)}</p>
                </div>
              </Card>
            )}
          </div>
        );
      })}
      {expenses.length === 0 && (
        <Card>
          <p className="p-5 text-center text-sm text-slate-400">
            No expenses recorded yet.
          </p>
        </Card>
      )}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <p className="text-sm font-semibold">All months total</p>
        <p className="text-sm font-bold">
          {formatINR(expenses.reduce((sum, e) => sum + e.amount, 0))}
        </p>
      </div>
    </div>
  );
}
