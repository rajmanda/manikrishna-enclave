"use client";

// Growth Center building blocks. Visual primitives (Card, Button, Badge,
// Modal…) are reused from the app's design system — visual reuse is
// approved; data-layer reuse is not.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  History,
  Layers,
  Lock,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/context/AuthContext";
import { growthApi } from "./api";
import type { Channel, ContentStatus, GrowthTemplate } from "./types";

/* ------------------------------------------------------------ status */

export function StatusBadge({ status }: { status: ContentStatus | string }) {
  if (status === "approved") return <Badge tone="green">Approved</Badge>;
  if (status === "under_review") return <Badge tone="amber">Under review</Badge>;
  if (status === "archived") return <Badge tone="slate">Archived</Badge>;
  return <Badge tone="blue">Draft</Badge>;
}

export const STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "archived", label: "Archived" },
];

export function ChannelBadge({ channel }: { channel: Channel | string }) {
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    email: "Email",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    any: "Any channel",
  };
  return <Badge tone="violet">{labels[channel] ?? channel}</Badge>;
}

/* ------------------------------------------------------------- guard */

/** Frontend gate: renders children only for a verified super admin. The
 * backend independently enforces the role on every endpoint. */
export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  if (!user || user.role !== "super_admin") {
    return (
      <Card className="mx-auto mt-16 flex max-w-md flex-col items-center px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Lock className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-semibold text-slate-700">
          Super Admin only
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          The Growth Center is restricted to platform super admins.
        </p>
        <Button size="sm" className="mt-4" onClick={() => router.replace("/dashboard")}>
          Back to dashboard
        </Button>
      </Card>
    );
  }
  return <>{children}</>;
}

/* ---------------------------------------------------------- isolation note */

export function IsolationBanner() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
      <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
      <p className="text-xs text-brand-700">
        This workspace is isolated from community and property-management
        data. It stores only marketing strategy and sales copy, in its own
        database.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- copy to clipboard */

export function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string, text: string, logPath?: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    if (logPath) growthApi(logPath, { method: "POST" }).catch(() => undefined);
  };
  return { copiedId, copy };
}

/* --------------------------------------------------------- template card */

export function TemplateCard({
  template,
  onChanged,
}: {
  template: GrowthTemplate;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { copiedId, copy } = useCopy();

  const preview =
    template.content.length > 240 && !expanded
      ? `${template.content.slice(0, 240)}…`
      : template.content;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{template.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={template.status} />
            <ChannelBadge channel={template.channel} />
            {template.targetPersona && (
              <Badge tone="slate">{template.targetPersona}</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              copy(
                template.id,
                template.content,
                `/templates/${template.id}/log-copy`
              )
            }
          >
            {copiedId === template.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiedId === template.id ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>
      <button
        className="mt-3 block w-full text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {preview}
        </p>
      </button>
      <p className="mt-2 text-2xs text-slate-400">
        Updated {new Date(template.updatedAt).toLocaleString()}
      </p>
      {editing && (
        <TemplateEditor
          template={template}
          onClose={() => setEditing(false)}
          onChanged={onChanged}
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------------- template editor */

export function TemplateEditor({
  template,
  onClose,
  onChanged,
}: {
  template: GrowthTemplate;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [content, setContent] = useState(template.content);
  const [status, setStatus] = useState<ContentStatus>(template.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      setBusy(false);
    }
  };

  const save = () =>
    act(() =>
      growthApi(`/templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, content, status }),
      })
    );

  return (
    <Modal title="Edit template" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Content</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContentStatus)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                act(() =>
                  growthApi(`/templates/${template.id}/duplicate`, {
                    method: "POST",
                  })
                )
              }
            >
              <Layers className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !template.previousVersion}
              onClick={() =>
                act(() =>
                  growthApi(`/templates/${template.id}/restore`, {
                    method: "POST",
                  })
                )
              }
            >
              <History className="h-3.5 w-3.5" />
              Restore
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </div>
        <p className="text-2xs text-slate-400">
          Created {new Date(template.createdAt).toLocaleString()} · Updated{" "}
          {new Date(template.updatedAt).toLocaleString()}
        </p>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------- markdown-ish view */

/** Light renderer for the playbook sections (headings, bold, lists). Content
 * is authored by the super admin inside this module; rendered as text nodes
 * (never HTML injection). */
export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed text-slate-600">
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return (
            <h4 key={i} className="pt-3 text-sm font-semibold text-slate-800">
              {line.slice(4)}
            </h4>
          );
        if (line.startsWith("## "))
          return (
            <h3 key={i} className="pt-4 text-[15px] font-bold text-slate-900">
              {line.slice(3)}
            </h3>
          );
        if (line.startsWith("# "))
          return (
            <h2 key={i} className="pt-4 text-base font-bold text-slate-900">
              {line.slice(2)}
            </h2>
          );
        if (/^\s*[-•]\s/.test(line))
          return (
            <p key={i} className="pl-4">
              • <InlineBold text={line.replace(/^\s*[-•]\s/, "")} />
            </p>
          );
        if (/^\s*\d+\.\s/.test(line))
          return (
            <p key={i} className="pl-4">
              <InlineBold text={line.trim()} />
            </p>
          );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return (
          <p key={i}>
            <InlineBold text={line} />
          </p>
        );
      })}
    </div>
  );
}

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-slate-800">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
