"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

type Theme = "indigo" | "evergreen";
const THEME_KEY = "nivaasos_theme";

/** Floating palette switch (bottom-right, all pages). Default is indigo —
 * the same brand color as the application, one look end to end. The
 * original evergreen palette stays available via .theme-evergreen. */
export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("indigo");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    // "nivaasos" is the legacy stored name for the evergreen look.
    if (saved === "evergreen" || saved === "nivaasos") apply("evergreen");
  }, []);

  function apply(t: Theme) {
    setTheme(t);
    document.body.classList.toggle("theme-evergreen", t === "evergreen");
    localStorage.setItem(THEME_KEY, t);
  }

  return (
    <div
      role="group"
      aria-label="Site theme"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-pine-200 bg-white/95 p-1 shadow-lift backdrop-blur"
    >
      <Palette className="ml-2 h-3.5 w-3.5 text-pine-400" aria-hidden />
      {(
        [
          { id: "indigo", label: "Indigo" },
          { id: "evergreen", label: "Evergreen" },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={theme === t.id}
          onClick={() => apply(t.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            theme === t.id
              ? "bg-pine-700 text-white"
              : "text-pine-700 hover:text-pine-950"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
