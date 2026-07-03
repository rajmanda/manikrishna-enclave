"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  apartments,
  documents,
  expenses,
  invoices,
  meetings,
  users,
  vendors,
  workOrders,
  ownerNameForApartment,
} from "@/lib/data";
import { formatINR } from "@/lib/format";

interface Result {
  category: string;
  title: string;
  subtitle: string;
  href: string;
}

function buildIndex(): Result[] {
  return [
    ...apartments.map((a) => ({
      category: "Apartment",
      title: `Apartment ${a.number}`,
      subtitle: ownerNameForApartment(a.id),
      href: "/community",
    })),
    ...users
      .filter((u) => u.role === "owner")
      .map((u) => ({
        category: "Owner",
        title: u.name,
        subtitle: u.apartmentId ? `Apartment ${u.apartmentId.replace("apt-", "")}` : "",
        href: "/community",
      })),
    ...vendors.map((v) => ({
      category: "Vendor",
      title: v.name,
      subtitle: v.service,
      href: "/vendors",
    })),
    ...invoices.map((i) => ({
      category: "Invoice",
      title: `${i.description} — ${i.period}`,
      subtitle: `Apt ${i.apartmentId.replace("apt-", "")} · ${formatINR(i.amount)} · ${i.status}`,
      href: "/invoices",
    })),
    ...workOrders.map((w) => ({
      category: "Work Order",
      title: w.title,
      subtitle: w.stage,
      href: `/work-orders/${w.id}`,
    })),
    ...documents.map((d) => ({
      category: "Document",
      title: d.title,
      subtitle: d.category,
      href: "/documents",
    })),
    ...meetings.map((m) => ({
      category: "Minutes",
      title: m.title,
      subtitle: m.date,
      href: "/meetings",
    })),
    ...expenses.map((e) => ({
      category: "Expense",
      title: e.description,
      subtitle: `${e.category} · ${formatINR(e.amount)}`,
      href: "/community",
    })),
  ];
}

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(buildIndex, []);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const results = q
    ? index
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.subtitle.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q)
        )
        .slice(0, 12)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]">
      <button className="absolute inset-0" aria-label="Close search" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apartments, owners, invoices, work orders…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400"
          />
          <button onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {q && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No results for “{query}”
            </p>
          )}
          {!q && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              Search anything — apartments, owners, vendors, invoices, work
              orders, documents, minutes, expenses.
            </p>
          )}
          {results.map((r, i) => (
            <Link
              key={i}
              href={r.href}
              onClick={onClose}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {r.title}
                </p>
                <p className="truncate text-xs text-slate-500">{r.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {r.category}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
