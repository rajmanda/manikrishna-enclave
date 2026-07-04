"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced server-side search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim();

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
          {q.length < 2 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              Search anything — apartments, members, vendors, invoices, work
              orders, documents, minutes, expenses, feed.
            </p>
          )}
          {q.length >= 2 && !searching && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No results for “{query}”
            </p>
          )}
          {searching && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">Searching…</p>
          )}
          {results.map((r, i) => (
            <Link
              key={i}
              href={r.href}
              onClick={onClose}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{r.title}</p>
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
