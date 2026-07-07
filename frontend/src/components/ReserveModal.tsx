"use client";

import Link from "next/link";
import { Modal } from "@/components/Modal";
import type { ReserveFundEntry } from "@/lib/types";
import { formatINR } from "@/lib/format";

/** "How we got this number" — the reserve balance with its month-by-month
 * story, in words a resident doesn't need an accountant to read. */
export function ReserveModal({
  entries,
  onClose,
}: {
  entries: ReserveFundEntry[];
  onClose: () => void;
}) {
  const recent = entries.slice(-6);
  const balance = entries.length ? entries[entries.length - 1].balance : 0;
  return (
    <Modal title="Community Reserve" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-bold text-emerald-600">{formatINR(balance)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            The community&apos;s shared fund as of today
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-4 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Month</span>
            <span className="text-right">Collected</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Balance</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.map((e) => (
              <div
                key={e.month}
                className="grid grid-cols-4 items-center gap-2 px-3 py-2.5 text-xs"
              >
                <span className="font-medium">{e.month}</span>
                <span className="text-right text-emerald-600">
                  +{formatINR(e.contributions)}
                </span>
                <span className="text-right text-red-500">
                  −{formatINR(e.expenses)}
                </span>
                <span className="text-right font-semibold">
                  {formatINR(e.balance)}
                </span>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">
                No reserve history yet.
              </p>
            )}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          The reserve is the money collected from owners minus what the
          community spends. Fees paid personally to the manager are never part
          of it.
        </p>

        <Link
          href="/reserve-fund"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          See the full reserve trend →
        </Link>
      </div>
    </Modal>
  );
}
