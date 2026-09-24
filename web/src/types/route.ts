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

export type SuggestionType = "NOTE" | "PROBLEM" | "DETOUR";
export type SuggestionStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export interface SuggestionAnchor { longitude: number; latitude: number; distanceMeters: number }
export interface RouteSuggestion {
  publicId: string;
  type: SuggestionType;
  status: SuggestionStatus;
  authorName: string;
  description: string;
  category: string | null;
  tags: string[];
  start: SuggestionAnchor;
  end: SuggestionAnchor | null;
  proposedGeometry: { type: "LineString"; coordinates: [number, number][] } | null;
  baseRouteUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}
export type CreateSuggestionRequest = Omit<RouteSuggestion, "publicId" | "status" | "baseRouteUpdatedAt" | "createdAt" | "updatedAt">;
