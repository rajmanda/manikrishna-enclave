"use client";

// Super-admin console: which account owns which flat, multi-apartment
// configuration, legal title holders, and portal-user linkage.

import { useState } from "react";
import { Home, Pencil, PlusCircle, Trash2, UserRound } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Account, Apartment, LegalOwner, User } from "@/lib/types";
import { aptNumber } from "@/lib/lookup";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Avatar, Badge, Card, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

function AddApartmentsDialog({
  existing,
  onClose,
  onDone,
}: {
  existing: Apartment[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [numbers, setNumbers] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Floor derived from numeric unit numbers ("302" → floor 3); otherwise 0.
  const deriveFloor = (num: string) =>
    /^\d{3,}$/.test(num) ? Math.floor(parseInt(num, 10) / 100) : 0;

  const parsed = [
    ...new Set(
      numbers
        .split(/[\n,]+/)
        .map((n) => n.trim())
        .filter(Boolean)
    ),
  ];
  const taken = new Set(existing.map((a) => a.number));
  const duplicates = parsed.filter((n) => taken.has(n));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const number of parsed) {
      try {
        await api("/apartments", {
          method: "POST",
          body: JSON.stringify({ number, floor: deriveFloor(number) }),
        });
      } catch (err) {
        failed.push(
          `${number} (${err instanceof ApiError ? err.message : "failed"})`
        );
      }
    }
    if (failed.length) {
      setError(`Not created: ${failed.join(", ")}`);
      setBusy(false);
      onDone(); // partial success — refresh what did get created
      return;
    }
    onDone();
    onClose();
  }

  return (
    <Modal title="Add Apartments" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Unit numbers (comma or line separated)</label>
          <textarea
            className={`${inputCls} min-h-24`}
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
            placeholder={"101, 102, 103\n201, 202, 203"}
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Floor is derived from the number (302 → floor 3). {parsed.length > 0 && `${parsed.length} unit${parsed.length === 1 ? "" : "s"} to create.`}
          </p>
          {duplicates.length > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Already exist and will fail: {duplicates.join(", ")}
            </p>
          )}
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || parsed.length === 0}
          className={primaryBtnCls}
        >
          {busy ? "Creating…" : `Create ${parsed.length || ""} apartment${parsed.length === 1 ? "" : "s"}`}
        </button>
      </form>
    </Modal>
  );
}

function AccountDialog({
  account,
  apartments,
  accounts,
  onClose,
  onDone,
}: {
  account: Account | null;
  apartments: Apartment[];
  accounts: Account[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(account?.apartmentIds ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takenElsewhere = new Set(
    accounts.filter((a) => a.id !== account?.id).flatMap((a) => a.apartmentIds)
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { name, apartmentIds: [...selected] };
    try {
      if (account) {
        await api(`/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/accounts", { method: "POST", body: JSON.stringify(body) });
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
      setBusy(false);
    }
  }

  return (
    <Modal title={account ? `Edit ${account.name}` : "New Account"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Account name (family / entity)</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Apartments owned (one billing account per apartment)</label>
          <div className="grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {[...apartments]
              .sort((a, b) => a.number.localeCompare(b.number))
              .map((apt) => {
                const taken = takenElsewhere.has(apt.id);
                return (
                  <label
                    key={apt.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${taken ? "opacity-40" : "cursor-pointer hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      disabled={taken}
                      checked={selected.has(apt.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(apt.id)) next.delete(apt.id);
                          else next.add(apt.id);
                          return next;
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    Apt {apt.number}
                    {taken && <span className="text-[10px] text-slate-400">taken</span>}
                  </label>
                );
              })}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !name.trim() || selected.size === 0} className={primaryBtnCls}>
          {busy ? "Saving…" : account ? "Save changes" : `Create account (${selected.size} apt)`}
        </button>
      </form>
    </Modal>
  );
}

function LegalOwnerDialog({
  apartmentId,
  onClose,
  onDone,
}: {
  apartmentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [pct, setPct] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/accounts/legal-owners", {
        method: "POST",
        body: JSON.stringify({ apartmentId, name, ownershipPercentage: Number(pct) }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Add Legal Owner — Apt ${aptNumber(apartmentId)}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Legal title holder name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Ownership %</label>
          <input type="number" min="1" max="100" className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !name.trim()} className={primaryBtnCls}>
          {busy ? "Adding…" : "Add legal owner"}
        </button>
      </form>
    </Modal>
  );
}

export default function OwnershipPage() {
  const accounts = useApi<Account[]>("/accounts");
  const apartments = useApi<Apartment[]>("/apartments");
  const legalOwners = useApi<LegalOwner[]>("/accounts/legal-owners");
  const users = useApi<User[]>("/users");
  const [accountDialog, setAccountDialog] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });
  const [legalDialog, setLegalDialog] = useState<string | null>(null);
  const [aptDialog, setAptDialog] = useState(false);

  if (accounts.error) return <ErrorNote message={accounts.error} onRetry={accounts.reload} />;
  if (accounts.loading || !accounts.data || !apartments.data) return <PageLoading />;

  const accountByApt = new Map<string, Account>();
  for (const a of accounts.data) for (const apt of a.apartmentIds) accountByApt.set(apt, a);
  const ownersByApt = new Map<string, LegalOwner[]>();
  for (const o of legalOwners.data ?? []) {
    ownersByApt.set(o.apartmentId, [...(ownersByApt.get(o.apartmentId) ?? []), o]);
  }
  const usersByAccount = new Map<string, User[]>();
  for (const u of users.data ?? []) {
    if (u.accountId) usersByAccount.set(u.accountId, [...(usersByAccount.get(u.accountId) ?? []), u]);
  }
  const unassigned = apartments.data.filter((a) => !accountByApt.has(a.id));

  async function removeAccount(a: Account) {
    if (!confirm(`Delete account "${a.name}"?`)) return;
    try {
      await api(`/accounts/${a.id}`, { method: "DELETE" });
      accounts.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function removeLegalOwner(o: LegalOwner) {
    if (!confirm(`Remove legal owner "${o.name}" from Apt ${aptNumber(o.apartmentId)}?`)) return;
    await api(`/accounts/legal-owners/${o.id}`, { method: "DELETE" });
    legalOwners.reload();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Ownership"
        subtitle="Billing accounts, multi-apartment configuration and legal title holders"
        actions={
          <>
            <button
              onClick={() => setAptDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <Home className="h-4 w-4" /> Add apartments
            </button>
            <button
              onClick={() => setAccountDialog({ open: true, account: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" /> New account
            </button>
          </>
        }
      />

      {apartments.data.length === 0 && (
        <Card className="border-brand-200 bg-brand-50/50 p-4 text-sm text-brand-800">
          This community has no apartments yet — start with{" "}
          <button className="font-semibold underline" onClick={() => setAptDialog(true)}>
            Add apartments
          </button>
          , then group them into billing accounts and whitelist members.
        </Card>
      )}

      {aptDialog && (
        <AddApartmentsDialog
          existing={apartments.data}
          onClose={() => setAptDialog(false)}
          onDone={apartments.reload}
        />
      )}

      {unassigned.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
          ⚠ Apartments without a billing account:{" "}
          {unassigned.map((a) => a.number).join(", ")}
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {accounts.data.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{a.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[...a.apartmentIds].sort().map((apt) => (
                    <Badge key={apt} tone="brand">
                      <Home className="mr-1 h-3 w-3" /> {aptNumber(apt)}
                    </Badge>
                  ))}
                  {a.apartmentIds.length > 1 && (
                    <Badge tone="violet">multi-apartment</Badge>
                  )}
                </div>
              </div>
              <span className="flex shrink-0 gap-1">
                <button
                  aria-label={`Edit ${a.name}`}
                  onClick={() => setAccountDialog({ open: true, account: a })}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-brand-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Delete ${a.name}`}
                  onClick={() => removeAccount(a)}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Portal users
              </p>
              {(usersByAccount.get(a.id) ?? []).map((u) => (
                <p key={u.id} className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                  <UserRound className="h-3 w-3 text-slate-400" /> {u.name} · {u.email}
                </p>
              ))}
              {!(usersByAccount.get(a.id) ?? []).length && (
                <p className="mt-1 text-xs text-slate-400">
                  None linked — link via Members → edit → Account
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Who owns which flat</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...apartments.data]
            .sort((a, b) => a.number.localeCompare(b.number))
            .map((apt) => {
              const acct = accountByApt.get(apt.id);
              const owners = ownersByApt.get(apt.id) ?? [];
              return (
                <Card key={apt.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Apartment {apt.number}</p>
                    {acct ? (
                      <span className="text-right">
                        <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                          billing account
                        </span>
                        <Badge tone="green">{acct.name}</Badge>
                      </span>
                    ) : (
                      <Badge tone="amber">no billing account</Badge>
                    )}
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Legal title holders
                    </p>
                    {owners.map((o) => (
                      <p key={o.id} className="mt-1 flex items-center justify-between text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Avatar name={o.name} size="sm" />
                          {o.name}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-400">{o.ownershipPercentage}%</span>
                          <button
                            aria-label={`Remove ${o.name}`}
                            onClick={() => removeLegalOwner(o)}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      </p>
                    ))}
                    <button
                      onClick={() => setLegalDialog(apt.id)}
                      className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      + Add legal owner
                    </button>
                  </div>
                </Card>
              );
            })}
        </div>
      </div>

      {accountDialog.open && (
        <AccountDialog
          account={accountDialog.account}
          apartments={apartments.data}
          accounts={accounts.data}
          onClose={() => setAccountDialog({ open: false, account: null })}
          onDone={accounts.reload}
        />
      )}
      {legalDialog && (
        <LegalOwnerDialog
          apartmentId={legalDialog}
          onClose={() => setLegalDialog(null)}
          onDone={legalOwners.reload}
        />
      )}
    </div>
  );
}
