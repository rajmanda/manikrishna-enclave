"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Filter state that lives in the URL — shareable links, working back button. */
export function useUrlFilters(defaults: Record<string, string>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values: Record<string, string> = { ...defaults };
  searchParams.forEach((v, k) => {
    if (k in defaults) values[k] = v;
  });

  function set(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaults[key]) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const activeCount = Object.keys(defaults).filter(
    (k) => values[k] !== defaults[k]
  ).length;

  return { values, set, clearAll, activeCount };
}
