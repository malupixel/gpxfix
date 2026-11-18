import { apiClient } from "@/lib/api-client";
import type { RouteCoordinate } from "@/features/routes/route-geometry";
export type MatchedRoute = { coordinates: RouteCoordinate[]; waypoints: RouteCoordinate[]; segments: RouteCoordinate[][] };
export const apiRoutingService = {
  async route(from: RouteCoordinate, to: RouteCoordinate, signal?: AbortSignal): Promise<RouteCoordinate[]> {
    return (await this.matched([from, to], signal)).coordinates;
  },
  matched(points: RouteCoordinate[], signal?: AbortSignal): Promise<MatchedRoute> {
    return apiClient("/api/routing/route", { method: "POST", body: JSON.stringify({ points }), signal });
  },
};
