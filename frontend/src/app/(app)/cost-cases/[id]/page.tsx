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
import { AssessDialog } from "@/components/AssessDialog";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { uploadEach, uploadFileTo } from "@/lib/upload";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Badge, Card, ErrorNote, PageLoading } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

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
          {canWrite && c.status !== "closed" && s.actualCost > 0 &&
            s.billedToOwners > 0 && s.billedToOwners !== s.actualCost && (
            <button
              onClick={async () => {
                if (!confirm(
                  `Adjust every owner invoice to the actual cost of ${formatINR(s.actualCost)}?\n\nBilled today: ${formatINR(s.billedToOwners)}. Each apartment's share is recalculated proportionally; amounts already paid are never reduced (any excess shows as surplus for a credit/refund).`
                )) return;
                try {
                  const r = await api<{ adjusted: number; deleted: number; surplusByApartment: Record<string, number> }>(
                    `/cost-cases/${c.id}/adjust-assessments`, { method: "POST" }
                  );
                  const surplus = Object.entries(r.surplusByApartment);
                  alert(
                    `${r.adjusted} invoice(s) adjusted${r.deleted ? `, ${r.deleted} removed` : ""}.` +
                    (surplus.length
                      ? `\n\nOverpaid (credit on their next invoice or refund):\n` +
                        surplus.map(([apt, v]) => `  Apt ${aptNumber(apt)}: ${formatINR(v)}`).join("\n")
                      : "")
                  );
                  detail.reload();
                } catch (err) {
                  alert(err instanceof ApiError ? err.message : "Adjustment failed");
                }
              }}
              className="mt-2 w-full rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Adjust owner invoices to actual ({formatINR(s.actualCost)})
            </button>
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
            {(Object.keys(c.credits ?? {}).length > 0 ||
              Object.keys(c.creditsApplied ?? {}).length > 0) && (
              <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <p className="font-semibold">Credits (paid over their share)</p>
                {Object.entries(c.credits ?? {}).map(([apt, v]) => (
                  <p key={apt} className="mt-1 flex items-center justify-between gap-2">
                    <span>Apt {aptNumber(apt)}: <b>{formatINR(v)}</b> to settle</span>
                    {canWrite && (
                      <button
                        onClick={async () => {
                          try {
                            const r = await api<{ applied: number; remainingCredit: number }>(
                              `/cost-cases/${c.id}/apply-credit`,
                              { method: "POST", body: JSON.stringify({ apartmentId: apt }) }
                            );
                            alert(`${formatINR(r.applied)} credited to their next open invoice.${r.remainingCredit > 0 ? ` ${formatINR(r.remainingCredit)} still to settle.` : ""}`);
                            detail.reload();
                          } catch (err) {
                            if (err instanceof ApiError && err.message.includes("No unapplied credit")) {
                              alert("This credit was already applied — refreshing the view.");
                              detail.reload();
                            } else {
                              alert(err instanceof ApiError ? err.message : "Failed to apply credit");
                            }
                          }
                        }}
                        className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        Apply to next invoice
                      </button>
                    )}
                  </p>
                ))}
                {Object.entries(c.creditsApplied ?? {})
                  .filter(([apt]) => !(c.credits ?? {})[apt])
                  .map(([apt, v]) => (
                    <p key={apt} className="mt-1">
                      Apt {aptNumber(apt)}: {formatINR(v)} <b>credit applied ✓</b>
                    </p>
                  ))}
              </div>
            )}
            {c.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                <ReceiptText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">Apt {aptNumber(inv.apartmentId)} · {formatINR(inv.amount)}</span>
                {(c.credits ?? {})[inv.apartmentId] != null && (
                  <Badge tone="green">credit {formatINR((c.credits ?? {})[inv.apartmentId])}</Badge>
                )}
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
          fundingMethod={c.fundingMethod}
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
