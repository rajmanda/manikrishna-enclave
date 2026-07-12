"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Building2,
  DoorOpen,
  RefreshCw,
  Search,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import type { PlatformInsights } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { PlatformActivityChart } from "@/components/charts";
import { Badge, Card, ErrorNote, PageLoading, PageTitle, Stat } from "@/components/ui";

// Sequential indigo ramp (light→dark, validated) — funnel stages are one
// measure at four depths, not four categories.
const FUNNEL_COLORS = ["#818cf8", "#6366f1", "#4f46e5", "#4338ca"];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owners",
  tenant: "Tenants",
  property_manager: "Property managers",
  community_admin: "Community admins",
  super_admin: "Super admins",
  auditor: "Auditors",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  // formatDate expects a date-only string — trim the time part.
  return formatDate(iso.slice(0, 10));
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

/** Horizontal magnitude bars with direct labels (funnel + feature usage). */
function BarRow({
  label,
  value,
  max,
  color,
  sublabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  sublabel?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-800">
          {value.toLocaleString()}
          {sublabel && <span className="ml-1.5 font-normal text-slate-400">{sublabel}</span>}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

type AdoptionFilter = "all" | "never" | "active";

export default function InsightsPage() {
  const { role } = useSessionUser();
  const insights = useApi<PlatformInsights>(role === "super_admin" ? "/insights/platform" : null);
  const [adoptionFilter, setAdoptionFilter] = useState<AdoptionFilter>("all");
  const [query, setQuery] = useState("");

  const cutoff7 = useMemo(
    () => new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    []
  );

  if (role !== "super_admin")
    return <ErrorNote message="Platform insights are visible to super admins only." />;
  if (insights.error)
    return <ErrorNote message={insights.error} onRetry={insights.reload} />;
  if (insights.loading || !insights.data) return <PageLoading />;

  const d = insights.data;
  const t = d.totals;
  const funnelMax = d.funnel[0]?.count ?? 0;
  const moduleMax = d.moduleUsage[0]?.actions ?? 0;

  const q = query.trim().toLowerCase();
  const adoptionRows = d.userAdoption.filter((u) => {
    if (adoptionFilter === "never" && u.lastLogin) return false;
    if (adoptionFilter === "active" && (!u.lastLogin || u.lastLogin < cutoff7)) return false;
    return (
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.communityName.toLowerCase().includes(q)
    );
  });
  const neverCount = d.userAdoption.filter((u) => !u.lastLogin).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Platform Insights"
        subtitle="Adoption, engagement and money across your portfolio"
        actions={
          <button
            onClick={insights.reload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Communities" value={String(t.communities)} icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Apartments" value={String(t.apartments)} icon={<DoorOpen className="h-4 w-4" />} />
        <Stat label="Whitelisted users" value={String(t.users)} icon={<UsersRound className="h-4 w-4" />} />
        <Stat
          label="Logged in ever"
          value={`${t.activatedUsers} (${pct(t.activatedUsers, t.users)}%)`}
          tone={pct(t.activatedUsers, t.users) >= 50 ? "positive" : "negative"}
          hint={t.users - t.activatedUsers > 0 ? `${t.users - t.activatedUsers} never logged in` : "Everyone's on board"}
        />
        <Stat
          label="Active last 7 days"
          value={String(t.active7d)}
          tone="positive"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Stat
          label="Actions last 30 days"
          value={t.actions30d.toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          hint={`${t.logins.toLocaleString()} logins all-time`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Adoption funnel */}
        <SectionCard title="Adoption funnel" hint="of whitelisted accounts">
          <div className="space-y-3">
            {d.funnel.map((s, i) => (
              <BarRow
                key={s.stage}
                label={s.stage}
                value={s.count}
                max={funnelMax}
                color={FUNNEL_COLORS[i] ?? FUNNEL_COLORS[FUNNEL_COLORS.length - 1]}
                sublabel={`${pct(s.count, funnelMax)}%`}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Login tracking starts from this release — &ldquo;never logged in&rdquo; users may
            simply predate it.
          </p>
        </SectionCard>

        {/* Daily engagement */}
        <SectionCard title="Daily engagement" hint="last 30 days, from the audit trail">
          <PlatformActivityChart data={d.activitySeries} />
        </SectionCard>

        {/* Feature usage */}
        <SectionCard title="What people use" hint="actions by module, last 30 days">
          {d.moduleUsage.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {d.moduleUsage.slice(0, 8).map((m) => (
                <BarRow
                  key={m.module}
                  label={m.module}
                  value={m.actions}
                  max={moduleMax}
                  color="#6366f1"
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Money + who's on the platform */}
        <SectionCard title="Financial pulse" hint="community ledger, all time">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Billed</p>
              <p className="tabular text-sm font-bold text-slate-800 sm:text-base">{formatINR(t.billed)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Collected</p>
              <p className="tabular text-sm font-bold text-emerald-600 sm:text-base">{formatINR(t.collected)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Collection</p>
              <p className={`text-sm font-bold sm:text-base ${t.collectionRate >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                {t.collectionRate}%
              </p>
            </div>
          </div>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Who&apos;s on the platform
          </h3>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {d.roles.map((r) => (
              <div key={r.role} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-medium text-slate-700">{ROLE_LABELS[r.role] ?? r.role}</span>
                <span className="text-slate-500">
                  <span className="font-semibold text-slate-800">{r.count}</span>
                  {" · "}
                  {r.activated} logged in
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Per-community health */}
      <SectionCard title="Communities" hint="tap Portfolio to manage">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Community</th>
                <th className="px-3 py-2 text-right">Apts</th>
                <th className="px-3 py-2 text-right">Users</th>
                <th className="px-3 py-2 text-right">Logged in</th>
                <th className="px-3 py-2 text-right">Active 7d</th>
                <th className="px-3 py-2 text-right">Actions 30d</th>
                <th className="px-3 py-2 text-right">Collection</th>
                <th className="px-3 py-2 text-right">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.communities.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2.5 font-semibold">{c.name}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.apartments}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.users}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {c.activatedUsers}
                    <span className="ml-1 text-xs text-slate-400">({pct(c.activatedUsers, c.users)}%)</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.active7d}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.actions30d}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge tone={c.collectionRate >= 80 ? "green" : c.collectionRate >= 50 ? "amber" : "red"}>
                      {c.collectionRate}%
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500">
                    {c.lastActivity ? timeAgo(c.lastActivity) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Whitelist adoption — the onboarding chase list */}
      <SectionCard title="Whitelist adoption" hint={`${neverCount} of ${d.userAdoption.length} never logged in`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", `All (${d.userAdoption.length})`],
              ["never", `Never logged in (${neverCount})`],
              ["active", "Active last 7d"],
            ] as [AdoptionFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAdoptionFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                adoptionFilter === key
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[10rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, community…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs shadow-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Community</th>
                <th className="px-3 py-2 text-right">Logins</th>
                <th className="px-3 py-2 text-right">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adoptionRows.map((u) => (
                <tr key={u.id}>
                  <td className="max-w-[16rem] px-3 py-2.5">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {(ROLE_LABELS[u.role] ?? u.role).replace(/s$/, "")}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{u.communityName}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{u.loginCount}</td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {u.lastLogin ? (
                      <span className="text-slate-600">{timeAgo(u.lastLogin)}</span>
                    ) : (
                      <Badge tone="amber">never</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {adoptionRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs text-slate-400">
                    Nobody matches this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <p className="text-center text-[11px] text-slate-400">
        Generated {formatDate(d.generatedAt.slice(0, 10))} · scoped to communities you own
      </p>
    </div>
  );
}
