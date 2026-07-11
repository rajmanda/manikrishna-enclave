"use client";

import { ChevronDown, X } from "lucide-react";

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Pill-style filter selects + active-filter chips with one-tap clear. */
export function FilterBar({
  filters,
  values,
  onChange,
  onClearAll,
  activeCount,
}: {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClearAll: () => void;
  activeCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = values[f.key] !== f.options[0].value;
          return (
            <label key={f.key} className="relative inline-flex shrink-0 items-center">
              <span className="sr-only">{f.label}</span>
              <select
                value={values[f.key]}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={`appearance-none rounded-full py-1.5 pl-3.5 pr-8 text-sm font-medium shadow-sm transition focus:outline-none ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === f.options[0].value ? f.label : o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-2.5 h-3.5 w-3.5 ${active ? "text-white" : "text-slate-400"}`}
              />
            </label>
          );
        })}
      </div>
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters
            .filter((f) => values[f.key] !== f.options[0].value)
            .map((f) => {
              const opt = f.options.find((o) => o.value === values[f.key]);
              return (
                <button
                  key={f.key}
                  onClick={() => onChange(f.key, f.options[0].value)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  {opt?.label} <X className="h-3 w-3" />
                </button>
              );
            })}
          <button
            onClick={onClearAll}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
