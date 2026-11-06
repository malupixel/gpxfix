const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
function apiUrl(): string {
  if (typeof window !== "undefined") return publicApiUrl;
  return process.env.API_INTERNAL_URL
    ?? (process.env.NODE_ENV === "production" ? "http://127.0.0.1:8151" : "http://localhost:8080");
}
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  path = withCurrentBranch(path);
  const isFormData = options?.body instanceof FormData;
  const response = await fetch(`${apiUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...options?.headers },
  });
  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;
    try { const body = await response.json() as { error?: string }; if (body.error) message = body.error; } catch { }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Apply variant context only to requests for the route currently on screen. */
export function withCurrentBranch(path: string): string {
  if (typeof window === "undefined") return path;
  const route = window.location.pathname.match(/^\/route\/([^/]+)/)?.[1];
  const branch = new URLSearchParams(window.location.search).get("branch");
  if (!route || !branch || !path.startsWith(`/api/routes/${route}`) || !["/", "?", undefined].includes(path[`/api/routes/${route}`.length])) return path;
  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has("branch")) url.searchParams.set("branch", branch);
  return url.pathname + url.search;
}
