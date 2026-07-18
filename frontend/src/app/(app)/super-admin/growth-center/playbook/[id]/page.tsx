"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Check,
  Copy,
  Download,
  History,
  Layers,
  Pencil,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  PageLoading,
} from "@/components/ui";
import {
  IsolationBanner,
  MarkdownLite,
  STATUS_OPTIONS,
  StatusBadge,
  SuperAdminGate,
  useCopy,
} from "../../components";
import { downloadExport, growthApi } from "../../api";
import { useGrowth } from "../../useGrowth";
import type { ContentStatus, GrowthPlaybook, PlaybookSection } from "../../types";

export default function PlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <SuperAdminGate>
      <PlaybookEditor playbookId={id} />
    </SuperAdminGate>
  );
}

function PlaybookEditor({ playbookId }: { playbookId: string }) {
  const router = useRouter();
  const { data, error, loading, reload } = useGrowth<GrowthPlaybook>(
    `/playbooks/${playbookId}`
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { copiedId, copy } = useCopy();

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      reload();
      after?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoading variant="stats" />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div>
      <button
        onClick={() => router.push("/super-admin/growth-center")}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Growth Center
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <TitleEditor playbook={data} onSave={(title) => act(() => growthApi(`/playbooks/${data.id}`, { method: "PATCH", body: JSON.stringify({ title }) }))} />
          <p className="mt-1 text-sm text-slate-500">{data.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={data.status} />
            {data.geography.map((g) => (
              <Badge key={g} tone="slate">
                {g}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-2xs text-slate-400">
            Created {new Date(data.createdAt).toLocaleString()} · Updated{" "}
            {new Date(data.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={data.status}
            disabled={busy}
            onChange={(e) =>
              act(() =>
                growthApi(`/playbooks/${data.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: e.target.value as ContentStatus }),
                })
              )
            }
            className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              act(
                () => growthApi(`/playbooks/${data.id}/duplicate`, { method: "POST" }),
                () => router.push("/super-admin/growth-center")
              )
            }
          >
            <Layers className="h-3.5 w-3.5" />
            Duplicate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !data.previousVersion}
            onClick={() =>
              act(() => growthApi(`/playbooks/${data.id}/restore`, { method: "POST" }))
            }
          >
            <History className="h-3.5 w-3.5" />
            Restore last save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || data.status === "archived"}
            onClick={() =>
              act(() =>
                growthApi(`/playbooks/${data.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "archived" }),
                })
              )
            }
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      </div>

      {actionError && (
        <p className="mb-3 text-xs font-medium text-red-600">{actionError}</p>
      )}

      <IsolationBanner />

      {/* Export */}
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-4">
        <Download className="h-4 w-4 text-slate-400" />
        <span className="mr-2 text-xs font-semibold text-slate-600">Export</span>
        {(["markdown", "text", "json"] as const).map((fmt) => (
          <Button
            key={fmt}
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadExport(
                data.id,
                fmt,
                `${slug}.${fmt === "markdown" ? "md" : fmt === "text" ? "txt" : "json"}`
              )
            }
          >
            {fmt === "markdown" ? "Markdown" : fmt === "text" ? "Plain text" : "JSON"}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            copy(
              "full-playbook",
              data.sections
                .map((s) => `# ${s.title}\n\n${s.body}`)
                .join("\n\n")
            )
          }
        >
          {copiedId === "full-playbook" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy all sections
        </Button>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {[...data.sections]
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              busy={busy}
              onSave={(body) =>
                act(() =>
                  growthApi(`/playbooks/${data.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      sections: data.sections.map((s) =>
                        s.id === section.id ? { ...s, body } : s
                      ),
                    }),
                  })
                )
              }
            />
          ))}
        {!data.sections.length && (
          <Card className="p-6 text-center text-sm text-slate-400">
            This playbook has no sections yet.
          </Card>
        )}
      </div>
    </div>
  );
}

function TitleEditor({
  playbook,
  onSave,
}: {
  playbook: GrowthPlaybook;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(playbook.title);
  useEffect(() => setTitle(playbook.title), [playbook.title]);

  if (!editing)
    return (
      <button
        className="group flex items-center gap-2 text-left"
        onClick={() => setEditing(true)}
        title="Rename playbook"
      >
        <h1 className="text-display-sm text-slate-900">{playbook.title}</h1>
        <Pencil className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setEditing(false);
        if (title.trim() && title !== playbook.title) onSave(title.trim());
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (title.trim() && title !== playbook.title) onSave(title.trim());
        }}
        className="rounded-xl border border-brand-300 px-3 py-1.5 text-lg font-bold text-slate-900 focus:outline-none"
      />
    </form>
  );
}

function SectionCard({
  section,
  busy,
  onSave,
}: {
  section: PlaybookSection;
  busy: boolean;
  onSave: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(section.body);
  useEffect(() => setBody(section.body), [section.body]);
  const { copiedId, copy } = useCopy();

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(section.id, section.body)}
          >
            {copiedId === section.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy
          </Button>
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setBody(section.body);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  if (body !== section.body) onSave(body);
                }}
              >
                {busy ? "Saving…" : "Save draft"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(30, Math.max(10, body.split("\n").length + 2))}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed focus:border-brand-400 focus:outline-none"
        />
      ) : (
        <MarkdownLite text={section.body} />
      )}
    </Card>
  );
}
