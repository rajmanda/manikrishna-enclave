"use client";

import { useState } from "react";
import { ArrowRightLeft, Building2, Plus, Receipt, Wrench } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import type { PortfolioCommunityStats } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageLoading,
  PageTitle,
  ProgressBar,
  Stat,
} from "@/components/ui";

function AddCommunityModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (communityId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("/communities", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), address: address.trim() }),
      });
      // Straight into the Setup Assistant of the new community.
      await onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create community");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Community" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Community name</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Greenwood Heights"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Address (optional)</label>
          <input
            className={inputCls}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g., Kukatpally, Hyderabad"
          />
        </div>
        <p className="text-xs text-slate-500">
          Next you'll be taken to the Setup Assistant to add flats, residents and a manager.
        </p>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Creating…" : "Create community"}
        </button>
      </form>
    </Modal>
  );
}

function rateTone(rate: number): "green" | "brand" | "red" {
  if (rate >= 90) return "green";
  if (rate >= 60) return "brand";
  return "red";
}

export default function PortfolioPage() {
  const { user, role, switchCommunity } = useAuth();
  const stats = useApi<PortfolioCommunityStats[]>("/communities/portfolio/stats");
  const [adding, setAdding] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  async function manage(communityId: string) {
    setSwitching(communityId);
    try {
      await switchCommunity(communityId);
    } catch {
      setSwitching(null);
    }
  }

  if (role && role !== "super_admin")
    return (
      <EmptyState
        title="Super admin only"
        hint="The portfolio console is available to platform administrators."
      />
    );
  if (stats.error) return <ErrorNote message={stats.error} onRetry={stats.reload} />;
  if (stats.loading || !stats.data) return <PageLoading />;

  const communities = stats.data;
  const totals = communities.reduce(
    (acc, c) => ({
      invoiced: acc.invoiced + c.invoicedTotal,
      collected: acc.collected + c.collectedTotal,
      outstanding: acc.outstanding + c.outstandingTotal,
      openWorkOrders: acc.openWorkOrders + c.openWorkOrders,
    }),
    { invoiced: 0, collected: 0, outstanding: 0, openWorkOrders: 0 }
  );
  const overallRate = totals.invoiced
    ? Math.round((totals.collected / totals.invoiced) * 1000) / 10
    : 0;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Portfolio Console"
        subtitle="Every community on the platform, side by side"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Community
          </Button>
        }
      />

      {adding && (
        <AddCommunityModal
          onClose={() => setAdding(false)}
          onCreated={(id) => switchCommunity(id, "/setup")}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Communities"
          value={String(communities.length)}
          accent="bg-brand-500"
        />
        <Stat
          label="Collected"
          value={formatINR(totals.collected)}
          hint={`of ${formatINR(totals.invoiced)} invoiced`}
          tone="positive"
        />
        <Stat
          label="Outstanding"
          value={formatINR(totals.outstanding)}
          tone={totals.outstanding > 0 ? "negative" : "default"}
        />
        <Stat
          label="Collection Rate"
          value={`${overallRate}%`}
          hint={`${totals.openWorkOrders} open work orders across portfolio`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {communities.map((c) => (
          <Card key={c.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-800">{c.name}</h3>
                  <p className="truncate text-xs text-slate-500">
                    {c.apartmentCount} {c.apartmentCount === 1 ? "unit" : "units"}
                    {c.address ? ` • ${c.address}` : ""}
                  </p>
                </div>
              </div>
              <Badge tone={rateTone(c.collectionRate)}>{c.collectionRate}% collected</Badge>
            </div>

            <ProgressBar value={c.collectionRate} tone={rateTone(c.collectionRate)} />

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                  Invoiced
                </p>
                <p className="text-sm font-bold text-slate-800">{formatINR(c.invoicedTotal)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                  Outstanding
                </p>
                <p
                  className={`text-sm font-bold ${
                    c.outstandingTotal > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {formatINR(c.outstandingTotal)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                  Open Items
                </p>
                <p className="flex items-center justify-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex items-center gap-0.5">
                    <Receipt className="h-3.5 w-3.5 text-slate-400" />
                    {c.openInvoices}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Wrench className="h-3.5 w-3.5 text-slate-400" />
                    {c.openWorkOrders}
                  </span>
                </p>
              </div>
            </div>

            {user?.communityId === c.id ? (
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 py-2 text-xs font-semibold text-brand-700">
                <Building2 className="h-3.5 w-3.5" /> Currently managing
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={switching !== null}
                onClick={() => manage(c.id)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {switching === c.id ? "Switching…" : "Manage this community"}
              </Button>
            )}
          </Card>
        ))}
        {communities.length === 0 && (
          <EmptyState title="No communities yet" hint="Create your first community to see it here." />
        )}
      </div>
    </div>
  );
}
