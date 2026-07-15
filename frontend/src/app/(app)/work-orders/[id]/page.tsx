"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Check, ClipboardList, Phone, ReceiptText, Send, Upload, Wallet } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, apiBlob, ApiError, apiUpload } from "@/lib/api";
import type { Apartment, Expense, Invoice, User, Vendor, WorkOrder, WorkOrderStage } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { userName, vendorFor } from "@/lib/lookup";
import { priorityTone, stageTone } from "@/lib/tones";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { AddExpenseDialog } from "@/components/expenses";
import { AssessDialog } from "@/components/AssessDialog";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function StageDialog({
  wo,
  onClose,
  onDone,
}: {
  wo: WorkOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const allStages: WorkOrderStage[] = [
    "Reported", "Estimate Received", "Owner Approval",
    "In Progress", "Inspection", "Completed", "Closed",
  ];
  const currentIdx = allStages.indexOf(wo.stage);
  const [stage, setStage] = useState<WorkOrderStage>(
    allStages[Math.min(currentIdx + 1, allStages.length - 1)]
  );
  const [note, setNote] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/work-orders/${wo.id}/stage`, {
        method: "POST",
        body: JSON.stringify({
          stage,
          note,
          ...(finalCost ? { finalCost: Number(finalCost) } : {}),
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stage");
      setBusy(false);
    }
  }

  return (
    <Modal title="Update Stage" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-slate-500">
          Current: <b>{wo.stage}</b>. Owners are notified of the change.
        </p>
        <div>
          <label className={labelCls}>New stage</label>
          <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as WorkOrderStage)}>
            {allStages.map((st) => <option key={st}>{st}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Note</label>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" />
        </div>
        {(stage === "Completed" || stage === "Closed") && (
          <div>
            <label className={labelCls}>Final cost (optional)</label>
            <input type="number" min="0" className={inputCls} value={finalCost} onChange={(e) => setFinalCost(e.target.value)} />
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Updating…" : `Move to ${stage}`}
        </button>
      </form>
    </Modal>
  );
}

function WorkOrderPhoto({ workOrderId, index }: { workOrderId: string; index: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    apiBlob(`/work-orders/${workOrderId}/photos/${index}`)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [workOrderId, index]);

  if (!src)
    return (
      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Camera className="h-5 w-5" />
      </span>
    );
  return (
    <a href={src} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Photo ${index + 1}`} className="h-16 w-16 rounded-xl object-cover" />
    </a>
  );
}

const allStages: WorkOrderStage[] = [
  "Reported",
  "Estimate Received",
  "Owner Approval",
  "In Progress",
  "Inspection",
  "Completed",
  "Closed",
];

export default function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const workOrder = useApi<WorkOrder>(`/work-orders/${id}`);
  const vendors = useApi<Vendor[]>("/vendors");
  const users = useApi<User[]>("/users");
  // Money chain (manager view): expenses/invoices linked to this job.
  const expenses = useApi<Expense[]>(canWrite ? "/expenses" : null);
  const invoices = useApi<Invoice[]>(canWrite ? "/invoices" : null);
  const apartments = useApi<Apartment[]>(canWrite ? "/apartments" : null);
  const [stageOpen, setStageOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true);
    try {
      await api(`/work-orders/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: comment }),
      });
      setComment("");
      workOrder.reload();
    } finally {
      setCommentBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setPhotoBusy(true);
    try {
      await apiUpload(`/work-orders/${id}/photos`, file);
      workOrder.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function deleteWorkOrder() {
    if (!confirm("Are you sure you want to delete this work order?")) return;
    try {
      await api(`/work-orders/${id}`, { method: "DELETE" });
      router.push("/work-orders");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  if (workOrder.error)
    return <ErrorNote message={workOrder.error} onRetry={workOrder.reload} />;
  if (workOrder.loading || !workOrder.data) return <PageLoading />;

  const wo = workOrder.data;
  const vendor = vendorFor(vendors.data, wo.vendorId);
  const currentIdx = allStages.indexOf(wo.stage);
  const eventByStage = new Map(wo.timeline.map((e) => [e.stage, e]));
  const linkedExpenses = (expenses.data ?? []).filter((e) => e.workOrderId === wo.id);
  const linkedInvoices = (invoices.data ?? []).filter((i) => i.workOrderId === wo.id);
  const posted = linkedExpenses.filter((e) => e.status !== "draft");
  const draftBill = linkedExpenses.find((e) => e.status === "draft");
  const spent = posted.reduce((s, e) => s + e.amount, 0);
  const billed = linkedInvoices.reduce((s, i) => s + i.amount, 0);
  const collected = linkedInvoices.reduce((s, i) => s + i.paidAmount, 0);

  // One contextual primary money action, tracking the lifecycle:
  // record the spend → post the vendor bill → bill owners → adjust to actual.
  const nextMoneyAction = !canWrite
    ? null
    : draftBill
      ? {
          label: `Post vendor bill (${formatINR(draftBill.amount)})`,
          run: async () => {
            if (!confirm(`Post "${draftBill.description}" (${formatINR(draftBill.amount)}) to the books? It will count against the reserve.`)) return;
            try {
              await api(`/expenses/${draftBill.id}/post`, { method: "POST" });
              expenses.reload();
            } catch (err) {
              alert(err instanceof ApiError ? err.message : "Failed to post");
            }
          },
        }
      : spent === 0
        ? { label: "Record expense for this job", run: () => setExpenseOpen(true) }
        : billed === 0
          ? wo.costCaseId
            ? { label: "Bill owners for this job", run: () => setAssessOpen(true) }
            : { label: "Bill owners for this job", href: `/invoices?dialog=generate&wo=${wo.id}&desc=${encodeURIComponent(wo.title)}` }
          : billed !== spent
            ? {
                label: "Adjust owner invoices to actual",
                run: async () => {
                  if (!confirm(
                    `Adjust every owner invoice to the actual cost of ${formatINR(spent)}?\n\nBilled today: ${formatINR(billed)}. Shares recalculate proportionally; paid money is never reduced. Owners are notified of their change.`
                  )) return;
                  try {
                    const r = await api<{ adjusted: number; surplusByApartment: Record<string, number> }>(
                      `/cost-cases/${wo.costCaseId}/adjust-assessments`, { method: "POST" }
                    );
                    const surplus = Object.entries(r.surplusByApartment);
                    alert(`${r.adjusted} invoice(s) adjusted.` + (surplus.length
                      ? `\n\nOverpaid (apply credit from the cost case):\n` +
                        surplus.map(([apt, v]) => `  Apt ${apt.replace("apt-", "")}: ${formatINR(v)}`).join("\n")
                      : ""));
                    invoices.reload();
                  } catch (err) {
                    alert(err instanceof ApiError ? err.message : "Adjustment failed");
                  }
                },
              }
            : null;

  return (
    <div className="space-y-5">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Work Orders
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={priorityTone(wo.priority)}>{wo.priority}</Badge>
          <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
        </div>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">{wo.title}</h1>
        <p className="mt-1.5 text-sm text-slate-600">{wo.description}</p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {canWrite && wo.stage !== "Closed" && (
            <button
              onClick={() => setStageOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <ArrowRight className="h-4 w-4" /> Update stage
            </button>
          )}
          {nextMoneyAction && (
            nextMoneyAction.href ? (
              <Link
                href={nextMoneyAction.href}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <ReceiptText className="h-4 w-4" /> {nextMoneyAction.label}
              </Link>
            ) : (
              <button
                onClick={nextMoneyAction.run}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <ReceiptText className="h-4 w-4" /> {nextMoneyAction.label}
              </button>
            )
          )}
          {role === "super_admin" && (
            <button
              onClick={deleteWorkOrder}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 hover:text-red-700"
            >
              Delete work order
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: timeline + comments */}
        <div className="space-y-5 lg:col-span-2">
          {/* Stage timeline */}
          <Card className="p-4">
            <h2 className="mb-4 text-sm font-semibold">Progress</h2>
            <ol className="space-y-0">
              {allStages.map((stage, i) => {
                const event = eventByStage.get(stage);
                const done = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <li key={stage} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < allStages.length - 1 && (
                      <span
                        className={`absolute left-[11px] top-6 h-full w-0.5 ${
                          i < currentIdx ? "bg-brand-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done
                          ? isCurrent
                            ? "bg-brand-600 text-white ring-4 ring-brand-100"
                            : "bg-brand-500 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {done && !isCurrent ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-sm font-medium ${done ? "text-slate-900" : "text-slate-400"}`}
                      >
                        {stage}
                      </p>
                      {event && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(event.date)} — {event.note}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Owner comments */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Comments ({wo.comments.length})
            </h2>
            <ul className="space-y-4">
              {wo.comments.map((c, i) => (
                <li key={i} className="flex gap-3">
                  <Avatar name={userName(users.data, c.authorId)} size="sm" />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {userName(users.data, c.authorId)}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDate(c.date)}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{c.text}</p>
                  </div>
                </li>
              ))}
              {wo.comments.length === 0 && (
                <p className="text-sm text-slate-400">No comments yet.</p>
              )}
            </ul>
            {role !== "auditor" && (
              <form className="mt-4 flex gap-2" onSubmit={submitComment}>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={commentBusy || !comment.trim()}
                  aria-label="Send comment"
                  className="rounded-xl bg-brand-600 px-3.5 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </Card>
        </div>

        {/* Right: details */}
        <div className="space-y-5">
          <Card className="divide-y divide-slate-100">
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Money
              </p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Estimate</span>
                <span className="text-sm font-semibold">
                  {wo.estimate != null ? formatINR(wo.estimate) : "—"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Final Cost</span>
                <span className="text-sm font-semibold">
                  {wo.finalCost != null ? formatINR(wo.finalCost) : "Pending"}
                </span>
              </div>
              {canWrite && (
                <>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">Expenses recorded</span>
                    <span className={`text-sm font-semibold ${spent === 0 && collected > 0 ? "text-amber-600" : ""}`}>
                      {linkedExpenses.length > 0 ? formatINR(spent) : "None"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">Billed to owners</span>
                    <span className="text-sm font-semibold">
                      {linkedInvoices.length > 0 ? formatINR(billed) : "—"}
                    </span>
                  </div>
                  {linkedInvoices.length > 0 && (
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm text-slate-500">Collected</span>
                      <span className={`text-sm font-semibold ${collected >= billed ? "text-emerald-600" : "text-amber-600"}`}>
                        {formatINR(collected)}
                        {billed > collected && (
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            of {formatINR(billed)}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {collected > 0 && linkedExpenses.length === 0 && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                      Money collected but no expense recorded for this job yet.
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-1.5">
                    {nextMoneyAction &&
                      (nextMoneyAction.href ? (
                        <Link
                          href={nextMoneyAction.href}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <ReceiptText className="h-3.5 w-3.5" /> {nextMoneyAction.label}
                        </Link>
                      ) : (
                        <button
                          onClick={nextMoneyAction.run}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <ReceiptText className="h-3.5 w-3.5" /> {nextMoneyAction.label}
                        </button>
                      ))}
                    {/* Both paths stay visible — collect-first communities
                        bill owners BEFORE any expense exists. The primary is
                        a suggestion, never a gate. */}
                    {nextMoneyAction?.label !== "Record expense for this job" && !draftBill && (
                      <button
                        onClick={() => setExpenseOpen(true)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        {spent > 0 ? "Add another expense" : "Record expense for this job"}
                      </button>
                    )}
                    {nextMoneyAction?.label !== "Bill owners for this job" && (
                      wo.costCaseId ? (
                        <button
                          onClick={() => setAssessOpen(true)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          {billed > 0 ? "Bill more owners" : "Bill owners for this job"}
                        </button>
                      ) : (
                        <Link
                          href={`/invoices?dialog=generate&wo=${wo.id}&desc=${encodeURIComponent(wo.title)}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          {billed > 0 ? "Bill more owners" : "Bill owners for this job"}
                        </Link>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
            {(wo.maintenanceRequestId || wo.costCaseId) && (
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Related
                </p>
                {wo.costCaseId && (
                  <Link
                    href={`/cost-cases/${wo.costCaseId}`}
                    className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    <ReceiptText className="h-3.5 w-3.5" /> Open cost case (full money story)
                  </Link>
                )}
                {wo.maintenanceRequestId && (
                  <Link
                    href="/maintenance"
                    className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> From a resident maintenance request
                  </Link>
                )}
              </div>
            )}
            {vendor && (
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Assigned Vendor
                </p>
                <p className="mt-1.5 text-sm font-medium">{vendor.name}</p>
                <p className="text-xs text-slate-500">{vendor.service}</p>
                <a
                  href={`tel:${vendor.phone.replace(/\s/g, "")}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600"
                >
                  <Phone className="h-3 w-3" /> {vendor.phone}
                </a>
              </div>
            )}
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Managed By
              </p>
              <p className="mt-1.5 text-sm font-medium">
                {wo.assignedTo ? userName(users.data, wo.assignedTo) : "Unassigned"}
              </p>
              <p className="text-xs text-slate-500">
                Reported {formatDate(wo.reportedDate)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Attachments
              </p>
              {(wo.photos?.length ?? 0) > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(wo.photos ?? []).map((_, i) => (
                    <WorkOrderPhoto key={i} workOrderId={wo.id} index={i} />
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-slate-400">
                  {wo.photoCount > 0
                    ? `${wo.photoCount} photo(s) recorded before uploads were enabled`
                    : "No photos"}
                </p>
              )}
              {canWrite && (
                <>
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                  />
                  <button
                    onClick={() => photoRef.current?.click()}
                    disabled={photoBusy}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {photoBusy ? "Uploading…" : "Add photo"}
                  </button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
      {stageOpen && (
        <StageDialog wo={wo} onClose={() => setStageOpen(false)} onDone={workOrder.reload} />
      )}
      {assessOpen && wo.costCaseId && (
        <AssessDialog
          caseId={wo.costCaseId}
          caseTitle={wo.title}
          budget={wo.finalCost ?? wo.estimate ?? 0}
          apartments={apartments.data ?? []}
          onClose={() => setAssessOpen(false)}
          onDone={() => invoices.reload()}
        />
      )}
      {expenseOpen && (
        <AddExpenseDialog
          vendors={vendors.data}
          onClose={() => setExpenseOpen(false)}
          onDone={() => expenses.reload()}
          initial={{
            category: "Repairs",
            description: wo.title,
            amount: wo.finalCost ?? wo.estimate ?? undefined,
            vendorId: wo.vendorId ?? undefined,
            workOrderId: wo.id,
          }}
        />
      )}
    </div>
  );
}
