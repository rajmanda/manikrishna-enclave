"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MessageSquare,
  Receipt,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, DEV_LOGIN_ENABLED, GOOGLE_CLIENT_ID } from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

const DEV_ACCOUNTS = [
  { label: "Vishnu — Property Manager", email: "vishnu@communityhub.app" },
  { label: "Rajaram (Apt 502) — Owner", email: "owner502@example.com" },
  { label: "Community Auditor — Read Only", email: "auditor@communityhub.app" },
];

export default function LoginPage() {
  const { user, loading, devLogin, googleLogin } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  // Google Identity Services — only when a client ID is configured.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            await googleLogin(credential);
            router.replace("/dashboard");
          } catch (err) {
            setError(
              err instanceof ApiError ? err.message : "Google sign-in failed"
            );
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [googleLogin, router]);

  async function handleDevLogin(email: string) {
    setBusy(true);
    setError(null);
    try {
      await devLogin(email);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <Building2 className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          CommunityHub
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your apartment community — invoices, maintenance, documents and
          discussions in one place.
        </p>

        {/* Google sign-in (rendered by GIS when configured) */}
        <div className="mt-8 flex justify-center">
          {GOOGLE_CLIENT_ID ? (
            <div ref={googleButtonRef} />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-400">
              Google sign-in appears here once{" "}
              <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> is
              configured.
            </p>
          )}
        </div>

        {DEV_LOGIN_ENABLED && (
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Development sign-in
            </p>
            <div className="space-y-2">
              {DEV_ACCOUNTS.map(({ label, email }) => (
                <button
                  key={email}
                  disabled={busy}
                  onClick={() => handleDevLogin(email)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-brand-600" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-slate-400">
          Access is restricted to whitelisted community members. Contact your
          property manager if you can&apos;t sign in.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 text-left">
          {[
            { icon: Receipt, label: "Invoices & payments" },
            { icon: Wrench, label: "Work orders & maintenance" },
            { icon: MessageSquare, label: "Community feed & polls" },
            { icon: ShieldCheck, label: "Documents & transparency" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <Icon className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="text-xs font-medium text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-10 text-xs text-slate-400">
        community.rajmanda.com · Mani Krishna Enclave
      </p>
    </div>
  );
}
