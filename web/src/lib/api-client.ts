const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
function apiUrl(): string {
  return typeof window === "undefined" ? (process.env.API_INTERNAL_URL ?? publicApiUrl) : publicApiUrl;
}
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
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
