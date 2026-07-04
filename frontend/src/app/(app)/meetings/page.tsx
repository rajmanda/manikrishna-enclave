"use client";

import { useRef, useState } from "react";
import { FileText, PlusCircle, Upload, Users } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, apiUpload, downloadFile } from "@/lib/api";
import type { Apartment, Meeting } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Badge, Card, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function MeetingDialog({
  meeting,
  onClose,
  onDone,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [date, setDate] = useState(meeting?.date ?? "");
  const [attendance, setAttendance] = useState(String(meeting?.attendance ?? 0));
  const [agenda, setAgenda] = useState((meeting?.agenda ?? []).join("\n"));
  const [resolutions, setResolutions] = useState((meeting?.resolutions ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title,
      date,
      attendance: Number(attendance),
      agenda: agenda.split("\n").map((a) => a.trim()).filter(Boolean),
      resolutions: resolutions.split("\n").map((r) => r.trim()).filter(Boolean),
    };
    try {
      if (meeting) {
        await api(`/meetings/${meeting.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/meetings", { method: "POST", body: JSON.stringify(body) });
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
      setBusy(false);
    }
  }

  return (
    <Modal title={meeting ? "Edit Meeting" : "New Meeting"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Attendance</label>
            <input type="number" min="0" className={inputCls} value={attendance} onChange={(e) => setAttendance(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Agenda (one item per line)</label>
          <textarea rows={3} className={inputCls} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Resolutions (one per line, blank if upcoming)</label>
          <textarea rows={3} className={inputCls} value={resolutions} onChange={(e) => setResolutions(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !title.trim() || !date} className={primaryBtnCls}>
          {busy ? "Saving…" : meeting ? "Save changes" : "Create (members are notified)"}
        </button>
      </form>
    </Modal>
  );
}

function MinutesUpload({ meeting, onDone }: { meeting: Meeting; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      await apiUpload(`/meetings/${meeting.id}/minutes`, file);
      onDone();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : meeting.hasPdf ? "Replace minutes" : "Upload minutes PDF"}
      </button>
    </>
  );
}

export default function MeetingsPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const meetings = useApi<Meeting[]>("/meetings");
  const apartments = useApi<Apartment[]>("/apartments");
  const [dialog, setDialog] = useState<{ open: boolean; meeting: Meeting | null }>({
    open: false,
    meeting: null,
  });

  if (meetings.error)
    return <ErrorNote message={meetings.error} onRetry={meetings.reload} />;
  if (meetings.loading || !meetings.data) return <PageLoading />;

  const total = apartments.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle
        title="Meeting Minutes"
        subtitle="Agendas, attendance, resolutions and recordings"
        actions={
          canWrite ? (
            <button
              onClick={() => setDialog({ open: true, meeting: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> New meeting
            </button>
          ) : undefined
        }
      />
      {meetings.data.map((m) => {
        const upcoming = m.resolutions.length === 0;
        return (
          <Card key={m.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={upcoming ? "blue" : "slate"}>
                {upcoming ? "Upcoming" : "Held"}
              </Badge>
              <span className="text-xs text-slate-400">{formatDate(m.date)}</span>
              {!upcoming && total > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3 w-3" /> {m.attendance}/{total} attended
                </span>
              )}
              {canWrite && (
                <button
                  onClick={() => setDialog({ open: true, meeting: m })}
                  className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Edit
                </button>
              )}
            </div>
            <h2 className="mt-2 text-base font-semibold">{m.title}</h2>

            {m.agenda.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Agenda
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {m.agenda.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            )}

            {m.resolutions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Resolutions
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {m.resolutions.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {m.hasPdf && (
                <button
                  onClick={() => downloadFile(`/meetings/${m.id}/minutes`, `${m.title}-minutes.pdf`)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5" /> Minutes PDF
                </button>
              )}
              {canWrite && <MinutesUpload meeting={m} onDone={meetings.reload} />}
            </div>
          </Card>
        );
      })}

      {dialog.open && (
        <MeetingDialog
          meeting={dialog.meeting}
          onClose={() => setDialog({ open: false, meeting: null })}
          onDone={meetings.reload}
        />
      )}
    </div>
  );
}
