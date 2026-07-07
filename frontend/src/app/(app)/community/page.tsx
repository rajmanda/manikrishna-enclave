"use client";

// The "HOA Page" — visible to every owner. All data comes from the API;
// invoices are RBAC-scoped server-side, so owners see dues badges only for
// their own apartment while managers see everyone's.

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Paperclip, PlusCircle, ReceiptText, Trash2, Upload } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, apiBlob, ApiError, apiUpload } from "@/lib/api";
import type {
  Apartment,
  CommunitySummary,
  Expense,
  Invoice,
  MonthlyFinance,
  ReserveFundEntry,
  User,
  Vendor,
} from "@/lib/types";
import { currentMonthLabel, formatDate, formatINR } from "@/lib/format";
import { aptNumber, vendorFor } from "@/lib/lookup";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { ExpensesModal } from "@/components/ExpensesModal";
import { ReserveModal } from "@/components/ReserveModal";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  SectionHeader,
  Stat,
} from "@/components/ui";
import { ExpensePie } from "@/components/charts";

const CATEGORIES = [
  "Electricity", "Water", "Watchman", "Lift", "Generator",
  "Repairs", "Garden", "Cleaning", "Miscellaneous",
];
const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function AddExpenseDialog({
  vendors,
  onClose,
  onDone,
}: {
  vendors: Vendor[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState("Miscellaneous");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/expenses", {
        method: "POST",
        body: JSON.stringify({
          category,
          description,
          amount: Number(amount),
          paidDate,
          ...(vendorId ? { vendorId } : {}),
        }),
      });
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
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount</label>
            <input type="number" min="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Paid date</label>
            <input type="date" className={inputCls} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} required />
          </div>
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
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Saving…" : "Add expense"}
        </button>
      </form>
    </Modal>
  );
}

function ReceiptActions({
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
      await apiUpload(`/expenses/${expense.id}/receipt`, file);
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

export default function CommunityPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const [addOpen, setAddOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<string | null>(null);
  const [ledgerView, setLedgerView] = useState<"month" | "category">("month");
  // Keyed by view+label; unset = default (only the first group starts open).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const summary = useApi<CommunitySummary>("/finance/summary");
  const expenses = useApi<Expense[]>("/expenses");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const invoices = useApi<Invoice[]>("/invoices");
  const vendors = useApi<Vendor[]>("/vendors");
  const monthly = useApi<MonthlyFinance[]>("/finance/monthly");
  const reserve = useApi<ReserveFundEntry[]>("/reserve-fund");
  const [incomeModal, setIncomeModal] = useState(false);
  const [monthExpenseModal, setMonthExpenseModal] = useState(false);
  const [duesModal, setDuesModal] = useState(false);
  const [reserveModal, setReserveModal] = useState(false);

  const error = summary.error ?? expenses.error ?? apartments.error ?? users.error;
  if (error) return <ErrorNote message={error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data || !expenses.data || !apartments.data)
    return <PageLoading />;

  const s = summary.data;
  const expenseList = expenses.data;
  const apartmentList = [...apartments.data].sort((a, b) =>
    a.number.localeCompare(b.number)
  );

  const byCategory = new Map<string, number>();
  for (const e of expenseList) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  // Ledger grouping: months tell "what we spent in July", categories tell
  // "what we spend on electricity" — both stories a resident actually asks.
  const monthLabel = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt.getTime())
      ? "Other"
      : dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const ledgerGroups = (() => {
    const map = new Map<string, Expense[]>();
    if (ledgerView === "category") {
      for (const e of [...expenseList].sort((a, b) => b.amount - a.amount)) {
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
    for (const e of [...expenseList].sort((a, b) =>
      b.paidDate.localeCompare(a.paidDate)
    )) {
      const key = monthLabel(e.paidDate);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  })();
  const pieData = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Owners only receive their own invoices from the API, so dues badges
  // appear only where the caller is allowed to see them.
  const duesByApartment = new Map<string, number>();
  for (const inv of (invoices.data ?? []).filter(
    (i) => (i.ledger ?? "community") === "community"
  )) {
    duesByApartment.set(
      inv.apartmentId,
      (duesByApartment.get(inv.apartmentId) ?? 0) + (inv.amount - inv.paidAmount)
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Mani Krishna Enclave"
        subtitle={`${apartmentList.length} apartments · Community financials`}
      />

      {/* Financial summary — /finance/summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Income (${currentMonthLabel()})`}
          value={formatINR(s.monthIncome)}
          tone="positive"
          hint="Tap for month-by-month"
          onClick={() => setIncomeModal(true)}
        />
        <Stat
          label={`Expenses (${currentMonthLabel()})`}
          value={formatINR(s.monthExpenses)}
          tone="negative"
          hint="Tap for line items"
          onClick={() => setMonthExpenseModal(true)}
        />
        <Stat
          label="Outstanding Dues"
          value={formatINR(s.outstandingDues)}
          hint="Tap for the breakup"
          onClick={() => setDuesModal(true)}
        />
        <Stat
          label="Community Reserve"
          value={formatINR(s.reserveFundBalance)}
          tone="positive"
          hint="Tap for the story"
          onClick={() => setReserveModal(true)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Expense breakdown chart */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Expense Breakdown</h2>
          <p className="mb-1 text-xs text-slate-400">Tap a slice for the line items</p>
          <ExpensePie data={pieData} onSliceClick={setCategoryModal} />
        </Card>

        {/* Expense ledger */}
        <section className="lg:col-span-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Expense Ledger</h2>
            {canWrite && (
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add expense
              </button>
            )}
          </div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              Every rupee spent from community funds
            </p>
            <div className="flex rounded-xl border border-slate-200 p-0.5">
              {(["month", "category"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setLedgerView(v)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    ledgerView === v
                      ? "bg-brand-600 text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v === "month" ? "By month" : "By category"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3" key={ledgerView}>
            {ledgerGroups.map(({ label, items }, index) => {
              const groupTotal = items.reduce((sum, e) => sum + e.amount, 0);
              const groupKey = `${ledgerView}:${label}`;
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
                      const vendor = vendorFor(vendors.data, e.vendorId);
                      return (
                        <div key={e.id} className="flex items-start justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{e.description}</p>
                              <Badge tone="slate">
                                {ledgerView === "category"
                                  ? monthLabel(e.paidDate)
                                  : e.category}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {vendor ? `${vendor.name} · ` : ""}
                              Paid {formatDate(e.paidDate)} · Split equally across{" "}
                              {apartmentList.length} apartments (
                              {formatINR(Math.round(e.amount / apartmentList.length))}/apt)
                            </p>
                            <ReceiptActions expense={e} canWrite={canWrite} onChanged={expenses.reload} />
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <p className="text-sm font-semibold">{formatINR(e.amount)}</p>
                            {canWrite && (
                              <button
                                aria-label={`Delete ${e.description}`}
                                onClick={async () => {
                                  if (!confirm(`Delete expense "${e.description}"?`)) return;
                                  await api(`/expenses/${e.id}`, { method: "DELETE" });
                                  expenses.reload();
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
            {expenseList.length === 0 && (
              <Card>
                <p className="p-5 text-center text-sm text-slate-400">
                  No expenses recorded yet.
                </p>
              </Card>
            )}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-sm font-semibold">All months total</p>
              <p className="text-sm font-bold">
                {formatINR(expenseList.reduce((sum, e) => sum + e.amount, 0))}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Apartment directory */}
      <section>
        <SectionHeader title="Apartments & Owners" />
        <div className="grid gap-3 sm:grid-cols-2">
          {apartmentList.map((apt) => {
            const owner = users.data?.find((u) => u.id === apt.ownerIds[0]);
            const due = duesByApartment.get(apt.id);
            return (
              <Card key={apt.id} className="flex items-center gap-3 p-4">
                <Avatar name={owner?.name ?? apt.number} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{owner?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    Apartment {apt.number} · Floor {apt.floor}
                  </p>
                </div>
                {due !== undefined &&
                  (due > 0 ? (
                    <Badge tone="red">{formatINR(due)} due</Badge>
                  ) : (
                    <Badge tone="green">
                      <ReceiptText className="mr-1 h-3 w-3" /> Paid
                    </Badge>
                  ))}
              </Card>
            );
          })}
        </div>
      </section>

      {categoryModal && (
        <ExpensesModal
          title={`${categoryModal} expenses`}
          expenses={expenseList.filter((e) => e.category === categoryModal)}
          onClose={() => setCategoryModal(null)}
        />
      )}

      {incomeModal && (
        <Modal title="Community Income" onClose={() => setIncomeModal(false)}>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Month</span>
              <span className="text-right">Collected</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(monthly.data ?? []).map((m) => (
                <div key={m.month} className="grid grid-cols-2 items-center gap-2 px-3 py-2.5 text-xs">
                  <span className="font-medium">{m.month}</span>
                  <span className="text-right font-semibold text-emerald-600">
                    {formatINR(m.income)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Money received into community funds each month — confirmed
            maintenance payments only. Fees paid to the manager are not
            included.
          </p>
        </Modal>
      )}
      {monthExpenseModal && (
        <ExpensesModal
          title={`Expenses — ${currentMonthLabel()}`}
          expenses={expenseList.filter((e) =>
            e.paidDate.startsWith(new Date().toISOString().slice(0, 7))
          )}
          onClose={() => setMonthExpenseModal(false)}
        />
      )}
      {duesModal && (
        <Modal title="Outstanding Dues" onClose={() => setDuesModal(false)}>
          {(() => {
            const rows = [...duesByApartment.entries()]
              .filter(([, total]) => total > 0)
              .sort((a, b) => b[1] - a[1]);
            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  {canWrite
                    ? "Everything collected — no dues."
                    : "No dues on your apartments."}
                </p>
              );
            return (
              <div className="divide-y divide-slate-100">
                {rows.map(([aptId, total]) => (
                  <div key={aptId} className="flex items-center justify-between gap-3 py-2.5">
                    <p className="text-sm font-medium">Apt {aptNumber(aptId)}</p>
                    <p className="text-sm font-semibold text-red-600">{formatINR(total)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-bold">Total</p>
                  <p className="text-sm font-bold text-red-600">
                    {formatINR(rows.reduce((sum, [, t]) => sum + t, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
          {!canWrite && (
            <p className="mt-3 text-xs text-slate-500">
              You can only see dues for your own apartment(s); the community
              total on the tile includes all flats.
            </p>
          )}
          <Link
            href="/invoices"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Go to invoices →
          </Link>
        </Modal>
      )}
      {reserveModal && (
        <ReserveModal
          entries={reserve.data ?? []}
          onClose={() => setReserveModal(false)}
        />
      )}

      {addOpen && (
        <AddExpenseDialog
          vendors={vendors.data}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            expenses.reload();
            summary.reload();
          }}
        />
      )}
    </div>
  );
}
