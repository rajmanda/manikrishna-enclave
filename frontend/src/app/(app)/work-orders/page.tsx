"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight, Plus } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import type { Priority, Vendor, WorkOrder } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { vendorFor } from "@/lib/lookup";
import { priorityTone, stageTone } from "@/lib/tones";
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  PageLoading,
  PageTitle,
} from "@/components/ui";

const filters = ["All", "Open", "In Progress", "Completed"] as const;
type Filter = (typeof filters)[number];

function matchesFilter(stage: string, f: Filter): boolean {
  if (f === "All") return true;
  if (f === "Open") return ["Reported", "Estimate Received", "Owner Approval"].includes(stage);
  if (f === "In Progress") return ["In Progress", "Inspection"].includes(stage);
  return ["Completed", "Closed"].includes(stage);
}

function NewWorkOrderDialog({
  vendors,
  onClose,
  onDone,
}: {
  vendors: Vendor[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [vendorId, setVendorId] = useState("");
  const [estimate, setEstimate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/work-orders", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          priority,
          ...(vendorId ? { vendorId } : {}),
          ...(estimate ? { estimate: Number(estimate) } : {}),
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
      setBusy(false);
    }
  }

  return (
    <Modal title="New Work Order" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={3} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Priority</label>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {["Low", "Medium", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estimate (optional)</label>
            <input type="number" min="0" className={inputCls} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Vendor (optional)</label>
          <select className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">— unassigned —</option>
            {(vendors ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !title.trim()} className={primaryBtnCls}>
          {busy ? "Creating…" : "Create work order"}
        </button>
      </form>
    </Modal>
  );
}

export default function WorkOrdersPage() {
  const { role } = useSessionUser();
  const [filter, setFilter] = useState<Filter>("All");
  const [newOpen, setNewOpen] = useState(false);
  const workOrders = useApi<WorkOrder[]>("/work-orders");
  const vendors = useApi<Vendor[]>("/vendors");

  if (workOrders.error)
    return <ErrorNote message={workOrders.error} onRetry={workOrders.reload} />;
  if (workOrders.loading || !workOrders.data) return <PageLoading />;

  const list = workOrders.data.filter((w) => matchesFilter(w.stage, filter));
  const canCreate = ["property_manager", "community_admin", "super_admin"].includes(role);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Work Orders"
        subtitle="Common-area repairs and maintenance, visible to all owners"
        actions={
          canCreate ? (
            <button
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          ) : undefined
        }
      />

      {/* Filter chips — horizontally scrollable on mobile */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <EmptyState title="No work orders in this view" hint="Try a different filter." />
      )}

      <div className="space-y-3">
        {list.map((wo) => {
          const vendor = vendorFor(vendors.data, wo.vendorId);
          return (
            <Link key={wo.id} href={`/work-orders/${wo.id}`} className="block">
              <Card className="p-4 transition hover:border-brand-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={priorityTone(wo.priority)}>{wo.priority}</Badge>
                      <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{wo.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {wo.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>Reported {formatDate(wo.reportedDate)}</span>
                      {vendor && <span>· {vendor.name}</span>}
                      {wo.finalCost != null ? (
                        <span>· Final {formatINR(wo.finalCost)}</span>
                      ) : wo.estimate != null ? (
                        <span>· Est. {formatINR(wo.estimate)}</span>
                      ) : null}
                      {wo.photoCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          · <Camera className="h-3 w-3" /> {wo.photoCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {newOpen && (
        <NewWorkOrderDialog
          vendors={vendors.data}
          onClose={() => setNewOpen(false)}
          onDone={workOrders.reload}
        />
      )}
    </div>
  );
}
