"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

type Theme = "nivaasos" | "classic";
const THEME_KEY = "nivaasos_theme";

/** Floating palette switch (bottom-right, all pages). Default is the
 * Nivaasos evergreen; "Classic" reskins the site in the app's indigo via
 * the .theme-classic variable overrides in globals.css. */
export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("nivaasos");

  useEffect(() => {
    if (localStorage.getItem(THEME_KEY) === "classic") apply("classic");
  }, []);

  function apply(t: Theme) {
    setTheme(t);
    document.body.classList.toggle("theme-classic", t === "classic");
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
          { id: "nivaasos", label: "Nivaasos" },
          { id: "classic", label: "Classic" },
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
