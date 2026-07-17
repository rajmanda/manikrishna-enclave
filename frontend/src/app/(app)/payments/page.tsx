"use client";

import { Suspense, useState } from "react";
import { Banknote, Check, ChevronDown, PiggyBank, Trash2, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { useSessionUser } from "@/context/AuthContext";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar } from "@/components/FilterBar";
import type { Account, Apartment, CreditEntry, Invoice, Payment, User } from "@/lib/types";
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
  const credits = useApi<CreditEntry[]>("/credits");
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

  // Pending rows that arrived as ONE reported transfer share a batch id —
  // the manager confirms or rejects them as a unit.
  const pendingBatches = (() => {
    const map = new Map<string, Payment[]>();
    for (const p of pending) {
      if (p.batchId) {
        const rows = map.get(p.batchId) ?? [];
        rows.push(p);
        map.set(p.batchId, rows);
      }
    }
    return [...map.entries()];
  })();
  const pendingSingles = pending.filter((p) => !p.batchId);
  const pendingCreditByBatch = new Map<string, number>();
  for (const cr of credits.data ?? []) {
    if (cr.status === "pending" && cr.batchId) {
      pendingCreditByBatch.set(
        cr.batchId, (pendingCreditByBatch.get(cr.batchId) ?? 0) + cr.remaining
      );
    }
  }
  // Spendable advance credit per apartment (manager card).
  const creditByApt = new Map<string, number>();
  for (const cr of credits.data ?? []) {
    if (cr.status === "confirmed" && cr.remaining > 0) {
      creditByApt.set(cr.apartmentId, (creditByApt.get(cr.apartmentId) ?? 0) + cr.remaining);
    }
  }
  // What credit can actually land on: open invoices WITHOUT a pending claim
  // (matches the server's apply-credit rule).
  const claimedInvoiceIds = new Set(pending.map((p) => p.invoiceId));
  const openByApt = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
    const due = inv.amount - inv.paidAmount;
    if (due > 0 && !claimedInvoiceIds.has(inv.id))
      openByApt.set(inv.apartmentId, (openByApt.get(inv.apartmentId) ?? 0) + due);
  }

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
    let reason = "";
    if (action === "reject") {
      const input = prompt(
        `Reject the reported payment of ${formatINR(p.amount)}?\n\nReason for rejection (shown to the owner):`
      );
      if (input === null) return; // cancelled
      reason = input.trim();
    }
    try {
      await api(`/payments/${p.id}/${action}`, {
        method: "POST",
        ...(action === "reject" ? { body: JSON.stringify({ reason }) } : {}),
      });
      payments.reload();
      invoices.reload();
      credits.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function actBatch(batchId: string, rows: Payment[], action: "confirm" | "reject") {
    const total = rows.reduce((s, p) => s + p.amount, 0);
    const label = `${rows.length} payment${rows.length > 1 ? "s" : ""} totaling ${formatINR(total)}`;
    const batchCredit = pendingCreditByBatch.get(batchId) ?? 0;
    const creditNote =
      batchCredit > 0
        ? `\n\nNote: this discards the claim's ${formatINR(batchCredit)} advance credit too.`
        : "";
    let reason = "";
    if (action === "reject") {
      const input = prompt(
        `Reject the reported ${label}?${creditNote}\n\nReason for rejection (shown to the owner):`
      );
      if (input === null) return; // cancelled
      reason = input.trim();
    }
    if (action === "confirm" && !confirm(`Confirm ${label} in one go?`)) return;
    try {
      await api(`/payments/batch/${batchId}/${action}`, {
        method: "POST",
        ...(action === "reject" ? { body: JSON.stringify({ reason }) } : {}),
      });
      payments.reload();
      invoices.reload();
      credits.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function applyCredit(apartmentId: string, balance: number) {
    // Credit is pooled per account — settle dues across ALL of the
    // account's apartments, not just the one holding the credit.
    const acct = (accounts.data ?? []).find((a) => a.apartmentIds.includes(apartmentId));
    const targets = acct?.apartmentIds ?? [apartmentId];
    const pool0 = targets.reduce((s, a) => s + (creditByApt.get(a) ?? 0), 0) || balance;
    const dues = targets.reduce((s, a) => s + (openByApt.get(a) ?? 0), 0);
    const usable = Math.min(pool0, dues);
    if (usable <= 0) return;
    if (!confirm(`Apply ${formatINR(usable)} of advance credit to the account's open dues (oldest first)?`)) return;
    try {
      let pool = usable;
      for (const apt of targets) {
        if (pool <= 0) break;
        const slice = Math.min(pool, openByApt.get(apt) ?? 0);
        if (slice <= 0) continue;
        await api("/payments/apply-credit", {
          method: "POST",
          body: JSON.stringify({ apartmentId: apt, amount: slice }),
        });
        pool -= slice;
      }
      payments.reload();
      invoices.reload();
      credits.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not apply credit");
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
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-700">
            Awaiting confirmation ({pending.length})
          </h2>

          {/* Combined claims first: one transfer covering several invoices —
              confirm or reject the whole thing in one action. */}
          {pendingBatches.map(([batchId, rows]) => {
            const total = rows.reduce((s, p) => s + p.amount, 0);
            const excess = pendingCreditByBatch.get(batchId) ?? 0;
            const first = rows[0];
            return (
              <Card key={batchId} className="border-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/50 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      One payment · {formatINR(total + excess)} covering {rows.length} invoice{rows.length > 1 ? "s" : ""}
                      {excess > 0 && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          + {formatINR(excess)} advance credit
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {ownerNameFor(users.data, apartments.data, first.apartmentId)} ·{" "}
                      {first.method} · {formatDate(first.date)}
                      {first.reference && ` · ref ${first.reference}`}
                    </p>
                  </div>
                  {canWrite ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => actBatch(batchId, rows, "confirm")}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm all
                      </button>
                      <button
                        onClick={() => actBatch(batchId, rows, "reject")}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject all
                      </button>
                    </div>
                  ) : (
                    <Badge tone="amber">awaiting manager confirmation</Badge>
                  )}
                </div>
                <div className="divide-y divide-amber-50">
                  {rows.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setDetailId(p.invoiceId)}
                      className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-amber-50/40 ${ledgerAccent(p.ledger)}`}
                    >
                      <p className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
                        {paymentTitle(p)}
                        <LedgerBadge ledger={p.ledger} />
                      </p>
                      <span className="shrink-0 text-xs font-semibold">{formatINR(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          {pendingSingles.length > 0 && (
            <Card className="divide-y divide-amber-100 border-amber-200">
              {pendingSingles.map((p) => (
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
          )}
        </div>
      )}

      {/* Advance credits held per apartment (money received beyond dues). */}
      {!mine && creditByApt.size > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-violet-700">
            Advance credits held
          </h2>
          <Card className="divide-y divide-violet-100 border-violet-200">
            {[...creditByApt.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([aptId, balance]) => {
                // Credit serves the whole account, so dues are counted
                // across every apartment the account holds.
                const acct = (accounts.data ?? []).find((a) => a.apartmentIds.includes(aptId));
                const targets = acct?.apartmentIds ?? [aptId];
                const accountDue = targets.reduce((s, a) => s + (openByApt.get(a) ?? 0), 0);
                return (
                  <div key={aptId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <PiggyBank className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          Apt {aptNumber(aptId)} · {ownerNameFor(users.data, apartments.data, aptId)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {accountDue > 0
                            ? `${formatINR(accountDue)} currently due across the account`
                            : "Nothing due — credit stays banked"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-violet-700">{formatINR(balance)}</span>
                      {canWrite && accountDue > 0 && (
                        <button
                          onClick={() => applyCredit(aptId, balance)}
                          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          Apply to dues
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
