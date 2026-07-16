"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessagesSquare, Send } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Message, MessageThread, User } from "@/lib/types";
import { Avatar, Badge, Card, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

const MANAGER_VIEW_ROLES = ["property_manager", "community_admin", "super_admin", "auditor"];
const POLL_MS = 15_000;

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          mine
            ? "rounded-br-md bg-brand-600 text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
        }`}
      >
        {!mine && (
          <p className="mb-0.5 text-xs font-semibold text-brand-600">{m.senderName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.text}</p>
        <p className={`mt-1 text-[10px] ${mine ? "text-brand-100" : "text-slate-400"}`}>
          {fmtWhen(m.date)}
        </p>
      </div>
    </div>
  );
}

function Conversation({
  threadUserId,
  canSend,
  emptyHint,
}: {
  threadUserId: string | null; // null = the caller's own thread
  canSend: boolean;
  emptyHint: string;
}) {
  const { user } = useSessionUser();
  const path = threadUserId ? `/messages?threadUserId=${threadUserId}` : "/messages";
  const messages = useApi<Message[]>(path);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Light polling so replies show up without a manual refresh.
  useEffect(() => {
    const t = setInterval(messages.reload, POLL_MS);
    return () => clearInterval(t);
  }, [messages.reload]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/messages", {
        method: "POST",
        body: JSON.stringify(
          threadUserId ? { text, threadUserId } : { text }
        ),
      });
      setText("");
      messages.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  if (messages.error)
    return <ErrorNote message={messages.error} onRetry={messages.reload} />;
  if (messages.loading && !messages.data) return <PageLoading />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {(messages.data ?? []).map((m) => (
          <Bubble key={m.id} m={m} mine={m.senderId === user.id} />
        ))}
        {(messages.data ?? []).length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <MessagesSquare className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">{emptyHint}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {canSend && (
        <form onSubmit={send} className="border-t border-slate-100 p-3">
          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Type a message…"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              aria-label="Send"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Resident view: one conversation with the property manager. */
function ResidentMessages() {
  return (
    <div className="space-y-4">
      <PageTitle
        title="Messages"
        subtitle="Chat directly with your property manager"
      />
      <Card className="flex h-[65dvh] flex-col overflow-hidden p-0">
        <Conversation
          threadUserId={null}
          canSend
          emptyHint="No messages yet — say hello, or report anything that needs attention."
        />
      </Card>
    </div>
  );
}

/** Manager view: inbox of resident threads + the open conversation. */
function ManagerMessages() {
  const { role } = useSessionUser();
  const threads = useApi<MessageThread[]>("/messages/threads");
  const users = useApi<User[]>("/users");
  const [openId, setOpenId] = useState<string | null>(null);
  const canSend = role !== "auditor";

  useEffect(() => {
    const t = setInterval(threads.reload, POLL_MS);
    return () => clearInterval(t);
  }, [threads.reload]);

  if (threads.error)
    return <ErrorNote message={threads.error} onRetry={threads.reload} />;
  if (threads.loading && !threads.data) return <PageLoading />;

  const rows = threads.data ?? [];
  const inThreads = new Set(rows.map((t) => t.threadUserId));
  const startable = (users.data ?? [])
    .filter((u) => (u.role === "owner" || u.role === "tenant") && !inThreads.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const open = rows.find((t) => t.threadUserId === openId);
  const openUser = (users.data ?? []).find((u) => u.id === openId);
  const openName = open?.threadUserName ?? openUser?.name ?? "";

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      {canSend && (
        <div className="border-b border-slate-100 p-3">
          <label className="sr-only">Start a conversation</label>
          <select
            value=""
            onChange={(e) => e.target.value && setOpenId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-brand-500 focus:outline-none"
          >
            <option value="">Start a conversation…</option>
            {startable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === "tenant" ? "Tenant" : "Owner"})
              </option>
            ))}
          </select>
        </div>
      )}
      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {rows.map((t) => (
          <li key={t.threadUserId}>
            <button
              onClick={() => {
                setOpenId(t.threadUserId);
                threads.reload();
              }}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 ${
                t.threadUserId === openId ? "bg-brand-50" : ""
              }`}
            >
              <Avatar name={t.threadUserName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{t.threadUserName}</span>
                  {t.apartmentId && (
                    <Badge tone="slate">Apt {t.apartmentId.replace("apt-", "")}</Badge>
                  )}
                </span>
                <span className="block truncate text-xs text-slate-500">{t.lastText}</span>
              </span>
              {t.unreadCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {t.unreadCount}
                </span>
              )}
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-3 py-10 text-center text-sm text-slate-400">
            No conversations yet.
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageTitle title="Messages" subtitle="Direct conversations with residents" />
      <Card className="h-[65dvh] overflow-hidden p-0">
        <div className="flex h-full min-h-0">
          {/* Thread list — hidden on mobile while a conversation is open. */}
          <div
            className={`h-full w-full flex-col border-slate-100 md:flex md:w-80 md:border-r ${
              openId ? "hidden" : "flex"
            }`}
          >
            {list}
          </div>
          <div className={`h-full min-w-0 flex-1 flex-col ${openId ? "flex" : "hidden md:flex"}`}>
            {openId ? (
              <>
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
                  <button
                    onClick={() => setOpenId(null)}
                    aria-label="Back to conversations"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar name={openName} size="sm" />
                  <p className="text-sm font-semibold">{openName}</p>
                </div>
                <div className="min-h-0 flex-1">
                  <Conversation
                    key={openId}
                    threadUserId={openId}
                    canSend={canSend}
                    emptyHint={`No messages with ${openName} yet.`}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <MessagesSquare className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Pick a conversation to read it.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function MessagesPage() {
  const { role } = useSessionUser();
  if (MANAGER_VIEW_ROLES.includes(role)) return <ManagerMessages />;
  return <ResidentMessages />;
}
