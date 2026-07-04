"use client";

import { useState } from "react";
import { AlarmClock, Banknote, Download, FileDown, PlusCircle } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Apartment, Invoice, User } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import { invoiceTone } from "@/lib/tones";
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
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

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
      const res = await api<{ created: number; skipped: number }>(
        "/invoices/generate",
        {
          method: "POST",
          body: JSON.stringify({
            period,
            dueDate,
            ...(amount ? { amount: Number(amount) } : {}),
            ...(scope === "selected" ? { apartmentIds: [...selected] } : {}),
          }),
        }
      );
      setResult(res);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Generate Monthly Invoices" onClose={onClose}>
      {result ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-700">
            Created <b>{result.created}</b> invoice{result.created === 1 ? "" : "s"}
            {result.skipped > 0 && ` · ${result.skipped} already existed`}
          </p>
          <button className={primaryBtnCls} onClick={onClose}>Done</button>
        </div>
      ) : (
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
              ? "Generating…"
              : scope === "all"
                ? "Generate for all apartments"
                : `Generate for ${selected.size} apartment${selected.size === 1 ? "" : "s"}`}
          </button>
        </form>
      )}
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

function LateFeeDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("200");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ created: number }>("/invoices/apply-late-fees", {
        method: "POST",
        body: JSON.stringify({ period, amount: Number(amount), dueDate }),
      });
      setCreated(res.created);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Apply Late Fees" onClose={onClose}>
      {created !== null ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-700">
            Added late fees to <b>{created}</b> overdue invoice{created === 1 ? "" : "s"}.
          </p>
          <button className={primaryBtnCls} onClick={onClose}>Done</button>
        </div>
      ) : (
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
      )}
    </Modal>
  );
}

export default function InvoicesPage() {
  const { role, user } = useSessionUser();
  const mine = role === "owner" || role === "tenant";
  const canWrite = WRITER_ROLES.includes(role);
  const invoices = useApi<Invoice[]>("/invoices");
  const apartments = useApi<Apartment[]>(mine ? null : "/apartments");
  const users = useApi<User[]>(mine ? null : "/users");
  const [dialog, setDialog] = useState<"generate" | "latefee" | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  if (invoices.error)
    return <ErrorNote message={invoices.error} onRetry={invoices.reload} />;
  if (invoices.loading || !invoices.data) return <PageLoading />;

  const list = invoices.data;
  const sorted = [...list].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const outstanding = list.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const billed = list.reduce((s, i) => s + i.amount, 0);
  const collected = list.reduce((s, i) => s + i.paidAmount, 0);
  const myApt = user.apartmentId;

  return (
    <div className="space-y-5">
      <PageTitle
        title={mine ? "My Invoices" : "Invoices"}
        subtitle={
          mine
            ? `Apartment ${myApt ? aptNumber(myApt) : "—"}`
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
                  <PlusCircle className="h-4 w-4" /> Generate
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
            {mine && myApt && (
              <button
                onClick={() =>
                  downloadFile(`/statements/${myApt}.pdf`, `statement-${aptNumber(myApt)}.pdf`)
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <Download className="h-4 w-4" /> Statement
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Billed" value={formatINR(billed)} />
        <Stat label="Collected" value={formatINR(collected)} tone="positive" />
        <Stat
          label="Outstanding"
          value={formatINR(outstanding)}
          tone={outstanding > 0 ? "negative" : "positive"}
        />
      </div>

      <Card className="divide-y divide-slate-100">
        {sorted.map((inv) => {
          const balance = inv.amount - inv.paidAmount;
          return (
            <div key={inv.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {inv.description} — {inv.period}
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
                <p className="mt-2 text-xs text-slate-400">
                  {formatINR(balance)} due — pay Vishnu via UPI/bank and he&apos;ll
                  record it here. Online payment coming soon.
                </p>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="p-5 text-center text-sm text-slate-400">No invoices yet.</p>
        )}
      </Card>

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
      {payInvoice && (
        <PaymentDialog
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onDone={invoices.reload}
        />
      )}
    </div>
  );
}
