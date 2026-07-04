"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Phone, PlusCircle, Star, Trash2 } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Vendor } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function VendorDialog({
  vendor,
  onClose,
  onDone,
}: {
  vendor: Vendor | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(vendor?.name ?? "");
  const [service, setService] = useState(vendor?.service ?? "");
  const [phone, setPhone] = useState(vendor?.phone ?? "");
  const [gst, setGst] = useState(vendor?.gst ?? "");
  const [amcExpiry, setAmcExpiry] = useState(vendor?.amcExpiry ?? "");
  const [rating, setRating] = useState(String(vendor?.rating ?? "4.0"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name,
      service,
      phone,
      ...(gst ? { gst } : {}),
      ...(amcExpiry ? { amcExpiry } : {}),
      rating: Number(rating),
    };
    try {
      if (vendor) {
        await api(`/vendors/${vendor.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/vendors", { method: "POST", body: JSON.stringify(body) });
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save vendor");
      setBusy(false);
    }
  }

  return (
    <Modal title={vendor ? `Edit ${vendor.name}` : "Add Vendor"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Service</label>
            <input className={inputCls} value={service} onChange={(e) => setService(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>GST (optional)</label>
            <input className={inputCls} value={gst} onChange={(e) => setGst(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>AMC expiry (optional)</label>
            <input type="date" className={inputCls} value={amcExpiry} onChange={(e) => setAmcExpiry(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Rating (0–5)</label>
          <input type="number" min="0" max="5" step="0.1" className={inputCls} value={rating} onChange={(e) => setRating(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Saving…" : vendor ? "Save changes" : "Add vendor"}
        </button>
      </form>
    </Modal>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
    </span>
  );
}

export default function VendorsPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const vendors = useApi<Vendor[]>("/vendors");
  const [dialog, setDialog] = useState<{ open: boolean; vendor: Vendor | null }>({
    open: false,
    vendor: null,
  });

  if (vendors.error)
    return <ErrorNote message={vendors.error} onRetry={vendors.reload} />;
  if (vendors.loading || !vendors.data) return <PageLoading />;

  async function remove(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    try {
      await api(`/vendors/${v.id}`, { method: "DELETE" });
      vendors.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Vendors"
        subtitle="Service providers, contracts and AMC schedules"
        actions={
          canWrite ? (
            <button
              onClick={() => setDialog({ open: true, vendor: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> Add vendor
            </button>
          ) : undefined
        }
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
                    <span className="flex items-center gap-2">
                      <Rating value={v.rating} />
                      {canWrite && (
                        <>
                          <button
                            aria-label={`Edit ${v.name}`}
                            onClick={() => setDialog({ open: true, vendor: v })}
                            className="text-slate-300 hover:text-brand-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            aria-label={`Delete ${v.name}`}
                            onClick={() => remove(v)}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </span>
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

      {dialog.open && (
        <VendorDialog
          vendor={dialog.vendor}
          onClose={() => setDialog({ open: false, vendor: null })}
          onDone={vendors.reload}
        />
      )}
    </div>
  );
}
