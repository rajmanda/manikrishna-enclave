"use client";

import { Suspense, useState } from "react";
import { AlarmClock, ArrowUpDown, Banknote, Download, FileDown, HandCoins, LayoutGrid, PlusCircle, ReceiptText, Table2, Trash2 } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Account, Apartment, FeeEnrollment, Invoice, Payment, User } from "@/lib/types";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar } from "@/components/FilterBar";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import { invoiceTone, ledgerAccent } from "@/lib/tones";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];
const METHODS = ["UPI", "Bank Transfer", "Cash", "Cheque", "Credit"] as const;
const OWNER_METHODS = ["UPI", "Bank Transfer", "Cash", "Cheque"] as const;

function ReportPaymentDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const outstanding = invoice.amount - invoice.paidAmount;
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
          Report the payment you made to the property manager. It shows as
          pending until they confirm receipt.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount paid</label>
            <input type="number" min="1" max={outstanding} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
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

function nextMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function GenerateDialog({
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
  const [period, setPeriod] = useState(nextMonthLabel());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Monthly Maintenance");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedApartments = [...(apartments ?? [])].sort((a, b) =>
    a.number.localeCompare(b.number)
  );

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
    if (scope === "selected" && selected.size === 0) {
      setError("Select at least one apartment");
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
            ...(amount ? { amount: Number(amount) } : {}),
            ...(scope === "selected" ? { apartmentIds: [...selected] } : {}),
          }),
        }
      );
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
          <label className={labelCls}>Period</label>
          <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} required />
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
          <label className={labelCls}>Apartments</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                scope === "all"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              All apartments
            </button>
            <button
              type="button"
                onClick={() => setScope("selected")}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                  scope === "selected"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                Select apartments
              </button>
            </div>
            {scope === "selected" && (
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {sortedApartments.map((apt) => (
                  <label
                    key={apt.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(apt.id)}
                      onChange={() => toggle(apt.id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium">Apt {apt.number}</span>
                    <span className="truncate text-xs text-slate-400">
                      {ownerNameFor(users, sortedApartments, apt.id)}
                    </span>
                  </label>
                ))}
                <p className="px-2 pt-1 text-xs text-slate-400">
                  {selected.size} selected
                </p>
              </div>
            )}
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" disabled={busy || !dueDate} className={primaryBtnCls}>
            {busy
              ? "Creating…"
              : scope === "all"
                ? "Create for all apartments"
                : `Create for ${selected.size} apartment${selected.size === 1 ? "" : "s"}`}
          </button>
        </form>
      </Modal>
    );
}

function PaymentDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const outstanding = invoice.amount - invoice.paidAmount;
  const [amount, setAmount] = useState(String(outstanding));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<(typeof METHODS)[number]>("UPI");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Apt {aptNumber(invoice.apartmentId)} · Outstanding {formatINR(outstanding)}
        </p>
        <div>
          <label className={labelCls}>Amount</label>
          <input type="number" min="1" max={outstanding} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Method</label>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{m === "Credit" ? "Credit / Waiver" : m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Reference</label>
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI-1234 / NEFT ref / waiver note" />
        </div>
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
      await api("/invoices/bill-owner", {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<{ created: number }>("/invoices/apply-late-fees", {
        method: "POST",
        body: JSON.stringify({ period, amount: Number(amount), dueDate }),
      });
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
  const invoices = useApi<Invoice[]>("/invoices");
  const payments = useApi<Payment[]>("/payments");
  const apartments = useApi<Apartment[]>(mine ? null : "/apartments");
  const users = useApi<User[]>(mine ? null : "/users");
  const accounts = useApi<Account[]>(mine ? null : "/accounts");
  const { values: f, set: setFilter, setMany, clearAll, activeCount } = useUrlFilters({
    client: "all", apt: "all", status: "all", ledger: "all", view: "boxes",
  });
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "dueDate", dir: -1 });
  const [dialog, setDialog] = useState<"generate" | "latefee" | "fees" | "billowner" | null>(null);
  const [aptTab, setAptTab] = useState<string>("all");
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [reportInvoice, setReportInvoice] = useState<Invoice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingInvoiceIds = new Set(
    (payments.data ?? []).filter((p) => p.status === "pending").map((p) => p.invoiceId)
  );

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
                  <PlusCircle className="h-4 w-4" /> Create invoices
                </button>
                <button
                  onClick={() => setDialog("billowner")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-700 shadow-sm hover:bg-amber-100"
                >
                  <ReceiptText className="h-4 w-4" /> Bill owner
                </button>
                <button
                  onClick={() => setDialog("fees")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-700 shadow-sm hover:bg-violet-100"
                >
                  <HandCoins className="h-4 w-4" /> Service fees
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

      {/* Never blend the two monies — one panel per ledger. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Badge tone="blue">Community funds</Badge>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-slate-500">Billed</p><p className="text-sm font-bold sm:text-base">{formatINR(c.billed)}</p></div>
            <div><p className="text-xs text-slate-500">Collected</p><p className="text-sm font-bold text-emerald-600 sm:text-base">{formatINR(c.collected)}</p></div>
            <div><p className="text-xs text-slate-500">Due</p><p className={`text-sm font-bold sm:text-base ${c.due > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatINR(c.due)}</p></div>
          </div>
        </Card>
        <Card className="border-violet-200 bg-violet-50/40 p-4">
          <div className="flex items-center gap-2">
            <Badge tone="violet">{mine ? "Payable to manager" : "Personal — fees & reimbursements"}</Badge>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-slate-500">Billed</p><p className="text-sm font-bold sm:text-base">{formatINR(p.billed)}</p></div>
            <div><p className="text-xs text-slate-500">Collected</p><p className="text-sm font-bold text-emerald-600 sm:text-base">{formatINR(p.collected)}</p></div>
            <div><p className="text-xs text-slate-500">Due</p><p className={`text-sm font-bold sm:text-base ${p.due > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatINR(p.due)}</p></div>
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
                  <tr key={inv.id} className={`hover:bg-slate-50/60 ${ledgerAccent(inv.ledger)}`}>
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
                            onClick={() => setPayInvoice(inv)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Record
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(inv)}
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

      <div className={!mine && f.view === "table" ? "space-y-5 md:hidden" : "space-y-5"} key={`boxes-${JSON.stringify(f)}-${aptTab}`}>
      {periodGroups.map(({ period, items }) => {
        const gc = items.filter((i) => (i.ledger ?? "community") === "community");
        const gp = items.filter((i) => (i.ledger ?? "community") !== "community");
        const gcDue = gc.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
        const gpDue = gp.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
        return (
          <section key={period} className="animate-rise">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-bold text-slate-700">{period}</h2>
              <p className="text-xs text-slate-400">
                {items.length} invoice{items.length === 1 ? "" : "s"}
                {gc.length > 0 && (
                  <> · community {gcDue > 0 ? <span className="font-medium text-red-500">{formatINR(gcDue)} due</span> : <span className="font-medium text-emerald-600">paid</span>}</>
                )}
                {gp.length > 0 && (
                  <> · personal {gpDue > 0 ? <span className="font-medium text-red-500">{formatINR(gpDue)} due</span> : <span className="font-medium text-emerald-600">paid</span>}</>
                )}
              </p>
            </div>
            <Card className="divide-y divide-slate-100">
              {items.map((inv) => {
                const balance = inv.amount - inv.paidAmount;
          return (
            <div key={inv.id} className={`p-4 ${ledgerAccent(inv.ledger)}`}>
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
                      `Apt ${aptNumber(inv.apartmentId)} · ${ownerNameFor(users.data, apartments.data, inv.apartmentId)} · `}
                    Due {formatDate(inv.dueDate)}
                    {inv.status === "partial" &&
                      ` · Paid ${formatINR(inv.paidAmount)} of ${formatINR(inv.amount)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold">{formatINR(inv.amount)}</span>
                  <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(inv)}
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
                  onClick={() => setPayInvoice(inv)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Record payment
                </button>
              )}
              {mine && balance > 0 && (
                pendingInvoiceIds.has(inv.id) ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                    Payment reported — awaiting confirmation from the manager
                  </p>
                ) : (
                  <button
                    onClick={() => setReportInvoice(inv)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    I&apos;ve paid this — report payment
                  </button>
                )
              )}
                </div>
              );
            })}
            </Card>
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

      {dialog === "generate" && (
        <GenerateDialog
          apartments={apartments.data}
          users={users.data}
          onClose={() => setDialog(null)}
          onDone={invoices.reload}
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
          onClose={() => setReportInvoice(null)}
          onDone={() => {
            invoices.reload();
            payments.reload();
          }}
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
