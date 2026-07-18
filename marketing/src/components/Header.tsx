"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Home, Menu, X } from "lucide-react";
import {
  APP_URL,
  NAV_COMPANY,
  NAV_PRODUCT,
  NAV_SOLUTIONS,
  SITE_NAME,
  type NavLink,
} from "@/lib/site";

function DesktopDropdown({ label, links }: { label: string; links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-2xl border border-pine-100 bg-white p-2 shadow-lift">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-pine-900 hover:bg-pine-50"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-pine-100/80 bg-ivory/90 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-pine-950"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-700 text-white">
              <Home className="h-5 w-5" aria-hidden />
            </span>
            {SITE_NAME}
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            <DesktopDropdown label="Product" links={NAV_PRODUCT} />
            <DesktopDropdown label="Solutions" links={NAV_SOLUTIONS} />
            <Link
              href="/how-it-works"
              className="rounded-lg px-3 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50"
            >
              How it works
            </Link>
            <Link
              href="/mobile-app"
              className="rounded-lg px-3 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50"
            >
              Mobile app
            </Link>
            <Link
              href="/about"
              className="rounded-lg px-3 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50"
            >
              About
            </Link>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <a
              href={APP_URL}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-pine-800 hover:bg-pine-50"
            >
              Resident Login
            </a>
            <Link
              href="/request-demo"
              className="rounded-xl bg-pine-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pine-800"
            >
              Start Your Community
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-pine-900 hover:bg-pine-50 lg:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {mobileOpen && (
        <nav
          aria-label="Mobile"
          className="border-t border-pine-100 bg-ivory px-5 pb-6 pt-3 lg:hidden"
        >
          {[
            { title: "Product", links: NAV_PRODUCT },
            { title: "Solutions", links: NAV_SOLUTIONS },
            { title: "Company", links: NAV_COMPANY },
          ].map((group) => (
            <div key={group.title} className="mb-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-pine-500">
                {group.title}
              </p>
              {group.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block rounded-lg px-2 py-2 text-[15px] font-medium text-pine-900 hover:bg-pine-50"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-2 grid gap-2">
            <Link
              href="/request-demo"
              className="rounded-xl bg-pine-700 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Start Your Community
            </Link>
            <a
              href={APP_URL}
              className="rounded-xl border border-pine-200 px-4 py-3 text-center text-sm font-semibold text-pine-800"
            >
              Resident Login
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-content px-5 sm:px-8">{children}</div>
  );
}
