"use client";

import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { polls } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { Poll } from "@/lib/types";
import { Badge, Card, PageTitle, ProgressBar } from "@/components/ui";

function PollCard({ poll }: { poll: Poll }) {
  const { role } = useSessionUser();
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const canVote = poll.status === "open" && role === "owner" && !votedFor;

  const totalVotes =
    poll.options.reduce((s, o) => s + o.votes, 0) + (votedFor ? 1 : 0);
  const turnout = Math.round((totalVotes / poll.totalEligible) * 100);

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
      </div>

      <h2 className="mt-2.5 text-base font-semibold">{poll.question}</h2>
      <p className="mt-1 text-sm text-slate-500">{poll.description}</p>

      <div className="mt-4 space-y-3">
        {poll.options.map((opt) => {
          const votes = opt.votes + (votedFor === opt.label ? 1 : 0);
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const leading =
            poll.status === "closed" &&
            votes === Math.max(...poll.options.map((o) => o.votes));
          return (
            <div key={opt.label}>
              <div className="mb-1 flex items-center justify-between gap-2">
                {canVote ? (
                  <button
                    onClick={() => setVotedFor(opt.label)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                  >
                    Vote — {opt.label}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    {opt.label}
                    {votedFor === opt.label && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-500">
                  {pct}% · {votes} vote{votes === 1 ? "" : "s"}
                </span>
              </div>
              <ProgressBar value={pct} tone={leading ? "green" : "brand"} />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Turnout: {totalVotes} of {poll.totalEligible} owners ({turnout}%)
        {votedFor && " · Your vote has been recorded"}
      </p>
    </Card>
  );
}

export default function PollsPage() {
  const open = polls.filter((p) => p.status === "open");
  const closed = polls.filter((p) => p.status === "closed");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Polls & Voting"
        subtitle="Community decisions — one vote per apartment"
      />
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500">Open ({open.length})</h2>
        {open.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500">Closed ({closed.length})</h2>
        {closed.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
      </section>
    </div>
  );
}
