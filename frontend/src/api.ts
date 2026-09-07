// In production (Railway), set VITE_API_URL to your backend Railway domain.
// Railway's UI strips "https://" from variable values, so we normalise it here.
// e.g. "reflex-ke-backend.up.railway.app" → "https://reflex-ke-backend.up.railway.app"
function buildBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) return "/api"; // local dev — Vite proxy handles it
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
const BASE = buildBase();

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
