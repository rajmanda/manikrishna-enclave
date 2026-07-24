"use client";

import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Pin,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { FeedPost, User } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { userName } from "@/lib/lookup";
import { DeliveryFailureBadge, useDeliveryFailures } from "@/components/DeliveryStatus";
import type { DeliveryFailureSummary } from "@/lib/types";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
} from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];
const POST_TYPES = ["announcement", "question", "suggestion", "photo"] as const;

const typeBadge: Record<string, { label: string; tone: "brand" | "blue" | "violet" | "green" }> = {
  announcement: { label: "Announcement", tone: "brand" },
  question: { label: "Question", tone: "blue" },
  suggestion: { label: "Suggestion", tone: "violet" },
  photo: { label: "Photos", tone: "green" },
};

function Composer({ onPosted }: { onPosted: () => void }) {
  const { user } = useSessionUser();
  const [text, setText] = useState("");
  const [type, setType] = useState<(typeof POST_TYPES)[number]>("announcement");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/feed", { method: "POST", body: JSON.stringify({ type, text }) });
      setText("");
      onPosted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit}>
        <div className="flex items-start gap-3">
          <Avatar name={user.name} size="sm" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Share an announcement, question or suggestion…"
            className="min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof POST_TYPES)[number])}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 focus:outline-none"
          >
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>{typeBadge[t].label}</option>
            ))}
          </select>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Post
          </button>
        </div>
      </form>
    </Card>
  );
}

function PostCard({
  post,
  users,
  onChanged,
  deliveryFailure,
  onDeliveryResent,
}: {
  post: FeedPost;
  users: User[] | undefined;
  onChanged: () => void;
  deliveryFailure?: DeliveryFailureSummary;
  onDeliveryResent?: () => void;
}) {
  const { user, role } = useSessionUser();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const badge = typeBadge[post.type];
  const canPin = WRITER_ROLES.includes(role);
  const canDelete = post.authorId === user.id || canPin;

  async function react(kind: "like" | "heart" | "thanks") {
    await api(`/feed/${post.id}/react`, {
      method: "POST",
      body: JSON.stringify({ kind: post.myReaction === kind ? "none" : kind }),
    });
    onChanged();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/feed/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: comment }),
      });
      setComment("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        {post.pinned && (
          <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Pin className="h-3 w-3" /> Pinned
          </p>
        )}
        <span className="ml-auto flex gap-2">
          {canPin && (
            <button
              onClick={async () => {
                await api(`/feed/${post.id}/pin`, { method: "POST" });
                onChanged();
              }}
              aria-label={post.pinned ? "Unpin" : "Pin"}
              className={`${post.pinned ? "text-amber-500" : "text-slate-300"} hover:text-amber-600`}
            >
              <Pin className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={async () => {
                if (!confirm("Delete this post?")) return;
                await api(`/feed/${post.id}`, { method: "DELETE" });
                onChanged();
              }}
              aria-label="Delete post"
              className="text-slate-300 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>
      <div className="flex items-start gap-3">
        <Avatar name={userName(users, post.authorId)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{userName(users, post.authorId)}</p>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <DeliveryFailureBadge
              failure={deliveryFailure}
              onResent={onDeliveryResent ?? (() => {})}
            />
          </div>
          <p className="text-xs text-slate-400">{formatDate(post.date)}</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{post.text}</p>

      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5">
        {(
          [
            { key: "like", icon: ThumbsUp, count: post.reactions.like },
            { key: "heart", icon: Heart, count: post.reactions.heart },
            { key: "thanks", icon: Sparkles, count: post.reactions.thanks },
          ] as const
        ).map(({ key, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => react(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              post.myReaction === key
                ? "bg-brand-50 text-brand-600"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {count}
          </button>
        ))}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
        >
          <MessageCircle className="h-3.5 w-3.5" /> {post.comments.length}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {post.comments.map((c, i) => (
            <div key={i} className="flex gap-2.5">
              <Avatar name={userName(users, c.authorId)} size="sm" />
              <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  {userName(users, c.authorId)}
                </p>
                <p className="mt-0.5 text-sm text-slate-700">{c.text}</p>
              </div>
            </div>
          ))}
          <form className="flex gap-2" onSubmit={submitComment}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !comment.trim()}
              aria-label="Send comment"
              className="rounded-xl bg-brand-600 px-3 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}

export default function FeedPage() {
  const { role } = useSessionUser();
  const posts = useApi<FeedPost[]>("/feed");
  const users = useApi<User[]>("/users");
  const deliveryFailures = useDeliveryFailures(WRITER_ROLES.includes(role), "feed_post");

  if (posts.error) return <ErrorNote message={posts.error} onRetry={posts.reload} />;
  if (posts.loading || !posts.data) return <PageLoading />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle
        title="Community Feed"
        subtitle="Announcements, questions and suggestions — your WhatsApp replacement"
      />

      {role !== "auditor" && <Composer onPosted={posts.reload} />}

      {posts.data.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          users={users.data}
          onChanged={posts.reload}
          deliveryFailure={deliveryFailures.map.get(`feed_post:${post.id}`)}
          onDeliveryResent={deliveryFailures.reload}
        />
      ))}
      {posts.data.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          No posts yet — start the conversation!
        </p>
      )}
    </div>
  );
}
