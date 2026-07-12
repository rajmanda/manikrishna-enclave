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
  expenseMonthLabel,
} from "@/components/expenses";
import { ErrorNote, PageLoading, PageTitle, Stat } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function ExpensesPageInner() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const expenses = useApi<Expense[]>("/expenses");
  const vendors = useApi<Vendor[]>("/vendors");
  const apartments = useApi<Apartment[]>("/apartments");
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<"month" | "category">("month");

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
        />
        <Stat label="All-time" value={formatINR(list.reduce((s, e) => s + e.amount, 0))} />
        <Stat
          label="Missing receipts"
          value={String(missingReceipts)}
          tone={missingReceipts > 0 ? "negative" : "positive"}
          hint={missingReceipts > 0 ? "Attach from the ledger below" : "All documented"}
        />
      </div>

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
