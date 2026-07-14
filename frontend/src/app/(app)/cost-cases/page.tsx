"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, FolderKanban, PlusCircle } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { CostCase } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Badge, Card, EmptyState, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function NewCaseDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/cost-cases", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          ...(budget ? { approvedBudget: Number(budget) } : {}),
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
    <Modal title="New Cost Case" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-xs text-slate-500">
          One cost case = one complete financial event (a repair, a purchase,
          a recurring bill) — its work orders, vendor bills and owner
          assessments all connect here.
        </p>
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lift cable replacement" required />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Approved budget (optional — an estimate, not an expense)</label>
          <input type="number" min="0" className={inputCls} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !title.trim()} className={primaryBtnCls}>
          {busy ? "Creating…" : "Create cost case"}
        </button>
      </form>
    </Modal>
  );
}

export default function CostCasesPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const cases = useApi<CostCase[]>("/cost-cases");
  const [newOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");

  if (cases.error) return <ErrorNote message={cases.error} onRetry={cases.reload} />;
  if (cases.loading || !cases.data) return <PageLoading />;

  const list = cases.data.filter((c) =>
    filter === "all" ? true : filter === "open" ? c.status !== "closed" : c.status === "closed"
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Cost Cases"
        subtitle="Every repair or purchase with its money story in one place"
        actions={
          canWrite ? (
            <button
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> New cost case
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition ${
              filter === f
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No cost cases here"
          hint={filter === "open" ? "Create one for the next repair or billing drive." : "Nothing closed yet."}
        />
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const s = c.summary;
            return (
              <Link key={c.id} href={`/cost-cases/${c.id}`} className="group block">
                <Card className="p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-brand-600" />
                        <p className="text-sm font-semibold">{c.title}</p>
                        <Badge tone={c.status === "closed" ? "slate" : "blue"}>{c.status}</Badge>
                        {s.awaitingVendorBill && (
                          <Badge tone="amber">
                            <AlertTriangle className="mr-1 h-3 w-3" /> awaiting vendor bill
                          </Badge>
                        )}
                        {s.draftBills > 0 && <Badge tone="violet">{s.draftBills} draft bill{s.draftBills > 1 ? "s" : ""}</Badge>}
                      </div>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Budget <b className="text-slate-700">{c.approvedBudget ? formatINR(c.approvedBudget) : "—"}</b></span>
                        <span>Spent <b className="text-slate-700">{formatINR(s.actualCost)}</b></span>
                        <span>Collected <b className="text-emerald-600">{formatINR(s.collectedFromOwners)}</b>{s.billedToOwners > 0 && <> of {formatINR(s.billedToOwners)}</>}</span>
                        {s.outstandingFromOwners > 0 && (
                          <span className="text-red-600">Outstanding {formatINR(s.outstandingFromOwners)}</span>
                        )}
                        <span>Opened {formatDate(c.createdDate)}</span>
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {newOpen && <NewCaseDialog onClose={() => setNewOpen(false)} onDone={cases.reload} />}
    </div>
  );
}
