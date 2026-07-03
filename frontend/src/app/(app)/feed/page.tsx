"use client";

import { useState } from "react";
import { Camera, Heart, MessageCircle, Paperclip, Pin, ThumbsUp, Sparkles } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { feedPosts, userById } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { FeedPost } from "@/lib/types";
import { Avatar, Badge, Card, PageTitle } from "@/components/ui";

const typeBadge: Record<FeedPost["type"], { label: string; tone: "brand" | "blue" | "violet" | "green" }> = {
  announcement: { label: "Announcement", tone: "brand" },
  question: { label: "Question", tone: "blue" },
  suggestion: { label: "Suggestion", tone: "violet" },
  photo: { label: "Photos", tone: "green" },
};

function PostCard({ post }: { post: FeedPost }) {
  const [reacted, setReacted] = useState<null | "like" | "heart" | "thanks">(null);
  const [showComments, setShowComments] = useState(false);
  const author = userById(post.authorId);
  const badge = typeBadge[post.type];

  const count = (base: number, key: "like" | "heart" | "thanks") =>
    base + (reacted === key ? 1 : 0);

  return (
    <Card className="p-4">
      {post.pinned && (
        <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
          <Pin className="h-3 w-3" /> Pinned
        </p>
      )}
      <div className="flex items-start gap-3">
        <Avatar name={author?.name ?? "?"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{author?.name}</p>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <p className="text-xs text-slate-400">{formatDate(post.date)}</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{post.text}</p>

      {post.attachmentCount > 0 && (
        <div className="mt-3 flex gap-2">
          {Array.from({ length: Math.min(post.attachmentCount, 3) }).map((_, i) => (
            <span
              key={i}
              className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-slate-400 sm:h-24 sm:w-24"
            >
              <Camera className="h-6 w-6" />
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5">
        {(
          [
            { key: "like", icon: ThumbsUp, count: count(post.reactions.like, "like") },
            { key: "heart", icon: Heart, count: count(post.reactions.heart, "heart") },
            { key: "thanks", icon: Sparkles, count: count(post.reactions.thanks, "thanks") },
          ] as const
        ).map(({ key, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setReacted(reacted === key ? null : key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              reacted === key
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

      {showComments && post.comments.length > 0 && (
        <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {post.comments.map((c, i) => (
            <li key={i} className="flex gap-2.5">
              <Avatar name={userById(c.authorId)?.name ?? "?"} size="sm" />
              <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  {userById(c.authorId)?.name}
                </p>
                <p className="mt-0.5 text-sm text-slate-700">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function FeedPage() {
  const { user, role } = useSessionUser();
  const sorted = [...feedPosts].sort((a, b) =>
    a.pinned === b.pinned ? b.date.localeCompare(a.date) : a.pinned ? -1 : 1
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle
        title="Community Feed"
        subtitle="Announcements, questions and suggestions — your WhatsApp replacement"
      />

      {/* Composer */}
      {role !== "auditor" && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="sm" />
            <button className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-400 hover:border-slate-300">
              Share an announcement, question or suggestion…
            </button>
          </div>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
              <Camera className="h-3.5 w-3.5" /> Photo
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
              <Paperclip className="h-3.5 w-3.5" /> Attachment
            </button>
          </div>
        </Card>
      )}

      {sorted.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
