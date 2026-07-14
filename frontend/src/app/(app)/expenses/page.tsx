"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import type { Apartment, Expense, Vendor } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { currentMonthLabel } from "@/lib/format";
import {
  AddExpenseDialog,
  ExpenseLedger,
  ReceiptActions,
  expenseMonthLabel,
} from "@/components/expenses";
import { Modal } from "@/components/Modal";
import { Badge, ErrorNote, PageLoading, PageTitle, Stat } from "@/components/ui";
import { formatDate } from "@/lib/format";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function ExpensesPageInner() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const expenses = useApi<Expense[]>("/expenses");
  const vendors = useApi<Vendor[]>("/vendors");
  const apartments = useApi<Apartment[]>("/apartments");
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<"month" | "category">("month");
  const [statModal, setStatModal] = useState<"month" | "all" | "receipts" | null>(null);

  // Quick actions deep-link: /expenses?add=1 opens the dialog straight away.
  const router = useRouter();
  const searchParams = useSearchParams();
  const consumedAdd = useRef(false);
  useEffect(() => {
    if (canWrite && !consumedAdd.current && searchParams.get("add")) {
      consumedAdd.current = true;
      setAddOpen(true);
      router.replace("/expenses");
    }
  }, [canWrite, searchParams, router]);

  if (expenses.error)
    return <ErrorNote message={expenses.error} onRetry={expenses.reload} />;
  if (expenses.loading || !expenses.data) return <PageLoading />;

  const list = expenses.data;
  const thisMonth = expenseMonthLabel(new Date().toISOString().slice(0, 10));
  const monthTotal = list
    .filter((e) => expenseMonthLabel(e.paidDate) === thisMonth)
    .reduce((s, e) => s + e.amount, 0);
  const missingReceipts = list.filter((e) => !e.hasReceipt).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Expenses"
        subtitle="Every rupee spent from community funds"
        actions={
          canWrite ? (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> Add expense
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label={`Spent (${currentMonthLabel()})`}
          value={formatINR(monthTotal)}
          tone="negative"
          hint="Tap for the line items"
          onClick={() => setStatModal("month")}
        />
        <Stat
          label="All-time"
          value={formatINR(list.reduce((s, e) => s + e.amount, 0))}
          hint="Tap for every expense"
          onClick={() => setStatModal("all")}
        />
        <Stat
          label="Missing receipts"
          value={String(missingReceipts)}
          tone={missingReceipts > 0 ? "negative" : "positive"}
          hint={missingReceipts > 0 ? "Tap to attach them now" : "All documented"}
          onClick={missingReceipts > 0 ? () => setStatModal("receipts") : undefined}
        />
      </div>

      {statModal && (
        <Modal
          title={
            statModal === "month"
              ? `Spent in ${currentMonthLabel()}`
              : statModal === "all"
                ? "All expenses"
                : "Missing receipts"
          }
          onClose={() => setStatModal(null)}
        >
          {(() => {
            const rows = [...list]
              .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
              .filter((e) =>
                statModal === "month"
                  ? expenseMonthLabel(e.paidDate) === thisMonth
                  : statModal === "receipts"
                    ? !e.hasReceipt
                    : true
              );
            if (rows.length === 0)
              return <p className="py-6 text-center text-sm text-slate-400">Nothing here.</p>;
            return (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {statModal === "receipts" && (
                  <p className="text-xs text-slate-500">
                    These expenses have no supporting receipt — attach a photo or
                    PDF right here to keep the books audit-ready.
                  </p>
                )}
                {rows.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{e.description}</p>
                          <Badge tone="slate">{e.category}</Badge>
                          {e.status === "draft" && <Badge tone="violet">draft</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">Paid {formatDate(e.paidDate)}</p>
                        {statModal === "receipts" && (
                          <ReceiptActions expense={e} canWrite={canWrite} onChanged={expenses.reload} />
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatINR(e.amount)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-1 pt-2">
                  <p className="text-sm font-bold">Total</p>
                  <p className="text-sm font-bold">
                    {formatINR(rows.reduce((s, e) => s + e.amount, 0))}
                  </p>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      <div className="flex items-center justify-end">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {(["month", "category"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                view === v ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "month" ? "By month" : "By category"}
            </button>
          ))}
        </div>
      </div>

      <ExpenseLedger
        expenses={list}
        vendors={vendors.data}
        apartmentCount={apartments.data?.length ?? 0}
        canWrite={canWrite}
        view={view}
        onChanged={expenses.reload}
      />

      {addOpen && (
        <AddExpenseDialog
          vendors={vendors.data}
          onClose={() => setAddOpen(false)}
          onDone={expenses.reload}
        />
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ExpensesPageInner />
    </Suspense>
  );
}
