import { apiClient } from "@/lib/api-client";
import type { CreateRouteResponse, RouteData } from "@/types/route";
import type { CreateSuggestionRequest, ModerationStatus, RouteSuggestion, SuggestionComment } from "@/types/route";
export function uploadRoute(form: FormData): Promise<CreateRouteResponse> { return apiClient("/api/routes", { method: "POST", body: form }); }
export function getRoute(publicId: string): Promise<RouteData> { return apiClient(`/api/routes/${encodeURIComponent(publicId)}`, { cache: "no-store" }); }
export function establishRouteOwnership(publicId: string, token: string): Promise<void> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/ownership`, { method: "POST", body: JSON.stringify({ token }) });
}
export async function getRouteOwnerStatus(publicId: string): Promise<boolean> {
  try { await apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner`, { cache: "no-store" }); return true; }
  catch { return false; }
}
export function getOwnerAccessToken(publicId: string): Promise<{ token: string }> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner/access-token`, { cache: "no-store" });
}
export function getRouteSuggestions(publicId: string): Promise<RouteSuggestion[]> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions`, { cache: "no-store" });
}
export function createRouteSuggestion(publicId: string, suggestion: CreateSuggestionRequest): Promise<RouteSuggestion> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions`, { method: "POST", body: JSON.stringify(suggestion) });
}
export function getOwnerRouteSuggestions(publicId:string):Promise<RouteSuggestion[]>{return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions/owner`,{cache:"no-store"});}
export function moderateSuggestion(routeId:string,suggestionId:string,moderationStatus:ModerationStatus):Promise<RouteSuggestion>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/owner/${encodeURIComponent(suggestionId)}/moderation`,{method:"PATCH",body:JSON.stringify({moderationStatus})});}
export function addSuggestionComment(routeId:string,suggestionId:string,request:{authorName:string;content:string}):Promise<SuggestionComment>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/${encodeURIComponent(suggestionId)}/comments`,{method:"POST",body:JSON.stringify(request)});}
export function moderateSuggestionComment(routeId:string,commentId:string,moderationStatus:ModerationStatus):Promise<SuggestionComment>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/owner/comments/${encodeURIComponent(commentId)}/moderation`,{method:"PATCH",body:JSON.stringify({moderationStatus})});}
