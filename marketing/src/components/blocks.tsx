import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Container, SectionHeading } from "./Section";

/** Checked bullet grid used across product pages. */
export function CheckGrid({
  items,
  cols = 2,
}: {
  items: string[];
  cols?: 2 | 3;
}) {
  return (
    <ul
      className={`grid gap-x-8 gap-y-3 ${
        cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
      }`}
    >
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2.5 text-sm text-pine-800/90">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-pine-600" aria-hidden />
          {it}
        </li>
      ))}
    </ul>
  );
}

/** Standard content section wrapper with alternating backgrounds. */
export function Block({
  tone = "ivory",
  heading,
  children,
}: {
  tone?: "ivory" | "white";
  heading?: { eyebrow?: string; title: string; lede?: string };
  children?: ReactNode;
}) {
  return (
    <section
      className={
        tone === "white"
          ? "border-y border-pine-100 bg-white py-14 sm:py-20"
          : "py-14 sm:py-20"
      }
    >
      <Container>
        {heading && <SectionHeading {...heading} />}
        {children && <div className={heading ? "mt-10" : ""}>{children}</div>}
      </Container>
    </section>
  );
}

/** Numbered step list for process explanations. */
export function Steps({
  steps,
}: {
  steps: { title: string; body: string }[];
}) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li
          key={s.title}
          className="flex gap-4 rounded-2xl border border-pine-100 bg-white p-5 shadow-card"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-700 text-sm font-bold text-white"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-semibold text-pine-950">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-pine-800/80">
              {s.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "Related pages" internal-linking strip. */
export function RelatedLinks({
  links,
}: {
  links: { label: string; href: string }[];
}) {
  return (
    <section className="py-14 sm:py-16">
      <Container>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pine-600">
          Related
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1.5 rounded-xl border border-pine-200 bg-white px-4 py-2.5 text-sm font-semibold text-pine-800 hover:border-pine-300 hover:bg-pine-50"
            >
              {l.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
