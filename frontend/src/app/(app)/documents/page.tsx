"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Search,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { useSessionUser } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, downloadFile } from "@/lib/api";
import { API_URL, getToken } from "@/lib/api";
import type { CommunityDocument } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { Badge, Card, EmptyState, ErrorNote, PageLoading, PageTitle } from "@/components/ui";

const WRITER_ROLES = ["property_manager", "community_admin", "super_admin"];
const CATEGORIES = [
  "Society Rules", "Insurance", "Water Bills", "Electric Bills",
  "Audit Reports", "AGM Minutes", "Building Plans", "Contracts", "Other",
];
const fileIcons = { pdf: FileText, image: ImageIcon, sheet: Table2 };

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("category", category);
    const token = getToken();
    try {
      const resp = await fetch(`${API_URL}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new ApiError(resp.status, body.detail ?? resp.statusText);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <Modal title="Upload Document" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>File (PDF, image or spreadsheet, ≤10 MB)</label>
          <input
            type="file"
            accept="application/pdf,image/*,.csv,.xls,.xlsx"
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !file || !title.trim()} className={primaryBtnCls}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </Modal>
  );
}

function VersionUpload({ doc, onDone }: { doc: CommunityDocument; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const token = getToken();
    try {
      const resp = await fetch(`${API_URL}/documents/${doc.id}/file`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!resp.ok) throw new Error();
      onDone();
    } catch {
      alert("Version upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*,.csv,.xls,.xlsx"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        aria-label={`New version of ${doc.title}`}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
      </button>
    </>
  );
}

export default function DocumentsPage() {
  const { role } = useSessionUser();
  const canWrite = WRITER_ROLES.includes(role);
  const documents = useApi<CommunityDocument[]>("/documents");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [uploadOpen, setUploadOpen] = useState(false);

  const categories = useMemo(
    () => ["All", ...new Set((documents.data ?? []).map((d) => d.category))],
    [documents.data]
  );

  if (documents.error)
    return <ErrorNote message={documents.error} onRetry={documents.reload} />;
  if (documents.loading || !documents.data) return <PageLoading />;

  const q = query.trim().toLowerCase();
  const list = documents.data.filter(
    (d) =>
      (category === "All" || d.category === category) &&
      (!q || d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Documents"
        subtitle="Society records — searchable and version controlled"
        actions={
          canWrite ? (
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <Upload className="h-4 w-4" /> Upload
            </button>
          ) : undefined
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              category === c
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="No documents found" hint="Try a different search or category." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.map((d) => {
            const Icon = fileIcons[d.fileType];
            return (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-slate-500">
                    {d.category} · {formatDate(d.uploadedDate)} ·{" "}
                    {d.sizeKb >= 1000 ? `${(d.sizeKb / 1000).toFixed(1)} MB` : `${d.sizeKb} KB`}
                    {!d.path && " · file not digitised yet"}
                  </p>
                </div>
                {d.version > 1 && <Badge tone="slate">v{d.version}</Badge>}
                {canWrite && <VersionUpload doc={d} onDone={documents.reload} />}
                {d.path && (
                  <button
                    aria-label={`Download ${d.title}`}
                    onClick={() => downloadFile(`/documents/${d.id}/file`, d.title)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-brand-600"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                {canWrite && (
                  <button
                    aria-label={`Delete ${d.title}`}
                    onClick={async () => {
                      if (!confirm(`Delete "${d.title}"?`)) return;
                      await api(`/documents/${d.id}`, { method: "DELETE" });
                      documents.reload();
                    }}
                    className="rounded-lg p-2 text-slate-300 hover:bg-slate-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {uploadOpen && (
        <UploadDialog onClose={() => setUploadOpen(false)} onDone={documents.reload} />
      )}
    </div>
  );
}
