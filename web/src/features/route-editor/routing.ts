import { apiClient } from "@/lib/api-client";
import type { RouteCoordinate } from "@/features/routes/route-geometry";
export interface RoutingService { route(from: RouteCoordinate, to: RouteCoordinate, signal?: AbortSignal): Promise<RouteCoordinate[]>; }
export const apiRoutingService: RoutingService = { async route(from,to,signal){ const result=await apiClient<{coordinates:RouteCoordinate[]}>("/api/routing/route",{method:"POST",body:JSON.stringify({from,to}),signal}); return result.coordinates; } };
