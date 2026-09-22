export interface RouteData {
  publicId: string;
  name: string;
  description: string | null;
  originalFilename: string;
  distanceMeters: number;
  elevationGainMeters: number | null;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  elevationProfile: ElevationSample[];
  createdAt: string;
}
export interface ElevationSample { distanceMeters: number; elevationMeters: number | null; longitude: number; latitude: number }
export interface CreateRouteResponse { publicId: string; managementToken: string }
