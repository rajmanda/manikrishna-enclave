"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, Phone, Send } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { User, Vendor, WorkOrder, WorkOrderStage } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { userName, vendorFor } from "@/lib/lookup";
import { priorityTone, stageTone } from "@/lib/tones";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
} from "@/components/ui";

const allStages: WorkOrderStage[] = [
  "Reported",
  "Estimate Received",
  "Owner Approval",
  "In Progress",
  "Inspection",
  "Completed",
  "Closed",
];

export default function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const workOrder = useApi<WorkOrder>(`/work-orders/${id}`);
  const vendors = useApi<Vendor[]>("/vendors");
  const users = useApi<User[]>("/users");

  if (workOrder.error)
    return <ErrorNote message={workOrder.error} onRetry={workOrder.reload} />;
  if (workOrder.loading || !workOrder.data) return <PageLoading />;

  const wo = workOrder.data;
  const vendor = vendorFor(vendors.data, wo.vendorId);
  const currentIdx = allStages.indexOf(wo.stage);
  const eventByStage = new Map(wo.timeline.map((e) => [e.stage, e]));

  return (
    <div className="space-y-5">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Work Orders
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={priorityTone(wo.priority)}>{wo.priority}</Badge>
          <Badge tone={stageTone(wo.stage)}>{wo.stage}</Badge>
        </div>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">{wo.title}</h1>
        <p className="mt-1.5 text-sm text-slate-600">{wo.description}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: timeline + comments */}
        <div className="space-y-5 lg:col-span-2">
          {/* Stage timeline */}
          <Card className="p-4">
            <h2 className="mb-4 text-sm font-semibold">Progress</h2>
            <ol className="space-y-0">
              {allStages.map((stage, i) => {
                const event = eventByStage.get(stage);
                const done = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <li key={stage} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < allStages.length - 1 && (
                      <span
                        className={`absolute left-[11px] top-6 h-full w-0.5 ${
                          i < currentIdx ? "bg-brand-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done
                          ? isCurrent
                            ? "bg-brand-600 text-white ring-4 ring-brand-100"
                            : "bg-brand-500 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {done && !isCurrent ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-sm font-medium ${done ? "text-slate-900" : "text-slate-400"}`}
                      >
                        {stage}
                      </p>
                      {event && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(event.date)} — {event.note}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Owner comments */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Comments ({wo.comments.length})
            </h2>
            <ul className="space-y-4">
              {wo.comments.map((c, i) => (
                <li key={i} className="flex gap-3">
                  <Avatar name={userName(users.data, c.authorId)} size="sm" />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {userName(users.data, c.authorId)}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDate(c.date)}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{c.text}</p>
                  </div>
                </li>
              ))}
              {wo.comments.length === 0 && (
                <p className="text-sm text-slate-400">No comments yet.</p>
              )}
            </ul>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send comment"
                className="rounded-xl bg-brand-600 px-3.5 text-white hover:bg-brand-700"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </Card>
        </div>

        {/* Right: details */}
        <div className="space-y-5">
          <Card className="divide-y divide-slate-100">
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Cost
              </p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Estimate</span>
                <span className="text-sm font-semibold">
                  {wo.estimate != null ? formatINR(wo.estimate) : "—"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Final Cost</span>
                <span className="text-sm font-semibold">
                  {wo.finalCost != null ? formatINR(wo.finalCost) : "Pending"}
                </span>
              </div>
            </div>
            {vendor && (
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Assigned Vendor
                </p>
                <p className="mt-1.5 text-sm font-medium">{vendor.name}</p>
                <p className="text-xs text-slate-500">{vendor.service}</p>
                <a
                  href={`tel:${vendor.phone.replace(/\s/g, "")}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600"
                >
                  <Phone className="h-3 w-3" /> {vendor.phone}
                </a>
              </div>
            )}
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Managed By
              </p>
              <p className="mt-1.5 text-sm font-medium">
                {wo.assignedTo ? userName(users.data, wo.assignedTo) : "Unassigned"}
              </p>
              <p className="text-xs text-slate-500">
                Reported {formatDate(wo.reportedDate)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Attachments
              </p>
              {wo.photoCount > 0 ? (
                <div className="mt-2 flex gap-2">
                  {Array.from({ length: Math.min(wo.photoCount, 4) }).map((_, i) => (
                    <span
                      key={i}
                      className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"
                    >
                      <Camera className="h-5 w-5" />
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-slate-400">No photos</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
