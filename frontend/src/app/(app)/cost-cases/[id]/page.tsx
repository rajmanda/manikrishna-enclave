"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  ReceiptText,
  Wallet,
  Wrench,
} from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Apartment, CostCaseDetail, Vendor } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber } from "@/lib/lookup";
import { invoiceTone } from "@/lib/tones";
import { AddExpenseDialog } from "@/components/expenses";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Badge, Card, ErrorNote, PageLoading } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

/** Owner assessment batch: per-apartment allocation table, equal split of
 * the budget by default, every row editable, tick apartments in or out. */
function AssessDialog({
  caseId,
  caseTitle,
  budget,
  apartments,
  onClose,
  onDone,
}: {
  caseId: string;
  caseTitle: string;
  budget: number;
  apartments: Apartment[];
  onClose: () => void;
  onDone: () => void;
}) {
  const sorted = [...apartments].sort((a, b) => a.number.localeCompare(b.number));
  const equal = sorted.length > 0 ? Math.round((budget || 0) / sorted.length) : 0;
  const [rows, setRows] = useState(
    sorted.map((a) => ({ apartmentId: a.id, number: a.number, included: true, amount: String(equal || ""), installments: 1 }))
  );
  const [period, setPeriod] = useState(
    new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
  );
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState(caseTitle);
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
            <button type="button" onClick={splitEqually} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Split equally
            </button>
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
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !dueDate || total <= 0} className={primaryBtnCls}>
          {busy ? "Generating…" : `Generate ${included.length} invoice${included.length === 1 ? "" : "s"} (${formatINR(total)})`}
        </button>
      </form>
    </Modal>
  );
}

const TIMELINE_ICONS: Record<string, typeof Wrench> = {
  case: FileText,
  maintenance: ClipboardList,
  work_order: Wrench,
  expense: Wallet,
  payment: Banknote,
};

export default function CostCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const detail = useApi<CostCaseDetail>(`/cost-cases/${id}`);
  const vendors = useApi<Vendor[]>("/vendors");
  const apartments = useApi<Apartment[]>("/apartments");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (detail.error) return <ErrorNote message={detail.error} onRetry={detail.reload} />;
  if (detail.loading || !detail.data) return <PageLoading />;

  const c = detail.data;
  const s = c.summary;

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
      detail.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function closeCase() {
    try {
      await api(`/cost-cases/${c.id}/close`, { method: "POST", body: JSON.stringify({}) });
      detail.reload();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to close";
      if (err instanceof ApiError && err.message.startsWith("Cannot close")) {
        if (confirm(`${msg}\n\nClose anyway? A note will be recorded in the audit trail.`)) {
          const note = prompt("Reason for closing with open balances:") ?? "";
          await api(`/cost-cases/${c.id}/close`, {
            method: "POST",
            body: JSON.stringify({ force: true, note }),
          });
          detail.reload();
        }
      } else {
        alert(msg);
      }
    }
  }

  const rows: [string, string, string?][] = [
    ["Estimated / approved", s.estimatedCost ? formatINR(s.estimatedCost) : "—"],
    ["Actual cost (posted)", formatINR(s.actualCost), s.actualCost === 0 ? "text-amber-600" : undefined],
    ["Billed to owners", formatINR(s.billedToOwners)],
    ["Collected", formatINR(s.collectedFromOwners), "text-emerald-600"],
    ["Outstanding from owners", formatINR(s.outstandingFromOwners), s.outstandingFromOwners > 0 ? "text-red-600" : undefined],
    ["Funded from reserve", formatINR(s.reserveFunded)],
    ["Surplus collected", formatINR(s.surplusCollected), s.surplusCollected > 0 ? "text-emerald-600" : undefined],
  ];

  return (
    <div className="space-y-5">
      <Link href="/cost-cases" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Cost Cases
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={c.status === "closed" ? "slate" : "blue"}>{c.status}</Badge>
          {c.fundingMethod && <Badge tone="violet">{c.fundingMethod.replace(/_/g, " ")}</Badge>}
        </div>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">{c.title}</h1>
        {c.description && <p className="mt-1.5 text-sm text-slate-600">{c.description}</p>}
      </div>

      {s.awaitingVendorBill && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <b>{formatINR(s.collectedFromOwners)}</b> has been collected for this
              job. No final vendor expense has been posted — add the vendor bill
              to complete reconciliation.
            </span>
          </p>
          {canWrite && (
            <button
              onClick={() => setExpenseOpen(true)}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Add vendor expense
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Financial summary */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Reconciliation</h2>
            {canWrite && c.status !== "closed" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setExpenseOpen(true)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Wallet className="mr-1 inline h-3 w-3" /> Add expense
                </button>
                <button
                  onClick={closeCase}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Lock className="mr-1 inline h-3 w-3" /> Close case
                </button>
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map(([label, value, cls]) => (
              <div key={label} className="flex items-baseline justify-between py-2 text-sm">
                <span className="text-slate-500">{label}</span>
                <span className={`font-semibold ${cls ?? "text-slate-800"}`}>{value}</span>
              </div>
            ))}
          </div>
          {s.draftBills > 0 && (
            <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
              {s.draftBills} vendor bill{s.draftBills > 1 ? "s" : ""} ({formatINR(s.draftBillAmount)}) in draft —
              post below to count them in the books.
            </p>
          )}
        </Card>

        {/* Timeline */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
          <ol className="space-y-3">
            {c.timeline.map((t, i) => {
              const Icon = TIMELINE_ICONS[t.kind] ?? FileText;
              return (
                <li key={i} className="flex gap-2.5 text-sm">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <div className="min-w-0">
                    <p className="text-slate-700">{t.label}</p>
                    <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      {/* Related records */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Related records</h2>
          <div className="space-y-1.5 text-sm">
            {c.maintenanceRequest && (
              <Link href="/maintenance" className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">Request: {c.maintenanceRequest.title}</span>
                <Badge tone="blue">{c.maintenanceRequest.status}</Badge>
              </Link>
            )}
            {c.workOrders.map((w) => (
              <Link key={w.id} href={`/work-orders/${w.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">
                <Wrench className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{w.title}</span>
                <Badge tone="slate">{w.stage}</Badge>
              </Link>
            ))}
            {c.expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{e.description} · {formatINR(e.amount)}</span>
                {e.status === "draft" ? (
                  canWrite ? (
                    <button
                      disabled={busy === e.id}
                      onClick={() => run(e.id, () => api(`/expenses/${e.id}/post`, { method: "POST" }))}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Post to books
                    </button>
                  ) : (
                    <Badge tone="violet">draft</Badge>
                  )
                ) : (
                  <Badge tone="green"><CheckCircle2 className="mr-1 h-3 w-3" /> posted</Badge>
                )}
              </div>
            ))}
            {c.expenses.length === 0 && c.workOrders.length === 0 && !c.maintenanceRequest && (
              <p className="py-3 text-center text-xs text-slate-400">Nothing linked yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
            Owner assessments
            <span className="flex items-center gap-2">
              <span className="text-xs font-normal text-slate-400">
                {c.invoices.length} invoice{c.invoices.length === 1 ? "" : "s"}
              </span>
              {canWrite && c.status !== "closed" && (
                <button
                  onClick={() => setAssessOpen(true)}
                  className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Bill owners
                </button>
              )}
            </span>
          </h2>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {c.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                <ReceiptText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">Apt {aptNumber(inv.apartmentId)} · {formatINR(inv.amount)}</span>
                <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
              </div>
            ))}
            {c.invoices.length === 0 && (
              <p className="py-3 text-center text-xs text-slate-400">
                No assessments yet — tap <b>Bill owners</b> to allocate and
                invoice the apartments.
              </p>
            )}
          </div>
        </Card>
      </div>

      {assessOpen && (
        <AssessDialog
          caseId={c.id}
          caseTitle={c.title}
          budget={c.approvedBudget ?? 0}
          apartments={apartments.data ?? []}
          onClose={() => setAssessOpen(false)}
          onDone={detail.reload}
        />
      )}
      {expenseOpen && (
        <AddExpenseDialog
          vendors={vendors.data}
          onClose={() => setExpenseOpen(false)}
          onDone={detail.reload}
          initial={{
            category: "Repairs",
            description: c.title,
            amount: c.approvedBudget ?? undefined,
            workOrderId: c.workOrders[0]?.id,
            costCaseId: c.id,
          }}
        />
      )}
    </div>
  );
}
