export interface RouteData {
  publicId: string;
  name: string;
  description: string | null;
  distanceMeters: number;
  elevationGainMeters: number | null;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  createdAt: string;
}
export interface CreateRouteResponse { publicId: string }
