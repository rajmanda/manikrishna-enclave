import Link from "next/link";
import type { ReactNode } from "react";
import { canonical, SITE_URL } from "@/lib/site";
import JsonLd from "./JsonLd";
import { Container, Eyebrow } from "./Section";

/** Interior-page hero with visible breadcrumb + BreadcrumbList JSON-LD.
 * `answer` renders the answer-first paragraph immediately under the H1. */
export default function PageHero({
  eyebrow,
  title,
  answer,
  breadcrumb,
  children,
}: {
  eyebrow: string;
  title: string;
  answer: string;
  breadcrumb: { label: string; path: string };
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-pine-100 bg-white py-14 sm:py-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            {
              "@type": "ListItem",
              position: 2,
              name: breadcrumb.label,
              item: canonical(breadcrumb.path),
            },
          ],
        }}
      />
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-pine-600">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-pine-900">
              {breadcrumb.label}
            </li>
          </ol>
        </nav>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-pine-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-pine-800/85">
          {answer}
        </p>
        {children}
      </Container>
    </section>
  );
}
