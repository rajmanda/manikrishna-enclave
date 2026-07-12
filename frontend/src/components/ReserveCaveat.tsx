"use client";

import { AlertTriangle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { ReserveReconciliation } from "@/lib/types";

/** Fairness note shown wherever the reserve balance appears: when the books
 * have known gaps (collections whose expense was never recorded, or entries
 * booked into an already-closed month), EVERYONE — owners included — sees
 * that the figure is provisional, not just the manager. Renders nothing when
 * the books fully reconcile. */
export function ReserveCaveat({ className = "" }: { className?: string }) {
  const recon = useApi<ReserveReconciliation>("/reserve-fund/reconciliation");
  const d = recon.data;
  if (!d) return null;
  const pendingDrives = d.collectionsWithoutExpense?.length ?? 0;
  const unanchored =
    (d.unanchoredContributions ?? 0) > 0 || (d.unanchoredExpenses ?? 0) > 0;
  if (pendingDrives === 0 && !unanchored) return null;
  return (
    <p
      className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        The reserve figure is provisional —{" "}
        {pendingDrives > 0 && (
          <>
            {pendingDrives === 1
              ? `money was collected for "${d.collectionsWithoutExpense?.[0]?.description}" but its expense hasn't been recorded yet`
              : `money was collected for ${pendingDrives} jobs whose expenses haven't been recorded yet`}
          </>
        )}
        {pendingDrives > 0 && unanchored && ", and "}
        {unanchored && (
          <>some entries were booked into an already-closed month</>
        )}
        . The balance will adjust once the books are completed.
      </span>
    </p>
  );
}
