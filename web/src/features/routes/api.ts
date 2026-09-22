import { apiClient } from "@/lib/api-client";
import type { CreateRouteResponse, RouteData } from "@/types/route";
export function uploadRoute(form: FormData): Promise<CreateRouteResponse> { return apiClient("/api/routes", { method: "POST", body: form }); }
export function getRoute(publicId: string): Promise<RouteData> { return apiClient(`/api/routes/${encodeURIComponent(publicId)}`, { cache: "no-store" }); }
export function establishRouteOwnership(publicId: string, token: string): Promise<void> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/ownership`, { method: "POST", body: JSON.stringify({ token }) });
}
export async function getRouteOwnerStatus(publicId: string): Promise<boolean> {
  try { await apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner`, { cache: "no-store" }); return true; }
  catch { return false; }
}
