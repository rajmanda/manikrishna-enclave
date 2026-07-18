import Link from "next/link";
import { Container } from "@/components/Section";

export default function NotFound() {
  return (
    <section className="py-24">
      <Container className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine-600">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-pine-950 sm:text-4xl">
          This page doesn&apos;t exist
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-pine-800/80">
          The address may have changed or been mistyped. Here are some
          helpful places to go instead.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-pine-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pine-800"
          >
            Home
          </Link>
          <Link
            href="/product"
            className="rounded-xl border border-pine-200 bg-white px-5 py-2.5 text-sm font-semibold text-pine-800 hover:bg-pine-50"
          >
            Product
          </Link>
          <Link
            href="/faq"
            className="rounded-xl border border-pine-200 bg-white px-5 py-2.5 text-sm font-semibold text-pine-800 hover:bg-pine-50"
          >
            FAQ
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-pine-200 bg-white px-5 py-2.5 text-sm font-semibold text-pine-800 hover:bg-pine-50"
          >
            Contact
          </Link>
        </div>
      </Container>
    </section>
  );
}
