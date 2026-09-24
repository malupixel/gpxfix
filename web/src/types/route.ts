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
export type ModerationStatus = "PENDING" | "PUBLISHED" | "REJECTED";
export type SuggestionIntegrationStatus = "NOT_APPLICABLE" | "NOT_MERGED" | "MERGED";
export type SuggestionApplicability = "NOT_APPLICABLE" | "CLEAN" | "CONFLICT" | "OUTDATED";
export interface SuggestionComment { publicId:string;authorName:string;content:string;moderationStatus:ModerationStatus;createdAt:string;updatedAt:string }
export interface SuggestionAnchor { longitude: number; latitude: number; distanceMeters: number }
export interface RouteSuggestion {
  publicId: string;
  type: SuggestionType;
  moderationStatus: ModerationStatus;
  integrationStatus: SuggestionIntegrationStatus;
  applicability: SuggestionApplicability;
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
  commentCount: number;
  comments: SuggestionComment[];
}
export type CreateSuggestionRequest = Omit<RouteSuggestion, "publicId" | "moderationStatus" | "integrationStatus" | "applicability" | "baseRouteUpdatedAt" | "createdAt" | "updatedAt" | "commentCount" | "comments">;
