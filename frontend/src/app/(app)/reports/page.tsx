"use client";

import { useState } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  PiggyBank,
  Receipt,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { downloadFile } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { MonthlyFinance } from "@/lib/types";
import { Badge, Card, PageTitle } from "@/components/ui";
import { CashFlowChart } from "@/components/charts";

const periods = ["Monthly", "Quarterly", "Yearly"] as const;

interface MoneyHealthData {
  openCostCases: { id: string; title: string; billed: number; collected: number; outstanding: number; actualCost: number; surplus: number; shortfall: number }[];
  workOrdersAwaitingExpense: { id: string; title: string; finalCost?: number | null }[];
  draftVendorBills: { id: string; description: string; amount: number; costCaseId?: string | null }[];
  outstandingAssessments: { invoiceId: string; description: string; balance: number }[];
}

/** The worklists that keep the books from closing — live, with links. */
function MoneyHealth() {
  const health = useApi<MoneyHealthData>("/reports/money-health");
  const d = health.data;
  if (!d) return null;
  const clean =
    d.openCostCases.length === 0 &&
    d.workOrdersAwaitingExpense.length === 0 &&
    d.draftVendorBills.length === 0;
  if (clean) return null;
  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold">Money health — needs attention</h2>
      <p className="mb-3 text-xs text-slate-400">
        Live worklists: what's keeping the books from closing.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Open cost cases ({d.openCostCases.length})
          </h3>
          <div className="space-y-1.5">
            {d.openCostCases.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/cost-cases/${c.id}`} className="block rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">
                <span className="font-medium">{c.title}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-slate-500">
                  {c.outstanding > 0 && <span className="text-red-600">{formatINR(c.outstanding)} owed</span>}
                  {c.shortfall > 0 && <span className="text-amber-600">{formatINR(c.shortfall)} from reserve</span>}
                  {c.surplus > 0 && <span className="text-emerald-600">{formatINR(c.surplus)} surplus</span>}
                  {c.actualCost === 0 && c.collected > 0 && <Badge tone="amber">no expense posted</Badge>}
                </span>
              </Link>
            ))}
            {d.openCostCases.length === 0 && <p className="text-xs text-slate-400">None — all closed.</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Jobs missing their expense ({d.workOrdersAwaitingExpense.length})
          </h3>
          <div className="space-y-1.5">
            {d.workOrdersAwaitingExpense.slice(0, 5).map((w) => (
              <Link key={w.id} href={`/work-orders/${w.id}`} className="block rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">
                <span className="font-medium">{w.title}</span>
                {w.finalCost != null && <span className="ml-2 text-slate-500">{formatINR(w.finalCost)}</span>}
              </Link>
            ))}
            {d.workOrdersAwaitingExpense.length === 0 && <p className="text-xs text-slate-400">All completed jobs have expenses.</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Draft vendor bills ({d.draftVendorBills.length})
          </h3>
          <div className="space-y-1.5">
            {d.draftVendorBills.slice(0, 5).map((b) => (
              <Link
                key={b.id}
                href={b.costCaseId ? `/cost-cases/${b.costCaseId}` : "/expenses"}
                className="block rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50"
              >
                <span className="font-medium">{b.description}</span>
                <span className="ml-2 text-slate-500">{formatINR(b.amount)} · awaiting posting</span>
              </Link>
            ))}
            {d.draftVendorBills.length === 0 && <p className="text-xs text-slate-400">Nothing awaiting review.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

const reports: { icon: typeof Wallet; title: string; desc: string; pdf?: string; csv?: string }[] = [
  { icon: Wallet, title: "Collection Report", desc: "Billed vs collected per apartment", pdf: "/reports/collection.pdf" },
  { icon: Receipt, title: "Expense Report", desc: "Category totals plus every entry", pdf: "/reports/expenses.pdf" },
  { icon: Store, title: "Vendor Spend", desc: "Total paid per vendor", pdf: "/reports/vendor-spend.pdf" },
  { icon: FileSpreadsheet, title: "Invoices Export", desc: "All invoices, role-scoped", csv: "/invoices/export.csv" },
  { icon: BarChart3, title: "Cash Flow", desc: "Income vs expense trend (chart above)" },
  { icon: PiggyBank, title: "Reserve Fund", desc: "See the Reserve Fund page for trend and history" },
  { icon: FileText, title: "Owner / Apartment Ledger", desc: "Use Statement PDF on the Invoices page" },
  { icon: Users, title: "Audit Report", desc: "See the Audit Log page" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("Monthly");
  const monthly = useApi<MonthlyFinance[]>("/finance/monthly");

  return (
    <div className="space-y-5">
      <PageTitle title="Reports" subtitle="Download as PDF or export CSV" />

      <MoneyHealth />

      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              period === p
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Cash Flow Preview — {period}</h2>
        {monthly.data && <CashFlowChart data={monthly.data} />}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(({ icon: Icon, title, desc, pdf, csv }) => (
          <Card key={title} className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
              <div className="mt-2.5 flex gap-2">
                {pdf && (
                  <button
                    onClick={() => downloadFile(pdf, `${title.toLowerCase().replace(/ /g, "-")}.pdf`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                )}
                {csv && (
                  <button
                    onClick={() => downloadFile(csv, "invoices.csv")}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-3 w-3" /> CSV
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
