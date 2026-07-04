"use client";

import { useState } from "react";
import { Globe, Lock, Plus } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { MaintenanceRequest, User } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { userName } from "@/lib/lookup";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];
const STATUSES = ["Open", "In Progress", "Resolved"] as const;

function NewRequestDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "community">("community");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify({ title, description, visibility }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit");
      setBusy(false);
    }
  }

  return (
    <Modal title="Report an Issue" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Street light not working"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            rows={3}
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue…"
          />
        </div>
        <div>
          <label className={labelCls}>Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility("community")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                visibility === "community"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <Globe className="h-4 w-4" /> Community
            </button>
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                visibility === "private"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <Lock className="h-4 w-4" /> Private
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {visibility === "private"
              ? "Only you and the property manager can see this."
              : "Visible to all community members."}
          </p>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !title.trim()} className={primaryBtnCls}>
          {busy ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </Modal>
  );
}

export default function MaintenancePage() {
  const { role } = useSessionUser();
  const canManage = WRITER_ROLES.includes(role);
  const [sheetOpen, setSheetOpen] = useState(false);
  const requests = useApi<MaintenanceRequest[]>("/maintenance-requests");
  const users = useApi<User[]>("/users");

  if (requests.error)
    return <ErrorNote message={requests.error} onRetry={requests.reload} />;
  if (requests.loading || !requests.data) return <PageLoading />;

  async function setStatus(id: string, status: string) {
    await api(`/maintenance-requests/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    requests.reload();
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Maintenance Requests"
        subtitle="Report issues privately to Vishnu or share with the community"
        actions={
          role !== "auditor" ? (
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> Report Issue
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {requests.data.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.visibility === "private" ? "violet" : "blue"}>
                {r.visibility === "private" ? (
                  <>
                    <Lock className="mr-1 h-3 w-3" /> Private
                  </>
                ) : (
                  <>
                    <Globe className="mr-1 h-3 w-3" /> Community
                  </>
                )}
              </Badge>
              <Badge
                tone={r.status === "Open" ? "amber" : r.status === "Resolved" ? "green" : "blue"}
              >
                {r.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">{r.title}</p>
            <p className="mt-1 text-xs text-slate-500">{r.description}</p>
            <p className="mt-2 text-xs text-slate-400">
              {userName(users.data, r.createdBy)} · {formatDate(r.createdDate)}
            </p>
            {canManage && (
              <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3">
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(r.id, s)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    Mark {s}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
        {requests.data.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No requests yet.</p>
        )}
      </div>

      {sheetOpen && (
        <NewRequestDialog onClose={() => setSheetOpen(false)} onDone={requests.reload} />
      )}
    </div>
  );
}
