"use client";

import { useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { Account, Apartment, Role, User } from "@/lib/types";
import { aptNumber } from "@/lib/lookup";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  PageLoading,
  PageTitle,
} from "@/components/ui";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "property_manager", label: "Property Manager" },
  { value: "community_admin", label: "Community Admin" },
  { value: "auditor", label: "Auditor (read only)" },
];

const roleTone: Record<string, "brand" | "green" | "violet" | "slate" | "amber" | "blue"> = {
  property_manager: "brand",
  community_admin: "violet",
  owner: "green",
  tenant: "blue",
  auditor: "amber",
  super_admin: "slate",
  vendor: "slate",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "raj.manda@gmail.com" → "Raj Manda" — starting name for bulk-added members. */
function nameFromEmail(addr: string): string {
  const words = addr.split("@")[0].split(/[._\-+\d]+/).filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || addr;
}

function MemberDialog({
  member,
  apartments,
  accounts,
  onClose,
  onDone,
}: {
  member: User | null;
  apartments: Apartment[] | undefined;
  accounts: Account[] | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accountId, setAccountId] = useState(member?.accountId ?? "");
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState<Role>(member?.role ?? "owner");
  const [apartmentId, setApartmentId] = useState(member?.apartmentId ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [preferredName, setPreferredName] = useState(member?.preferredName ?? "");
  const [dualOwner, setDualOwner] = useState(
    (member?.roles ?? []).includes("owner") && member?.role !== "owner"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The email field accepts a comma-delimited list — every address gets
  // whitelisted. In edit mode the first one stays with this member and the
  // rest are added as new members.
  const emails = email
    .split(/[,;\s]+/)
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  const bulkAdd = !member && emails.length > 1;

  const nameParts = name.trim().split(/\s+/);
  const derivedDisplayName =
    nameParts.length >= 2 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : name.trim();
  const managerRole = role === "property_manager" || role === "community_admin";
  const customRoleSet = (member?.roles?.length ?? 0) > 2; // e.g. super user
  const sorted = [...(apartments ?? [])].sort((a, b) => a.number.localeCompare(b.number));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = emails.filter((a) => !EMAIL_RE.test(a));
    if (emails.length === 0 || bad.length) {
      setError(
        bad.length
          ? `Not a valid email: ${bad.join(", ")}`
          : "Enter an email address"
      );
      return;
    }
    setBusy(true);
    setError(null);
    const [first, ...rest] = emails;
    const roles = !customRoleSet
      ? managerRole && dualOwner && apartmentId
        ? [role, "owner"]
        : [role]
      : undefined;
    const body: Record<string, unknown> = {
      name: bulkAdd ? nameFromEmail(first) : name,
      email: first,
      role,
      accountId,
      ...(apartmentId ? { apartmentId } : {}),
      ...(phone && !bulkAdd ? { phone } : {}),
      // Always sent on edit so clearing the field clears the override ("" resets).
      ...((member || preferredName.trim()) && !bulkAdd
        ? { preferredName: preferredName.trim() }
        : {}),
    };
    // Custom multi-role sets (super users) are preserved, not overwritten.
    if (roles) body.roles = roles;
    try {
      if (member) {
        await api(`/users/${member.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/users", { method: "POST", body: JSON.stringify(body) });
        // roles list isn't part of create — set it when dual-role requested
        // (create defaults to the single role).
      }
      // Every additional email becomes a new whitelisted member with the
      // same role/apartment/account; names start from the email address.
      const failed: string[] = [];
      for (const addr of rest) {
        try {
          await api("/users", {
            method: "POST",
            body: JSON.stringify({
              name: nameFromEmail(addr),
              email: addr,
              role,
              accountId,
              ...(apartmentId ? { apartmentId } : {}),
              ...(roles ? { roles } : {}),
            }),
          });
        } catch (err) {
          failed.push(
            `${addr} (${err instanceof ApiError ? err.message : "failed"})`
          );
        }
      }
      if (failed.length) {
        onDone();
        setBusy(false);
        setError(
          `Whitelisted ${emails.length - failed.length} of ${emails.length} — ` +
            `skipped ${failed.join("; ")}`
        );
        return;
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save member");
      setBusy(false);
    }
  }

  return (
    <Modal title={member ? `Edit ${member.name}` : "Add Member (whitelist)"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Name</label>
          <input
            className={inputCls}
            value={bulkAdd ? "" : name}
            onChange={(e) => setName(e.target.value)}
            placeholder={bulkAdd ? "Taken from each email address" : undefined}
            disabled={bulkAdd}
            required={!bulkAdd}
          />
          {bulkAdd && (
            <p className="mt-1 text-xs text-slate-400">
              Adding {emails.length} members — names start from their email
              addresses; you can edit each afterwards.
            </p>
          )}
        </div>
        {!bulkAdd && (
          <div>
            <label className={labelCls}>Display name (optional)</label>
            <input
              className={inputCls}
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder={derivedDisplayName}
            />
            <p className="mt-1 text-xs text-slate-400">
              Shown in group messages — apartment number is added automatically.
              Leave blank to use the name above.
            </p>
          </div>
        )}
        <div>
          <label className={labelCls}>Google email (this is the login whitelist)</label>
          <input
            type="text"
            inputMode="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="one@example.com, two@example.com"
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Paste several emails separated by commas to whitelist them all at
            once{member && " — the first stays with this member, the rest are added as new members"}.
          </p>
          {member && emails[0] !== member.email.toLowerCase() && (
            <p className="mt-1 text-xs text-amber-600">
              Changing the email means they must sign in with the new address —
              the old one stops working immediately.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Apartment</label>
            <select className={inputCls} value={apartmentId} onChange={(e) => setApartmentId(e.target.value)}>
              <option value="">— none —</option>
              {sorted.map((a) => (
                <option key={a.id} value={a.id}>Apt {a.number}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Account (multi-apartment ownership)</label>
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— none —</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.apartmentIds.map((x) => x.replace("apt-", "")).join(", ")})
              </option>
            ))}
          </select>
        </div>
        {!bulkAdd && (
          <div>
            <label className={labelCls}>Phone (optional)</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        )}
        {customRoleSet && (
          <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
            This account has a custom role set ({member!.roles!.join(", ")}) —
            it is preserved when saving.
          </p>
        )}
        {managerRole && !customRoleSet && (
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm">
            <input
              type="checkbox"
              checked={dualOwner}
              onChange={(e) => setDualOwner(e.target.checked)}
              disabled={!apartmentId}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span>
              <span className="font-medium">Can switch to owner view</span>
              <span className="block text-xs text-slate-500">
                Adds a Manager/Owner toggle to their top bar
                {!apartmentId && " (assign an apartment first)"}
              </span>
            </span>
          </label>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || (!bulkAdd && !name.trim()) || emails.length === 0}
          className={primaryBtnCls}
        >
          {busy
            ? "Saving…"
            : member
              ? emails.length > 1
                ? `Save + whitelist ${emails.length - 1} more`
                : "Save changes"
              : bulkAdd
                ? `Whitelist ${emails.length} members`
                : "Whitelist member"}
        </button>
      </form>
    </Modal>
  );
}

export default function MembersPage() {
  const { user: me } = useSessionUser();
  const users = useApi<User[]>("/users");
  const apartments = useApi<Apartment[]>("/apartments");
  const accounts = useApi<Account[]>("/accounts");
  const [dialog, setDialog] = useState<{ open: boolean; member: User | null }>({
    open: false,
    member: null,
  });

  if (users.error) return <ErrorNote message={users.error} onRetry={users.reload} />;
  if (users.loading || !users.data) return <PageLoading />;

  const sorted = [...users.data].sort((a, b) => a.name.localeCompare(b.name));

  async function remove(u: User) {
    if (!confirm(`Remove ${u.name}? They lose access immediately.`)) return;
    try {
      await api(`/users/${u.id}`, { method: "DELETE" });
      users.reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Members"
        subtitle="The whitelist — only these Google accounts can sign in"
        actions={
          <button
            onClick={() => setDialog({ open: true, member: null })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <PlusCircle className="h-4 w-4" /> Add member
          </button>
        }
      />

      <Card className="divide-y divide-slate-100">
        {sorted.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-4">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {u.name}
                {u.id === me.id && <span className="text-slate-400"> (you)</span>}
              </p>
              <p className="truncate text-xs text-slate-500">
                {u.email}
                {u.apartmentId && ` · Apt ${aptNumber(u.apartmentId)}`}
                {u.phone && ` · ${u.phone}`}
              </p>
            </div>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={roleTone[u.role] ?? "slate"}>{u.role.replace("_", " ")}</Badge>
              {(u.roles?.length ?? 0) > 1 && (
                <span className="text-[10px] text-slate-400">
                  can switch: {u.roles!.map((r) => r.replace("_", " ")).join(" / ")}
                </span>
              )}
            </span>
            <button
              aria-label={`Edit ${u.name}`}
              onClick={() => setDialog({ open: true, member: u })}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-brand-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {u.id !== me.id && (
              <button
                aria-label={`Remove ${u.name}`}
                onClick={() => remove(u)}
                className="rounded-lg p-2 text-slate-300 hover:bg-slate-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </Card>

      {dialog.open && (
        <MemberDialog
          member={dialog.member}
          apartments={apartments.data}
          accounts={accounts.data}
          onClose={() => setDialog({ open: false, member: null })}
          onDone={users.reload}
        />
      )}
    </div>
  );
}
