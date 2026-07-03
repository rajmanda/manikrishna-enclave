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
import type { MonthlyFinance } from "@/lib/types";
import { Card, PageTitle } from "@/components/ui";
import { CashFlowChart } from "@/components/charts";

const periods = ["Monthly", "Quarterly", "Yearly"] as const;

const reports = [
  { icon: Wallet, title: "Collection Report", desc: "Invoices raised vs collected per apartment" },
  { icon: Receipt, title: "Expense Report", desc: "Category-wise spend with vendor details" },
  { icon: BarChart3, title: "Cash Flow", desc: "Income vs expense trend" },
  { icon: PiggyBank, title: "Reserve Fund", desc: "Contributions, withdrawals and balance" },
  { icon: Store, title: "Vendor Spend", desc: "Total paid per vendor with contracts" },
  { icon: FileText, title: "Outstanding Dues", desc: "Ageing summary of unpaid invoices" },
  { icon: Users, title: "Owner Ledger", desc: "Full transaction ledger per owner" },
  { icon: FileSpreadsheet, title: "Apartment Ledger", desc: "Charges and payments per apartment" },
  { icon: FileText, title: "Audit Report", desc: "Complete audit trail of modifications" },
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
        {reports.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
              <div className="mt-2.5 flex gap-2">
                <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Download className="h-3 w-3" /> PDF
                </button>
                <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <FileSpreadsheet className="h-3 w-3" /> CSV
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
