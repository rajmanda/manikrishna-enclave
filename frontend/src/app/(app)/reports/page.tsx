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
import { useApi } from "@/hooks/useApi";
import { downloadFile } from "@/lib/api";
import type { MonthlyFinance } from "@/lib/types";
import { Card, PageTitle } from "@/components/ui";
import { CashFlowChart } from "@/components/charts";

const periods = ["Monthly", "Quarterly", "Yearly"] as const;

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
