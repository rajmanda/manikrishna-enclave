// Thin client for the FastAPI backend. The API speaks camelCase JSON that
// matches ./types.ts, so responses need no mapping.

import type { User } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Shows dev quick-login and the account switcher. Set to "false" in prod.
export const DEV_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "false";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const TOKEN_KEY = "communityhub_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the CommunityHub API. Is the backend running?");
  }
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export async function loginWithGoogle(idToken: string): Promise<TokenResponse> {
  const result = await api<TokenResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  setToken(result.accessToken);
  return result;
}

export async function loginDev(email: string): Promise<TokenResponse> {
  const result = await api<TokenResponse>("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  setToken(result.accessToken);
  return result;
}

export async function fetchMe(): Promise<User> {
  return api<User>("/auth/me");
}

export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken();
  const resp = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new ApiError(resp.status, resp.statusText);
  return resp.blob();
}

/** Fetch an authenticated file and trigger a browser download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Multipart upload (no JSON content-type — the browser sets the boundary). */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(resp.status, detail);
  }
  return (await resp.json()) as T;
}
