"use client";

import { Suspense, useState } from "react";
import { Banknote, Check, ChevronDown, Trash2, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { useSessionUser } from "@/context/AuthContext";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar } from "@/components/FilterBar";
import type { Account, Apartment, Invoice, Payment, User } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { aptNumber, ownerNameFor } from "@/lib/lookup";
import { ledgerAccent } from "@/lib/tones";
import {
  Badge,
  Card,
  ErrorNote,
  LedgerBadge,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { Modal } from "@/components/Modal";

function PaymentsPageInner() {
  const { role, user } = useSessionUser();
  const canDelete = role === "super_admin" || role === "property_manager";
  const canWrite = ["property_manager", "community_admin", "super_admin"].includes(role);
  const mine = role === "owner" || role === "tenant";
  const myApts = user.apartmentIds?.length
    ? user.apartmentIds
    : user.apartmentId
      ? [user.apartmentId]
      : [];
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statModal, setStatModal] = useState<"community" | "personal" | null>(null);
  const [selectedStatPaymentInvoiceId, setSelectedStatPaymentInvoiceId] = useState<string | null>(null);
  const [collapsedModalPeriods, setCollapsedModalPeriods] = useState<Record<string, boolean>>({});

  const closeStatModal = () => {
    setStatModal(null);
    setSelectedStatPaymentInvoiceId(null);
    setCollapsedModalPeriods({});
  };
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedApts, setCollapsedApts] = useState<Record<string, boolean>>({});
  const payments = useApi<Payment[]>("/payments");
  const invoices = useApi<Invoice[]>("/invoices");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const accounts = useApi<Account[]>(mine ? null : "/accounts");
  const { values: f, set: setFilter, setMany, clearAll, activeCount } = useUrlFilters({
    client: "all", apt: "all", method: "all", ledger: "all",
  });

  if (payments.error)
    return <ErrorNote message={payments.error} onRetry={payments.reload} />;
  if (payments.loading || !payments.data) return <PageLoading />;

  const accountApts = new Set(
    f.client === "all"
      ? []
      : accounts.data?.find((a) => a.id === f.client)?.apartmentIds ?? []
  );
  const visible = payments.data.filter(
    (p) =>
      (f.apt === "all" || p.apartmentId === f.apt) &&
      (f.method === "all" || p.method === f.method) &&
      (f.ledger === "all" || (p.ledger ?? "community") === f.ledger) &&
      (f.client === "all" || accountApts.has(p.apartmentId))
  );
  const invoiceById = new Map((invoices.data ?? []).map((i) => [i.id, i]));
  // What a payment row is titled: the invoice it settles, not just the flat.
  function paymentTitle(p: Payment): string {
    const inv = invoiceById.get(p.invoiceId);
    if (!inv) return `Apt ${aptNumber(p.apartmentId)}`;
    return `${inv.description} — ${inv.period}`;
  }

  const pending = visible.filter((p) => p.status === "pending");
  const confirmed = visible.filter((p) => p.status !== "pending");
  const sorted = [...confirmed].sort((a, b) => b.date.localeCompare(a.date));

  // Group by the month the payment was received, newest first (insertion
  // order follows the date sort above).
  function monthLabel(date: string): string {
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return "Other";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  const monthGroups = (() => {
    const map = new Map<string, Payment[]>();
    for (const p of sorted) {
      const key = monthLabel(p.date);
      const items = map.get(key) ?? [];
      items.push(p);
      map.set(key, items);
    }
    return [...map.entries()].map(([month, items]) => ({ month, items }));
  })();
  const communityTotal = confirmed
    .filter((p) => (p.ledger ?? "community") === "community")
    .reduce((s, p) => s + p.amount, 0);
  const personalTotal = confirmed
    .filter((p) => (p.ledger ?? "community") !== "community")
    .reduce((s, p) => s + p.amount, 0);

  async function act(p: Payment, action: "confirm" | "reject") {
    if (action === "reject" && !confirm(`Reject the reported payment of ${formatINR(p.amount)}? The owner will be notified.`)) return;
    try {
      await api(`/payments/${p.id}/${action}`, { method: "POST" });
      payments.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function reverse(p: Payment) {
    if (!confirm(`Reverse this payment of ${formatINR(p.amount)} (${p.method}, ${formatDate(p.date)})?\n\nThe amount is added back to the invoice's outstanding balance. This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      await api(`/payments/${p.id}`, { method: "DELETE" });
      payments.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to reverse payment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title={mine ? "My Payments" : "Payments Received"}
        subtitle={mine ? "Every payment from your apartments" : "All payment records with references"}
      />

      <FilterBar
        filters={[
          ...(!mine
            ? [{ key: "client", label: "Client", options: [
                { value: "all", label: "All clients" },
                ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name })),
              ]}]
            : []),
          ...(!mine || myApts.length > 1
            ? [{ key: "apt", label: "Apartment", options: [
                { value: "all", label: "All apartments" },
                ...[...(apartments.data ?? [])]
                  .filter((a) =>
                    mine
                      ? myApts.includes(a.id)
                      : f.client === "all" || accountApts.has(a.id)
                  )
                  .sort((a, b) => a.number.localeCompare(b.number))
                  .map((a) => ({ value: a.id, label: `Apt ${a.number}` })),
              ]}]
            : []),
          { key: "method", label: "Method", options: [
            { value: "all", label: "Any method" },
            { value: "UPI", label: "UPI" },
            { value: "Bank Transfer", label: "Bank Transfer" },
            { value: "Cash", label: "Cash" },
            { value: "Cheque", label: "Cheque" },
            { value: "Credit", label: "Credit / Waiver" },
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

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label={mine ? "Maintenance Paid" : "Community Funds Received"}
          value={formatINR(communityTotal)}
          tone="positive"
          hint="Tap for the list"
          onClick={() => setStatModal("community")}
        />
        <Stat
          label={mine ? "Paid to Manager" : "Personal — Fees & Reimbursements"}
          value={formatINR(personalTotal)}
          hint="Tap for the list"
          onClick={() => setStatModal("personal")}
        />
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-amber-700">
            Awaiting confirmation ({pending.length})
          </h2>
          <Card className="divide-y divide-amber-100 border-amber-200">
            {pending.map((p) => (
              <div
                key={p.id}
                onClick={() => setDetailId(p.invoiceId)}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 hover:bg-amber-50/40 ${ledgerAccent(p.ledger)}`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {paymentTitle(p)}
                    <LedgerBadge ledger={p.ledger} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {ownerNameFor(users.data, apartments.data, p.apartmentId)} ·{" "}
                    {formatINR(p.amount)} · {p.method} · {formatDate(p.date)}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        act(p, "confirm");
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        act(p, "reject");
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                ) : (
                  <Badge tone="amber">awaiting manager confirmation</Badge>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="space-y-5" key={JSON.stringify(f)}>
        {monthGroups.map(({ month, items }) => {
          const gc = items
            .filter((p) => (p.ledger ?? "community") === "community")
            .reduce((s, p) => s + p.amount, 0);
          const gp = items
            .filter((p) => (p.ledger ?? "community") !== "community")
            .reduce((s, p) => s + p.amount, 0);
          const isCollapsed = collapsedMonths[month] ?? false;

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
            <section key={month} className="animate-rise">
              <button
                type="button"
                onClick={() => setCollapsedMonths((prev) => ({ ...prev, [month]: !prev[month] }))}
                className="mb-2 flex w-full items-baseline justify-between rounded-lg px-1 py-1 hover:bg-slate-50 transition text-left focus:outline-none focus:ring-1 focus:ring-slate-200"
              >
                <div className="flex items-center gap-1.5 pointer-events-none">
                  <h2 className="text-sm font-bold text-slate-700">{month}</h2>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </div>
                <p className="text-xs text-slate-400 pointer-events-none">
                  {items.length} payment{items.length === 1 ? "" : "s"}
                  {gc > 0 && <> · community <span className="font-medium text-emerald-600">{formatINR(gc)}</span></>}
                  {gp > 0 && <> · personal <span className="font-medium text-slate-600">{formatINR(gp)}</span></>}
                </p>
              </button>
              {!isCollapsed && (
                <div className="space-y-4 mt-2">
                  {itemsByApt.map(([aptId, aptItems]) => {
                    const aptKey = `${month}_${aptId}`;
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
                            {aptItems.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => setDetailId(p.invoiceId)}
                                className={`flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-slate-50/60 ${ledgerAccent(p.ledger)}`}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    <Banknote className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                      <span className="truncate">{paymentTitle(p)}</span>
                                      <LedgerBadge ledger={p.ledger} />
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                      {ownerNameFor(users.data, apartments.data, p.apartmentId)} ·{" "}
                                      {formatDate(p.date)}
                                      {p.reference && ` · ${p.reference}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-sm font-semibold">{formatINR(p.amount)}</span>
                                  <Badge tone="slate">{p.method}</Badge>
                                  {canDelete && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        reverse(p);
                                      }}
                                      disabled={deletingId === p.id}
                                      title="Reverse payment"
                                      className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
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
              {activeCount > 0 ? "Nothing matches these filters." : "No payments recorded."}
            </p>
          </Card>
        )}
      </div>

      {statModal && (
        <Modal
          title={
            selectedStatPaymentInvoiceId
              ? "Invoice Details"
              : statModal === "community"
                ? (mine ? "Maintenance Paid" : "Community Funds Received")
                : (mine ? "Paid to Manager" : "Fees & Reimbursements")
          }
          onClose={selectedStatPaymentInvoiceId ? () => setSelectedStatPaymentInvoiceId(null) : closeStatModal}
        >
          {(() => {
            const rows = confirmed.filter((p) =>
              statModal === "community"
                ? (p.ledger ?? "community") === "community"
                : (p.ledger ?? "community") !== "community"
            );

            if (selectedStatPaymentInvoiceId) {
              const inv = invoices.data?.find((i) => i.id === selectedStatPaymentInvoiceId);
              if (!inv) return <p className="text-sm text-slate-500">Invoice not found.</p>;
              const balance = inv.amount - inv.paidAmount;
              
              return (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedStatPaymentInvoiceId(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    ← Back to {statModal === "community" ? (mine ? "Maintenance Paid" : "Community Funds Received") : (mine ? "Paid to Manager" : "Fees & Reimbursements")}
                  </button>
                  
                  <div className="space-y-2 border-b border-slate-100 pb-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Invoice Details</p>
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
                </div>
              );
            }

            // Group by Month (using monthLabel(p.date))
            const byMonth = new Map<string, number>();
            for (const p of rows) {
              const month = monthLabel(p.date);
              byMonth.set(month, (byMonth.get(month) ?? 0) + p.amount);
            }
            const monthRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

            // Group by Category
            const byCategory = new Map<string, number>();
            for (const p of rows) {
              let cat = "Community Maintenance";
              if (p.ledger === "manager_fee") cat = "Manager Service Fee";
              if (p.ledger === "reimbursement") cat = "Reimbursement";
              byCategory.set(cat, (byCategory.get(cat) ?? 0) + p.amount);
            }
            const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

            if (rows.length === 0)
              return (
                <p className="py-6 text-center text-sm text-slate-400">
                  No payments here yet.
                </p>
              );

            // Group rows by month label for items list
            const itemsByMonth = new Map<string, Payment[]>();
            for (const p of rows) {
              const month = monthLabel(p.date);
              const list = itemsByMonth.get(month) ?? [];
              list.push(p);
              itemsByMonth.set(month, list);
            }
            const itemsByMonthList = [...itemsByMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

            return (
              <div className="space-y-5">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatINR(rows.reduce((sum, p) => sum + p.amount, 0))}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Total Paid
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

                {/* Individual payments grouped by month */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payments (Tap to view invoice)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {itemsByMonthList.map(([month, monthItems]) => {
                      const isCollapsed = collapsedModalPeriods[month] !== false; // collapsed by default
                      const monthTotal = monthItems.reduce((sum, p) => sum + p.amount, 0);
                      
                      return (
                        <div key={month} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setCollapsedModalPeriods(prev => ({ ...prev, [month]: !isCollapsed }))}
                            className="flex w-full items-center justify-between bg-slate-50 px-2 py-1.5 text-2xs font-semibold text-slate-500 rounded hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-slate-600">{month}</span>
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800">
                                Total: {formatINR(monthTotal)}
                              </span>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transform transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                          </button>
                          
                          {!isCollapsed && (
                            <div className="divide-y divide-slate-100 pl-1">
                              {monthItems.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setSelectedStatPaymentInvoiceId(p.invoiceId)}
                                  className="flex justify-between items-start w-full py-2 text-xs hover:bg-slate-50 rounded px-1 transition text-left"
                                >
                                  <div className="min-w-0 mr-2">
                                    <p className="font-medium text-slate-800 hover:text-brand-600 truncate">{paymentTitle(p)}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                      {formatDate(p.date)} · {p.method} {p.reference && `· Ref: ${p.reference}`}
                                    </p>
                                  </div>
                                  <span className="font-semibold shrink-0 ml-2 text-emerald-600">
                                    {formatINR(p.amount)}
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
            Tap a row for the invoice this payment settled.
          </p>
        </Modal>
      )}
      {detailId && (() => {
        const inv = invoices.data?.find((i) => i.id === detailId);
        return inv ? (
          <InvoiceSheet
            invoice={inv}
            payments={payments.data ?? []}
            invoices={invoices.data ?? []}
            users={users.data}
            apartments={apartments.data}
            canWrite={canWrite}
            mine={mine}
            onClose={() => setDetailId(null)}
            onChanged={() => {
              payments.reload();
              invoices.reload();
            }}
            onOpenInvoice={(i) => setDetailId(i.id)}
          />
        ) : null;
      })()}
    </div>
  );
}


export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PaymentsPageInner />
    </Suspense>
  );
}
