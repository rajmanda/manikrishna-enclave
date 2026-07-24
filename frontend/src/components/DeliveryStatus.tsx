"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type {
  DeliveryFailureSummary,
  NotificationAgentHealth,
  NotificationQueueEntry,
} from "@/lib/types";
import { Badge } from "@/components/ui";

/** Roles that may see delivery internals — mirrors backend WRITE_ROLES. */
export const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

/** Retry every listed notification; a 409 means someone else already resent
 * that row — skip it rather than abort the batch. */
async function resendAll(notificationIds: string[]): Promise<void> {
  for (const id of notificationIds) {
    try {
      await api(`/notification-queue/${id}/retry`, { method: "POST" });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
    }
  }
}

/** One delivery-summary fetch per page. Pass enabled=false for non-manager
 * roles — no request is made and the map stays empty. Errors are swallowed:
 * a broken summary must never break the host page. */
export function useDeliveryFailures(
  enabled: boolean,
  relatedType?: string
): {
  map: Map<string, DeliveryFailureSummary>;
  all: DeliveryFailureSummary[];
  reload: () => void;
} {
  const path = enabled
    ? `/notification-queue/delivery-summary${relatedType ? `?related_type=${relatedType}` : ""}`
    : null;
  const { data, reload } = useApi<DeliveryFailureSummary[]>(path);
  const map = useMemo(() => {
    const m = new Map<string, DeliveryFailureSummary>();
    for (const f of data ?? []) m.set(`${f.relatedType}:${f.relatedId}`, f);
    return m;
  }, [data]);
  return { map, all: data ?? [], reload };
}

/** The poller checks in every 15s — a gap this long means it's down. */
const AGENT_STALE_MS = 5 * 60 * 1000;

/** Amber strip shown to managers (in AppShell, above the page content) when
 * the OpenClaw delivery agent has stopped polling while messages are queued.
 * Distinguishes "the delivery pipe is down" from per-message failures — a dead
 * agent can't report failures, so without this nobody would ever know.
 * Renders nothing for non-managers (no request made) or when all is well. */
export function DeliveryAgentBanner() {
  const { role } = useSessionUser();
  const enabled = WRITER_ROLES.includes(role);
  const { data, reload } = useApi<NotificationAgentHealth>(
    enabled ? "/notification-queue/health" : null
  );
  // AppShell mounts once per session — re-check every minute so the banner
  // appears/clears without a page reload.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [enabled, reload]);

  if (!enabled || !data) return null;
  const queued = data.pendingCount + data.processingCount;
  const lastPoll = data.agentLastPollAt ? Date.parse(data.agentLastPollAt) : null;
  const agentDown = lastPoll === null || Date.now() - lastPoll > AGENT_STALE_MS;
  if (!agentDown || queued === 0) return null;

  const since =
    lastPoll === null
      ? "has never checked in"
      : `hasn't checked in for ${formatGap(Date.now() - lastPoll)}`;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p>
        <span className="font-semibold">WhatsApp delivery is paused</span> — the
        delivery agent {since}. {queued} message{queued > 1 ? "s are" : " is"}{" "}
        waiting and will send once it&apos;s back. Resending won&apos;t help until then.
      </p>
    </div>
  );
}

function formatGap(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)} days`;
}

/** Subtle red chip shown next to an entity's status badges when its outbound
 * notification(s) failed to deliver. Renders nothing when there's no failure. */
export function DeliveryFailureBadge({
  failure,
  onResent,
}: {
  failure: DeliveryFailureSummary | undefined;
  onResent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!failure) return null;

  async function resend(e: React.MouseEvent) {
    // Badges sit inside <Link>-wrapped cards — don't navigate.
    e.preventDefault();
    e.stopPropagation();
    if (busy || !failure) return;
    setBusy(true);
    try {
      await resendAll(failure.notificationIds);
      onResent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span title={failure.lastErrorMessage ?? "Delivery failed"}>
      <Badge tone="red">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {failure.failedCount > 1
          ? `${failure.failedCount} not delivered`
          : "Not delivered"}
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="ml-1.5 inline-flex items-center gap-0.5 font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Resending…" : "Resend"}
        </button>
      </Badge>
    </span>
  );
}

/** Detail-page panel listing each failed notification for one entity, with
 * per-row Resend and a Resend-all. Renders nothing when deliveries are fine.
 * Caller gates by role (WRITER_ROLES) — the backend enforces it too. */
export function DeliveryFailurePanel({
  relatedType,
  relatedId,
}: {
  relatedType: string;
  relatedId: string;
}) {
  const { data, reload } = useApi<NotificationQueueEntry[]>(
    `/notification-queue?related_type=${relatedType}&related_id=${relatedId}&status=failed`
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!data || data.length === 0) return null;

  async function resend(ids: string[], busyKey: string) {
    if (busyId) return;
    setBusyId(busyKey);
    try {
      await resendAll(ids);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
          <AlertTriangle className="h-4 w-4" />
          {data.length > 1
            ? `${data.length} notifications were not delivered`
            : "A notification was not delivered"}
        </p>
        {data.length > 1 && (
          <button
            type="button"
            onClick={() => resend(data.map((n) => n.notificationId), "__all__")}
            disabled={busyId !== null}
            className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
          >
            {busyId === "__all__" ? "Resending…" : "Resend all"}
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {data.map((n) => (
          <li
            key={n.notificationId}
            className="flex items-center justify-between gap-3 text-xs text-red-700"
          >
            <span className="min-w-0 truncate">
              {n.recipientName} · {n.channel}
              {n.errorMessage ? ` — ${n.errorMessage}` : ""}
              <span className="text-red-400">
                {" "}
                ({n.retryCount}/{n.maxRetries} attempts)
              </span>
            </span>
            <button
              type="button"
              onClick={() => resend([n.notificationId], n.notificationId)}
              disabled={busyId !== null}
              className="shrink-0 font-semibold underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
            >
              {busyId === n.notificationId ? "Resending…" : "Resend"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
