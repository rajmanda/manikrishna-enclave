"use client";

// Setup Assistant — the paved road for configuring a fresh community.
// The admin thinks in "flats and the people in them"; households (billing
// accounts) and legal-title records are created silently underneath.

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Home,
  PartyPopper,
  UserRound,
  Users,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type {
  Account,
  Apartment,
  SetupResidentResult,
  SetupStatus,
  User,
} from "@/lib/types";
import { inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  PageLoading,
  PageTitle,
  ProgressBar,
} from "@/components/ui";

const WRITE_ROLES = ["super_admin", "property_manager", "community_admin"];

interface ResidentDraft {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  rented: boolean;
  tenantName: string;
  tenantEmail: string;
  error?: string;
}

const emptyDraft = (): ResidentDraft => ({
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  rented: false,
  tenantName: "",
  tenantEmail: "",
});

function StepHeader({
  n,
  title,
  done,
  hint,
}: {
  n: number;
  title: string;
  done: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export default function SetupPage() {
  const { role } = useAuth();
  const status = useApi<SetupStatus>("/setup/status");
  const apartments = useApi<Apartment[]>("/apartments");
  const accounts = useApi<Account[]>("/accounts");
  const users = useApi<User[]>("/users");

  // Step 1 state
  const [numbers, setNumbers] = useState("");
  const [flatsBusy, setFlatsBusy] = useState(false);
  const [flatsError, setFlatsError] = useState<string | null>(null);

  // Step 2 state
  const [drafts, setDrafts] = useState<Record<string, ResidentDraft>>({});
  const [residentsBusy, setResidentsBusy] = useState(false);

  // Step 3 state
  const [mgrName, setMgrName] = useState("");
  const [mgrEmail, setMgrEmail] = useState("");
  const [mgrBusy, setMgrBusy] = useState(false);
  const [mgrError, setMgrError] = useState<string | null>(null);

  if (role && !WRITE_ROLES.includes(role))
    return (
      <EmptyState
        title="Managers and admins only"
        hint="The Setup Assistant is for the people configuring the community."
      />
    );
  if (status.error) return <ErrorNote message={status.error} onRetry={status.reload} />;
  if (status.loading || !status.data || !apartments.data || !accounts.data)
    return <PageLoading />;

  const s = status.data;
  const covered = new Set(accounts.data.flatMap((a) => a.apartmentIds));
  const pendingFlats = apartments.data.filter((a) => !covered.has(a.id));

  const step1Done = s.apartments > 0;
  const step2Done = step1Done && pendingFlats.length === 0;
  const step3Done = s.managers > 0;
  const doneCount = [step1Done, step2Done, step3Done].filter(Boolean).length;
  const allDone = doneCount === 3;

  const managers = (users.data ?? []).filter(
    (u) => u.role === "property_manager" || u.role === "community_admin"
  );

  const reloadAll = () => {
    status.reload();
    apartments.reload();
    accounts.reload();
    users.reload();
  };

  /* ---------------- Step 1: flats ---------------- */
  const deriveFloor = (num: string) =>
    /^\d{3,}$/.test(num) ? Math.floor(parseInt(num, 10) / 100) : 0;
  const parsedNumbers = [
    ...new Set(numbers.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean)),
  ];

  async function createFlats(e: React.FormEvent) {
    e.preventDefault();
    setFlatsBusy(true);
    setFlatsError(null);
    const failed: string[] = [];
    for (const number of parsedNumbers) {
      try {
        await api("/apartments", {
          method: "POST",
          body: JSON.stringify({ number, floor: deriveFloor(number) }),
        });
      } catch (err) {
        failed.push(`${number} (${err instanceof ApiError ? err.message : "failed"})`);
      }
    }
    setFlatsBusy(false);
    setNumbers("");
    if (failed.length) setFlatsError(`Not created: ${failed.join(", ")}`);
    reloadAll();
  }

  /* ---------------- Step 2: residents ---------------- */
  const draftFor = (id: string) => drafts[id] ?? emptyDraft();
  const setDraft = (id: string, patch: Partial<ResidentDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch, error: undefined } }));

  const filledRows = pendingFlats.filter((a) => {
    const d = draftFor(a.id);
    return d.ownerName.trim() && d.ownerEmail.trim();
  });

  async function saveResidents() {
    setResidentsBusy(true);
    const payload = filledRows.map((a) => {
      const d = draftFor(a.id);
      return {
        apartmentId: a.id,
        ownerName: d.ownerName.trim(),
        ownerEmail: d.ownerEmail.trim(),
        ownerPhone: d.ownerPhone.trim() || null,
        tenantName: d.rented && d.tenantName.trim() ? d.tenantName.trim() : null,
        tenantEmail: d.rented && d.tenantEmail.trim() ? d.tenantEmail.trim() : null,
      };
    });
    try {
      const results = await api<SetupResidentResult[]>("/setup/residents", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDrafts((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.ok) delete next[r.apartmentId];
          else next[r.apartmentId] = { ...(next[r.apartmentId] ?? emptyDraft()), error: r.error ?? "Failed" };
        }
        return next;
      });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not save residents");
    }
    setResidentsBusy(false);
    reloadAll();
  }

  /* ---------------- Step 3: manager ---------------- */
  async function addManager(e: React.FormEvent) {
    e.preventDefault();
    setMgrBusy(true);
    setMgrError(null);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ name: mgrName.trim(), email: mgrEmail.trim(), role: "property_manager" }),
      });
      setMgrName("");
      setMgrEmail("");
      reloadAll();
    } catch (err) {
      setMgrError(err instanceof ApiError ? err.message : "Could not add manager");
    }
    setMgrBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle
        title="Setup Assistant"
        subtitle="Three steps and your community is ready — the system handles the bookkeeping"
      />

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{allDone ? "Setup complete" : `Step ${Math.min(doneCount + 1, 3)} of 3`}</span>
          <span>{doneCount}/3 done</span>
        </div>
        <ProgressBar value={(doneCount / 3) * 100} tone={allDone ? "green" : "brand"} />
      </Card>

      {/* -------- Step 1: flats -------- */}
      <Card className="space-y-4 p-5">
        <StepHeader
          n={1}
          title="Add your flats"
          done={step1Done}
          hint="List every unit in the community — you can always add more later."
        />
        {s.apartments > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {apartments.data.map((a) => (
              <Badge key={a.id} tone="brand">
                <Home className="mr-1 h-3 w-3" /> {a.number}
              </Badge>
            ))}
          </div>
        )}
        <form onSubmit={createFlats} className="space-y-3">
          <div>
            <label className={labelCls}>
              Flat numbers (comma or line separated)
            </label>
            <textarea
              className={`${inputCls} min-h-20`}
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              placeholder={"101, 102, 103\n201, 202, 203"}
            />
            <p className="mt-1 text-xs text-slate-400">
              Floor is worked out from the number (302 → floor 3).
            </p>
          </div>
          {flatsError && <p className="text-sm font-medium text-red-600">{flatsError}</p>}
          {parsedNumbers.length > 0 && (
            <button type="submit" disabled={flatsBusy} className={primaryBtnCls}>
              {flatsBusy ? "Creating…" : `Add ${parsedNumbers.length} flat${parsedNumbers.length === 1 ? "" : "s"}`}
            </button>
          )}
        </form>
      </Card>

      {/* -------- Step 2: people -------- */}
      <Card className="space-y-4 p-5">
        <StepHeader
          n={2}
          title="Who lives in each flat?"
          done={step2Done}
          hint="Owner's name and email per flat. We create their household, sign-in access and title record for you. Skip vacant flats."
        />
        {!step1Done && (
          <p className="text-sm text-slate-400">Add flats first — then fill in the people here.</p>
        )}
        {step1Done && pendingFlats.length === 0 && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Every flat has its household. Nothing to do here.
          </p>
        )}
        {pendingFlats.map((a) => {
          const d = draftFor(a.id);
          return (
            <div key={a.id} className="rounded-2xl border border-slate-200 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <Badge tone="brand">
                  <Home className="mr-1 h-3 w-3" /> Flat {a.number}
                </Badge>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <input
                    type="checkbox"
                    checked={d.rented}
                    onChange={(e) => setDraft(a.id, { rented: e.target.checked })}
                  />
                  Rented out?
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  className={inputCls}
                  placeholder="Owner's name"
                  value={d.ownerName}
                  onChange={(e) => setDraft(a.id, { ownerName: e.target.value })}
                />
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Owner's email (Google)"
                  value={d.ownerEmail}
                  onChange={(e) => setDraft(a.id, { ownerEmail: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Phone (optional)"
                  value={d.ownerPhone}
                  onChange={(e) => setDraft(a.id, { ownerPhone: e.target.value })}
                />
              </div>
              {d.rented && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={inputCls}
                    placeholder="Tenant's name"
                    value={d.tenantName}
                    onChange={(e) => setDraft(a.id, { tenantName: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    type="email"
                    placeholder="Tenant's email (Google)"
                    value={d.tenantEmail}
                    onChange={(e) => setDraft(a.id, { tenantEmail: e.target.value })}
                  />
                </div>
              )}
              {d.error && <p className="mt-2 text-xs font-medium text-red-600">{d.error}</p>}
            </div>
          );
        })}
        {filledRows.length > 0 && (
          <button onClick={saveResidents} disabled={residentsBusy} className={primaryBtnCls}>
            {residentsBusy ? "Saving…" : `Save ${filledRows.length} flat${filledRows.length === 1 ? "" : "s"}`}
          </button>
        )}
      </Card>

      {/* -------- Step 3: manager -------- */}
      <Card className="space-y-4 p-5">
        <StepHeader
          n={3}
          title="Who manages this community?"
          done={step3Done}
          hint="They'll handle invoices, expenses and repairs. A manager can serve several communities with one email."
        />
        {managers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {managers.map((m) => (
              <Badge key={m.id} tone="green">
                <UserRound className="mr-1 h-3 w-3" /> {m.name}
              </Badge>
            ))}
          </div>
        )}
        <form onSubmit={addManager} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className={inputCls}
            placeholder="Manager's name"
            value={mgrName}
            onChange={(e) => setMgrName(e.target.value)}
          />
          <input
            className={inputCls}
            type="email"
            placeholder="Manager's email (Google)"
            value={mgrEmail}
            onChange={(e) => setMgrEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={mgrBusy || !mgrName.trim() || !mgrEmail.trim()}
            className={primaryBtnCls}
          >
            {mgrBusy ? "Adding…" : "Add manager"}
          </button>
        </form>
        {mgrError && <p className="text-sm font-medium text-red-600">{mgrError}</p>}
      </Card>

      {/* -------- Done -------- */}
      {allDone && (
        <Card className="space-y-3 border-emerald-200 bg-emerald-50/60 p-5 text-center">
          <PartyPopper className="mx-auto h-8 w-8 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">Your community is ready!</h2>
          <p className="text-sm text-slate-600">
            {s.apartments} flats · {s.owners} owners · {s.tenants} tenants · {s.managers}{" "}
            manager{s.managers === 1 ? "" : "s"}. Everyone above can now sign in with
            their Google account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Generate first invoices <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/members"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Users className="h-4 w-4" /> Review members
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
