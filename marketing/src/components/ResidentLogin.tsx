"use client";

/**
 * Resident Login popup. Instead of bouncing visitors to the app's login
 * page (an extra hop), the popup hosts the Google sign-in button right on
 * the marketing site and hands the resulting Google credential to the app
 * via a URL fragment (`#gcred=…`). The app exchanges it for a session and
 * lands the user on their dashboard — one click, no intermediate page.
 *
 * The marketing site still never talks to the backend API: the credential
 * exchange happens on the app origin. Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * at build time AND nivaasos.com registered as an authorized JavaScript
 * origin on the same Google OAuth client — otherwise the popup gracefully
 * falls back to a link to the app's sign-in page.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { APP_URL, GOOGLE_CLIENT_ID } from "@/lib/site";

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

/** Google blocks OAuth inside embedded in-app browsers (WhatsApp, Instagram,
 * Gmail, …). Marketing links get shared on WhatsApp too, so detect it and
 * steer the user to a real browser instead of a Google dead end. */
function isEmbeddedWebview(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|Snapchat|Twitter/i.test(ua)) {
    return true;
  }
  if (/Android/.test(ua) && /;\s?wv\)/.test(ua)) return true;
  if (
    /iPhone|iPad|iPod/.test(ua) &&
    !/Safari\/|CriOS\/|FxiOS\/|EdgiOS\//.test(ua)
  ) {
    return true;
  }
  return false;
}

function LoginModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [inWebview, setInWebview] = useState(false);
  const [gsiFailed, setGsiFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInWebview(isEmbeddedWebview());
  }, []);

  // Lock background scroll + Escape-to-close while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Google Identity Services — render the sign-in button inside the popup.
  useEffect(() => {
    if (!mounted || !GOOGLE_CLIENT_ID || inWebview) return;
    const host = document.getElementById("nivaasos-gsi-button");
    if (!host) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onerror = () => setGsiFailed(true);
    script.onload = () => {
      if (!window.google) {
        setGsiFailed(true);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => {
          // Fragment, not query string: fragments never reach a server or
          // its logs. The app consumes and clears it immediately on load.
          window.location.href = `${APP_URL}/#gcred=${encodeURIComponent(credential)}`;
        },
      });
      window.google.accounts.id.renderButton(host, {
        theme: "outline",
        size: "large",
        width: 280,
        text: "continue_with",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [mounted, inWebview]);

  if (!mounted) return null;

  const showGoogle = Boolean(GOOGLE_CLIENT_ID) && !inWebview && !gsiFailed;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resident Login"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button
        className="absolute inset-0 bg-pine-950/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-pine-950">
              Resident Login
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-pine-800/80">
              Sign in with the Google account your community registered —
              you&apos;ll go straight to your community workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-pine-400 hover:bg-pine-50 hover:text-pine-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {inWebview && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              Google sign-in doesn&apos;t work inside this app&apos;s built-in
              browser
            </p>
            <p className="mt-1.5 text-xs text-amber-800">
              You opened this page inside WhatsApp or another app. Tap the{" "}
              <b>⋮</b> (or share) menu and choose <b>Open in browser</b>, then
              try again.
            </p>
          </div>
        )}

        {showGoogle && (
          <div className="mt-6 flex min-h-[44px] justify-center">
            <div id="nivaasos-gsi-button" />
          </div>
        )}

        {!showGoogle && !inWebview && (
          <a
            href={APP_URL}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-pine-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pine-800"
          >
            Continue to sign in
            <ExternalLink className="h-4 w-4" />
          </a>
        )}

        <p className="mt-5 text-center text-xs text-pine-600">
          Access is restricted to registered community members.{" "}
          <a
            href={APP_URL}
            className="font-semibold text-pine-700 hover:underline"
          >
            Open the full sign-in page →
          </a>
        </p>
      </div>
    </div>,
    document.body
  );
}

/** Drop-in replacement for the old `<a href={APP_URL}>` login links: same
 * styling via className, but opens the login popup instead of navigating. */
export function ResidentLoginButton({
  className,
  children = "Resident Login",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <LoginModal onClose={() => setOpen(false)} />}
    </>
  );
}
