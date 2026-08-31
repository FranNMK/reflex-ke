// In production (Railway), set VITE_API_URL=https://your-backend.up.railway.app
// In local dev this is undefined, so /api is used (proxied by vite.config.ts)
const BASE = import.meta.env.VITE_API_URL ?? "/api";

function getToken(): string | null {
  return localStorage.getItem("reflex_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
};
