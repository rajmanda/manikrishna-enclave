import Link from "next/link";
import { APP_URL } from "@/lib/site";
import { Container } from "./Section";

export default function FinalCta({
  title = "Give your community the clarity it deserves.",
  body = "Bring payments, expenses, maintenance, documents, and communication into one transparent workspace your whole community can trust.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="bg-pine-900 py-20 text-white">
      <Container className="text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pine-100/85">
          {body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/request-demo"
            className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-pine-900 shadow-sm hover:bg-pine-50 sm:w-auto"
          >
            Start Your Community
          </Link>
          <Link
            href="/request-demo"
            className="w-full rounded-xl border border-pine-500 px-6 py-3 text-sm font-semibold text-white hover:bg-pine-800 sm:w-auto"
          >
            Request a Demo
          </Link>
          <a
            href={APP_URL}
            className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-pine-100 hover:text-white sm:w-auto"
          >
            Resident Login →
          </a>
        </div>
      </Container>
    </section>
  );
}
