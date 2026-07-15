"use client";

import { useRef, useState } from "react";
import { Banknote, Camera, Check, Download, Link2, Paperclip, Trash2, X } from "lucide-react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import type { Apartment, CommunityDocument, CostCaseDetail, Invoice, Payment, User } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import { invoiceTone } from "@/lib/tones";
import { Modal } from "@/components/Modal";
import { uploadFileTo } from "@/lib/upload";
import { Badge, LedgerBadge } from "@/components/ui";

/** Bottom sheet (modal on desktop) showing one invoice with its full payment
 * history — the single place where invoice and money meet. */
export function InvoiceSheet({
  invoice,
  payments,
  invoices,
  users,
  apartments,
  canWrite,
  mine,
  onClose,
  onChanged,
  onRecordPayment,
  onReportPaid,
  onDelete,
  onOpenInvoice,
}: {
  invoice: Invoice;
  payments: Payment[];
  invoices: Invoice[];
  users: User[] | undefined;
  apartments: Apartment[] | undefined;
  canWrite: boolean;
  mine: boolean;
  onClose: () => void;
  onChanged: () => void;
  onRecordPayment?: (inv: Invoice) => void;
  onReportPaid?: (inv: Invoice) => void;
  onDelete?: (inv: Invoice) => void;
  onOpenInvoice?: (inv: Invoice) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  // Server already filters visibility: owners only get community docs plus
  // ones scoped to their apartments.
  const documents = useApi<CommunityDocument[]>("/documents");
  // Credit from the job this invoice funds (over-collection after the
  // actual cost posted) — owners see it here, not just on the cost case.
  const costCase = useApi<CostCaseDetail>(
    invoice.costCaseId ? `/cost-cases/${invoice.costCaseId}` : null
  );
  const credit = costCase.data?.credits?.[invoice.apartmentId] ?? 0;
  const creditApplied = costCase.data?.creditsApplied?.[invoice.apartmentId] ?? 0;
  const receipts = (documents.data ?? []).filter((d) => d.invoiceId === invoice.id);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  async function attachReceipt(file: File) {
    setUploadingReceipt(true);
    try {
      await uploadFileTo(`/invoices/${invoice.id}/receipt`, file);
      documents.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Receipt upload failed");
    } finally {
      setUploadingReceipt(false);
      if (receiptFileRef.current) receiptFileRef.current.value = "";
      if (receiptCameraRef.current) receiptCameraRef.current.value = "";
    }
  }

  async function deleteReceipt(d: CommunityDocument) {
    if (!confirm(`Delete receipt "${d.title}"?\n\nIt is removed from Documents too. This cannot be undone.`)) return;
    setBusyId(d.id);
    try {
      await api(`/documents/${d.id}`, { method: "DELETE" });
      documents.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete receipt");
    } finally {
      setBusyId(null);
    }
  }

  const linked = payments
    .filter((p) => p.invoiceId === invoice.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const pending = linked.filter((p) => p.status === "pending");
  const confirmed = linked.filter((p) => p.status !== "pending");
  const balance = invoice.amount - invoice.paidAmount;
  const pct =
    invoice.amount > 0
      ? Math.min(100, Math.round((invoice.paidAmount / invoice.amount) * 100))
      : 0;
  const lateFees = invoices.filter((i) => i.parentInvoiceId === invoice.id);
  const parent = invoice.parentInvoiceId
    ? invoices.find((i) => i.id === invoice.parentInvoiceId)
    : undefined;

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await fn();
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function confirmPayment(p: Payment) {
    run(p.id, () => api(`/payments/${p.id}/confirm`, { method: "POST" }));
  }
  function rejectPayment(p: Payment) {
    if (!confirm(`Reject the reported payment of ${formatINR(p.amount)}? The owner will be notified.`)) return;
    run(p.id, () => api(`/payments/${p.id}/reject`, { method: "POST" }));
  }
  function reversePayment(p: Payment) {
    if (!confirm(`Reverse this payment of ${formatINR(p.amount)} (${p.method}, ${formatDate(p.date)})?\n\nThe amount is added back to this invoice's outstanding balance.`)) return;
    run(p.id, () => api(`/payments/${p.id}`, { method: "DELETE" }));
  }

  return (
    <Modal title="Invoice" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {invoice.description}
            <LedgerBadge ledger={invoice.ledger} />
            <Badge tone={invoiceTone(invoice.status)}>{invoice.status}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {invoice.period} · due {formatDate(invoice.dueDate)}
            {!mine &&
              ` · ${ownerNameFor(users, apartments, invoice.apartmentId)}`}
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold">{formatINR(invoice.amount)} billed</span>
            <span className="text-slate-500">
              {formatINR(invoice.paidAmount)} paid
              {balance > 0 && (
                <> · <span className="font-semibold text-red-500">{formatINR(balance)} balance</span></>
              )}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${balance <= 0 ? "bg-emerald-500" : "bg-emerald-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {credit > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-xs text-emerald-800">
              <b>{formatINR(credit)} credit</b> — this apartment paid over its
              share of &ldquo;{costCase.data?.title}&rdquo; (final cost came in lower).
              {!canWrite && " It will be applied to your next invoice or refunded."}
            </p>
            {canWrite && (
              <button
                onClick={async () => {
                  try {
                    const r = await api<{ applied: number; remainingCredit: number }>(
                      `/cost-cases/${invoice.costCaseId}/apply-credit`,
                      { method: "POST", body: JSON.stringify({ apartmentId: invoice.apartmentId }) }
                    );
                    alert(`${formatINR(r.applied)} credited to their next open invoice.${r.remainingCredit > 0 ? ` ${formatINR(r.remainingCredit)} still to settle.` : ""}`);
                    costCase.reload();
                    onChanged();
                  } catch (err) {
                    alert(err instanceof ApiError ? err.message : "Failed to apply credit");
                  }
                }}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Apply to next invoice
              </button>
            )}
          </div>
        )}
        {credit === 0 && creditApplied > 0 && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {formatINR(creditApplied)} credit from &ldquo;{costCase.data?.title}&rdquo; applied ✓
          </p>
        )}
        {invoice.lineItems && invoice.lineItems.length > 0 && (
          <div className="rounded-xl border border-slate-200">
            {invoice.lineItems.map((it, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs last:border-0"
              >
                <span className="text-slate-600">{it.description}</span>
                <span className="font-medium">{formatINR(it.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment history
          </h3>
          {linked.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">
              No payments yet.
            </p>
          )}
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {formatINR(p.amount)} · {p.method}
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      pending
                    </span>
                  </p>
                  <p className="text-xs text-amber-700/80">
                    Reported {formatDate(p.date)}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmPayment(p)}
                      disabled={busyId === p.id}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </button>
                    <button
                      onClick={() => rejectPayment(p)}
                      disabled={busyId === p.id}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-amber-700">awaiting manager</span>
                )}
              </div>
            ))}
            {confirmed.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatINR(p.amount)} · {p.method}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDate(p.date)}
                      {p.reference && ` · ref ${p.reference}`}
                    </p>
                  </div>
                </div>
                {canWrite && (
                  <button
                    onClick={() => reversePayment(p)}
                    disabled={busyId === p.id}
                    title="Reverse payment"
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {(receipts.length > 0 || canWrite) && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Receipts
            </h3>
            <div className="space-y-1.5">
              {receipts.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 pr-1.5 text-xs"
                >
                  <button
                    onClick={() => downloadFile(`/documents/${d.id}/file`, d.title)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate font-medium">{d.title}</span>
                    <span className="shrink-0 text-slate-400">{formatDate(d.uploadedDate)}</span>
                    <Download className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => deleteReceipt(d)}
                      disabled={busyId === d.id}
                      title="Delete receipt"
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {receipts.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">
                  No receipt attached.
                </p>
              )}
              {canWrite && (
                <>
                  <input
                    ref={receiptFileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && attachReceipt(e.target.files[0])}
                  />
                  <input
                    ref={receiptCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && attachReceipt(e.target.files[0])}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => receiptFileRef.current?.click()}
                      disabled={uploadingReceipt}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {uploadingReceipt ? "Uploading…" : "Attach receipt"}
                    </button>
                    <button
                      onClick={() => receiptCameraRef.current?.click()}
                      disabled={uploadingReceipt}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                    >
                      <Camera className="h-3.5 w-3.5" /> Take photo
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-slate-400">
                    Saved to Documents — visible only to this apartment&apos;s owners.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {(parent || lateFees.length > 0) && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Related
            </h3>
            <div className="space-y-1.5">
              {parent && (
                <button
                  onClick={() => onOpenInvoice?.(parent)}
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 truncate">
                    Late fee on: <span className="font-medium">{parent.description}</span>
                  </span>
                  <Badge tone={invoiceTone(parent.status)}>{parent.status}</Badge>
                </button>
              )}
              {lateFees.map((lf) => (
                <button
                  key={lf.id}
                  onClick={() => onOpenInvoice?.(lf)}
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">
                    {lf.description} · {formatINR(lf.amount)}
                  </span>
                  <Badge tone={invoiceTone(lf.status)}>{lf.status}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {canWrite && (
            <button
              onClick={async () => {
                const raw = prompt(
                  `Correct the invoice amount?\n\nCurrent: ${formatINR(invoice.amount)} (paid so far ${formatINR(invoice.paidAmount)}). The status recomputes automatically.`,
                  String(invoice.amount)
                );
                if (raw == null) return;
                const amount = Number(raw);
                if (!amount || amount <= 0 || amount === invoice.amount) return;
                if (amount < invoice.paidAmount) {
                  alert(`Cannot set below the ${formatINR(invoice.paidAmount)} already paid — reverse a payment first.`);
                  return;
                }
                try {
                  await api(`/invoices/${invoice.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ amount }),
                  });
                  onChanged();
                } catch (err) {
                  alert(err instanceof ApiError ? err.message : "Failed to update amount");
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Edit amount
            </button>
          )}
          {canWrite && balance > 0 && onRecordPayment && (
            <button
              onClick={() => {
                onClose();
                onRecordPayment(invoice);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Banknote className="h-3.5 w-3.5" /> Record payment
            </button>
          )}
          {mine && balance > 0 && onReportPaid && pending.length === 0 && (
            <button
              onClick={() => {
                onClose();
                onReportPaid(invoice);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Banknote className="h-3.5 w-3.5" /> I&apos;ve paid this
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(invoice)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-400">
          Apt {aptNumber(invoice.apartmentId)} · invoice {invoice.id}
        </p>
      </div>
    </Modal>
  );
}
