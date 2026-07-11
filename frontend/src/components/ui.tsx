import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import { initials } from "@/lib/format";

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 ease-standard active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-brand-glow",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const cls = `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Headers */

export function SectionHeader({
  title,
  action,
  href,
}: {
  title: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {action && href && (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          {action}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-display-sm text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Badges */

type BadgeTone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "slate"
  | "violet"
  | "brand";

const badgeTones: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Which money-stream a record belongs to — used on invoices AND payments so
 * the two ledgers stay visually separate everywhere. */
export function LedgerBadge({ ledger }: { ledger?: string }) {
  if (ledger === "manager_fee") return <Badge tone="violet">Manager fee</Badge>;
  if (ledger === "reimbursement") return <Badge tone="amber">Reimbursement</Badge>;
  return <Badge tone="blue">Community</Badge>;
}

/* ------------------------------------------------------------------ Stat */

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
  onClick,
  delta,
  deltaPositive,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
  icon?: ReactNode;
  onClick?: () => void;
  /** e.g. "+12%" — renders a coloured pill with a directional arrow. */
  delta?: string;
  deltaPositive?: boolean;
  /** left accent bar colour, e.g. "bg-brand-500" — for the hero metric row. */
  accent?: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-slate-900";
  return (
    <Card
      onClick={onClick}
      className={`group relative overflow-hidden p-3 sm:p-4 transition-all duration-200 ease-standard ${
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          : ""
      }`}
    >
      {accent && (
        <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden />
      )}
      <div className="flex items-start justify-between">
        <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {icon ? (
          <span className="text-slate-400">{icon}</span>
        ) : onClick ? (
          <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
        ) : null}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p
          className={`tabular min-w-0 truncate text-[19px] font-bold tracking-tight sm:text-[26px] ${valueColor}`}
        >
          {value}
        </p>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold ${
              deltaPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {deltaPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

/* ---------------------------------------------------------------- Avatar */

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`inline-flex ${cls} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 font-semibold text-brand-700`}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------- Progress */

export function ProgressBar({
  value,
  tone = "brand",
}: {
  value: number;
  tone?: "brand" | "green" | "red";
}) {
  const bar =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "red"
        ? "bg-red-500"
        : "bg-brand-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-standard ${bar}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* --------------------------------------------------------- Skeletons */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-100 ${className}`}>
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  );
}

/** Page-level loading. `variant="stats"` shows a shimmer grid that mirrors the
 * real dashboard layout, so navigation no longer flashes an empty screen. */
export function PageLoading({
  label,
  variant = "spinner",
}: {
  label?: string;
  variant?: "spinner" | "stats";
}) {
  if (variant === "stats") {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
      <p className="text-sm text-slate-400">{label ?? "Loading…"}</p>
    </div>
  );
}

/* --------------------------------------------------------- Error / Empty */

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-red-100 bg-red-50/50 p-6 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
        >
          Try again
        </button>
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
  actionHref,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: string;
  actionHref?: string;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-slate-400">{hint}</p>}
      {action && actionHref && (
        <Button href={actionHref} size="sm" className="mt-4">
          {action}
        </Button>
      )}
    </Card>
  );
}
