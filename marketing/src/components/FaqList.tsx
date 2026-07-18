import JsonLd from "./JsonLd";

export interface Faq {
  q: string;
  a: string;
}

/** Accessible no-JS FAQ accordion (native details/summary) with matching
 * FAQPage JSON-LD. Only pass FAQs that are visibly rendered on the page. */
export default function FaqList({
  faqs,
  withSchema = false,
}: {
  faqs: Faq[];
  withSchema?: boolean;
}) {
  return (
    <div className="divide-y divide-pine-100 rounded-2xl border border-pine-100 bg-white shadow-card">
      {withSchema && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }}
        />
      )}
      {faqs.map((f) => (
        <details key={f.q} className="group px-5 py-4 open:bg-pine-50/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-semibold text-pine-950 [&::-webkit-details-marker]:hidden">
            {f.q}
            <span
              aria-hidden
              className="text-pine-400 transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-pine-800/85">
            {f.a}
          </p>
        </details>
      ))}
    </div>
  );
}
