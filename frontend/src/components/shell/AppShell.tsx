"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useAuth, useSessionUser } from "@/context/AuthContext";
import { api, DEV_LOGIN_ENABLED } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import type { Community, NavBadges, Notification, Role, User } from "@/lib/types";
import { Avatar, Badge } from "@/components/ui";
import { mobilePrimary, visibleNavItems } from "./nav";
import { GlobalSearch } from "./GlobalSearch";

const roleLabels: Partial<Record<Role, string>> = {
  owner: "Apartment Owner",
  property_manager: "Property Manager",
  community_admin: "Community Admin",
  auditor: "Auditor (Read Only)",
  tenant: "Tenant",
  super_admin: "Platform Admin",
};

// Dev-only: impersonate any real member — reads the live user list, so it
// can never reference a stale/renamed email.
function DevAccountSwitcher() {
  const { user, devLogin } = useAuth();
  const users = useApi<User[]>("/users");
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(email: string) {
    if (!email || email === user?.email) return;
    setSwitching(true);
    try {
      await devLogin(email);
      // Full reload so all role-scoped data refetches under the new account.
      window.location.assign("/dashboard");
    } catch (err) {
      setSwitching(false);
      alert(err instanceof Error ? err.message : "Could not switch account");
    }
  }

  const sorted = [...(users.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Switch account (dev)</span>
      <select
        value={user?.email ?? ""}
        disabled={switching || sorted.length === 0}
        onChange={(e) => handleSwitch(e.target.value)}
        className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
      >
        {sorted.length === 0 && <option value="">Dev accounts…</option>}
        {sorted.map((u) => (
          <option key={u.id} value={u.email}>
            {u.name.length > 22 ? u.name.slice(0, 22) + "…" : u.name} ({u.role.replace("_", " ")})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
    </label>
  );
}

function NotificationItem({
  n,
  onClose,
}: {
  n: Notification;
  onClose: () => void;
}) {
  const body = (
    <>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-200" : "bg-brand-500"}`}
      />
      <div>
        <p className="text-sm text-slate-700">{n.text}</p>
        <p className="mt-0.5 text-xs text-slate-400">{n.date.slice(0, 10)}</p>
      </div>
    </>
  );
  if (n.href) {
    return (
      <Link
        href={n.href}
        onClick={onClose}
        className="flex gap-2 rounded-xl px-2 py-2.5 hover:bg-slate-50"
      >
        {body}
      </Link>
    );
  }
  return <div className="flex gap-2 px-2 py-2.5">{body}</div>;
}

function NotificationsPanel({
  items,
  onClose,
  onReadAll,
}: {
  items: Notification[];
  onClose: () => void;
  onReadAll: () => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-sm font-semibold">Notifications</p>
        <span className="flex items-center gap-3">
          {items.some((n) => !n.read) && (
            <button
              onClick={onReadAll}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} aria-label="Close notifications">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </span>
      </div>
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {items.map((n) => (
          <li key={n.id}>
            <NotificationItem n={n} onClose={onClose} />
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-slate-400">
            Nothing yet — you&apos;ll see work-order updates and announcements here.
          </li>
        )}
      </ul>
    </div>
  );
}

const roleShort: Record<string, string> = {
  super_admin: "Super Admin",
  community_admin: "Admin",
  property_manager: "Manager",
  owner: "Owner",
  tenant: "Tenant",
  auditor: "Auditor",
  vendor: "Vendor",
};

function ViewAsSwitcher() {
  const { user, switchRole } = useAuth();
  const [busy, setBusy] = useState(false);
  const roles = user?.roles ?? [];
  if (!user || roles.length < 2) return null;

  async function handle(role: Role) {
    if (role === user!.role) return;
    setBusy(true);
    try {
      await switchRole(role);
    } catch (err) {
      setBusy(false);
      alert(err instanceof Error ? err.message : "Could not switch view");
    }
  }

  // Few roles: pill toggle. Many roles (super user): compact dropdown.
  if (roles.length > 3) {
    return (
      <label className="relative inline-flex items-center">
        <span className="sr-only">View as</span>
        <select
          value={user.role}
          disabled={busy}
          onChange={(e) => handle(e.target.value as Role)}
          className="appearance-none rounded-xl border border-brand-200 bg-brand-50 py-1.5 pl-3 pr-8 text-xs font-semibold text-brand-700 shadow-sm focus:outline-none disabled:opacity-50"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              View as: {roleShort[r] ?? r}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-brand-500" />
      </label>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
      {roles.map((r) => (
        <button
          key={r}
          onClick={() => handle(r)}
          disabled={busy}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
            user.role === r
              ? "bg-brand-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {roleShort[r] ?? r}
        </button>
      ))}
    </div>
  );
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { user, role } = useSessionUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const items = visibleNavItems(role);
  const primary = items.filter((i) => mobilePrimary.includes(i.href));
  const secondary = items.filter((i) => !mobilePrimary.includes(i.href));
  const notifications = useApi<Notification[]>("/notifications");
  const communities = useApi<Community[]>("/communities");
  const badges = useApi<NavBadges>("/dashboard/badges");
  const communityName = communities.data?.[0]?.name ?? "CommunityHub";

  // Live counts per nav item — state-driven, so they clear themselves.
  const badgeFor = (href: string): number => {
    if (!badges.data) return 0;
    if (href === "/invoices") return badges.data.openInvoices;
    if (href === "/payments") return badges.data.pendingPaymentConfirmations;
    return 0;
  };
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;

  async function markAllRead() {
    await api("/notifications/read-all", { method: "POST" });
    notifications.reload();
  }

  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      badges.reload();
      notifications.reload();
    }
  });

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">CommunityHub</p>
            <p className="text-xs text-slate-500">{communityName}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive(href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
              <NavBadge count={badgeFor(href)} />
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-slate-500">
                {roleLabels[role] ?? role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="text-slate-400 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white lg:hidden">
              <Building2 className="h-[18px] w-[18px]" />
            </span>
            <p className="mr-auto truncate text-sm font-semibold lg:hidden">
              {communityName}
            </p>

            {/* Desktop search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="mr-auto hidden w-72 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 hover:border-slate-300 lg:flex"
            >
              <Search className="h-4 w-4" />
              Search anything…
            </button>

            <div className="hidden sm:block">
              <ViewAsSwitcher />
            </div>
            {DEV_LOGIN_ENABLED && (
              <div className="hidden sm:block">
                <DevAccountSwitcher />
              </div>
            )}

            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Search className="h-5 w-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationsPanel
                  items={notifications.data ?? []}
                  onClose={() => setNotifOpen(false)}
                  onReadAll={markAllRead}
                />
              )}
            </div>
          </div>
          {/* Mobile role row */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-1.5 sm:hidden">
            <Badge tone="brand">{roleLabels[role] ?? role}</Badge>
            <span className="flex items-center gap-2">
              <ViewAsSwitcher />
              {DEV_LOGIN_ENABLED && <DevAccountSwitcher />}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-safe-nav sm:px-6 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {primary.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                isActive(href) ? "text-brand-600" : "text-slate-500"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {badgeFor(href) > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {badgeFor(href) > 99 ? "99+" : badgeFor(href)}
                  </span>
                )}
              </span>
              {label}
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500"
          >
            <span className="relative">
              <Menu className="h-5 w-5" />
              {secondary.some((i) => badgeFor(i.href) > 0) && (
                <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </span>
            More
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="grid grid-cols-3 gap-2">
              {secondary.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-medium ${
                    isActive(href)
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {badgeFor(href) > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {badgeFor(href) > 99 ? "99+" : badgeFor(href)}
                      </span>
                    )}
                  </span>
                  {label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleLogout();
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
