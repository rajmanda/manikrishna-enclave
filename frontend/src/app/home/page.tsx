"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  FileText,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Vote,
  Wrench,
} from "lucide-react";

/* ---------------------------------------------------------------- data */

const FEATURES = [
  {
    icon: Receipt,
    title: "Invoices & payments",
    body: "Per-flat billing, consolidated statements, late fees and credits — with a clean paper trail owners actually trust.",
  },
  {
    icon: Wrench,
    title: "Work orders",
    body: "A full lifecycle from reported to closed: estimates, approvals, vendor assignment, photos and cost tracking.",
  },
  {
    icon: BarChart3,
    title: "Reserve & reporting",
    body: "Live reserve-fund tracking, cash-flow trends and one-tap PDF reports for every meeting and audit.",
  },
  {
    icon: MessageSquare,
    title: "Community feed",
    body: "Announcements, notices and threaded discussion — so the group chat finally has a home that stays organised.",
  },
  {
    icon: Vote,
    title: "Polls & governance",
    body: "One vote per apartment, versioned documents and meeting minutes. Decisions made in the open.",
  },
  {
    icon: ShieldCheck,
    title: "Roles & audit",
    body: "Google sign-in, a whitelist, granular roles and an immutable audit log on every action. Secure by default.",
  },
];

const STATS = [
  { value: "₹40.8k", label: "Collected this cycle" },
  { value: "96%", label: "Collection rate" },
  { value: "10", label: "Apartments, one source of truth" },
  { value: "100%", label: "API-driven & auditable" },
];

const TESTIMONIALS = [
  {
    quote:
      "Dues, repairs and the reserve fund used to live in three WhatsApp groups and a notebook. Now it's one screen everyone trusts.",
    name: "Vishnu",
    role: "Property Manager, Mani Krishna Enclave",
  },
  {
    quote:
      "I can see exactly what I owe, what the community spent, and where the reserve stands — without asking anyone.",
    name: "M.V. Shanmukha Datta",
    role: "Owner, Apt 101",
  },
  {
    quote:
      "Approvals that took a week of phone calls now take a tap. The audit log means no one has to take my word for it.",
    name: "Rajaram Manda",
    role: "Community Admin",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "Free",
    tagline: "For a single small community finding its feet.",
    features: ["Up to 15 units", "Invoices & payments", "Community feed", "Email support"],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Community",
    price: "₹2,999",
    unit: "/ month",
    tagline: "Everything an active association needs to run in the open.",
    features: [
      "Unlimited units",
      "Work orders & vendors",
      "Reserve fund & reports",
      "Polls, documents & minutes",
      "Full audit log",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Portfolio",
    price: "Custom",
    tagline: "For managers running many communities at once.",
    features: ["Multi-community console", "Consolidated billing", "SSO & advanced roles", "Priority support"],
    cta: "Talk to us",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "Who is CommunityHub for?",
    a: "Apartment associations, HOAs and property managers who want billing, maintenance, documents and governance in one auditable place — instead of spreadsheets and scattered chats.",
  },
  {
    q: "How do people sign in?",
    a: "Google sign-in against a member whitelist. Unknown accounts are refused, and every role from auditor to super-admin has precisely scoped permissions.",
  },
  {
    q: "Can one owner hold multiple apartments?",
    a: "Yes. Ownership, billing and portal access are modelled separately, so an account can own several units with a single consolidated statement while legal title is preserved per apartment.",
  },
  {
    q: "Is our data private and secure?",
    a: "Every record is tenant-scoped server-side, secrets live in a managed vault, traffic is HTTPS-only, and every create, update and delete is written to an immutable audit log.",
  },
  {
    q: "What does it cost to start?",
    a: "The Starter plan is free for small communities. You can move to Community when you need work orders, reserves and governance — no migration, same data.",
  },
];

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ------------------------------------------------------------ sections */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-brand-glow">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900">
            CommunityHub
          </span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition-colors hover:text-slate-900">Features</a>
          <a href="#pricing" className="transition-colors hover:text-slate-900">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-slate-900">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-brand-glow"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* Above-the-fold entrance: transform-only (opacity stays 1) so content is
 * ALWAYS visible — even in a backgrounded tab where rAF/JS animation is paused,
 * with JS disabled, or in reader mode. The rise is pure enhancement. */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[42rem] max-w-5xl rounded-full bg-gradient-to-b from-brand-200/50 via-brand-100/30 to-transparent blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-16 text-center sm:pt-24">
        <div
          className="mx-auto inline-flex animate-enter items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700"
          style={{ animationDelay: "0ms" }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          The operating system for apartment communities
        </div>

        <h1
          className="mx-auto mt-6 max-w-3xl animate-enter text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          Run your community like
          <span className="bg-gradient-to-r from-brand-600 to-violet-500 bg-clip-text text-transparent">
            {" "}a well-kept building.
          </span>
        </h1>

        <p
          className="mx-auto mt-5 max-w-xl animate-enter text-lg text-slate-600"
          style={{ animationDelay: "120ms" }}
        >
          Invoices, maintenance, reserves, documents and decisions — for every
          apartment, in one transparent place your owners actually trust.
        </p>

        <div
          className="mt-8 flex animate-enter flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "180ms" }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-brand-glow transition-all hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Free for small communities · Google sign-in · No card required
        </p>

        <HeroPreview />
      </div>
    </section>
  );
}

/** A stylised product preview — a miniature of the real dashboard. Rendered
 * fully visible (transform-only entrance), so it never blanks out. */
function HeroPreview() {
  const bars = [42, 58, 47, 66, 54, 72];
  return (
    <div
      className="relative mx-auto mt-14 max-w-4xl animate-enter"
      style={{ animationDelay: "240ms" }}
    >
      <div className="overflow-hidden rounded-4xl border border-slate-200/80 bg-white shadow-lg">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-300" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-emerald-300" />
          <span className="ml-3 text-xs font-medium text-slate-400">
            community.rajmanda.com / dashboard
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {/* stat tiles */}
          {[
            { l: "Outstanding", v: "₹12,700", a: "bg-red-500", c: "text-red-600" },
            { l: "Received", v: "₹40,800", a: "bg-emerald-500", c: "text-emerald-600" },
            { l: "Reserve fund", v: "₹10,470", a: "bg-brand-500", c: "text-slate-900" },
          ].map((s) => (
            <div
              key={s.l}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm"
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${s.a}`} />
              <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">{s.l}</p>
              <p className={`tabular mt-1 text-xl font-bold ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>
        {/* chart */}
        <div className="px-5 pb-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-slate-800">Cash flow · 6 months</p>
            <div className="flex h-32 items-end gap-3">
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="flex-1 rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBar() {
  return (
    <section className="border-y border-slate-200/70 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="tabular text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {s.value}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Scroll-in reveal that is ALWAYS visible: content renders at full opacity and
 * only receives a transform-only rise when it enters the viewport. If JS never
 * runs (backgrounded tab, no-JS, reader mode) the content is still fully shown. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-80px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={shown ? "animate-enter" : undefined}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Everything in one place
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            The whole community, handled
          </h2>
          <p className="mt-4 text-slate-600">
            Six modules that replace the spreadsheets, the notebook and the three
            group chats — each one auditable, each one mobile-first.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 0.06}>
            <div className="group h-full rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="border-y border-slate-200/70 bg-slate-50/60">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex justify-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Trusted where it matters most
            </h2>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <blockquote className="flex-1 text-sm leading-relaxed text-slate-700">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-semibold text-brand-700">
                    {t.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Pricing</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mt-4 text-slate-600">
            Start free. Upgrade when your community grows into it. No lock-in.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
        {PRICING.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.06}>
            <div
              className={`relative flex h-full flex-col rounded-3xl border p-7 shadow-sm ${
                p.highlight
                  ? "border-brand-300 bg-slate-900 text-white shadow-lg"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-2xs font-bold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <p className={`text-sm font-semibold ${p.highlight ? "text-brand-300" : "text-slate-900"}`}>
                {p.name}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className={`text-4xl font-extrabold tracking-tight ${p.highlight ? "text-white" : "text-slate-900"}`}>
                  {p.price}
                </span>
                {p.unit && <span className={`text-sm ${p.highlight ? "text-slate-400" : "text-slate-500"}`}>{p.unit}</span>}
              </div>
              <p className={`mt-2 text-sm ${p.highlight ? "text-slate-300" : "text-slate-600"}`}>{p.tagline}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-brand-400" : "text-brand-600"}`} />
                    <span className={p.highlight ? "text-slate-200" : "text-slate-700"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/"
                className={`mt-7 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  p.highlight
                    ? "bg-brand-500 text-white hover:bg-brand-400"
                    : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200/80">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-sm leading-relaxed text-slate-600">{a}</p>
      </motion.div>
    </div>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t border-slate-200/70 bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:py-28">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Questions, answered
          </h2>
        </Reveal>
        <div className="mt-10">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFooter() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-4xl bg-slate-900 px-8 py-14 text-center shadow-lg sm:px-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 max-w-lg rounded-full bg-brand-500/30 blur-3xl"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Give your community a home it can trust
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-300">
                Set up in minutes. Bring your apartments, owners and reserve fund
                into one transparent, auditable place.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-brand-glow transition-all hover:-translate-y-0.5 hover:bg-brand-400"
                >
                  Get started free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-slate-200/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="font-semibold text-slate-700">CommunityHub</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="transition-colors hover:text-slate-900">Features</a>
            <a href="#pricing" className="transition-colors hover:text-slate-900">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-slate-900">FAQ</a>
            <Link href="/" className="transition-colors hover:text-slate-900">Sign in</Link>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} CommunityHub · Mani Krishna Enclave
          </p>
        </div>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------- page */

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-white text-slate-900">
      <Nav />
      <Hero />
      <StatBar />
      <Features />
      <Testimonials />
      <Pricing />
      <Faq />
      <CtaFooter />
    </main>
  );
}
