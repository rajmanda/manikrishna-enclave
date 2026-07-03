"use client";

import { CalendarClock, Phone, Star } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { Vendor } from "@/lib/types";
import { formatDate } from "@/lib/format";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
} from "@/components/ui";

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
    </span>
  );
}

export default function VendorsPage() {
  const vendors = useApi<Vendor[]>("/vendors");

  if (vendors.error)
    return <ErrorNote message={vendors.error} onRetry={vendors.reload} />;
  if (vendors.loading || !vendors.data) return <PageLoading />;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Vendors"
        subtitle="Service providers, contracts and AMC schedules"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {vendors.data.map((v) => {
          const amcSoon = v.amcExpiry && new Date(v.amcExpiry) < new Date("2026-10-01");
          return (
            <Card key={v.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={v.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{v.name}</p>
                      <p className="text-xs text-slate-500">{v.service}</p>
                    </div>
                    <Rating value={v.rating} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <a
                      href={`tel:${v.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600"
                    >
                      <Phone className="h-3 w-3" /> {v.phone}
                    </a>
                    {v.gst && (
                      <span className="text-xs text-slate-400">GST {v.gst}</span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {v.activeContracts > 0 && (
                      <Badge tone="green">
                        {v.activeContracts} active contract{v.activeContracts > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {v.amcExpiry && (
                      <Badge tone={amcSoon ? "amber" : "slate"}>
                        <CalendarClock className="mr-1 h-3 w-3" />
                        AMC till {formatDate(v.amcExpiry)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
