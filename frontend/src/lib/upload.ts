// Multipart upload helper with client-side image compression. Phone camera
// photos are routinely 4–15 MB; the API (and the Next dev proxy) cap bodies
// at 10 MB, and a receipt never needs that much resolution anyway.

import { API_URL, ApiError, getToken } from "@/lib/api";
import type { CommunityDocument } from "@/lib/types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // keep in sync with backend
const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // small images pass through
const MAX_IMAGE_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;

async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    // Format the browser can't decode — send as-is and let the server decide.
    return file;
  }
}

/** Shrinks large images; rejects anything still over the API limit with a
 * friendly error instead of letting the request fail mid-flight. */
export async function prepareUpload(file: File): Promise<File> {
  let out = file;
  if (file.type.startsWith("image/") && file.size > COMPRESS_THRESHOLD_BYTES) {
    out = await compressImage(file);
  }
  if (out.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      413,
      "File is larger than 10 MB — please choose a smaller file."
    );
  }
  return out;
}

/** Uploads files one at a time; returns how many failed so callers can
 * report partial failures without aborting the rest. */
export async function uploadEach(
  files: File[],
  fn: (file: File, index: number) => Promise<unknown>
): Promise<number> {
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      await fn(files[i], i);
    } catch {
      failed += 1;
    }
  }
  return failed;
}

/** Multipart upload (the JSON `api()` helper can't carry files). Used for
 * receipts on invoices and document uploads. */
export async function uploadFileTo(
  url: string,
  file: File,
  fields: Record<string, string> = {}
): Promise<CommunityDocument> {
  const prepared = await prepareUpload(file);
  const form = new FormData();
  form.append("file", prepared);
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
  const token = getToken();
  const resp = await fetch(`${API_URL}${url}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(resp.status, body.detail ?? resp.statusText);
  }
  return resp.json();
}
