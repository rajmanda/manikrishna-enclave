"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  Globe,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trophy,
  UserPlus,
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
import { Modal } from "@/components/Modal";
import { IsolationBanner, SuperAdminGate } from "../components";
import { growthApi } from "../api";
import { useGrowth } from "../useGrowth";
import type {
  ActivityType,
  CrmOverview,
  DiscoverResponse,
  GrowthLead,
  GrowthLeadActivity,
  ImportLeadsResponse,
  LeadCandidate,
  LeadSource,
  LeadStage,
} from "../types";

const STAGES: { value: LeadStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "qualified", label: "Qualified" },
  { value: "demo_scheduled", label: "Demo scheduled" },
  { value: "demo_done", label: "Demo done" },
  { value: "pilot_proposed", label: "Pilot proposed" },
  { value: "won", label: "Won 🎉" },
  { value: "lost", label: "Lost" },
];

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "discovery", label: "Web discovery" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "meeting", label: "Meeting" },
  { value: "demo", label: "Demo" },
  { value: "proposal", label: "Proposal" },
];

function stageTone(stage: LeadStage): "green" | "red" | "amber" | "blue" | "slate" | "violet" | "brand" {
  if (stage === "won") return "green";
  if (stage === "lost") return "red";
  if (stage === "new") return "slate";
  if (stage === "contacted" || stage === "responded") return "blue";
  if (stage === "qualified") return "violet";
  return "amber"; // demo / pilot stages
}

function stageLabel(stage: LeadStage): string {
  return STAGES.find((s) => s.value === stage)?.label ?? stage;
}

function followUpTone(iso: string | null): string {
  if (!iso) return "text-slate-400";
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) return "font-semibold text-red-600";
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  if (due <= endToday) return "font-semibold text-amber-600";
  return "text-slate-500";
}

export default function CrmPage() {
  return (
    <SuperAdminGate>
      <CrmInner />
    </SuperAdminGate>
  );
}

function CrmInner() {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState("open");
  const [due, setDue] = useState("");
  const [q, setQ] = useState("");
  const [showDiscover, setShowDiscover] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<GrowthLead | null>(null);

  const overview = useGrowth<CrmOverview>("/crm/overview");
  const params = new URLSearchParams();
  if (stageFilter && stageFilter !== "open" && stageFilter !== "all")
    params.set("stage", stageFilter);
  if (due) params.set("due", due);
  if (q.trim()) params.set("q", q.trim());
  const leads = useGrowth<GrowthLead[]>(`/crm/leads?${params.toString()}`);

  const reloadAll = () => {
    overview.reload();
    leads.reload();
  };

  if (overview.errorStatus === 503)
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Leads CRM" />
        <ErrorNote message={overview.error ?? "Growth Center is not configured."} />
      </div>
    );
  if (overview.error) return <ErrorNote message={overview.error} onRetry={reloadAll} />;
  if (overview.loading || !overview.data) return <PageLoading variant="stats" />;

  const visibleLeads = (leads.data ?? []).filter((lead) =>
    stageFilter === "open"
      ? lead.stage !== "won" && lead.stage !== "lost"
      : true
  );

  return (
    <div>
      <button
        onClick={() => router.push("/super-admin/growth-center")}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Growth Center
      </button>
      <PageTitle
        title="Leads CRM"
        subtitle="Find Hyderabad property managers, work the pipeline, track every follow-up to won or lost."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Add lead
            </Button>
            <Button size="sm" onClick={() => setShowDiscover(true)}>
              <Sparkles className="h-3.5 w-3.5" />
              Discover leads
            </Button>
          </>
        }
      />
      <IsolationBanner />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Open leads"
          value={String(overview.data.openLeads)}
          icon={<Users className="h-4 w-4" />}
          hint={`${overview.data.totalLeads} total · ${overview.data.unscheduledOpen} without a scheduled follow-up`}
        />
        <Stat
          label="Overdue follow-ups"
          value={String(overview.data.overdueFollowUps)}
          tone={overview.data.overdueFollowUps > 0 ? "negative" : "default"}
          icon={<AlarmClock className="h-4 w-4" />}
          onClick={() => {
            setDue("overdue");
            setStageFilter("open");
          }}
        />
        <Stat
          label="Due today / this week"
          value={`${overview.data.dueToday} / ${overview.data.dueThisWeek}`}
          icon={<AlarmClock className="h-4 w-4" />}
          onClick={() => {
            setDue("today");
            setStageFilter("open");
          }}
        />
        <Stat
          label="Won / Lost"
          value={`${overview.data.wonCount} / ${overview.data.lostCount}`}
          tone={overview.data.wonCount > 0 ? "positive" : "default"}
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, contact, phone, area…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:outline-none"
        >
          <option value="open">All open</option>
          <option value="all">Everything</option>
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:outline-none"
        >
          <option value="">Any follow-up date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </select>
      </div>

      {/* Lead list */}
      {leads.loading ? (
        <PageLoading />
      ) : !visibleLeads.length ? (
        <EmptyState
          title="No leads match"
          hint="Use Discover to search the web for Hyderabad property managers, or add leads you found on Facebook/LinkedIn manually."
        />
      ) : (
        <div className="space-y-2">
          {visibleLeads.map((lead) => (
            <Card
              key={lead.id}
              onClick={() => setSelected(lead)}
              className="cursor-pointer p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {lead.company}
                    {lead.contactName && (
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {lead.contactName}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {lead.area && <span>{lead.area}</span>}
                    {lead.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </span>
                    )}
                    {lead.website && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {lead.website.replace(/^https?:\/\//, "")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={stageTone(lead.stage)}>{stageLabel(lead.stage)}</Badge>
                  <span className={`text-2xs ${followUpTone(lead.nextFollowUpAt)}`}>
                    {lead.nextFollowUpAt
                      ? `Follow up ${new Date(lead.nextFollowUpAt).toLocaleDateString()}`
                      : "No follow-up scheduled"}
                  </span>
                </div>
              </div>
              {lead.nextAction && (
                <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                  Next: {lead.nextAction}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {showDiscover && (
        <DiscoverDialog
          onClose={() => setShowDiscover(false)}
          onImported={reloadAll}
        />
      )}
      {showAdd && (
        <AddLeadDialog onClose={() => setShowAdd(false)} onCreated={reloadAll} />
      )}
      {selected && (
        <LeadDrawer
          leadId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={reloadAll}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ discovery */

function DiscoverDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [query, setQuery] = useState("property management services");
  const [area, setArea] = useState("Gachibowli");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setImportSummary(null);
    try {
      const resp = await growthApi<DiscoverResponse>("/crm/discover", {
        method: "POST",
        body: JSON.stringify({ query, area, city: "Hyderabad", limit: 8 }),
      });
      setResult(resp);
      setChecked(new Set(resp.candidates.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const candidates: LeadCandidate[] = result.candidates.filter((_, i) =>
        checked.has(i)
      );
      const resp = await growthApi<ImportLeadsResponse>("/crm/import", {
        method: "POST",
        body: JSON.stringify({ candidates, area }),
      });
      setImportSummary(
        `${resp.imported.length} imported` +
          (resp.skippedDuplicates.length
            ? `, ${resp.skippedDuplicates.length} already in the CRM (${resp.skippedDuplicates.join(", ")})`
            : "")
      );
      setResult(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Discover leads on the web" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Searches the public web via Firecrawl (directories, agency sites,
          search results) and extracts contact details for your review.
          Nothing is saved until you import. LinkedIn/Facebook are not
          scraped — add leads from there manually.
        </p>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Looking for</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "property management services", "NRI property care"'
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">
            Area (Hyderabad)
          </span>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Gachibowli, Madhapur, HITEC City, Secunderabad…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <Button onClick={run} disabled={busy || !query.trim()} className="w-full">
          <Sparkles className="h-4 w-4" />
          {busy && !result ? "Searching the web…" : "Search"}
        </Button>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        {importSummary && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {importSummary}
          </p>
        )}
        {result && (
          <>
            <p className="text-2xs text-slate-400">
              Query used: “{result.queryUsed}”
            </p>
            {!result.candidates.length && (
              <p className="text-xs text-slate-500">
                No candidates found — try a different area or phrasing.
              </p>
            )}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {result.candidates.map((cand, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(i);
                      else next.delete(i);
                      setChecked(next);
                    }}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className="min-w-0 text-xs">
                    <span className="block font-semibold text-slate-800">
                      {cand.company}
                    </span>
                    <span className="block truncate text-slate-500">
                      {cand.website}
                    </span>
                    {(cand.phones.length > 0 || cand.emails.length > 0) && (
                      <span className="block text-slate-600">
                        {[...cand.phones, ...cand.emails].join(" · ")}
                      </span>
                    )}
                    {cand.snippet && (
                      <span className="mt-0.5 block text-slate-400">
                        {cand.snippet.slice(0, 120)}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {result.candidates.length > 0 && (
              <Button
                onClick={doImport}
                disabled={busy || checked.size === 0}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Import {checked.size} selected
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- add lead */

function AddLeadDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    area: "",
    source: "manual" as LeadSource,
    sourceUrl: "",
    notes: "",
    nextFollowUpAt: "",
    nextAction: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [extracted, setExtracted] = useState<{ phones: string[]; emails: string[] } | null>(null);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const extract = async () => {
    setBusy(true);
    setError(null);
    try {
      const found = await growthApi<{ phones: string[]; emails: string[] }>(
        "/crm/extract-contacts",
        { method: "POST", body: JSON.stringify({ text: pasteText }) }
      );
      setExtracted(found);
      setForm((f) => ({
        ...f,
        phone: f.phone || found.phones[0] || "",
        email: f.email || found.emails[0] || "",
        // Pasted content usually comes from a FB group — default the source.
        source: f.source === "manual" ? "facebook" : f.source,
        notes: f.notes || pasteText.slice(0, 500),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await growthApi("/crm/leads", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          nextFollowUpAt: form.nextFollowUpAt || null,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lead");
      setBusy(false);
    }
  };

  const input =
    "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none";

  return (
    <Modal title="Add lead" onClose={onClose}>
      <div className="space-y-3">
        {/* Paste-and-extract: for posts you're reading in a FB group /
            WhatsApp yourself — copy, paste, extract. No scraping. */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <span className="text-xs font-semibold text-brand-700">
            Quick capture — paste a Facebook post / WhatsApp message
          </span>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={3}
            placeholder="Paste the post or comment here — phone numbers and emails will be picked out automatically."
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-brand-400 focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-2xs text-slate-400">
              For content you're viewing yourself — nothing is scraped.
            </p>
            <Button size="sm" variant="secondary" disabled={busy || !pasteText.trim()} onClick={extract}>
              Extract contacts
            </Button>
          </div>
          {extracted && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...extracted.phones, ...extracted.emails].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    c.includes("@") ? set("email", c) : set("phone", c)
                  }
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-brand-400"
                  title="Click to use"
                >
                  {c}
                </button>
              ))}
              {!extracted.phones.length && !extracted.emails.length && (
                <p className="text-xs text-slate-500">
                  No phone numbers or emails found in the pasted text.
                </p>
              )}
            </div>
          )}
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-500">
            Company / business name *
          </span>
          <input value={form.company} onChange={(e) => set("company", e.target.value)} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Contact person</span>
            <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Area</span>
            <input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="Madhapur" className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Phone / WhatsApp</span>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91…" className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Email</span>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Source</span>
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className={input}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              Source link (FB post, profile…)
            </span>
            <input value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Website</span>
            <input value={form.website} onChange={(e) => set("website", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">First follow-up</span>
            <input type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} className={input} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Next action</span>
          <input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="Send first-contact WhatsApp" className={input} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Notes</span>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={input} />
        </label>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !form.company.trim()}>
            {busy ? "Saving…" : "Save lead"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- lead drawer */

function LeadDrawer({
  leadId,
  onClose,
  onChanged,
}: {
  leadId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const lead = useGrowth<GrowthLead>(`/crm/leads/${leadId}`);
  const activities = useGrowth<GrowthLeadActivity[]>(
    `/crm/leads/${leadId}/activities`
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logType, setLogType] = useState<ActivityType>("whatsapp");
  const [logSummary, setLogSummary] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [confirmingLost, setConfirmingLost] = useState(false);

  const refresh = () => {
    lead.reload();
    activities.reload();
    onChanged();
  };

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const changeStage = (stage: LeadStage) => {
    if (stage === "lost") {
      setConfirmingLost(true);
      return;
    }
    act(() =>
      growthApi(`/crm/leads/${leadId}/stage`, {
        method: "POST",
        body: JSON.stringify({ stage }),
      })
    );
  };

  const logActivity = () =>
    act(async () => {
      await growthApi(`/crm/leads/${leadId}/activities`, {
        method: "POST",
        body: JSON.stringify({
          activityType: logType,
          summary: logSummary,
          nextFollowUpAt: nextDate || null,
          nextAction: nextAction || undefined,
        }),
      });
      setLogSummary("");
      setNextDate("");
      setNextAction("");
    });

  if (lead.loading || !lead.data)
    return (
      <Modal title="Lead" onClose={onClose}>
        <PageLoading />
      </Modal>
    );
  const l = lead.data;

  return (
    <Modal title={l.company} onClose={onClose}>
      <div className="space-y-4">
        {/* Facts */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={stageTone(l.stage)}>{stageLabel(l.stage)}</Badge>
          <Badge tone="slate">{SOURCES.find((s) => s.value === l.source)?.label ?? l.source}</Badge>
          {l.area && <Badge tone="slate">{l.area}</Badge>}
        </div>
        <div className="space-y-1 text-xs text-slate-600">
          {l.contactName && <p>Contact: {l.contactName} {l.roleTitle && `(${l.roleTitle})`}</p>}
          {l.phone && (
            <p>
              Phone: {l.phone}{" "}
              <a
                href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-600 hover:underline"
              >
                Open WhatsApp ↗
              </a>
            </p>
          )}
          {l.email && <p>Email: {l.email}</p>}
          {l.website && (
            <p>
              Website:{" "}
              <a href={l.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                {l.website.replace(/^https?:\/\//, "")} ↗
              </a>
            </p>
          )}
          {l.notes && <p className="rounded-lg bg-slate-50 p-2">{l.notes}</p>}
          {l.lostReason && <p className="text-red-600">Lost: {l.lostReason}</p>}
          <p className="text-slate-400">
            Added {new Date(l.createdAt).toLocaleDateString()} · Stage since{" "}
            {new Date(l.stageChangedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Stage control */}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Pipeline stage</span>
          <select
            value={l.stage}
            disabled={busy}
            onChange={(e) => changeStage(e.target.value as LeadStage)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {confirmingLost && (
          <div className="rounded-xl border border-red-100 bg-red-50/60 p-3">
            <label className="block">
              <span className="text-xs font-semibold text-red-700">
                Why was it lost? (helps refine the playbook)
              </span>
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="e.g. price, timing, happy with WhatsApp"
                className="mt-1 w-full rounded-xl border border-red-200 px-3 py-2 text-sm focus:outline-none"
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingLost(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await growthApi(`/crm/leads/${leadId}/stage`, {
                      method: "POST",
                      body: JSON.stringify({ stage: "lost", lostReason }),
                    });
                    setConfirmingLost(false);
                  })
                }
              >
                Mark lost
              </Button>
            </div>
          </div>
        )}

        {/* Log a touch + schedule next follow-up */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            Log a touch & schedule the next follow-up
          </p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value as ActivityType)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
              title="Next follow-up date"
            />
          </div>
          <input
            value={logSummary}
            onChange={(e) => setLogSummary(e.target.value)}
            placeholder="What happened? e.g. Sent first-contact message"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
          />
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Next action, e.g. 48h follow-up if no reply"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
          />
          <Button
            size="sm"
            className="mt-2 w-full"
            disabled={busy || !logSummary.trim()}
            onClick={logActivity}
          >
            Log activity
          </Button>
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        {/* Timeline */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Timeline</p>
          {activities.loading ? (
            <PageLoading />
          ) : !activities.data?.length ? (
            <p className="text-xs text-slate-400">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {activities.data.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 border-b border-slate-50 pb-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold capitalize text-slate-700">
                      {a.activityType.replace("_", " ")}
                    </span>{" "}
                    <span className="text-slate-500">{a.summary}</span>
                  </div>
                  <span className="shrink-0 text-slate-400">
                    {new Date(a.happenedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Danger zone */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete lead "${l.company}" and its timeline?`))
                act(async () => {
                  await growthApi(`/crm/leads/${leadId}`, { method: "DELETE" });
                  onClose();
                });
            }}
          >
            Delete lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}
