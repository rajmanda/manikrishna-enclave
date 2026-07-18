// Dedicated Growth Center API client — deliberately independent of
// src/lib/api.ts. The ONLY things shared with the main application are the
// session token (authentication reuse is approved) and visual components.
// Base URL: the backend origin + /api/super-admin/growth-center — a separate
// namespace from the operational /api/v1.

const API_V1 = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const BACKEND_ORIGIN = API_V1.replace(/\/api\/v1\/?$/, "");
export const GROWTH_API = `${BACKEND_ORIGIN}/api/super-admin/growth-center`;

// Same session token the app's auth flow issues (approved auth reuse).
const TOKEN_KEY = "communityhub_token";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export class GrowthApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function growthApi<T>(path: string, init?: RequestInit): Promise<T> {
  const jwt = token();
  let resp: Response;
  try {
    resp = await fetch(`${GROWTH_API}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new GrowthApiError(0, "Cannot reach the Growth Center API. Is the backend running?");
  }
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON error body
    }
    throw new GrowthApiError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

/** Download an export (markdown | text | json) as a browser file. */
export async function downloadExport(
  playbookId: string,
  format: "markdown" | "text" | "json",
  filename: string
): Promise<void> {
  const jwt = token();
  const resp = await fetch(
    `${GROWTH_API}/playbooks/${playbookId}/export?format=${format}`,
    { cache: "no-store", headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} }
  );
  if (!resp.ok) throw new GrowthApiError(resp.status, resp.statusText);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
