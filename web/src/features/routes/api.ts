import { apiClient } from "@/lib/api-client";
import type { CreateRouteResponse, RouteData, RouteVersionSummary } from "@/types/route";
import type { RouteEditorDocument } from "@/features/route-editor/model";
import type { CreateSuggestionRequest, ModerationStatus, RouteSuggestion, SuggestionComment } from "@/types/route";
export function uploadRoute(form: FormData): Promise<CreateRouteResponse> { return apiClient("/api/routes", { method: "POST", body: form }); }
export function createDrawnRoute(request:{name:string;description:string|null;editorDocument:RouteEditorDocument}):Promise<CreateRouteResponse>{return apiClient("/api/routes/drawn",{method:"POST",body:JSON.stringify(request)});}
export function getRoute(publicId: string): Promise<RouteData> { return apiClient(`/api/routes/${encodeURIComponent(publicId)}`, { cache: "no-store" }); }
export function getRouteVersion(publicId:string,version:number):Promise<RouteData>{return apiClient(`/api/routes/${encodeURIComponent(publicId)}/versions/${version}`,{cache:"no-store"});}
export function getRouteVersions(publicId:string):Promise<RouteVersionSummary[]>{return apiClient(`/api/routes/${encodeURIComponent(publicId)}/versions`,{cache:"no-store"});}
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
export function getRouteSuggestions(publicId: string, versionNumber?: number): Promise<RouteSuggestion[]> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions${versionNumber ? `?versionNumber=${versionNumber}` : ""}`, { cache: "no-store" });
}
export type OwnerEditorData = { route: RouteData; editorDocument: RouteEditorDocument | null };
export function getOwnerEditor(publicId: string): Promise<OwnerEditorData> { return apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner/editor`, { cache: "no-store" }); }
export function saveOwnerRoute(publicId: string, request: { baseVersionNumber: number; expectedUpdatedAt?: string; name: string; description: string | null; editorDocument: RouteEditorDocument }): Promise<RouteData> { return apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner/versions`, { method: "POST", body: JSON.stringify(request) }); }
export function createRouteSuggestion(publicId: string, suggestion: CreateSuggestionRequest,requestKey?:string): Promise<RouteSuggestion> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions`, { method: "POST", body: JSON.stringify(suggestion),headers:requestKey?{"Idempotency-Key":requestKey}:undefined });
}
export function getOwnerRouteSuggestions(publicId:string):Promise<RouteSuggestion[]>{return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions/owner`,{cache:"no-store"});}
export function moderateSuggestion(routeId:string,suggestionId:string,moderationStatus:ModerationStatus):Promise<RouteSuggestion>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/owner/${encodeURIComponent(suggestionId)}/moderation`,{method:"PATCH",body:JSON.stringify({moderationStatus})});}
export function addSuggestionComment(routeId:string,suggestionId:string,request:{authorName:string;content:string},requestKey?:string):Promise<SuggestionComment>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/${encodeURIComponent(suggestionId)}/comments`,{method:"POST",body:JSON.stringify(request),headers:requestKey?{"Idempotency-Key":requestKey}:undefined});}
export function moderateSuggestionComment(routeId:string,commentId:string,moderationStatus:ModerationStatus):Promise<SuggestionComment>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/owner/comments/${encodeURIComponent(commentId)}/moderation`,{method:"PATCH",body:JSON.stringify({moderationStatus})});}
export function mergeSuggestion(routeId:string,suggestionId:string):Promise<RouteData>{return apiClient(`/api/routes/${encodeURIComponent(routeId)}/suggestions/owner/${encodeURIComponent(suggestionId)}/merge`,{method:"POST"});}

export type RouteActivity = { id: string; type: string; occurredAt: string; versionNumber: number | null; suggestionPublicId: string | null; commentPublicId: string | null; actorKind: string; actorName: string | null; metadata: Record<string,string> };
export type RouteActivityPage = { items: RouteActivity[]; nextCursor: string | null };
export function getRouteActivity(publicId: string, owner: boolean, limit = 5, cursor?: string | null): Promise<RouteActivityPage> {
  const query = new URLSearchParams({ limit: String(limit) }); if (cursor) query.set("cursor", cursor);
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/${owner ? "owner/" : ""}activity?${query}`, { cache: "no-store" });
}
export function updateRouteInformation(publicId: string, body: { name: string; description: string | null; expectedUpdatedAt: string }): Promise<RouteData> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner/information`, { method: "PATCH", body: JSON.stringify(body) });
}
export function updateSuggestionsSettings(publicId: string, enabled: boolean): Promise<RouteData> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner/suggestions-settings`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}
export function deleteRoute(publicId: string, confirmationName: string): Promise<void> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/owner`, { method: "DELETE", body: JSON.stringify({ confirmationName }) });
}
export function getPublicSuggestion(publicId: string, suggestionId: string): Promise<RouteSuggestion> {
  return apiClient(`/api/routes/${encodeURIComponent(publicId)}/suggestions/${encodeURIComponent(suggestionId)}`, { cache: "no-store" });
}
