import {
  Banknote,
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  Receipt,
  Store,
  Vote,
  Wrench,
  ClipboardList,
  BarChart3,
  ScrollText,
  UsersRound,
  KeyRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[]; // undefined = visible to all roles
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Community", href: "/community", icon: Building2 },
  { label: "Feed", href: "/feed", icon: MessageSquare },
  { label: "Work Orders", href: "/work-orders", icon: Wrench },
  { label: "Maintenance", href: "/maintenance", icon: ClipboardList },
  { label: "Invoices", href: "/invoices", icon: Receipt },
  { label: "Payments", href: "/payments", icon: Banknote, roles: ["property_manager", "community_admin", "auditor", "super_admin", "owner", "tenant"] },
  { label: "Polls", href: "/polls", icon: Vote },
  { label: "Meetings", href: "/meetings", icon: CalendarDays },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Vendors", href: "/vendors", icon: Store, roles: ["property_manager", "community_admin", "auditor", "super_admin"] },
  { label: "Reserve Fund", href: "/reserve-fund", icon: PiggyBank },
  { label: "Members", href: "/members", icon: UsersRound, roles: ["property_manager", "community_admin", "super_admin"] },
  { label: "Ownership", href: "/ownership", icon: KeyRound, roles: ["super_admin"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["property_manager", "community_admin", "auditor", "super_admin"] },
  { label: "Audit Log", href: "/audit", icon: ScrollText, roles: ["property_manager", "community_admin", "auditor", "super_admin"] },
];

// The 4 primary destinations on the mobile bottom bar (plus "More").
export const mobilePrimary = ["/dashboard", "/community", "/feed", "/work-orders"];

export function visibleNavItems(role: Role): NavItem[] {
  return navItems.filter((item) => !item.roles || item.roles.includes(role));
}
