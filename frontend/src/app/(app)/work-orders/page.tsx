"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight, Plus } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import type { Vendor, WorkOrder } from "@/lib/types";
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

export default function WorkOrdersPage() {
  const { role } = useSessionUser();
  const [filter, setFilter] = useState<Filter>("All");
  const workOrders = useApi<WorkOrder[]>("/work-orders");
  const vendors = useApi<Vendor[]>("/vendors");

  if (workOrders.error)
    return <ErrorNote message={workOrders.error} onRetry={workOrders.reload} />;
  if (workOrders.loading || !workOrders.data) return <PageLoading />;

  const list = workOrders.data.filter((w) => matchesFilter(w.stage, filter));
  const canCreate = role === "property_manager" || role === "community_admin";

  return (
    <div className="space-y-4">
      <PageTitle
        title="Work Orders"
        subtitle="Common-area repairs and maintenance, visible to all owners"
        actions={
          canCreate ? (
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
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
    </div>
  );
}
