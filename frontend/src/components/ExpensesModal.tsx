"use client";

import Link from "next/link";
import { Modal } from "@/components/Modal";
import type { Expense } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { Badge } from "@/components/ui";

export function ExpensesModal({
  title,
  expenses,
  onClose,
  moreHref,
  moreLabel,
}: {
  title: string;
  expenses: Expense[];
  onClose: () => void;
  moreHref?: string;
  moreLabel?: string;
}) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <Modal title={title} onClose={onClose}>
      {expenses.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No expenses recorded here.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.description}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <Badge tone="slate">{e.category}</Badge>
                  {formatDate(e.paidDate)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatINR(e.amount)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3">
            <p className="text-sm font-bold">
              Total ({expenses.length} item{expenses.length === 1 ? "" : "s"})
            </p>
            <p className="text-sm font-bold">{formatINR(total)}</p>
          </div>
        </div>
      )}
      {moreHref && (
        <Link
          href={moreHref}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          {moreLabel ?? "See more"} →
        </Link>
      )}
    </Modal>
  );
}
