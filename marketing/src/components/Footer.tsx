import Link from "next/link";
import { Home } from "lucide-react";
import {
  APP_URL,
  CONTACT_EMAIL,
  NAV_COMPANY,
  NAV_LEGAL,
  NAV_PRODUCT,
  NAV_SOLUTIONS,
  SITE_NAME,
} from "@/lib/site";
import { Container } from "./Section";

const GROUPS = [
  { title: "Product", links: NAV_PRODUCT },
  { title: "Solutions", links: NAV_SOLUTIONS },
  { title: "Company", links: NAV_COMPANY },
];

export default function Footer() {
  return (
    <footer className="border-t border-pine-100 bg-sand">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="flex items-center gap-2.5 text-lg font-bold text-pine-950">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine-700 text-white">
                <Home className="h-4 w-4" aria-hidden />
              </span>
              {SITE_NAME}
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-pine-800/80">
              One transparent home for your entire community — payments,
              expenses, maintenance, documents, and communication in one
              secure place.
            </p>
            <p className="mt-4 text-sm text-pine-800/80">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-pine-700 underline-offset-2 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          {GROUPS.map((g) => (
            <nav key={g.title} aria-label={`Footer ${g.title}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-pine-600">
                {g.title}
              </p>
              <ul className="mt-3 space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-pine-900/80 hover:text-pine-950 hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-pine-200/70 pt-6 text-sm text-pine-800/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {NAV_LEGAL.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-pine-950 hover:underline"
              >
                {l.label}
              </Link>
            ))}
            <a href={APP_URL} className="hover:text-pine-950 hover:underline">
              Resident Login
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
