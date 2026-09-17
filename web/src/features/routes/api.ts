import { apiClient } from "@/lib/api-client";
import type { CreateRouteResponse, RouteData } from "@/types/route";
export function uploadRoute(form: FormData): Promise<CreateRouteResponse> { return apiClient("/api/routes", { method: "POST", body: form }); }
export function getRoute(publicId: string): Promise<RouteData> { return apiClient(`/api/routes/${encodeURIComponent(publicId)}`, { cache: "no-store" }); }
