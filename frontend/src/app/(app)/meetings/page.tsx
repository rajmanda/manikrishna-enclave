"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, PlusCircle, Search, Trash2, Upload, Users } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, apiUpload, downloadFile } from "@/lib/api";
import type { Apartment, Meeting, User } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ownerNameFor } from "@/lib/lookup";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Badge, Card, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function MeetingDialog({
  meeting,
  apartments,
  users,
  onClose,
  onDone,
}: {
  meeting: Meeting | null;
  apartments: Apartment[] | undefined;
  users: User[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [date, setDate] = useState(meeting?.date ?? "");
  const [attendance, setAttendance] = useState(String(meeting?.attendance ?? 0));
  const [attendees, setAttendees] = useState<string[]>(meeting?.attendees ?? []);
  const [agenda, setAgenda] = useState((meeting?.agenda ?? []).join("\n"));
  const [resolutions, setResolutions] = useState((meeting?.resolutions ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-sync attendance count with attendees length
  useEffect(() => {
    setAttendance(String(attendees.length));
  }, [attendees]);

  const sortedApartments = [...(apartments ?? [])].sort((a, b) =>
    a.number.localeCompare(b.number)
  );

  const filteredApartments = sortedApartments.filter((apt) => {
    const num = apt.number.toLowerCase();
    const owner = ownerNameFor(users, apartments, apt.id).toLowerCase();
    const term = search.toLowerCase();
    return num.includes(term) || owner.includes(term);
  });

  function toggleAttendee(id: string) {
    setAttendees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setAttendees(sortedApartments.map((a) => a.id));
  }

  function selectNone() {
    setAttendees([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title,
      date,
      attendance: Number(attendance),
      attendees,
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
          <div className="relative" ref={dropdownRef}>
            <label className={labelCls}>Attendees ({attendees.length} selected)</label>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`${inputCls} flex items-center justify-between bg-white text-left text-sm`}
            >
              <span className="truncate text-slate-700">
                {attendees.length === 0
                  ? "Select apartments..."
                  : attendees.length === sortedApartments.length
                  ? "All apartments"
                  : `${attendees.length} apartment${attendees.length === 1 ? "" : "s"}`}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>

            {isOpen && (
              <div className="absolute z-50 mt-1.5 w-72 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl ring-1 ring-black/5">
                <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search apartments or owners..."
                    className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="flex gap-2 mb-2 px-1">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[10px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Select All
                  </button>
                  <span className="text-[10px] text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-600"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                  {filteredApartments.map((apt) => {
                    const isSelected = attendees.includes(apt.id);
                    const owner = ownerNameFor(users, apartments, apt.id);
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => toggleAttendee(apt.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <div className="truncate">
                          <div>Apt {apt.number}</div>
                          {owner !== "—" && (
                            <div className={`text-[10px] truncate ${isSelected ? "text-brand-500" : "text-slate-400"}`}>
                              {owner}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="h-4 w-4 rounded bg-brand-600 text-white flex items-center justify-center shrink-0">
                            <span className="text-[10px] leading-none">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filteredApartments.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No matching apartments.
                    </div>
                  )}
                </div>
              </div>
            )}
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
  const canDelete = role === "super_admin";
  const meetings = useApi<Meeting[]>("/meetings");
  const apartments = useApi<Apartment[]>("/apartments");
  const users = useApi<User[]>("/users");
  const [dialog, setDialog] = useState<{ open: boolean; meeting: Meeting | null }>({
    open: false,
    meeting: null,
  });

  async function handleDelete(m: Meeting) {
    if (!confirm(`Delete meeting: "${m.title}" (${formatDate(m.date)})?\n\nThis cannot be undone.`)) return;
    try {
      await api(`/meetings/${m.id}`, { method: "DELETE" });
      meetings.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete meeting");
    }
  }

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
              {canDelete && (
                <button
                  onClick={() => handleDelete(m)}
                  title="Delete meeting (super admin only)"
                  className={`${canWrite ? "" : "ml-auto"} inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-red-500`}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
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

            {m.attendees && m.attendees.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Attendees
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.attendees.map((aptId) => {
                    const apt = apartments.data?.find((a) => a.id === aptId);
                    const owner = ownerNameFor(users.data, apartments.data, aptId);
                    return (
                      <span
                        key={aptId}
                        className="inline-flex items-center rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10"
                      >
                        Apt {apt ? apt.number : aptId.replace("apt-", "")}
                        {owner !== "—" && <span className="ml-1 text-[10px] text-slate-400">({owner})</span>}
                      </span>
                    );
                  })}
                </div>
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
          apartments={apartments.data}
          users={users.data}
          onClose={() => setDialog({ open: false, meeting: null })}
          onDone={meetings.reload}
        />
      )}
    </div>
  );
}
