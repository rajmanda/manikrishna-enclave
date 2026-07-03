"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Image as ImageIcon, Search, Table2 } from "lucide-react";
import { documents } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";

const fileIcons = { pdf: FileText, image: ImageIcon, sheet: Table2 };

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...new Set(documents.map((d) => d.category))],
    []
  );

  const q = query.trim().toLowerCase();
  const list = documents.filter(
    (d) =>
      (category === "All" || d.category === category) &&
      (!q || d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Documents"
        subtitle="Society records — searchable and version controlled"
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              category === c
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="No documents found" hint="Try a different search or category." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.map((d) => {
            const Icon = fileIcons[d.fileType];
            return (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-slate-500">
                    {d.category} · {formatDate(d.uploadedDate)} ·{" "}
                    {d.sizeKb >= 1000 ? `${(d.sizeKb / 1000).toFixed(1)} MB` : `${d.sizeKb} KB`}
                  </p>
                </div>
                {d.version > 1 && <Badge tone="slate">v{d.version}</Badge>}
                <button
                  aria-label={`Download ${d.title}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-brand-600"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
