"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { CONTACT_EMAIL, LEADS_API_URL } from "@/lib/site";

export type LeadKind = "demo" | "start" | "waitlist" | "contact";

/**
 * Lead capture: the form posts to the app API's public lead endpoint
 * (LEADS_API_URL → Growth Center CRM, see docs/NIVAASOS_PUBLIC_SITE.md §3)
 * so every CTA lands in the operator's pipeline. Deliberately NO mailto
 * flow (owner decision 2026-07-22): the visitor's mail app is never
 * opened — on failure we show a retry message with our address as text.
 */
export default function LeadForm({ kind }: { kind: LeadKind }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compact = kind === "waitlist" || kind === "contact";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    if (!name || !email) {
      setError("Please fill in your name and email address.");
      return;
    }

    setSubmitting(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(LEADS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind,
          name,
          email,
          phone: String(data.get("phone") || "").trim(),
          community: String(data.get("community") || "").trim(),
          city: String(data.get("city") || "").trim(),
          units: String(data.get("units") || "").trim(),
          role: String(data.get("role") || "").trim(),
          message: String(data.get("message") || "").trim(),
          // Honeypot — hidden from humans, bots fill it.
          website: String(data.get("website") || "").trim(),
        }),
      });
      clearTimeout(timer);
      if (resp.ok) {
        setSubmitting(false);
        setSent(true);
        return;
      }
    } catch {
      // Handled below — same retry message for network and server errors.
    }
    setSubmitting(false);
    setError(
      `We couldn't send your request right now. Please try again in a ` +
        `minute — or write to us at ${CONTACT_EMAIL}.`
    );
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-pine-200 bg-pine-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-pine-600" />
        <p className="mt-3 font-semibold text-pine-950">
          {kind === "waitlist"
            ? "You're on the waitlist!"
            : "Thanks — we've got your request"}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-pine-800/80">
          We&apos;ll get back to you shortly. If you&apos;d like to add
          anything in the meantime, email us at{" "}
          <a
            className="font-medium text-pine-700 underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-medium text-pine-700 underline-offset-2 hover:underline"
        >
          Back to the form
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-pine-200 bg-white px-3.5 py-2.5 text-sm text-pine-950 placeholder:text-pine-400 focus:border-pine-500 focus:outline-none focus:ring-1 focus:ring-pine-500";
  const label = "mb-1.5 block text-xs font-semibold text-pine-800";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${kind}-name`} className={label}>
            Your name *
          </label>
          <input
            id={`${kind}-name`}
            name="name"
            required
            autoComplete="name"
            className={field}
            placeholder="Full name"
          />
        </div>
        <div>
          <label htmlFor={`${kind}-email`} className={label}>
            Email *
          </label>
          <input
            id={`${kind}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            className={field}
            placeholder="you@example.com"
          />
        </div>
      </div>

      {!compact && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${kind}-phone`} className={label}>
                Phone
              </label>
              <input
                id={`${kind}-phone`}
                name="phone"
                type="tel"
                autoComplete="tel"
                className={field}
                placeholder="+91…"
              />
            </div>
            <div>
              <label htmlFor={`${kind}-role`} className={label}>
                Your role
              </label>
              <select id={`${kind}-role`} name="role" className={field} defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                <option>Community administrator / committee member</option>
                <option>Property manager</option>
                <option>Apartment owner</option>
                <option>Resident / tenant</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor={`${kind}-community`} className={label}>
                Community name
              </label>
              <input
                id={`${kind}-community`}
                name="community"
                className={field}
                placeholder="e.g. Greenwood Residency"
              />
            </div>
            <div>
              <label htmlFor={`${kind}-units`} className={label}>
                Apartments
              </label>
              <input
                id={`${kind}-units`}
                name="units"
                inputMode="numeric"
                className={field}
                placeholder="e.g. 24"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${kind}-city`} className={label}>
              City
            </label>
            <input
              id={`${kind}-city`}
              name="city"
              autoComplete="address-level2"
              className={field}
              placeholder="e.g. Hyderabad"
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor={`${kind}-message`} className={label}>
          Anything you&apos;d like to tell us?
        </label>
        <textarea
          id={`${kind}-message`}
          name="message"
          rows={3}
          className={field}
          placeholder="Optional"
        />
      </div>

      {/* Honeypot — visually hidden and skipped by keyboard/screen readers;
          any value here marks the submission as bot traffic. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`${kind}-website`}>Website</label>
        <input
          id={`${kind}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-pine-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {submitting
          ? "Sending…"
          : kind === "waitlist"
            ? "Join the waitlist"
            : "Send my request"}
      </button>
      <p className="text-xs leading-relaxed text-pine-600">
        Submitting sends these details securely to Nivaasos so we can respond
        to your request — we use them for nothing else.
      </p>
    </form>
  );
}
