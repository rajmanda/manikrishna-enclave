"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  MessageSquare,
  Receipt,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, DEV_LOGIN_ENABLED, GOOGLE_CLIENT_ID } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";

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
  { label: "Raj — Property Manager", email: "raj.manda@gmail.com" },
  { label: "Owner 501 (placeholder)", email: "owner501@example.com" },
  { label: "Community Auditor — Read Only", email: "auditor@communityhub.app" },
];

/** Google blocks OAuth inside embedded in-app browsers (WhatsApp, Instagram,
 * Facebook, Gmail app, …) with "Access denied" — most owners arrive via a
 * WhatsApp link, so detect it and tell them to open a real browser instead
 * of letting them hit Google's dead end. */
function isEmbeddedWebview(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Explicit in-app browser markers.
  if (/WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|Snapchat|Twitter/i.test(ua)) {
    return true;
  }
  // Android WebView ships "; wv)" in its UA.
  if (/Android/.test(ua) && /;\s?wv\)/.test(ua)) return true;
  // iOS in-app browsers use WKWebView: real browsers always carry a
  // Safari/CriOS/FxiOS/EdgiOS token; a bare AppleWebKit UA is a webview.
  if (
    /iPhone|iPad|iPod/.test(ua) &&
    !/Safari\/|CriOS\/|FxiOS\/|EdgiOS\//.test(ua)
  ) {
    return true;
  }
  return false;
}

function WebviewWarning() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        Google sign-in doesn&apos;t work inside this app&apos;s built-in browser
      </p>
      <p className="mt-1.5 text-xs text-amber-800">
        You opened this link inside WhatsApp or another app. Google blocks
        sign-in here for security. Tap the <b>⋮</b> (or share) menu and choose{" "}
        <b>Open in browser</b> — or copy the link below and paste it into
        Chrome or Safari.
      </p>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.origin);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            // Clipboard can be unavailable in webviews — the URL is visible below.
          }
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" /> Copied — paste it in Chrome
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" /> Copy link for Chrome / Safari
          </>
        )}
      </button>
      <p className="mt-2 text-center font-mono text-xs text-amber-700">
        {/* Rendered only post-hydration (inWebview gate), so window exists. */}
        {typeof window !== "undefined" ? window.location.host : ""}
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { user, loading, devLogin, googleLogin } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [inWebview, setInWebview] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const handoffTried = useRef(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  // Credential handoff from the marketing site: nivaasos.com hosts the
  // Google sign-in popup and forwards the Google ID token here as
  // `#gcred=…` (a fragment — never sent to any server). Consume it once,
  // scrub it from the URL/history immediately, then exchange it for a
  // session exactly like the on-page Google button does.
  useEffect(() => {
    if (handoffTried.current) return;
    const match = /[#&]gcred=([^&]+)/.exec(window.location.hash);
    if (!match) return;
    handoffTried.current = true;
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
    setHandoff(true);
    googleLogin(decodeURIComponent(match[1]))
      .then(() => router.replace("/dashboard"))
      .catch((err) => {
        setHandoff(false);
        setError(
          err instanceof ApiError ? err.message : "Google sign-in failed"
        );
      });
  }, [googleLogin, router]);

  // After hydration only — UA sniffing on the server would mismatch.
  useEffect(() => {
    setInWebview(isEmbeddedWebview());
  }, []);

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
          {APP_NAME}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your apartment community — invoices, maintenance, documents and
          discussions in one place.
        </p>

        {/* In-app browsers can't complete Google OAuth — say so up front. */}
        {inWebview && <WebviewWarning />}

        {/* Signing in via marketing-site handoff — hide the button, show progress. */}
        {handoff && (
          <p className="mt-8 animate-pulse text-sm font-medium text-brand-700">
            Signing you in…
          </p>
        )}

        {/* Google sign-in (rendered by GIS when configured) */}
        <div className={inWebview || handoff ? "hidden" : "mt-8 flex justify-center"}>
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
          <div className="mt-6 space-y-4">
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customEmail.trim()) {
                  handleDevLogin(customEmail.trim());
                }
              }}
              className="flex gap-2"
            >
              <input
                type="email"
                disabled={busy}
                placeholder="Or enter custom email (Yahoo, etc)..."
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white text-slate-800"
              />
              <button
                type="submit"
                disabled={busy || !customEmail.trim()}
                className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
              >
                Sign In
              </button>
            </form>
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
      <p className="mt-10 text-xs text-slate-400">{APP_NAME}</p>
    </div>
  );
}
