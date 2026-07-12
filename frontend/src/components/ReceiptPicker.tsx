"use client";

import { useRef } from "react";
import { Camera, Paperclip, X } from "lucide-react";
import { labelCls } from "@/components/Modal";

const pickerBtnCls =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700";

/** "Upload receipt or take a picture" — same pattern as the Documents view.
 * On phones the camera button opens the camera directly. */
export function ReceiptPicker({
  file,
  onChange,
  label = "Paper receipt (optional — saved to Documents)",
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Paperclip className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
            {file.name}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">
            {file.size >= 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.max(1, Math.round(file.size / 1024))} KB`}
          </span>
          <button
            type="button"
            aria-label="Remove receipt"
            onClick={() => {
              onChange(null);
              if (fileRef.current) fileRef.current.value = "";
              if (cameraRef.current) cameraRef.current.value = "";
            }}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={pickerBtnCls}>
            <Paperclip className="h-3.5 w-3.5" /> Upload file
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} className={pickerBtnCls}>
            <Camera className="h-3.5 w-3.5" /> Take photo
          </button>
        </div>
      )}
    </div>
  );
}
