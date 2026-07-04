"use client";

import { useApi } from "@/hooks/useApi";
import type { AuditEntry } from "@/lib/types";
import { Badge, Card, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

const actionTone = { create: "green", update: "blue", delete: "red" } as const;

export default function AuditPage() {
  const entries = useApi<AuditEntry[]>("/audit-log?limit=200");

  if (entries.error)
    return <ErrorNote message={entries.error} onRetry={entries.reload} />;
  if (entries.loading || !entries.data) return <PageLoading />;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Audit Log"
        subtitle="Every modification, by whom, when — the transparency backbone"
      />
      <Card className="divide-y divide-slate-100">
        {entries.data.map((e) => (
          <div key={e.id} className="flex items-start gap-3 p-4">
            <Badge tone={actionTone[e.action as keyof typeof actionTone] ?? "slate"}>
              {e.action}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700">
                <span className="font-medium">{e.userName}</span>{" "}
                {e.action}d{" "}
                <span className="font-medium">{e.entity.replace("_", " ")}</span>{" "}
                <span className="text-slate-400">({e.entityId})</span>
              </p>
              {Object.keys(e.details).length > 0 && (
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {JSON.stringify(e.details)}
                </p>
              )}
            </div>
            <p className="shrink-0 text-xs text-slate-400">
              {e.timestamp.slice(0, 16).replace("T", " ")}
            </p>
          </div>
        ))}
        {entries.data.length === 0 && (
          <p className="p-5 text-center text-sm text-slate-400">No entries yet.</p>
        )}
      </Card>
    </div>
  );
}
