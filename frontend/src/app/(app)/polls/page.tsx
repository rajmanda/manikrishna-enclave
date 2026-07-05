"use client";

import { useState } from "react";
import { CheckCircle2, Clock, PlusCircle, Trash2, XCircle } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Poll } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
  ProgressBar,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];

function NewPollDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [options, setOptions] = useState("Approve\nReject");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/polls", {
        method: "POST",
        body: JSON.stringify({
          question,
          description,
          closeDate,
          options: options.split("\n").map((o) => o.trim()).filter(Boolean),
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create poll");
      setBusy(false);
    }
  }

  return (
    <Modal title="New Poll" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Question</label>
          <input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Voting closes on</label>
          <input type="date" className={inputCls} value={closeDate} onChange={(e) => setCloseDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Options (one per line)</label>
          <textarea rows={3} className={inputCls} value={options} onChange={(e) => setOptions(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Creating…" : "Open poll (members are notified)"}
        </button>
      </form>
    </Modal>
  );
}

function PollCard({ poll, onChanged }: { poll: Poll; onChanged: () => void }) {
  const { user, role } = useSessionUser();
  const canManage = WRITER_ROLES.includes(role);
  const canDelete = role === "super_admin";
  const canVote = poll.status === "open" && !!user.apartmentId;
  const [error, setError] = useState<string | null>(null);

  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
  const turnout = poll.totalEligible
    ? Math.round((totalVotes / poll.totalEligible) * 100)
    : 0;
  const maxVotes = Math.max(...poll.options.map((o) => o.votes), 0);

  async function vote(option: string) {
    setError(null);
    try {
      await api(`/polls/${poll.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ option }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Vote failed");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete poll: "${poll.question}"?\n\nThis cannot be undone.`)) return;
    try {
      await api(`/polls/${poll.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete poll");
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={poll.status === "open" ? "green" : "slate"}>
          {poll.status === "open" ? "Open" : "Closed"}
        </Badge>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3 w-3" />
          {formatDate(poll.openDate)} – {formatDate(poll.closeDate)}
        </span>
        {canManage && poll.status === "open" && (
          <button
            onClick={async () => {
              await api(`/polls/${poll.id}/close`, { method: "POST" });
              onChanged();
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" /> Close poll
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            title="Delete poll (super admin only)"
            className={`${canManage && poll.status === "open" ? "" : "ml-auto"} inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-red-500`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>

      <h2 className="mt-2.5 text-base font-semibold">{poll.question}</h2>
      {poll.description && (
        <p className="mt-1 text-sm text-slate-500">{poll.description}</p>
      )}

      <div className="mt-4 space-y-3">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const leading = poll.status === "closed" && opt.votes === maxVotes && maxVotes > 0;
          const mine = poll.myVote === opt.label;
          return (
            <div key={opt.label}>
              <div className="mb-1 flex items-center justify-between gap-2">
                {canVote ? (
                  <button
                    onClick={() => vote(opt.label)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      mine
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-700 hover:border-brand-400 hover:bg-brand-50"
                    }`}
                  >
                    {mine && <CheckCircle2 className="mr-1 inline h-4 w-4 text-brand-600" />}
                    {opt.label}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    {opt.label}
                    {mine && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-500">
                  {pct}% · {opt.votes} vote{opt.votes === 1 ? "" : "s"}
                </span>
              </div>
              <ProgressBar value={pct} tone={leading ? "green" : "brand"} />
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <p className="mt-4 text-xs text-slate-400">
        Turnout: {totalVotes} of {poll.totalEligible} apartments ({turnout}%)
        {poll.myVote && ` · Your apartment voted: ${poll.myVote}`}
        {!user.apartmentId && poll.status === "open" && " · Voting is one per apartment"}
      </p>
    </Card>
  );
}

export default function PollsPage() {
  const { role } = useSessionUser();
  const polls = useApi<Poll[]>("/polls");
  const [newOpen, setNewOpen] = useState(false);
  const canCreate = WRITER_ROLES.includes(role);

  if (polls.error) return <ErrorNote message={polls.error} onRetry={polls.reload} />;
  if (polls.loading || !polls.data) return <PageLoading />;

  const open = polls.data.filter((p) => p.status === "open");
  const closed = polls.data.filter((p) => p.status === "closed");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Polls & Voting"
        subtitle="Community decisions — one vote per apartment"
        actions={
          canCreate ? (
            <button
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> New poll
            </button>
          ) : undefined
        }
      />
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500">Open ({open.length})</h2>
        {open.map((p) => <PollCard key={p.id} poll={p} onChanged={polls.reload} />)}
        {open.length === 0 && <p className="text-sm text-slate-400">No open polls.</p>}
      </section>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500">Closed ({closed.length})</h2>
        {closed.map((p) => <PollCard key={p.id} poll={p} onChanged={polls.reload} />)}
      </section>

      {newOpen && <NewPollDialog onClose={() => setNewOpen(false)} onDone={polls.reload} />}
    </div>
  );
}
