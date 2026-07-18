"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  Check,
  Copy,
  Megaphone,
  MessageSquareQuote,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageLoading,
  PageTitle,
  Stat,
} from "@/components/ui";
import {
  ChannelBadge,
  IsolationBanner,
  MarkdownLite,
  StatusBadge,
  SuperAdminGate,
  TemplateCard,
  useCopy,
} from "./components";
import { useGrowth } from "./useGrowth";
import type {
  GrowthAuditEntry,
  GrowthOverview,
  GrowthPersona,
  GrowthPlaybook,
  GrowthSearchResult,
  GrowthTemplate,
} from "./types";

const TABS = [
  { key: "strategy", label: "Market Strategy" },
  { key: "funnel", label: "Acquisition Funnel" },
  { key: "outreach", label: "Outreach Sequences" },
  { key: "postdemo", label: "Post-Demo Follow-Up" },
  { key: "objections", label: "Objection Handling" },
  { key: "pricing", label: "Pilot & Pricing" },
  { key: "playbooks", label: "Saved Playbooks" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function GrowthCenterPage() {
  return (
    <SuperAdminGate>
      <GrowthCenterInner />
    </SuperAdminGate>
  );
}

function GrowthCenterInner() {
  const [tab, setTab] = useState<TabKey>("strategy");
  const [query, setQuery] = useState("");

  const overview = useGrowth<GrowthOverview>("/overview");
  const playbooks = useGrowth<GrowthPlaybook[]>("/playbooks");
  const templates = useGrowth<GrowthTemplate[]>("/templates");
  const search = useGrowth<GrowthSearchResult[]>(
    query.trim().length >= 2 ? `/search?q=${encodeURIComponent(query.trim())}` : null
  );

  const defaultPlaybook = useMemo(
    () => playbooks.data?.find((p) => p.tags.includes("default")) ?? playbooks.data?.[0],
    [playbooks.data]
  );

  const reloadAll = () => {
    overview.reload();
    playbooks.reload();
    templates.reload();
  };

  if (overview.errorStatus === 503) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Growth Center" />
        <ErrorNote
          message={
            "Growth Center storage is not configured. Set GROWTH_CENTER_MONGO_URI " +
            "to a dedicated database — this module never uses the main application database."
          }
        />
      </div>
    );
  }
  if (overview.error)
    return <ErrorNote message={overview.error} onRetry={reloadAll} />;
  if (overview.loading || !overview.data)
    return <PageLoading variant="stats" />;

  return (
    <div>
      <PageTitle
        title="Growth Center"
        subtitle="Build, refine, and manage the sales playbook for the property-management platform."
        actions={
          <>
            <Badge tone="brand">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Super Admin Only
            </Badge>
            <Button href="/super-admin/growth-center/crm" size="sm">
              <Users className="h-3.5 w-3.5" />
              Leads CRM
            </Button>
          </>
        }
      />
      <IsolationBanner />

      {/* Overview — module-specific numbers only */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Saved playbooks"
          value={String(overview.data.playbookCount)}
          icon={<BookOpenText className="h-4 w-4" />}
          hint={
            overview.data.lastEditedPlaybookTitle
              ? `Last edited: ${overview.data.lastEditedPlaybookTitle}`
              : undefined
          }
        />
        <Stat
          label="Outreach templates"
          value={String(
            overview.data.templateCount - overview.data.objectionResponseCount
          )}
          icon={<Megaphone className="h-4 w-4" />}
        />
        <Stat
          label="Objection responses"
          value={String(overview.data.objectionResponseCount)}
          icon={<MessageSquareQuote className="h-4 w-4" />}
        />
        <Stat
          label="Draft / Approved"
          value={`${overview.data.draftCount} / ${overview.data.approvedCount}`}
          icon={<Target className="h-4 w-4" />}
          hint={`${overview.data.personaCount} personas · ${overview.data.underReviewCount} under review`}
        />
      </div>

      {/* Search within Growth Center content only */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Growth Center content (playbooks, templates, personas)…"
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        />
      </div>
      {query.trim().length >= 2 ? (
        <SearchResults results={search.data} loading={search.loading} />
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "strategy" && (
            <SectionTab playbook={defaultPlaybook} sectionKey="market-strategy" loading={playbooks.loading} />
          )}
          {tab === "funnel" && (
            <SectionTab playbook={defaultPlaybook} sectionKey="funnel-strategy" loading={playbooks.loading} />
          )}
          {tab === "pricing" && (
            <SectionTab playbook={defaultPlaybook} sectionKey="pilot-pricing" loading={playbooks.loading} />
          )}
          {tab === "outreach" && (
            <TemplatesTab
              templates={templates.data}
              loading={templates.loading}
              stages={["first_contact", "follow_up", "demo", "closing"]}
              onChanged={reloadAll}
            />
          )}
          {tab === "postdemo" && (
            <TemplatesTab
              templates={templates.data}
              loading={templates.loading}
              stages={["post_demo"]}
              onChanged={reloadAll}
            />
          )}
          {tab === "objections" && (
            <TemplatesTab
              templates={templates.data}
              loading={templates.loading}
              stages={["objection"]}
              onChanged={reloadAll}
            />
          )}
          {tab === "playbooks" && (
            <PlaybooksTab
              playbooks={playbooks.data}
              loading={playbooks.loading}
              onChanged={reloadAll}
            />
          )}
          {tab === "settings" && <SettingsTab />}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- search */

function SearchResults({
  results,
  loading,
}: {
  results: GrowthSearchResult[] | undefined;
  loading: boolean;
}) {
  if (loading) return <PageLoading label="Searching Growth Center…" />;
  if (!results?.length)
    return (
      <EmptyState
        title="No matches in Growth Center content"
        hint="The search covers only playbooks, templates and personas in this workspace."
      />
    );
  return (
    <div className="space-y-2">
      {results.map((r) => (
        <Card key={`${r.entityType}-${r.id}`} className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{r.title}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{r.snippet}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="slate">{r.entityType}</Badge>
            {r.status && <StatusBadge status={r.status} />}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ sections */

function SectionTab({
  playbook,
  sectionKey,
  loading,
}: {
  playbook: GrowthPlaybook | undefined;
  sectionKey: string;
  loading: boolean;
}) {
  if (loading) return <PageLoading />;
  const section = playbook?.sections.find((s) => s.key === sectionKey);
  if (!playbook || !section)
    return (
      <EmptyState
        title="No content yet"
        hint="The default playbook seeds automatically on first load."
      />
    );
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            From “{playbook.title}” · updated{" "}
            {new Date(playbook.updatedAt).toLocaleString()}
          </p>
        </div>
        <Button href={`/super-admin/growth-center/playbook/${playbook.id}`} variant="secondary" size="sm">
          Open in editor
        </Button>
      </div>
      <MarkdownLite text={section.body} />
    </Card>
  );
}

/* ------------------------------------------------------------ templates */

const STAGE_LABELS: Record<string, string> = {
  first_contact: "Step 1 — First Contact",
  follow_up: "Step 2 — No-Response Follow-Up",
  demo: "Step 3 — Demo Invitation",
  post_demo: "Step 4 — Post-Demo Pitch",
  closing: "Step 5 — Stalled-Close Sequence",
  objection: "Objection Handling",
};

function TemplatesTab({
  templates,
  loading,
  stages,
  onChanged,
}: {
  templates: GrowthTemplate[] | undefined;
  loading: boolean;
  stages: string[];
  onChanged: () => void;
}) {
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const { copiedId, copy } = useCopy();

  if (loading) return <PageLoading />;
  const relevant = (templates ?? []).filter((t) => stages.includes(t.funnelStage));
  const filtered = relevant.filter(
    (t) =>
      (channel === "all" || t.channel === channel) &&
      (status === "all" || t.status === status)
  );

  const channels = Array.from(new Set(relevant.map((t) => t.channel)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:outline-none"
        >
          <option value="all">All channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {stages.map((stage) => {
        const group = filtered.filter((t) => t.funnelStage === stage);
        if (!group.length) return null;
        const sequenceText = group
          .map((t) => `--- ${t.title} ---\n\n${t.content}`)
          .join("\n\n");
        return (
          <div key={stage} className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {STAGE_LABELS[stage] ?? stage}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(`seq-${stage}`, sequenceText)}
              >
                {copiedId === `seq-${stage}` ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy sequence
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {group.map((t) => (
                <TemplateCard key={t.id} template={t} onChanged={onChanged} />
              ))}
            </div>
          </div>
        );
      })}
      {!filtered.length && (
        <EmptyState title="No templates match the current filters" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ playbooks */

function PlaybooksTab({
  playbooks,
  loading,
  onChanged,
}: {
  playbooks: GrowthPlaybook[] | undefined;
  loading: boolean;
  onChanged: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  if (loading) return <PageLoading />;
  const visible = (playbooks ?? []).filter(
    (p) => showArchived || p.status !== "archived"
  );
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show archived
        </label>
        <NewPlaybookButton onChanged={onChanged} />
      </div>
      {!visible.length ? (
        <EmptyState title="No playbooks yet" hint="Create one to get started." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((p) => (
            <Link key={p.id} href={`/super-admin/growth-center/playbook/${p.id}`}>
              <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {p.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.geography.slice(0, 4).map((g) => (
                    <Badge key={g} tone="slate">
                      {g}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-2xs text-slate-400">
                  Created {new Date(p.createdAt).toLocaleDateString()} · Updated{" "}
                  {new Date(p.updatedAt).toLocaleString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewPlaybookButton({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { growthApi } = await import("./api");
          await growthApi("/playbooks", {
            method: "POST",
            body: JSON.stringify({
              title: "Untitled playbook",
              description: "",
            }),
          });
          onChanged();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Rocket className="h-3.5 w-3.5" />
      New playbook
    </Button>
  );
}

/* ------------------------------------------------------------- settings */

function SettingsTab() {
  const personas = useGrowth<GrowthPersona[]>("/personas");
  const audit = useGrowth<GrowthAuditEntry[]>("/audit?limit=30");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Settings2 className="h-4 w-4 text-slate-400" />
          Module configuration
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          Storage boundary and access rules for this workspace.
        </p>
        <ul className="space-y-2 text-xs text-slate-600">
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            Dedicated database via <code className="rounded bg-slate-100 px-1">GROWTH_CENTER_MONGO_URI</code> — no fallback to the application database.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            Every API endpoint independently verifies the super-admin role server-side.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            No owner, tenant, property, payment or community data is read, stored or referenced.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            AI-assisted drafting is not yet enabled; when added it will use only content typed into this module.
          </li>
        </ul>
        <h3 className="mb-2 mt-6 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Users className="h-4 w-4 text-slate-400" />
          Marketing personas
        </h3>
        {personas.loading ? (
          <PageLoading />
        ) : (
          <div className="space-y-2">
            {(personas.data ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold text-slate-800">
                  {p.name}{" "}
                  <span className="font-normal text-slate-400">
                    · {p.portfolioSize}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{p.description}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-bold text-slate-800">Module audit trail</h3>
        <p className="mb-4 text-xs text-slate-500">
          Growth Center actions only — stored inside this module’s database.
        </p>
        {audit.loading ? (
          <PageLoading />
        ) : (
          <ul className="space-y-2">
            {(audit.data ?? []).map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-slate-700">
                    {entry.action.replaceAll("_", " ")}
                  </span>{" "}
                  <span className="truncate text-slate-500">
                    {entry.entityTitle}
                  </span>
                </div>
                <span className="shrink-0 text-slate-400">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
            {!audit.data?.length && (
              <p className="text-xs text-slate-400">No actions recorded yet.</p>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
