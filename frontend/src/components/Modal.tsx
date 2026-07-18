"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Portal to <body> so the overlay escapes any transformed ancestor (e.g. the
  // page-transition wrapper). A `transform` on an ancestor makes `position:
  // fixed` resolve against that ancestor instead of the viewport, which would
  // otherwise drop the modal at the bottom of a tall page and force scrolling.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock background scroll and support Escape-to-close while the modal is open.
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

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <button
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      {/* Centered on every viewport (no mobile bottom-sheet): the panel opens
          where the user tapped, with breathing room on all sides from the
          container's p-4. `modal-panel-max` caps height in dvh so the panel
          stays fully visible above mobile browser toolbars. */}
      <div className="animate-rise modal-panel-max relative w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none";
export const labelCls = "mb-1.5 block text-xs font-medium text-slate-600";
export const primaryBtnCls =
  "w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
