import {
  Banknote,
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  PiggyBank,
  Receipt,
  Store,
  Vote,
  Wrench,
  ClipboardList,
  BarChart3,
  LayoutGrid,
  LineChart,
  ScrollText,
  UsersRound,
  KeyRound,
  Wallet,
  FolderKanban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";

export type NavGroup = "Overview" | "Money" | "Operations" | "Governance" | "Admin";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
  roles?: Role[]; // undefined = visible to all roles
}

// Tenants get the lite experience — Maintenance + Messages only. Everything
// else (money, work orders, governance) is owner/staff territory; the
// backend enforces the same split server-side.
const FULL: Role[] = [
  "property_manager",
  "community_admin",
  "auditor",
  "super_admin",
  "owner",
];

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Overview", roles: FULL },
  { label: "Community", href: "/community", icon: Building2, group: "Overview", roles: FULL },
  { label: "Feed", href: "/feed", icon: MessageSquare, group: "Overview", roles: FULL },
  { label: "Messages", href: "/messages", icon: MessagesSquare, group: "Overview", roles: [...FULL, "tenant"] },
  { label: "Invoices", href: "/invoices", icon: Receipt, group: "Money", roles: FULL },
  { label: "Payments", href: "/payments", icon: Banknote, group: "Money", roles: FULL },
  { label: "Expenses", href: "/expenses", icon: Wallet, group: "Money", roles: FULL },
  { label: "Cost Cases", href: "/cost-cases", icon: FolderKanban, group: "Money", roles: FULL },
  { label: "Reserve Fund", href: "/reserve-fund", icon: PiggyBank, group: "Money", roles: FULL },
  { label: "Work Orders", href: "/work-orders", icon: Wrench, group: "Operations", roles: FULL },
  { label: "Maintenance", href: "/maintenance", icon: ClipboardList, group: "Operations", roles: [...FULL, "tenant"] },
  { label: "Vendors", href: "/vendors", icon: Store, group: "Operations", roles: ["property_manager", "community_admin", "auditor", "super_admin"] },
  { label: "Polls", href: "/polls", icon: Vote, group: "Governance", roles: FULL },
  { label: "Meetings", href: "/meetings", icon: CalendarDays, group: "Governance", roles: FULL },
  { label: "Documents", href: "/documents", icon: FileText, group: "Governance", roles: FULL },
  { label: "Setup", href: "/setup", icon: ClipboardList, group: "Admin", roles: ["property_manager", "community_admin", "super_admin"] },
  { label: "Portfolio", href: "/portfolio", icon: LayoutGrid, group: "Admin", roles: ["super_admin"] },
  { label: "Insights", href: "/insights", icon: LineChart, group: "Admin", roles: ["super_admin"] },
  { label: "Members", href: "/members", icon: UsersRound, group: "Admin", roles: ["property_manager", "community_admin", "super_admin"] },
  { label: "Ownership", href: "/ownership", icon: KeyRound, group: "Admin", roles: ["super_admin"] },
  { label: "Reports", href: "/reports", icon: BarChart3, group: "Admin", roles: ["property_manager", "community_admin", "auditor", "super_admin"] },
  { label: "Audit Log", href: "/audit", icon: ScrollText, group: "Admin", roles: ["property_manager", "community_admin", "auditor", "super_admin"] },
];

export const NAV_GROUP_ORDER: NavGroup[] = [
  "Overview",
  "Money",
  "Operations",
  "Governance",
  "Admin",
];

// The 4 primary destinations on the mobile bottom bar (plus "More"). Roles
// whose visible items don't include any of these (tenants) fall back to
// their first visible items in AppShell.
export const mobilePrimary = ["/dashboard", "/community", "/feed", "/work-orders"];

export function visibleNavItems(role: Role): NavItem[] {
  return navItems.filter((item) => !item.roles || item.roles.includes(role));
}

/** Visible nav items bucketed into ordered groups (empty groups dropped). */
export function groupedNavItems(role: Role): { group: NavGroup; items: NavItem[] }[] {
  const visible = visibleNavItems(role);
  return NAV_GROUP_ORDER.map((group) => ({
    group,
    items: visible.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);
}

/** Where a freshly signed-in user should land. */
export function homePath(role: Role): string {
  return role === "tenant" ? "/maintenance" : "/dashboard";
}
