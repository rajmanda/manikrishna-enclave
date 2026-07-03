"use client";

import { useState } from "react";
import { Globe, Lock, Plus, X } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { maintenanceRequests, userById } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageTitle } from "@/components/ui";

function NewRequestSheet({ onClose }: { onClose: () => void }) {
  const [visibility, setVisibility] = useState<"private" | "community">("community");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Report an Issue</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onClose(); }}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Title</label>
            <input
              placeholder="e.g. Street light not working"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              placeholder="Describe the issue…"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Visibility</label>
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
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Submit Request
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { role, user } = useSessionUser();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Private requests are visible only to their creator and the manager/auditor.
  const visible = maintenanceRequests.filter(
    (r) =>
      r.visibility === "community" ||
      r.createdBy === user.id ||
      role === "property_manager" ||
      role === "auditor"
  );

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
        {visible.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
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
                    tone={
                      r.status === "Open" ? "amber" : r.status === "Resolved" ? "green" : "blue"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold">{r.title}</p>
                <p className="mt-1 text-xs text-slate-500">{r.description}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {userById(r.createdBy)?.name} · {formatDate(r.createdDate)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {sheetOpen && <NewRequestSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
