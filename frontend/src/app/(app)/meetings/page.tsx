"use client";

import { FileText, Mic, Users } from "lucide-react";
import { meetings } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { apartments } from "@/lib/data";
import { Badge, Card, PageTitle } from "@/components/ui";

export default function MeetingsPage() {
  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle
        title="Meeting Minutes"
        subtitle="Agendas, attendance, resolutions and recordings"
      />
      {sorted.map((m) => {
        const upcoming = m.resolutions.length === 0;
        return (
          <Card key={m.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={upcoming ? "blue" : "slate"}>
                {upcoming ? "Upcoming" : "Held"}
              </Badge>
              <span className="text-xs text-slate-400">{formatDate(m.date)}</span>
              {!upcoming && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3 w-3" /> {m.attendance}/{apartments.length} attended
                </span>
              )}
            </div>
            <h2 className="mt-2 text-base font-semibold">{m.title}</h2>

            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Agenda
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-600">
                {m.agenda.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>

            {m.resolutions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Resolutions
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {m.resolutions.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {(m.hasPdf || m.hasAudio) && (
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                {m.hasPdf && (
                  <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> Minutes PDF
                  </button>
                )}
                {m.hasAudio && (
                  <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    <Mic className="h-3.5 w-3.5" /> Audio recording
                  </button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
