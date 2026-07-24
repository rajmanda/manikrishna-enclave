"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ChevronRight, Plus } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import type { Priority, Vendor, WorkOrder } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { vendorFor } from "@/lib/lookup";
import { priorityTone, stageTone } from "@/lib/tones";
import { DeliveryFailureBadge, useDeliveryFailures } from "@/components/DeliveryStatus";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageLoading,
  PageTitle,
  Skeleton,
} from "@/components/ui";
import { FadeIn, Stagger } from "@/components/motion";

const filters = ["All", "Open", "In Progress", "Completed"] as const;
type Filter = (typeof filters)[number];

function matchesFilter(stage: string, f: Filter): boolean {
  if (f === "All") return true;
  if (f === "Open") return ["Reported", "Estimate Received", "Owner Approval"].includes(stage);
  if (f === "In Progress") return ["In Progress", "Inspection"].includes(stage);
  return ["Completed", "Closed"].includes(stage);
}

/** The work-order lifecycle, in order. */
const STAGE_ORDER = [
  "Reported",
  "Estimate Received",
  "Owner Approval",
  "In Progress",
  "Inspection",
  "Completed",
  "Closed",
] as const;

/** A compact 7-step pipeline showing where a work order sits in its lifecycle.
 * Steps up to the current one are filled (emerald once done, brand while open);
 * the rest stay grey — the stage is legible at a glance without reading text. */
function StagePipeline({ stage }: { stage: string }) {
  const current = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  const idx = current < 0 ? 0 : current;
  const done = stage === "Completed" || stage === "Closed";
  const fill = done ? "bg-emerald-500" : "bg-brand-500";
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1" aria-hidden>
        {STAGE_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= idx ? fill : "bg-slate-100"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-2xs font-medium uppercase tracking-wide text-slate-400">
        Step {idx + 1} of {STAGE_ORDER.length} · {stage}
      </p>
    </div>
  );
}

function NewWorkOrderDialog({
  vendors,
  onClose,
  onDone,
  initial,
}: {
  vendors: Vendor[] | undefined;
  onClose: () => void;
  onDone: () => void;
  /** Prefill when created from a maintenance request — the work order links
   * back to it and the request flips to In Progress. */
  initial?: { title?: string; description?: string; maintenanceRequestId?: string };
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
          ...(initial?.maintenanceRequestId
            ? { maintenanceRequestId: initial.maintenanceRequestId }
            : {}),
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
        {initial?.maintenanceRequestId && (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
            Linked to the resident&apos;s maintenance request — it moves to
            &ldquo;In Progress&rdquo; when this is created.
          </p>
        )}
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

function WorkOrdersPageInner() {
  const { role } = useSessionUser();
  const [filter, setFilter] = useState<Filter>("All");
  const [newOpen, setNewOpen] = useState(false);
  const [initialWo, setInitialWo] = useState<
    { title?: string; description?: string; maintenanceRequestId?: string } | undefined
  >(undefined);
  const workOrders = useApi<WorkOrder[]>("/work-orders");
  const vendors = useApi<Vendor[]>("/vendors");
  const canCreateRole = ["property_manager", "community_admin", "super_admin"].includes(role);
  const deliveryFailures = useDeliveryFailures(canCreateRole, "work_order");

  // Deep-link: /work-orders?create=1&mr={id}&title=…&desc=… (from a
  // maintenance request) opens the dialog prefilled, then cleans the URL.
  const router = useRouter();
  const searchParams = useSearchParams();
  const consumedCreate = useRef(false);
  useEffect(() => {
    if (canCreateRole && !consumedCreate.current && searchParams.get("create")) {
      consumedCreate.current = true;
      setInitialWo({
        title: searchParams.get("title") ?? undefined,
        description: searchParams.get("desc") ?? undefined,
        maintenanceRequestId: searchParams.get("mr") ?? undefined,
      });
      setNewOpen(true);
      router.replace("/work-orders");
    }
  }, [canCreateRole, searchParams, router]);

  if (workOrders.error)
    return <ErrorNote message={workOrders.error} onRetry={workOrders.reload} />;
  if (workOrders.loading || !workOrders.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );

  const list = workOrders.data.filter((w) => matchesFilter(w.stage, filter));
  const canCreate = ["property_manager", "community_admin", "super_admin"].includes(role);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Work Orders"
        subtitle="Common-area repairs and maintenance, visible to all owners"
        actions={
          canCreate ? (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> New
            </Button>
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

      <Stagger className="space-y-3">
        {list.map((wo) => {
          const vendor = vendorFor(vendors.data, wo.vendorId);
          return (
            <FadeIn key={wo.id}>
              <Link href={`/work-orders/${wo.id}`} className="group block">
                <Card className="p-4 transition-all duration-200 ease-standard hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={priorityTone(wo.priority)}>{wo.priority}</Badge>
                        <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
                        <DeliveryFailureBadge
                          failure={deliveryFailures.map.get(`work_order:${wo.id}`)}
                          onResent={deliveryFailures.reload}
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{wo.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {wo.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>Reported {formatDate(wo.reportedDate)}</span>
                        {vendor && <span>· {vendor.name}</span>}
                        {wo.finalCost != null ? (
                          <span>· Final <span className="tabular font-medium text-slate-700">{formatINR(wo.finalCost)}</span></span>
                        ) : wo.estimate != null ? (
                          <span>· Est. <span className="tabular font-medium text-slate-700">{formatINR(wo.estimate)}</span></span>
                        ) : null}
                        {wo.photoCount > 0 && (
                          <span className="inline-flex items-center gap-1">
                            · <Camera className="h-3 w-3" /> {wo.photoCount}
                          </span>
                        )}
                      </div>
                      <StagePipeline stage={wo.stage} />
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
                  </div>
                </Card>
              </Link>
            </FadeIn>
          );
        })}
      </Stagger>

      {newOpen && (
        <NewWorkOrderDialog
          vendors={vendors.data}
          onClose={() => {
            setNewOpen(false);
            setInitialWo(undefined);
          }}
          onDone={workOrders.reload}
          initial={initialWo}
        />
      )}
    </div>
  );
}

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WorkOrdersPageInner />
    </Suspense>
  );
}
