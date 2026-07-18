"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlarmClock, ArrowUpDown, Banknote, ChevronDown, Download, FileDown, HandCoins, LayoutGrid, PiggyBank, PlusCircle, ReceiptText, Table2, Trash2, X } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Account, Apartment, CreditEntry, DepositStatus, FeeEnrollment, Invoice, Payment, PaymentRejection, PayerType, User, WorkOrder } from "@/lib/types";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar } from "@/components/FilterBar";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor, tenantFor } from "@/lib/lookup";
import { invoiceTone, ledgerAccent } from "@/lib/tones";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { ClosedMonthNote } from "@/components/expenses";
import { uploadEach, uploadFileTo } from "@/lib/upload";
import {
  Badge,
  Card,
  ErrorNote,
  LedgerBadge,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];
const METHODS = ["UPI", "Bank Transfer", "Cash", "Cheque", "Credit"] as const;
const OWNER_METHODS = ["UPI", "Bank Transfer", "Cash", "Cheque"] as const;

function ReportPaymentDialog({
  invoice,
  users,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  users: User[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const { role } = useSessionUser();
  const outstanding = invoice.amount - invoice.paidAmount;
  const tenant = tenantFor(users, invoice.apartmentId);
  // "self" = the reporter (owner or tenant); owners may declare their
  // tenant or a named third party as the one who actually paid.
  const [paidBy, setPaidBy] = useState<"self" | "tenant" | "other">("self");
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState(String(outstanding));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<(typeof OWNER_METHODS)[number]>("UPI");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/payments/report", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: Number(amount),
          date,
          method,
          reference,
          ...(paidBy === "tenant" ? { payerType: "tenant" } : {}),
          ...(paidBy === "other" ? { payerType: "other", payerName } : {}),
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to report payment");
      setBusy(false);
    }
  }

  return (
    <Modal title={`I've paid — ${invoice.description}, ${invoice.period}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-slate-500">
          Report the payment made to the property manager. It shows as
          pending until they confirm receipt.
        </p>
        <div>
          <label className={labelCls}>Who paid?</label>
          <select
            className={inputCls}
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value as "self" | "tenant" | "other")}
          >
            <option value="self">I paid this myself</option>
            {role === "owner" && tenant && (
              <option value="tenant">My tenant — {tenant.name}</option>
            )}
            <option value="other">Someone else</option>
          </select>
        </div>
        {paidBy === "other" && (
          <div>
            <label className={labelCls}>Payer name</label>
            <input className={inputCls} value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Who handed over the money" required />
          </div>
        )}
        {paidBy !== "self" && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            The payment still settles this invoice on the owner&apos;s ledger —
            the manager sees who paid and the payer is named on the receipt.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount paid</label>
            <input type="number" min="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        {Number(amount) > outstanding && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {formatINR(Number(amount) - outstanding)} beyond this invoice will be
            held as advance credit for your apartment once the manager confirms.
          </p>
        )}
        <div>
          <label className={labelCls}>Method</label>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as (typeof OWNER_METHODS)[number])}>
            {OWNER_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Reference (UPI/NEFT id — helps quick confirmation)</label>
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UPI-4821" />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Submitting…" : `Report ${formatINR(Number(amount) || 0)} paid`}
        </button>
      </form>
    </Modal>
  );
}

/** Owner pays several invoices in one shot: one transfer, allocated oldest
 * due first — with the option to spend advance credit first. Each portion
 * lands as a normal per-invoice payment, so the books balance exactly as if
 * every invoice were paid individually. */
function PayMultipleDialog({
  invoices,
  users,
  totalCredit,
  multiApt,
  onClose,
  onDone,
}: {
  invoices: Invoice[]; // the owner's open invoices without pending reports
  users: User[] | undefined;
  totalCredit: number; // the account's pooled confirmed advance credit
  multiApt: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { role } = useSessionUser();
  const open = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [selected, setSelected] = useState<Set<string>>(new Set(open.map((i) => i.id)));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<(typeof OWNER_METHODS)[number]>("UPI");
  const [reference, setReference] = useState("");
  // Owners may declare their tenant (resolved per apartment server-side)
  // or a named third party as the actual payer.
  const [paidBy, setPaidBy] = useState<"self" | "tenant" | "other">("self");
  const [payerName, setPayerName] = useState("");
  const anyTenant = open.some((i) => tenantFor(users, i.apartmentId));
  const [useCredit, setUseCredit] = useState(true);
  const [amountTouched, setAmountTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = open.filter((i) => selected.has(i.id));
  const outstanding = chosen.reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  // Credit is pooled across the account: spend it oldest due first over the
  // chosen invoices, regardless of which apartment holds it.
  const creditAlloc = (() => {
    const alloc = new Map<string, number>();
    if (!useCredit) return alloc;
    let pool = totalCredit;
    for (const inv of chosen) {
      if (pool <= 0) break;
      const take = Math.min(pool, inv.amount - inv.paidAmount);
      alloc.set(inv.id, take);
      pool -= take;
    }
    return alloc;
  })();
  const creditUsed = [...creditAlloc.values()].reduce((s, v) => s + v, 0);
  const cashDue = Math.max(0, outstanding - creditUsed);
  const cash = amountTouched ? Number(amount) || 0 : cashDue;
  const excess = Math.max(0, cash - cashDue);

  // Preview mirrors the server: credit first, then the transfer oldest due
  // first across what's left.
  const preview = (() => {
    const cashMap = new Map<string, number>();
    let remaining = cash;
    for (const inv of chosen) {
      if (remaining <= 0) break;
      const due = inv.amount - inv.paidAmount - (creditAlloc.get(inv.id) ?? 0);
      if (due <= 0) continue;
      const take = Math.min(remaining, due);
      cashMap.set(inv.id, take);
      remaining -= take;
    }
    return { credit: creditAlloc, cash: cashMap };
  })();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // 1) Spend advance credit (already with the community — applies
      //    instantly, no confirmation needed). The pool is shared, but the
      //    API targets one apartment per call — group the allocation.
      const byApt = new Map<string, { amount: number; invoiceIds: string[] }>();
      for (const inv of chosen) {
        const take = creditAlloc.get(inv.id) ?? 0;
        if (take <= 0) continue;
        const slot = byApt.get(inv.apartmentId) ?? { amount: 0, invoiceIds: [] };
        slot.amount += take;
        slot.invoiceIds.push(inv.id);
        byApt.set(inv.apartmentId, slot);
      }
      for (const [apt, slot] of byApt) {
        await api("/payments/apply-credit", {
          method: "POST",
          body: JSON.stringify({
            apartmentId: apt,
            amount: slot.amount,
            invoiceIds: slot.invoiceIds,
          }),
        });
      }
      // 2) Report the transfer covering the rest (pending until confirmed).
      if (cash > 0) {
        await api("/payments/report-batch", {
          method: "POST",
          body: JSON.stringify({
            invoiceIds: chosen.map((i) => i.id),
            amount: cash,
            date,
            method,
            reference,
            ...(paidBy === "tenant" ? { payerType: "tenant" } : {}),
            ...(paidBy === "other" ? { payerType: "other", payerName } : {}),
          }),
        });
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to report payment");
      setBusy(false);
    }
  }

  const allSelected = selected.size === open.length;

  return (
    <Modal title="Pay Multiple Invoices" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-xs text-slate-500">
          One transfer can cover everything you owe — it&apos;s applied oldest
          due date first, and each invoice is settled exactly as if paid on its
          own. It shows as pending until the manager confirms.
        </p>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(open.map((i) => i.id)))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Select all
          </label>
          <span className="text-xs text-slate-400">
            {chosen.length} of {open.length} selected
          </span>
        </div>
        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {open.map((inv) => {
            const bal = inv.amount - inv.paidAmount;
            const viaCredit = preview.credit.get(inv.id);
            const viaCash = preview.cash.get(inv.id);
            return (
              <label key={inv.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.has(inv.id)}
                  onChange={() => toggle(inv.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span className="min-w-0 flex-1 truncate">
                  {multiApt && <b>Apt {aptNumber(inv.apartmentId)} · </b>}
                  {inv.description} — {inv.period}
                </span>
                <span className="shrink-0 text-slate-500">{formatINR(bal)}</span>
                {viaCredit != null && (
                  <span className="shrink-0 font-semibold text-violet-600">credit {formatINR(viaCredit)}</span>
                )}
                {viaCash != null && (
                  <span className="shrink-0 font-semibold text-emerald-600">→ {formatINR(viaCash)}</span>
                )}
              </label>
            );
          })}
          {open.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-400">Nothing left to pay. 🎉</p>
          )}
        </div>
        {totalCredit > 0 && (
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-violet-700">
              <input
                type="checkbox"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="h-4 w-4 rounded border-violet-300 text-violet-600"
              />
              Use my advance credit first ({formatINR(totalCredit)} available)
            </span>
            {creditUsed > 0 && (
              <span className="text-xs font-bold text-violet-700">−{formatINR(creditUsed)}</span>
            )}
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{creditUsed > 0 ? "Amount you transfer" : "Amount paid"}</label>
            <input
              type="number"
              min={creditUsed > 0 ? "0" : "1"}
              className={inputCls}
              value={amountTouched ? amount : String(cashDue)}
              onChange={(e) => {
                setAmountTouched(true);
                setAmount(e.target.value);
              }}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        {cash > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Method</label>
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as (typeof OWNER_METHODS)[number])}>
                {OWNER_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reference (UPI/NEFT id)</label>
              <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UPI-4821" />
            </div>
          </div>
        )}
        <div className="space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold">
          <p className="flex justify-between">
            <span>{chosen.length} invoice{chosen.length === 1 ? "" : "s"} · total due</span>
            <span>{formatINR(outstanding)}</span>
          </p>
          {creditUsed > 0 && (
            <p className="flex justify-between text-violet-700">
              <span>Advance credit applied</span>
              <span>−{formatINR(creditUsed)}</span>
            </p>
          )}
          <p className="flex justify-between text-slate-800">
            <span>You transfer</span>
            <span>{formatINR(cash)}</span>
          </p>
          {excess > 0 && (
            <p className="flex justify-between text-emerald-700">
              <span>Held as advance credit for next time</span>
              <span>+{formatINR(excess)}</span>
            </p>
          )}
        </div>
        {cash > 0 && (
          <div>
            <label className={labelCls}>Who paid the transfer?</label>
            <select
              className={inputCls}
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value as "self" | "tenant" | "other")}
            >
              <option value="self">I paid this myself</option>
              {role === "owner" && anyTenant && (
                <option value="tenant">My tenant (on behalf of me)</option>
              )}
              <option value="other">Someone else</option>
            </select>
            {paidBy === "other" && (
              <input
                className={`${inputCls} mt-2`}
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Payer name"
                required
              />
            )}
          </div>
        )}
        <ClosedMonthNote date={date} />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || chosen.length === 0 || (cash <= 0 && creditUsed <= 0)}
          className={primaryBtnCls}
        >
          {busy
            ? "Submitting…"
            : cash > 0
              ? `Report ${formatINR(cash)} paid${creditUsed > 0 ? ` + use ${formatINR(creditUsed)} credit` : ""}`
              : `Use ${formatINR(creditUsed)} credit`}
        </button>
      </form>
    </Modal>
  );
}

function nextMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function GenerateDialog({
  apartments,
  users,
  workOrders,
  onClose,
  onDone,
  initialDescription,
  workOrderId,
}: {
  apartments: Apartment[] | undefined;
  users: User[] | undefined;
  workOrders: WorkOrder[] | undefined;
  onClose: () => void;
  onDone: () => void;
  /** Set when billing owners for a work order — invoices link back to it. */
  initialDescription?: string;
  workOrderId?: string;
}) {
  const [linkedWo, setLinkedWo] = useState(workOrderId ?? "");
  const [period, setPeriod] = useState(nextMonthLabel());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState(initialDescription || "Monthly Maintenance");
  const [receipts, setReceipts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedApartments = [...(apartments ?? [])].sort((a, b) =>
    a.number.localeCompare(b.number)
  );
  // Allocation rows like the cost-case Bill owners dialog: tick apartments
  // in/out, blank amount = the default amount field below.
  // Rented apartments can have the payment request routed to the tenant
  // (on behalf of the owner) — liability stays with the owner either way.
  const [rows, setRows] = useState(
    sortedApartments.map((a) => ({
      apartmentId: a.id,
      number: a.number,
      included: true,
      amount: "",
      requestFrom: "owner" as "owner" | "tenant",
    }))
  );
  const included = rows.filter((r) => r.included);
  const allIncluded = included.length === rows.length;
  const customUsed = included.some((r) => r.amount !== "");
  const tenantRecipients = included
    .filter((r) => r.requestFrom === "tenant")
    .map((r) => r.apartmentId);

  function updateRow(
    i: number,
    patch: Partial<{ included: boolean; amount: string; requestFrom: "owner" | "tenant" }>
  ) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (included.length === 0) {
      setError("Select at least one apartment");
      return;
    }
    if (customUsed && !amount && included.some((r) => r.amount === "")) {
      setError("With custom amounts, fill every selected row or set a default amount");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<{ created: number; skipped: number }>(
        "/invoices/generate",
        {
          method: "POST",
          body: JSON.stringify({
            period,
            dueDate,
            description,
            ...(customUsed
              ? { allocations: included.map((r) => ({
                    apartmentId: r.apartmentId,
                    amount: Number(r.amount || amount),
                  })) }
              : {
                  ...(amount ? { amount: Number(amount) } : {}),
                  ...(allIncluded ? {} : { apartmentIds: included.map((r) => r.apartmentId) }),
                }),
            ...(linkedWo ? { workOrderId: linkedWo } : {}),
            ...(tenantRecipients.length > 0 ? { tenantRecipients } : {}),
          }),
        }
      );
      if (receipts.length > 0) {
        // Community-wide charge → community-visible receipts in Documents
        // (scoped to the selected apartments when not billing everyone).
        const failed = await uploadEach(receipts, (f, i) =>
          uploadFileTo("/documents", f, {
            title: `Receipt — ${description.trim()} (${period})${receipts.length > 1 ? ` #${i + 1}` : ""}`,
            category: "Receipts",
            apartment_ids: allIncluded ? "" : included.map((r) => r.apartmentId).join(","),
          })
        );
        if (failed > 0)
          alert(`Invoices created, but ${failed} receipt upload${failed > 1 ? "s" : ""} failed — you can add them from the Documents view.`);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate");
      setBusy(false);
    }
  }

  return (
    <Modal title="Create Community Invoices" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>What is this invoice for?</label>
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monthly Maintenance, Borewell repair…"
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Owners see this as the invoice title, e.g. &ldquo;{description.trim() || "Monthly Maintenance"} — Apt 502&rdquo;
          </p>
        </div>
        <div>
          <label className={labelCls}>Period (billing month)</label>
          <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Aug 2026" required />
        </div>
        <div>
          <label className={labelCls}>Due date</label>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Amount per apartment (blank = community default)</label>
          <input type="number" min="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3500" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Apartments & amounts</label>
            <span className="flex gap-3">
              <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, included: true })))} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Select all
              </button>
              <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, included: false })))} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                Clear all
              </button>
            </span>
          </div>
          <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {rows.map((r, i) => {
              const tenant = tenantFor(users, r.apartmentId);
              return (
              <div key={r.apartmentId} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.included}
                    onChange={(e) => updateRow(i, { included: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className={`w-14 font-medium ${r.included ? "" : "text-slate-400 line-through"}`}>
                    Apt {r.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                    {ownerNameFor(users, sortedApartments, r.apartmentId)}
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={r.amount}
                    disabled={!r.included}
                    placeholder={amount || "default"}
                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm disabled:bg-slate-50 disabled:text-slate-300"
                  />
                </div>
                {tenant && r.included && (
                  <div className="ml-6 flex items-center gap-2 text-xs text-slate-500">
                    <span>Payment requested from</span>
                    <select
                      value={r.requestFrom}
                      onChange={(e) =>
                        updateRow(i, { requestFrom: e.target.value as "owner" | "tenant" })
                      }
                      className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs"
                    >
                      <option value="owner">Owner</option>
                      <option value="tenant">Tenant — {tenant.name} (on behalf of owner)</option>
                    </select>
                  </div>
                )}
              </div>
              );
            })}
          </div>
          <p className="mt-1 px-1 text-xs text-slate-400">
            {included.length} selected · blank amount = the default above
          </p>
        </div>
          <ReceiptPicker files={receipts} onChange={setReceipts} />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" disabled={busy || !dueDate || included.length === 0} className={primaryBtnCls}>
            {busy
              ? "Creating…"
              : allIncluded
                ? "Create for all apartments"
                : `Create for ${included.length} apartment${included.length === 1 ? "" : "s"}`}
          </button>
        </form>
      </Modal>
    );
}

function PaymentDialog({
  invoice,
  users,
  apartments,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  users: User[] | undefined;
  apartments: Apartment[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user: me } = useSessionUser();
  const outstanding = invoice.amount - invoice.paidAmount;
  const tenant = tenantFor(users, invoice.apartmentId);
  const ownerName = ownerNameFor(users, apartments, invoice.apartmentId);
  const [amount, setAmount] = useState(String(outstanding));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<(typeof METHODS)[number]>("UPI");
  const [reference, setReference] = useState("");
  const [payerType, setPayerType] = useState<PayerType>("owner");
  const [payerName, setPayerName] = useState("");
  const [depositStatus, setDepositStatus] = useState<DepositStatus>("not_required");
  const [depositDate, setDepositDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excess = Math.max(0, Number(amount) - outstanding);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: Number(amount),
          date,
          method,
          reference,
          payerType,
          payerEntityId: payerType === "tenant" ? tenant?.id ?? null : null,
          payerName:
            payerType === "tenant" ? tenant?.name ?? payerName : payerType === "other" ? payerName : "",
          depositStatus,
          depositDate: depositStatus === "deposited" && depositDate ? depositDate : null,
          notes,
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record Payment — ${invoice.description}, ${invoice.period}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-slate-500">
          Apt {aptNumber(invoice.apartmentId)} · Responsible owner {ownerName} ·
          Outstanding {formatINR(outstanding)}
        </p>
        <div>
          <label className={labelCls}>Paid by</label>
          <select
            className={inputCls}
            value={payerType}
            onChange={(e) => setPayerType(e.target.value as PayerType)}
          >
            <option value="owner">Owner — {ownerName}</option>
            {tenant && (
              <option value="tenant">
                Tenant paid on behalf of owner — {tenant.name}
              </option>
            )}
            <option value="other">Other person</option>
          </select>
        </div>
        {payerType === "other" && (
          <div>
            <label className={labelCls}>Payer name</label>
            <input className={inputCls} value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Who handed over the money" required />
          </div>
        )}
        {payerType === "tenant" && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            This settles the <b>owner&apos;s</b> invoice and credits the owner&apos;s
            ledger; {tenant?.name} is recorded as the payment source and gets a
            receipt. The owner remains responsible for any unpaid balance.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount received</label>
            <input type="number" min="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        {excess > 0 && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {formatINR(excess)} beyond this invoice will be held as advance
            credit on the owner&apos;s account
            {payerType !== "owner" && ", funded by the payer,"} and can be
            applied to a future invoice or refunded.
          </p>
        )}
        <div>
          <label className={labelCls}>Method</label>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{m === "Credit" ? "Credit / Waiver" : m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Reference / transaction ID</label>
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI-1234 / NEFT ref / waiver note" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Deposit status</label>
            <select className={inputCls} value={depositStatus} onChange={(e) => setDepositStatus(e.target.value as DepositStatus)}>
              <option value="not_required">Not required</option>
              <option value="pending">Pending deposit</option>
              <option value="deposited">Deposited</option>
            </select>
          </div>
          {depositStatus === "deposited" && (
            <div>
              <label className={labelCls}>Deposit date</label>
              <input type="date" className={inputCls} value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this payment" />
        </div>
        <p className="text-xs text-slate-400">Collected by {me.name}</p>
        <ClosedMonthNote date={date} />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Saving…" : `Record ${formatINR(Number(amount) || 0)}`}
        </button>
      </form>
    </Modal>
  );
}

function BillOwnerDialog({
  apartments,
  users,
  onClose,
  onDone,
}: {
  apartments: Apartment[] | undefined;
  users: User[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [apartmentId, setApartmentId] = useState("");
  const [period, setPeriod] = useState(
    new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
  );
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<{ description: string; amount: string }[]>([
    { description: "", amount: "" },
  ]);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const sortedApts = [...(apartments ?? [])].sort((a, b) => a.number.localeCompare(b.number));

  function update(i: number, patch: Partial<{ description: string; amount: string }>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const invoice = await api<Invoice>("/invoices/bill-owner", {
        method: "POST",
        body: JSON.stringify({
          apartmentId,
          period,
          dueDate,
          lineItems: items
            .filter((i) => i.description.trim() && Number(i.amount) > 0)
            .map((i) => ({ description: i.description.trim(), amount: Number(i.amount) })),
        }),
      });
      if (receipts.length > 0) {
        // Personal charge → receipts visible only to this apartment's owners.
        const failed = await uploadEach(receipts, (f, i) =>
          uploadFileTo(`/invoices/${invoice.id}/receipt`, f, {
            title:
              receipts.length > 1
                ? `Receipt — ${invoice.description} (${period}) #${i + 1}`
                : "",
          })
        );
        if (failed > 0)
          alert(`Invoice created, but ${failed} receipt upload${failed > 1 ? "s" : ""} failed — you can attach them from the invoice details.`);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to bill owner");
      setBusy(false);
    }
  }

  return (
    <Modal title="Bill an Owner (personal reimbursement)" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-xs text-slate-500">
          Flat-specific expenses you paid and are collecting back — kept fully
          separate from community funds. The owner sees this exact breakdown.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Apartment</label>
            <select className={inputCls} value={apartmentId} onChange={(e) => setApartmentId(e.target.value)} required>
              <option value="">Select…</option>
              {sortedApts.map((a) => (
                <option key={a.id} value={a.id}>
                  Apt {a.number} — {ownerNameFor(users, apartments, a.id).slice(0, 20)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Due date</label>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelCls}>Line items</label>
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="e.g. May electricity bill"
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
                <input
                  type="number"
                  min="1"
                  className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="₹"
                  value={it.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="text-slate-300 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems([...items, { description: "", amount: "" }])}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Add line item
            </button>
          </div>
          <p className="mt-2 flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
            <span>Total</span>
            <span>{formatINR(total)}</span>
          </p>
        </div>
        <div>
          <label className={labelCls}>Period (billing month)</label>
          <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </div>
        <ReceiptPicker
          files={receipts}
          onChange={setReceipts}
          label="Paper receipts (optional — only this apartment's owners can see them)"
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !apartmentId || !dueDate || total <= 0}
          className={primaryBtnCls}
        >
          {busy ? "Billing…" : `Bill ${formatINR(total)} (owner is notified)`}
        </button>
      </form>
    </Modal>
  );
}

function FeeDialog({
  apartments,
  users,
  onClose,
  onDone,
}: {
  apartments: Apartment[] | undefined;
  users: User[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const enrollments = useApi<FeeEnrollment[]>("/manager-fees/enrollments");
  const [rows, setRows] = useState<FeeEnrollment[] | null>(null);
  const [period, setPeriod] = useState(nextMonthLabel());
  const [dueDate, setDueDate] = useState("");
  const [receipts, setReceipts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = rows ?? enrollments.data ?? [];
  const sortedApts = [...(apartments ?? [])].sort((a, b) => a.number.localeCompare(b.number));
  const available = sortedApts.filter((a) => !list.some((r) => r.apartmentId === a.id));

  function update(i: number, patch: Partial<FeeEnrollment>) {
    setRows(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save(): Promise<boolean> {
    try {
      await api("/manager-fees/enrollments", {
        method: "PUT",
        body: JSON.stringify({ enrollments: list }),
      });
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save enrollments");
      return false;
    }
  }

  async function saveAndGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (!(await save())) {
      setBusy(false);
      return;
    }
    try {
      await api<{ created: number; skipped: number }>(
        "/manager-fees/generate",
        { method: "POST", body: JSON.stringify({ period, dueDate }) }
      );
      if (receipts.length > 0) {
        // Personal fees → receipts visible only to the enrolled apartments.
        const failed = await uploadEach(receipts, (f, i) =>
          uploadFileTo("/documents", f, {
            title: `Receipt — Manager service fees (${period})${receipts.length > 1 ? ` #${i + 1}` : ""}`,
            category: "Receipts",
            apartment_ids: list.filter((r) => r.active).map((r) => r.apartmentId).join(","),
          })
        );
        if (failed > 0)
          alert(`Fees generated, but ${failed} receipt upload${failed > 1 ? "s" : ""} failed — you can add them from the Documents view.`);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate");
      setBusy(false);
    }
  }

  return (
    <Modal title="Manager Service Fees" onClose={onClose}>
      <form className="space-y-4" onSubmit={saveAndGenerate}>
        <p className="text-xs text-slate-500">
          Private fees paid to the manager — never mixed into community
          income. Untick an apartment when its tenant moves out.
        </p>
        <div>
          <label className={labelCls}>Enrolled apartments</label>
          <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {list.map((r, i) => (
              <div key={r.apartmentId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => update(i, { active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span className={`w-16 font-medium ${r.active ? "" : "text-slate-400 line-through"}`}>
                  Apt {r.apartmentId.replace("apt-", "")}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                  {ownerNameFor(users, apartments, r.apartmentId)}
                </span>
                <input
                  type="number"
                  min="1"
                  value={r.amount}
                  onChange={(e) => update(i, { amount: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm"
                />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setRows(list.filter((_, idx) => idx !== i))}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {list.length === 0 && (
                <p className="py-3 text-center text-xs text-slate-400">No apartments enrolled.</p>
              )}
              {available.length > 0 && (
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    setRows([...list, { apartmentId: e.target.value, amount: 1500, active: true }])
                  }
                  className="mt-1 w-full rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500"
                >
                  <option value="">+ Enroll an apartment…</option>
                  {available.map((a) => (
                    <option key={a.id} value={a.id}>Apt {a.number}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
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
          <ReceiptPicker
            files={receipts}
            onChange={setReceipts}
            label="Paper receipts (optional — visible to enrolled apartments only)"
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true); setError(null);
                if (await save()) onClose();
                else setBusy(false);
              }}
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Save config only
            </button>
            <button type="submit" disabled={busy || !dueDate}
              className="rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? "Working…" : "Save & generate"}
            </button>
          </div>
        </form>
      </Modal>
    );
}

function LateFeeDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("200");
  const [dueDate, setDueDate] = useState("");
  const [receipts, setReceipts] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ created: number; apartmentIds: string[] }>(
        "/invoices/apply-late-fees",
        {
          method: "POST",
          body: JSON.stringify({ period, amount: Number(amount), dueDate }),
        }
      );
      if (receipts.length > 0 && result.created > 0) {
        // Who paid late is private — scope the receipts to exactly the
        // apartments that were charged.
        const failed = await uploadEach(receipts, (f, i) =>
          uploadFileTo("/documents", f, {
            title: `Receipt — Late fees (${period})${receipts.length > 1 ? ` #${i + 1}` : ""}`,
            category: "Receipts",
            apartment_ids: (result.apartmentIds ?? []).join(","),
          })
        );
        if (failed > 0)
          alert(`Late fees applied, but ${failed} receipt upload${failed > 1 ? "s" : ""} failed — you can add them from the Documents view.`);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal title="Apply Late Fees" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-slate-500">
          Adds a late-fee invoice for every overdue invoice in the period
          (skips ones already charged).
        </p>
        <div>
          <label className={labelCls}>Period (e.g. Jun 2026)</label>
          <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Late fee amount</label>
          <input type="number" min="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Fee due date</label>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <ReceiptPicker
          files={receipts}
          onChange={setReceipts}
          label="Paper receipts (optional — visible only to the charged apartments)"
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Applying…" : "Apply late fees"}
        </button>
      </form>
    </Modal>
  );
}

function InvoicesPageInner() {
  const { role, user } = useSessionUser();
  const mine = role === "owner" || role === "tenant";
  const canWrite = WRITER_ROLES.includes(role);
  const canDelete = role === "super_admin" || role === "property_manager";
  // Mirrors the backend rule: property managers may not delete paid-off
  // invoices (super admins still can).
  const canDeleteInv = (inv: Invoice) =>
    canDelete &&
    !(
      role === "property_manager" &&
      (inv.status === "paid" || inv.amount - inv.paidAmount <= 0)
    );
  const invoices = useApi<Invoice[]>("/invoices");
  const payments = useApi<Payment[]>("/payments");
  const credits = useApi<CreditEntry[]>(mine ? "/credits" : null);
  const rejections = useApi<PaymentRejection[]>(mine ? "/payments/rejections" : null);
  const apartments = useApi<Apartment[]>(mine ? null : "/apartments");
  const users = useApi<User[]>(mine ? null : "/users");
  const accounts = useApi<Account[]>(mine ? null : "/accounts");
  const workOrders = useApi<WorkOrder[]>(mine ? null : "/work-orders");
  const { values: f, set: setFilter, setMany, clearAll, activeCount } = useUrlFilters({
    client: "all", apt: "all", status: "all", ledger: "all", view: "boxes",
  });
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "dueDate", dir: -1 });
  const [dialog, setDialog] = useState<"generate" | "latefee" | "fees" | "billowner" | null>(null);

  // Quick actions deep-link: /invoices?dialog=generate|billowner|fees|latefee
  // opens that dialog once, then cleans the params so refresh/back is normal.
  // `wo` + `desc` carry a work-order link ("Bill owners" on a work order).
  const [woLink, setWoLink] = useState<{ id: string; desc: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const consumedDialog = useRef(false);
  useEffect(() => {
    const wanted = searchParams.get("dialog");
    if (
      canWrite &&
      !consumedDialog.current &&
      (wanted === "generate" || wanted === "billowner" || wanted === "fees" || wanted === "latefee")
    ) {
      consumedDialog.current = true;
      const wo = searchParams.get("wo");
      if (wanted === "generate" && wo) {
        setWoLink({ id: wo, desc: searchParams.get("desc") ?? "" });
      }
      setDialog(wanted);
      const rest = new URLSearchParams(searchParams);
      rest.delete("dialog");
      rest.delete("wo");
      rest.delete("desc");
      router.replace(`/invoices${rest.size ? `?${rest}` : ""}`);
    }
  }, [canWrite, searchParams, router]);
  const [aptTab, setAptTab] = useState<string>("all");
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [reportInvoice, setReportInvoice] = useState<Invoice | null>(null);
  const [payMulti, setPayMulti] = useState(false);
  const [creditModal, setCreditModal] = useState(false);
  // Owner multi-pay: invoices ticked directly on their cards.
  const [selectedPay, setSelectedPay] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statModal, setStatModal] = useState<"billed" | "paid" | "due" | null>(null);
  const [selectedStatInvoiceId, setSelectedStatInvoiceId] = useState<string | null>(null);
  const [collapsedModalPeriods, setCollapsedModalPeriods] = useState<Record<string, boolean>>({});

  const closeStatModal = () => {
    setStatModal(null);
    setSelectedStatInvoiceId(null);
    setCollapsedModalPeriods({});
  };
  const [fundsModal, setFundsModal] = useState<{
    ledgerType: "community" | "personal";
    metric: "billed" | "collected" | "due";
    label: string;
  } | null>(null);
  const [selectedFundsInvoiceId, setSelectedFundsInvoiceId] = useState<string | null>(null);

  const closeFundsModal = () => {
    setFundsModal(null);
    setSelectedFundsInvoiceId(null);
    setCollapsedModalPeriods({});
  };
  const [collapsedPeriods, setCollapsedPeriods] = useState<Record<string, boolean>>({});
  const [collapsedApts, setCollapsedApts] = useState<Record<string, boolean>>({});

  const pendingInvoiceIds = new Set(
    (payments.data ?? []).filter((p) => p.status === "pending").map((p) => p.invoiceId)
  );

  // Advance credit (owners): spendable balance per apartment + what's still
  // waiting on a manager confirmation.
  const creditByApt = new Map<string, number>();
  let pendingCreditTotal = 0;
  for (const c of credits.data ?? []) {
    if (c.status === "confirmed" && c.remaining > 0) {
      creditByApt.set(c.apartmentId, (creditByApt.get(c.apartmentId) ?? 0) + c.remaining);
    } else if (c.status === "pending") {
      pendingCreditTotal += c.remaining;
    }
  }
  const creditBalance = [...creditByApt.values()].reduce((s, v) => s + v, 0);
  // What can be ticked for payment: open invoices that aren't already claimed.
  const payableInvoices = (invoices.data ?? []).filter(
    (i) => i.amount - i.paidAmount > 0 && !pendingInvoiceIds.has(i.id)
  );
  // Selections survive reloads only while still payable.
  const selectedPayable = payableInvoices.filter((i) => selectedPay.has(i.id));
  const selectedPayTotal = selectedPayable.reduce(
    (s, i) => s + (i.amount - i.paidAmount), 0
  );
  // Select-all follows the apartment tab an owner is looking at.
  const visiblePayable = payableInvoices.filter(
    (i) => aptTab === "all" || i.apartmentId === aptTab
  );
  const visiblePayableTotal = visiblePayable.reduce(
    (s, i) => s + (i.amount - i.paidAmount), 0
  );
  const allPayableSelected =
    visiblePayable.length > 0 && visiblePayable.every((i) => selectedPay.has(i.id));

  function togglePaySelect(id: string) {
    setSelectedPay((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Latest rejection per invoice (list arrives newest first) — shown on the
  // card while the invoice is still open and unclaimed.
  const rejectionByInvoice = new Map<string, PaymentRejection>();
  for (const r of rejections.data ?? []) {
    if (!rejectionByInvoice.has(r.invoiceId)) rejectionByInvoice.set(r.invoiceId, r);
  }

  async function payFromCredit(inv: Invoice) {
    const due = inv.amount - inv.paidAmount;
    // Credit is pooled across the whole account — any apartment's invoice
    // can draw from it.
    const usable = Math.min(creditBalance, due);
    if (usable <= 0) return;
    if (!confirm(`Pay ${formatINR(usable)} of this invoice from your advance credit?`)) return;
    try {
      await api("/payments/apply-credit", {
        method: "POST",
        body: JSON.stringify({
          apartmentId: inv.apartmentId,
          amount: usable,
          invoiceIds: [inv.id],
        }),
      });
      invoices.reload();
      payments.reload();
      credits.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not apply credit");
    }
  }

  async function applyAllCredit() {
    if (!confirm(`Apply ${formatINR(creditBalance)} of advance credit to your open dues (oldest first)?`)) return;
    try {
      // One shared pool across the account — walk apartments with dues and
      // hand each an explicit slice until the pool runs out.
      let pool = creditBalance;
      const apts = [...new Set(payableInvoices.map((i) => i.apartmentId))];
      for (const apt of apts) {
        if (pool <= 0) break;
        const aptDue = payableInvoices
          .filter((i) => i.apartmentId === apt)
          .reduce((s, i) => s + (i.amount - i.paidAmount), 0);
        const slice = Math.min(pool, aptDue);
        if (slice <= 0) continue;
        await api("/payments/apply-credit", {
          method: "POST",
          body: JSON.stringify({ apartmentId: apt, amount: slice }),
        });
        pool -= slice;
      }
      setCreditModal(false);
      invoices.reload();
      payments.reload();
      credits.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not apply credit");
    }
  }

  async function handleDelete(inv: Invoice) {
    const label = `${inv.description} — ${inv.period} (${formatINR(inv.amount)})`;
    const linked = (payments.data ?? []).filter((p) => p.invoiceId === inv.id);
    const linkedTotal = linked.reduce((s, p) => s + p.amount, 0);
    const msg = linked.length
      ? `Delete invoice: ${label}?\n\nThis invoice has ${linked.length} payment${linked.length > 1 ? "s" : ""} totaling ${formatINR(linkedTotal)}. Deleting the invoice will delete ${linked.length > 1 ? "these payments" : "this payment"} too.\n\nThis cannot be undone.`
      : `Delete invoice: ${label}?\n\nThis cannot be undone.`;
    if (!confirm(msg)) return;
    setDeletingId(inv.id);
    try {
      await api(`/invoices/${inv.id}${linked.length ? "?cascade=true" : ""}`, { method: "DELETE" });
      invoices.reload();
      payments.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete invoice");
    } finally {
      setDeletingId(null);
    }
  }

  if (invoices.error)
    return <ErrorNote message={invoices.error} onRetry={invoices.reload} />;
  if (invoices.loading || !invoices.data) return <PageLoading />;

  const allInvoices = invoices.data;
  // Derived from the live list so the sheet updates after confirm/reverse.
  const detailInvoice = detailId
    ? allInvoices.find((i) => i.id === detailId) ?? null
    : null;
  const accountApts = new Set(
    f.client === "all"
      ? []
      : accounts.data?.find((a) => a.id === f.client)?.apartmentIds ?? []
  );
  // Owners: per-apartment tabs. Managers: URL-synced faceted filters.
  const list = mine
    ? aptTab === "all"
      ? allInvoices
      : allInvoices.filter((i) => i.apartmentId === aptTab)
    : allInvoices.filter(
        (i) =>
          (f.apt === "all" || i.apartmentId === f.apt) &&
          (f.status === "all" || i.status === f.status) &&
          (f.ledger === "all" || (i.ledger ?? "community") === f.ledger) &&
          (f.client === "all" || accountApts.has(i.apartmentId))
      );
  const sorted = [...list].sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  // Derive a canonical "Mon YYYY" label from an invoice's due date so that
  // all charges for a calendar month land in the same group regardless of how
  // `period` was stored ("Jul 2026", "July 2026", "2026-07", etc.).
  function monthLabel(dueDate: string): string {
    const d = new Date(dueDate + "T00:00:00");
    if (isNaN(d.getTime())) return "Other";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  // Group by the due-date month, newest first (insertion order follows sort).
  const periodGroups = (() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of sorted) {
      const key = monthLabel(inv.dueDate);
      const items = map.get(key) ?? [];
      items.push(inv);
      map.set(key, items);
    }
    return [...map.entries()].map(([period, items]) => ({ period, items }));
  })();
  const communityInv = list.filter((i) => (i.ledger ?? "community") === "community");
  const personalInv = list.filter((i) => (i.ledger ?? "community") !== "community");
  const sums = (arr: Invoice[]) => ({
    billed: arr.reduce((s, i) => s + i.amount, 0),
    collected: arr.reduce((s, i) => s + i.paidAmount, 0),
    due: arr.reduce((s, i) => s + (i.amount - i.paidAmount), 0),
  });
  const c = sums(communityInv);
  const p = sums(personalInv);
  const myApts = (user.apartmentIds?.length ? user.apartmentIds : user.apartmentId ? [user.apartmentId] : []).slice().sort();

  return (
    <div className="space-y-5">
      <PageTitle
        title={mine ? "My Invoices" : "Invoices"}
        subtitle={
          mine
            ? `Apartment${myApts.length > 1 ? "s" : ""} ${myApts.map(aptNumber).join(", ") || "—"}`
            : "All apartments · monthly maintenance and charges"
        }
        actions={
          <>
            {canWrite && (
              <>
                <button
                  onClick={() => setDialog("generate")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  <PlusCircle className="h-4 w-4" /> Create Community Invoices
                </button>
                <button
                  onClick={() => setDialog("fees")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-700 shadow-sm hover:bg-violet-100"
                >
                  <HandCoins className="h-4 w-4" /> Service fees
                </button>
                <button
                  onClick={() => setDialog("billowner")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-700 shadow-sm hover:bg-amber-100"
                >
                  <ReceiptText className="h-4 w-4" /> Bill owner
                </button>
                <button
                  onClick={() => setDialog("latefee")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <AlarmClock className="h-4 w-4" /> Late fees
                </button>
              </>
            )}
            <button
              onClick={() => downloadFile("/invoices/export.csv", "invoices.csv")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" /> CSV
            </button>
            {mine &&
              myApts.map((apt) => (
                <button
                  key={apt}
                  onClick={() =>
                    downloadFile(`/statements/${apt}.pdf`, `statement-${aptNumber(apt)}.pdf`)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" /> Statement {aptNumber(apt)}
                </button>
              ))}
            {mine && myApts.length > 1 && (
              <button
                onClick={() =>
                  downloadFile("/statements/consolidated.pdf", "statement-consolidated.pdf")
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 shadow-sm hover:bg-brand-100"
              >
                <Download className="h-4 w-4" /> Consolidated
              </button>
            )}
          </>
        }
      />

      {!mine && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
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
                { key: "status", label: "Status", options: [
                  { value: "all", label: "Any status" },
                  { value: "due", label: "Due" },
                  { value: "overdue", label: "Overdue" },
                  { value: "partial", label: "Partial" },
                  { value: "paid", label: "Paid" },
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
          </div>
          <div className="hidden shrink-0 items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm md:flex">
            <button
              onClick={() => setFilter("view", "boxes")}
              aria-label="Card view"
              className={`rounded-lg p-1.5 ${f.view === "boxes" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFilter("view", "table")}
              aria-label="Table view"
              className={`rounded-lg p-1.5 ${f.view === "table" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {mine && myApts.length > 1 && (
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {["all", ...myApts].map((t) => (
            <button
              key={t}
              onClick={() => setAptTab(t)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                aptTab === t
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "all" ? "All apartments" : `Apt ${aptNumber(t)}`}
            </button>
          ))}
        </div>
      )}

      {/* Owner headline: my totals for the selected apartment(s). */}
      {mine && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Billed"
            value={formatINR(c.billed + p.billed)}
            hint="Tap for all charges"
            onClick={() => setStatModal("billed")}
          />
          <Stat
            label="Paid"
            value={formatINR(c.collected + p.collected)}
            tone="positive"
            hint="Tap for what's covered"
            onClick={() => setStatModal("paid")}
          />
          <Stat
            label="Balance Due"
            value={formatINR(c.due + p.due)}
            tone={c.due + p.due > 0 ? "negative" : "positive"}
            hint={c.due + p.due > 0 ? "Tap for what's due" : "All clear"}
            onClick={() => setStatModal("due")}
          />
          <Stat
            label="Advance Credit"
            value={formatINR(creditBalance)}
            tone={creditBalance > 0 ? "positive" : undefined}
            hint={
              pendingCreditTotal > 0
                ? `+ ${formatINR(pendingCreditTotal)} awaiting confirmation`
                : creditBalance > 0
                  ? "Tap to view / apply"
                  : "Overpayments are banked here"
            }
            onClick={() => setCreditModal(true)}
          />
        </div>
      )}

      {/* Never blend the two monies — one panel per ledger. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Badge tone="blue">Community funds</Badge>
            <span className="text-[10px] text-slate-400 font-medium select-none">Tap metric to view breakdown</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <button
              type="button"
              onClick={() => setFundsModal({ ledgerType: "community", metric: "billed", label: "Community Funds - Billed" })}
              className="group rounded-xl p-2 active:bg-slate-100 transition text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <p className="text-xs text-slate-500 font-medium pointer-events-none">Billed</p>
              <p className="tabular text-sm font-bold sm:text-base text-slate-800 pointer-events-none">{formatINR(c.billed)}</p>
            </button>
            <button
              type="button"
              onClick={() => setFundsModal({ ledgerType: "community", metric: "collected", label: "Community Funds - Collected" })}
              className="group rounded-xl p-2 active:bg-slate-100 transition text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <p className="text-xs text-slate-500 font-medium pointer-events-none">Collected</p>
              <p className="text-sm font-bold text-emerald-600 sm:text-base pointer-events-none">{formatINR(c.collected)}</p>
            </button>
            <button
              type="button"
              onClick={() => setFundsModal({ ledgerType: "community", metric: "due", label: "Community Funds - Balance Due" })}
              className="group rounded-xl p-2 active:bg-slate-100 transition text-center focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <p className="text-xs text-slate-500 font-medium pointer-events-none">Due</p>
              <p className={`text-sm font-bold sm:text-base pointer-events-none ${c.due > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatINR(c.due)}</p>
            </button>
          </div>
        </Card>
        <Card className="border-violet-200 bg-violet-50/40 p-4">
          <div className="flex items-center justify-between">
            <Badge tone="violet">{mine ? "Payable to manager" : "Personal — fees & reimbursements"}</Badge>
            <span className="text-[10px] text-violet-400 font-medium select-none">Tap metric to view breakdown</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <button
              type="button"
              onClick={() => setFundsModal({ ledgerType: "personal", metric: "billed", label: mine ? "Payable to Manager - Billed" : "Personal Funds - Billed" })}
              className="group rounded-xl p-2 active:bg-violet-100 transition text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <p className="text-xs text-slate-500 font-medium pointer-events-none">Billed</p>
              <p className="tabular text-sm font-bold sm:text-base text-slate-800 pointer-events-none">{formatINR(p.billed)}</p>
            </button>
            <button
              type="button"
              onClick={() => setFundsModal({ ledgerType: "personal", metric: "collected", label: mine ? "Payable to Manager - Collected" : "Personal Funds - Collected" })}
              className="group rounded-xl p-2 active:bg-violet-100 transition text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <p className="text-xs text-slate-500 font-medium pointer-events-none">Collected</p>
              <p className="text-sm font-bold text-emerald-600 sm:text-base pointer-events-none">{formatINR(p.collected)}</p>
            </button>
            <button
              type="button"
              onClick={() => setFundsModal({ ledgerType: "personal", metric: "due", label: mine ? "Payable to Manager - Balance Due" : "Personal Funds - Balance Due" })}
              className="group rounded-xl p-2 active:bg-violet-100 transition text-center focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <p className="text-xs text-slate-500 group-hover:text-red-600 font-medium">Due</p>
              <p className={`text-sm font-bold sm:text-base ${p.due > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatINR(p.due)}</p>
            </button>
          </div>
        </Card>
      </div>

      {!mine && f.view === "table" ? (
        <Card className="hidden overflow-x-auto md:block animate-rise" key={JSON.stringify(f)}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  ["apartmentId", "Apt"],
                  ["description", "Description"],
                  ["period", "Period"],
                  ["dueDate", "Due"],
                  ["amount", "Amount"],
                  ["paidAmount", "Paid"],
                  ["status", "Status"],
                ].map(([key, label]) => (
                  <th key={key} className="px-3 py-2.5">
                    <button
                      onClick={() =>
                        setSort((s0) =>
                          s0.key === key ? { key, dir: s0.dir === 1 ? -1 : 1 } : { key, dir: 1 }
                        )
                      }
                      className={`inline-flex items-center gap-1 hover:text-slate-800 ${sort.key === key ? "text-brand-700" : ""}`}
                    >
                      {label} <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...list]
                .sort((a, b) => {
                  const av = a[sort.key as keyof Invoice] ?? "";
                  const bv = b[sort.key as keyof Invoice] ?? "";
                  return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
                })
                .map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setDetailId(inv.id)}
                    className={`cursor-pointer hover:bg-slate-50/60 ${ledgerAccent(inv.ledger)}`}
                  >
                    <td className="px-3 py-2.5 font-semibold">{aptNumber(inv.apartmentId)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5">
                      {inv.description}{" "}
                      {inv.ledger === "manager_fee" && <Badge tone="violet">fee</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{inv.period}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="px-3 py-2.5 font-semibold">{formatINR(inv.amount)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatINR(inv.paidAmount)}</td>
                    <td className="px-3 py-2.5"><Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {canWrite && inv.amount - inv.paidAmount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayInvoice(inv);
                            }}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Record
                          </button>
                        )}
                        {canDeleteInv(inv) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(inv);
                            }}
                            disabled={deletingId === inv.id}
                            title="Delete invoice"
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              {list.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-slate-400">Nothing matches these filters.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      ) : null}

      {/* Owner bulk selection: one tap to select or clear every unpaid
          invoice in the current apartment tab. */}
      {mine && visiblePayable.length > 0 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-brand-300">
          <input
            type="checkbox"
            checked={allPayableSelected}
            onChange={() =>
              setSelectedPay(
                allPayableSelected
                  ? new Set()
                  : new Set(visiblePayable.map((i) => i.id))
              )
            }
            className="h-5 w-5 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">
            {allPayableSelected ? "Clear all" : "Select all unpaid"}
            <span className="ml-1 text-xs font-normal text-slate-400">
              — {visiblePayable.length} invoice{visiblePayable.length === 1 ? "" : "s"} · {formatINR(visiblePayableTotal)}
            </span>
          </span>
          {selectedPayable.length > 0 && !allPayableSelected && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setSelectedPay(new Set());
              }}
              className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Clear ({selectedPayable.length})
            </button>
          )}
        </label>
      )}

      <div className={!mine && f.view === "table" ? "space-y-5 md:hidden" : "space-y-5"} key={`boxes-${JSON.stringify(f)}-${aptTab}`}>
      {periodGroups.map(({ period, items }) => {
        const gc = items.filter((i) => (i.ledger ?? "community") === "community");
        const gp = items.filter((i) => (i.ledger ?? "community") !== "community");
        const gcDue = gc.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
        const gpDue = gp.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
        const isCollapsed = collapsedPeriods[period] ?? false;

        // Group items by apartment ID
        const itemsByApt = (() => {
          const map = new Map<string, typeof items>();
          for (const item of items) {
            const key = item.apartmentId;
            const list = map.get(key) ?? [];
            list.push(item);
            map.set(key, list);
          }
          return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        })();

        return (
          <section key={period} className="animate-rise">
            <button
              type="button"
              onClick={() => setCollapsedPeriods((prev) => ({ ...prev, [period]: !prev[period] }))}
              className="mb-2 flex w-full items-baseline justify-between rounded-lg px-1 py-1 hover:bg-slate-50 transition text-left focus:outline-none focus:ring-1 focus:ring-slate-200"
            >
              <div className="flex items-center gap-1.5 pointer-events-none">
                <h2 className="text-sm font-bold text-slate-700">{period}</h2>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
              </div>
              <p className="text-xs text-slate-400 pointer-events-none">
                {items.length} invoice{items.length === 1 ? "" : "s"}
                {gc.length > 0 && (
                  <> · community {gcDue > 0 ? <span className="font-medium text-red-500">{formatINR(gcDue)} due</span> : <span className="font-medium text-emerald-600">paid</span>}</>
                )}
                {gp.length > 0 && (
                  <> · personal {gpDue > 0 ? <span className="font-medium text-red-500">{formatINR(gpDue)} due</span> : <span className="font-medium text-emerald-600">paid</span>}</>
                )}
              </p>
            </button>
            {!isCollapsed && (
              <div className="space-y-4 mt-2">
                {itemsByApt.map(([aptId, aptItems]) => {
                  const aptKey = `${period}_${aptId}`;
                  const isAptCollapsed = collapsedApts[aptKey] ?? false;
                  return (
                    <div key={aptId} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setCollapsedApts((prev) => ({ ...prev, [aptKey]: !prev[aptKey] }))}
                        className="flex w-full items-center justify-between px-1 py-1 hover:bg-slate-50 rounded transition text-left focus:outline-none"
                      >
                        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
                          Apt {aptNumber(aptId)}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isAptCollapsed ? "-rotate-90" : ""}`} />
                      </button>
                      {!isAptCollapsed && (
                        <Card className="divide-y divide-slate-100">
                          {aptItems.map((inv) => {
                            const balance = inv.amount - inv.paidAmount;
                            const selectable =
                              mine && balance > 0 && !pendingInvoiceIds.has(inv.id);
                            return (
                              <div
                                key={inv.id}
                                onClick={() => setDetailId(inv.id)}
                                className={`flex cursor-pointer gap-3 p-4 hover:bg-slate-50/60 ${ledgerAccent(inv.ledger)} ${selectable && selectedPay.has(inv.id) ? "bg-brand-50/60" : ""}`}
                              >
                                {selectable && (
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${inv.description} for payment`}
                                    checked={selectedPay.has(inv.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => togglePaySelect(inv.id)}
                                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                      {mine ? inv.description : `${inv.description} — ${inv.period}`}
                                      {(!inv.ledger || inv.ledger === "community") && (
                                        <Badge tone="blue">Community</Badge>
                                      )}
                                      {inv.ledger === "manager_fee" && (
                                        <Badge tone="violet">Manager fee</Badge>
                                      )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {!mine &&
                                        `${ownerNameFor(users.data, apartments.data, inv.apartmentId)} · `}
                                      Due {formatDate(inv.dueDate)}
                                      {inv.status === "partial" &&
                                        ` · Paid ${formatINR(inv.paidAmount)} of ${formatINR(inv.amount)}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <span className="tabular text-sm font-bold text-slate-900">{formatINR(inv.amount)}</span>
                                    <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                                    {canDeleteInv(inv) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(inv);
                                        }}
                                        disabled={deletingId === inv.id}
                                        title="Delete invoice"
                                        className="ml-1 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {canWrite && balance > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPayInvoice(inv);
                                    }}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    <Banknote className="h-3.5 w-3.5" />
                                    Record payment
                                  </button>
                                )}
                                {mine && balance > 0 && !pendingInvoiceIds.has(inv.id) &&
                                  rejectionByInvoice.has(inv.id) && (() => {
                                    const rej = rejectionByInvoice.get(inv.id)!;
                                    return (
                                      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                        Your {formatINR(rej.amount)} payment was not accepted
                                        {rej.reason ? <> — {rej.reason}</> : " — contact the property manager"}
                                        <span className="ml-1 text-red-400">({formatDate(rej.date.slice(0, 10))})</span>
                                      </p>
                                    );
                                  })()}
                                {mine && balance > 0 && (
                                  pendingInvoiceIds.has(inv.id) ? (
                                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                                      Payment reported — awaiting confirmation from the manager
                                    </p>
                                  ) : (() => {
                                    // Pooled: any of the account's credit can
                                    // settle any of its invoices.
                                    const aptCredit = creditBalance;
                                    // Credit that fully covers the invoice is
                                    // the obvious move — lead with it.
                                    const creditFirst = aptCredit >= balance;
                                    const reportBtn = (
                                      <button
                                        key="report"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReportInvoice(inv);
                                        }}
                                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
                                          creditFirst
                                            ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                            : "bg-brand-600 text-white hover:bg-brand-700"
                                        }`}
                                      >
                                        <Banknote className="h-3.5 w-3.5" />
                                        I&apos;ve paid this — report payment
                                      </button>
                                    );
                                    const creditBtn = aptCredit > 0 && (
                                      <button
                                        key="credit"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          payFromCredit(inv);
                                        }}
                                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
                                          creditFirst
                                            ? "bg-violet-600 text-white hover:bg-violet-700"
                                            : "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                        }`}
                                      >
                                        <PiggyBank className="h-3.5 w-3.5" />
                                        Pay {formatINR(Math.min(aptCredit, balance))} from credit
                                      </button>
                                    );
                                    return (
                                      <span className="mt-3 flex flex-wrap gap-1.5">
                                        {creditFirst ? [creditBtn, reportBtn] : [reportBtn, creditBtn]}
                                      </span>
                                    );
                                  })()
                                )}
                                </div>
                              </div>
                            );
                          })}
                        </Card>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {sorted.length === 0 && (
        <Card>
          <p className="p-5 text-center text-sm text-slate-400">
            {activeCount > 0 ? "Nothing matches these filters." : "No invoices yet."}
          </p>
        </Card>
      )}
      </div>

      {/* Keep the last card reachable while the sticky pay bar is up. */}
      {mine && selectedPayable.length > 0 && <div aria-hidden className="h-24" />}

      {dialog === "generate" && (
        <GenerateDialog
          apartments={apartments.data}
          users={users.data}
          workOrders={workOrders.data}
          onClose={() => {
            setDialog(null);
            setWoLink(null);
          }}
          onDone={invoices.reload}
          initialDescription={woLink?.desc}
          workOrderId={woLink?.id}
        />
      )}
      {dialog === "latefee" && (
        <LateFeeDialog onClose={() => setDialog(null)} onDone={invoices.reload} />
      )}
      {dialog === "billowner" && (
        <BillOwnerDialog
          apartments={apartments.data}
          users={users.data}
          onClose={() => setDialog(null)}
          onDone={invoices.reload}
        />
      )}
      {dialog === "fees" && (
        <FeeDialog
          apartments={apartments.data}
          users={users.data}
          onClose={() => setDialog(null)}
          onDone={invoices.reload}
        />
      )}
      {payInvoice && (
        <PaymentDialog
          invoice={payInvoice}
          users={users.data}
          apartments={apartments.data}
          onClose={() => setPayInvoice(null)}
          onDone={() => {
            invoices.reload();
            payments.reload();
          }}
        />
      )}
      {reportInvoice && (
        <ReportPaymentDialog
          invoice={reportInvoice}
          users={users.data}
          onClose={() => setReportInvoice(null)}
          onDone={() => {
            invoices.reload();
            payments.reload();
            credits.reload();
          }}
        />
      )}
      {/* Sticky pay bar — appears as soon as the owner ticks an invoice. */}
      {mine && selectedPayable.length > 0 && !payMulti && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 flex justify-center px-4 lg:bottom-6 lg:pl-60">
          <div className="animate-rise flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{formatINR(selectedPayTotal)}</p>
              <p className="text-xs text-slate-500">
                {selectedPayable.length} invoice{selectedPayable.length === 1 ? "" : "s"} selected
                {!allPayableSelected && (
                  <>
                    {" · "}
                    <button
                      onClick={() => setSelectedPay(new Set(visiblePayable.map((i) => i.id)))}
                      className="font-semibold text-brand-600 hover:text-brand-700"
                    >
                      select all {visiblePayable.length}
                    </button>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => setSelectedPay(new Set())}
              aria-label="Clear selection"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPayMulti(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <Banknote className="h-4 w-4" /> Pay selected
            </button>
          </div>
        </div>
      )}
      {payMulti && (
        <PayMultipleDialog
          invoices={selectedPayable}
          users={users.data}
          totalCredit={creditBalance}
          multiApt={myApts.length > 1}
          onClose={() => setPayMulti(false)}
          onDone={() => {
            setSelectedPay(new Set());
            invoices.reload();
            payments.reload();
            credits.reload();
          }}
        />
      )}
      {creditModal && (
        <Modal title="Advance Credit" onClose={() => setCreditModal(false)}>
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{formatINR(creditBalance)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Money you paid beyond what was owed — it&apos;s yours, waiting
                to cover future invoices.
              </p>
            </div>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {(credits.data ?? [])
                .filter((cr) => cr.remaining > 0)
                .map((cr) => (
                  <div key={cr.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700">
                        {myApts.length > 1 && `Apt ${aptNumber(cr.apartmentId)} · `}
                        {cr.reference || "Overpayment"}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDate(cr.date)}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-slate-800">{formatINR(cr.remaining)}</span>
                      {cr.status === "pending" && <Badge tone="amber">awaiting confirmation</Badge>}
                    </span>
                  </div>
                ))}
              {(credits.data ?? []).filter((cr) => cr.remaining > 0).length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-slate-400">No credit right now.</p>
              )}
            </div>
            {creditBalance > 0 && payableInvoices.length > 0 && (
              <button onClick={applyAllCredit} className={primaryBtnCls}>
                Apply {formatINR(Math.min(creditBalance, payableInvoices.reduce((s, i) => s + i.amount - i.paidAmount, 0)))} to my dues
              </button>
            )}
          </div>
        </Modal>
      )}
      {statModal && (
        <Modal
          title={
            selectedStatInvoiceId
              ? "Invoice Details"
              : statModal === "billed"
                ? "All Charges"
                : statModal === "paid"
                  ? "What You've Paid"
                  : "Balance Due"
          }
          onClose={selectedStatInvoiceId ? () => setSelectedStatInvoiceId(null) : closeStatModal}
        >
          {(() => {
            const rows =
              statModal === "billed"
                ? sorted
                : statModal === "paid"
                  ? sorted.filter((i) => i.paidAmount > 0)
                  : sorted.filter((i) => i.amount - i.paidAmount > 0);

            const amountOf = (i: Invoice) =>
              statModal === "billed"
                ? i.amount
                : statModal === "paid"
                  ? i.paidAmount
                  : i.amount - i.paidAmount;

            if (selectedStatInvoiceId) {
              const inv = rows.find((i) => i.id === selectedStatInvoiceId);
              if (!inv) return <p className="text-sm text-slate-500">Invoice not found.</p>;
              const balance = inv.amount - inv.paidAmount;
              
              return (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedStatInvoiceId(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    ← Back to {statModal === "billed" ? "All Charges" : statModal === "paid" ? "What You've Paid" : "Balance Due"}
                  </button>
                  
                  <div className="space-y-2 border-b border-slate-100 pb-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Invoice</p>
                    <h3 className="text-base font-bold text-slate-800">{inv.description}</h3>
                    <p className="text-xs text-slate-500">Period: {monthLabel(inv.dueDate)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Amount</p>
                      <p className="text-sm font-semibold text-slate-700">{formatINR(inv.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Paid Amount</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatINR(inv.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Balance Due</p>
                      <p className="text-sm font-bold text-red-600">{formatINR(balance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Due Date</p>
                      <p className="text-xs text-slate-600">{formatDate(inv.dueDate)}</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>Ledger: <span className="font-semibold text-slate-700">{inv.ledger || "Community"}</span></p>
                    <p>Status: <span className="font-semibold text-slate-700 uppercase">{inv.status}</span></p>
                  </div>

                  {mine && balance > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setSelectedStatInvoiceId(null);
                          setStatModal(null);
                          setReportInvoice(inv);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        I&apos;ve paid this — report payment
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Group by Month (period)
            const byMonth = new Map<string, number>();
            for (const i of rows) {
              const month = monthLabel(i.dueDate);
              byMonth.set(month, (byMonth.get(month) ?? 0) + amountOf(i));
            }
            const monthRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

            // Group by Category
            const byCategory = new Map<string, number>();
            for (const i of rows) {
              let cat = "Community Maintenance";
              if (i.ledger === "manager_fee") cat = "Manager Service Fee";
              if (i.ledger === "reimbursement") cat = "Reimbursement";
              byCategory.set(cat, (byCategory.get(cat) ?? 0) + amountOf(i));
            }
            const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  {statModal === "due" ? "Nothing due — all clear. 🎉" : "Nothing here yet."}
                </p>
              );

            return (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl font-bold text-slate-800">
                    {formatINR(rows.reduce((sum, i) => sum + amountOf(i), 0))}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Total {statModal === "billed" ? "charges" : statModal === "paid" ? "payments" : "balance due"}
                  </p>
                </div>

                {/* Monthly Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Month</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Month</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {monthRows.map(([month, val]) => (
                        <div key={month} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{month}</span>
                          <span className="font-semibold text-slate-800">{formatINR(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Category</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Category</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {catRows.map(([cat, val]) => (
                        <div key={cat} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{cat}</span>
                          <span className="font-semibold text-slate-800">{formatINR(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Individual invoices grouped by month */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Items (Tap to view details)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(() => {
                      const itemsByMonth = new Map<string, Invoice[]>();
                      for (const inv of rows) {
                        const month = monthLabel(inv.dueDate);
                        const list = itemsByMonth.get(month) ?? [];
                        list.push(inv);
                        itemsByMonth.set(month, list);
                      }
                      const itemsByMonthList = [...itemsByMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

                      return itemsByMonthList.map(([month, monthItems]) => {
                        const isCollapsed = collapsedModalPeriods[month] !== false; // collapsed by default
                        const monthTotal = monthItems.reduce((sum, inv) => sum + amountOf(inv), 0);
                        
                        return (
                          <div key={month} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setCollapsedModalPeriods(prev => ({ ...prev, [month]: !isCollapsed }))}
                              className="flex w-full items-center justify-between bg-slate-50 px-2 py-1.5 text-2xs font-semibold text-slate-500 rounded hover:bg-slate-100 transition-colors"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-slate-600">{month}</span>
                                <span className="inline-flex items-center rounded-full bg-slate-200/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                  Total: {formatINR(monthTotal)}
                                </span>
                              </div>
                              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transform transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                            </button>
                            
                            {!isCollapsed && (
                              <div className="divide-y divide-slate-100 pl-1">
                                {monthItems.map((inv) => (
                                  <button
                                    key={inv.id}
                                    type="button"
                                    onClick={() => setSelectedStatInvoiceId(inv.id)}
                                    className="flex justify-between items-start w-full py-2 text-xs hover:bg-slate-50 rounded px-1 transition text-left"
                                  >
                                    <div className="min-w-0 mr-2">
                                      <p className="font-medium text-slate-800 hover:text-brand-600 truncate">{inv.description}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                        Due {formatDate(inv.dueDate)}
                                      </p>
                                    </div>
                                    <span
                                      className={`font-semibold shrink-0 ml-2 ${
                                        statModal === "due"
                                          ? "text-red-600"
                                          : statModal === "paid"
                                            ? "text-emerald-600"
                                            : "text-slate-800"
                                      }`}
                                    >
                                      {formatINR(amountOf(inv))}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
      {fundsModal && (
        <Modal
          title={selectedFundsInvoiceId ? "Invoice Details" : fundsModal.label}
          onClose={selectedFundsInvoiceId ? () => setSelectedFundsInvoiceId(null) : closeFundsModal}
        >
          {(() => {
            const baseInvoices = list.filter((i) => {
              const isCommunity = (i.ledger ?? "community") === "community";
              return fundsModal.ledgerType === "community" ? isCommunity : !isCommunity;
            });
            const rows =
              fundsModal.metric === "billed"
                ? baseInvoices
                : fundsModal.metric === "collected"
                  ? baseInvoices.filter((i) => i.paidAmount > 0)
                  : baseInvoices.filter((i) => i.amount - i.paidAmount > 0);
            const amountOf = (i: Invoice) =>
              fundsModal.metric === "billed"
                ? i.amount
                : fundsModal.metric === "collected"
                  ? i.paidAmount
                  : i.amount - i.paidAmount;

            if (selectedFundsInvoiceId) {
              const inv = rows.find((i) => i.id === selectedFundsInvoiceId);
              if (!inv) return <p className="text-sm text-slate-500">Invoice not found.</p>;
              const balance = inv.amount - inv.paidAmount;
              
              return (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedFundsInvoiceId(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    ← Back to {fundsModal.label}
                  </button>
                  
                  <div className="space-y-2 border-b border-slate-100 pb-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Invoice Details</p>
                    <h3 className="text-base font-bold text-slate-800">Apt {aptNumber(inv.apartmentId)} · {inv.description}</h3>
                    <p className="text-xs text-slate-500">Period: {monthLabel(inv.dueDate)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Amount</p>
                      <p className="text-sm font-semibold text-slate-700">{formatINR(inv.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Paid Amount</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatINR(inv.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Balance Due</p>
                      <p className="text-sm font-bold text-red-600">{formatINR(balance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Due Date</p>
                      <p className="text-xs text-slate-600">{formatDate(inv.dueDate)}</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>Ledger: <span className="font-semibold text-slate-700">{inv.ledger || "Community"}</span></p>
                    <p>Status: <span className="font-semibold text-slate-700 uppercase">{inv.status}</span></p>
                  </div>

                  {mine && balance > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setSelectedFundsInvoiceId(null);
                          setFundsModal(null);
                          setReportInvoice(inv);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        I&apos;ve paid this — report payment
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Group by Month (using monthLabel(i.dueDate))
            const byMonth = new Map<string, number>();
            for (const i of rows) {
              const month = monthLabel(i.dueDate);
              byMonth.set(month, (byMonth.get(month) ?? 0) + amountOf(i));
            }
            const monthRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

            // Group by Category
            const byCategory = new Map<string, number>();
            for (const i of rows) {
              let cat = "Community Maintenance";
              if (i.ledger === "manager_fee") cat = "Manager Service Fee";
              if (i.ledger === "reimbursement") cat = "Reimbursement";
              byCategory.set(cat, (byCategory.get(cat) ?? 0) + amountOf(i));
            }
            const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  No invoices found.
                </p>
              );

            // Group rows by month label for items list
            const itemsByMonth = new Map<string, Invoice[]>();
            for (const i of rows) {
              const month = monthLabel(i.dueDate);
              const list = itemsByMonth.get(month) ?? [];
              list.push(i);
              itemsByMonth.set(month, list);
            }
            const itemsByMonthList = [...itemsByMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

            return (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl font-bold text-slate-800">
                    {formatINR(rows.reduce((sum, i) => sum + amountOf(i), 0))}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Total
                  </p>
                </div>

                {/* Monthly Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Month</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Month</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {monthRows.map(([month, val]) => (
                        <div key={month} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{month}</span>
                          <span className="font-semibold text-slate-800">{formatINR(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category Table */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Category</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                      <span className="text-left">Category</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {catRows.map(([cat, val]) => (
                        <div key={cat} className="grid grid-cols-2 items-center px-3 py-2 text-xs text-right">
                          <span className="text-left font-medium text-slate-700">{cat}</span>
                          <span className="font-semibold text-slate-800">{formatINR(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Individual invoices grouped by month */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Items (Tap to view details)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {itemsByMonthList.map(([month, monthItems]) => {
                      const isCollapsed = collapsedModalPeriods[month] !== false; // collapsed by default
                      const monthTotal = monthItems.reduce((sum, i) => sum + amountOf(i), 0);
                      
                      return (
                        <div key={month} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setCollapsedModalPeriods(prev => ({ ...prev, [month]: !isCollapsed }))}
                            className="flex w-full items-center justify-between bg-slate-50 px-2 py-1.5 text-2xs font-semibold text-slate-500 rounded hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-slate-600">{month}</span>
                              <span className="inline-flex items-center rounded-full bg-slate-200/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                Total: {formatINR(monthTotal)}
                              </span>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transform transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                          </button>
                          
                          {!isCollapsed && (
                            <div className="divide-y divide-slate-100 pl-1">
                              {monthItems.map((inv) => (
                                <button
                                  key={inv.id}
                                  type="button"
                                  onClick={() => setSelectedFundsInvoiceId(inv.id)}
                                  className="flex justify-between items-start w-full py-2 text-xs hover:bg-slate-50 rounded px-1 transition text-left"
                                >
                                  <div className="min-w-0 mr-2">
                                    <p className="font-medium text-slate-800 hover:text-brand-600 truncate">
                                      Apt {aptNumber(inv.apartmentId)} · {inv.description}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                      Due {formatDate(inv.dueDate)}
                                    </p>
                                  </div>
                                  <span
                                    className={`font-semibold shrink-0 ml-2 ${
                                      fundsModal.metric === "due"
                                        ? "text-red-600"
                                        : fundsModal.metric === "collected"
                                          ? "text-emerald-600"
                                          : "text-slate-800"
                                    }`}
                                  >
                                    {formatINR(amountOf(inv))}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          <p className="mt-3 text-xs text-slate-400">
            Tap a row for the full invoice with its payment history.
          </p>
        </Modal>
      )}
      {detailInvoice && (
        <InvoiceSheet
          invoice={detailInvoice}
          payments={payments.data ?? []}
          invoices={allInvoices}
          users={users.data}
          apartments={apartments.data}
          canWrite={canWrite}
          mine={mine}
          onClose={() => setDetailId(null)}
          onChanged={() => {
            invoices.reload();
            payments.reload();
          }}
          onRecordPayment={setPayInvoice}
          onReportPaid={setReportInvoice}
          onDelete={
            canDeleteInv(detailInvoice)
              ? (inv) => {
                  setDetailId(null);
                  handleDelete(inv);
                }
              : undefined
          }
          onOpenInvoice={(inv) => setDetailId(inv.id)}
        />
      )}
    </div>
  );
}


export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <InvoicesPageInner />
    </Suspense>
  );
}
