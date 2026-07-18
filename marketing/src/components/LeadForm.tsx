"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/site";

export type LeadKind = "demo" | "start" | "waitlist" | "contact";

const SUBJECTS: Record<LeadKind, string> = {
  demo: "Nivaasos — demo request",
  start: "Nivaasos — start our community",
  waitlist: "Nivaasos — mobile app waitlist",
  contact: "Nivaasos — contact",
};

/**
 * Lead capture without an unapproved backend: the form validates locally,
 * then opens the visitor's email client with a structured message to the
 * Nivaasos mailbox. This is deliberate — see docs/NIVAASOS_PUBLIC_SITE.md
 * for the plan to replace it with a secure server endpoint. No data is
 * sent anywhere until the visitor sends the email themselves, and the UI
 * says so plainly.
 */
export default function LeadForm({ kind }: { kind: LeadKind }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compact = kind === "waitlist" || kind === "contact";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    if (!name || !email) {
      setError("Please fill in your name and email address.");
      return;
    }
    const lines = [
      `Name: ${name}`,
      `Email: ${email}`,
      data.get("phone") && `Phone: ${data.get("phone")}`,
      data.get("community") && `Community: ${data.get("community")}`,
      data.get("city") && `City: ${data.get("city")}`,
      data.get("units") && `Apartments/units: ${data.get("units")}`,
      data.get("role") && `Role: ${data.get("role")}`,
      data.get("message") && `Message: ${data.get("message")}`,
    ].filter(Boolean);
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      SUBJECTS[kind]
    )}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-pine-200 bg-pine-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-pine-600" />
        <p className="mt-3 font-semibold text-pine-950">
          Almost done — send the email we prepared
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-pine-800/80">
          Your email app should have opened with your details filled in. Press
          send there and we&apos;ll get back to you. If nothing opened, email
          us directly at{" "}
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

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-pine-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pine-800"
      >
        <Mail className="h-4 w-4" />
        {kind === "waitlist" ? "Join the waitlist" : "Send my request"}
      </button>
      <p className="text-xs leading-relaxed text-pine-600">
        Submitting opens your email app with this message addressed to{" "}
        {CONTACT_EMAIL} — nothing is sent until you press send there. We use
        your details only to respond to your request.
      </p>
    </form>
  );
}
