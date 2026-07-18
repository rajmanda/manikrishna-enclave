import type { Config } from "tailwindcss";

/**
 * Nivaasos brand tokens. Deliberately distinct from the application's
 * indigo theme: a deep evergreen ("nivaas" — dwelling) with warm ivory
 * surfaces and an amber accent. Calm, premium, trustworthy.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // CSS-variable driven so the visitor-facing theme switch can swap
        // the whole palette (defaults in globals.css :root = evergreen;
        // .theme-classic = the app's indigo).
        pine: {
          50: "rgb(var(--pine-50) / <alpha-value>)",
          100: "rgb(var(--pine-100) / <alpha-value>)",
          200: "rgb(var(--pine-200) / <alpha-value>)",
          300: "rgb(var(--pine-300) / <alpha-value>)",
          400: "rgb(var(--pine-400) / <alpha-value>)",
          500: "rgb(var(--pine-500) / <alpha-value>)",
          600: "rgb(var(--pine-600) / <alpha-value>)",
          700: "rgb(var(--pine-700) / <alpha-value>)",
          800: "rgb(var(--pine-800) / <alpha-value>)",
          900: "rgb(var(--pine-900) / <alpha-value>)",
          950: "rgb(var(--pine-950) / <alpha-value>)",
        },
        ivory: "rgb(var(--ivory) / <alpha-value>)",
        sand: "rgb(var(--sand) / <alpha-value>)",
        amberglow: "#d97706",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "72rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 31 25 / 0.04), 0 4px 16px rgb(15 31 25 / 0.06)",
        lift: "0 2px 4px rgb(15 31 25 / 0.06), 0 12px 32px rgb(15 31 25 / 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
