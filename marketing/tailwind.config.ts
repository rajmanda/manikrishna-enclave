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
        pine: {
          50: "#f2f7f4",
          100: "#dfece5",
          200: "#c1d9cc",
          300: "#97bfaa",
          400: "#699f83",
          500: "#498266",
          600: "#366850",
          700: "#2b5341",
          800: "#244336",
          900: "#1e372d",
          950: "#0f1f19",
        },
        ivory: "#faf8f4",
        sand: "#f3efe7",
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
