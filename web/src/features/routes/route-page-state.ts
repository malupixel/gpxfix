import type { RouteCoordinate, RoutePosition } from "./route-geometry";

export type RoutePageMode = "view" | "suggest";
export type SuggestionTool = "issue" | "detour" | "note" | null;
export type SuggestionProcessStep = "chooseType" | "drawing" | "describe" | "submitting" | "success";

export type SuggestionGeometry =
  | { type: null }
  | { type: "note"; position: RoutePosition | null }
  | { type: "issue"; start: RoutePosition | null; end: RoutePosition | null }
  | { type: "detour"; start: RoutePosition | null; end: RoutePosition | null; waypoints: RouteCoordinate[] };

export type SuggestionFormData = {
  message: string;
  authorName: string;
  category: string;
  tags: string[];
};

export function createSuggestionGeometry(type: SuggestionTool): SuggestionGeometry {
  if (type === "note") return { type, position: null };
  if (type === "issue") return { type, start: null, end: null };
  if (type === "detour") return { type, start: null, end: null, waypoints: [] };
  return { type: null };
}

export const EMPTY_SUGGESTION_GEOMETRY: SuggestionGeometry = { type: null };
export const EMPTY_SUGGESTION_FORM: SuggestionFormData = { message: "", authorName: "", category: "", tags: [] };

export function isSuggestionGeometryComplete(geometry: SuggestionGeometry): boolean {
  if (geometry.type === "note") return geometry.position !== null;
  if (geometry.type === "issue" || geometry.type === "detour") return geometry.start !== null && geometry.end !== null;
  return false;
}

export function hasSuggestionWork(geometry: SuggestionGeometry, form: SuggestionFormData): boolean {
  const hasGeometry = geometry.type === "note"
    ? geometry.position !== null
    : geometry.type === "issue" || geometry.type === "detour"
      ? geometry.start !== null || geometry.end !== null || (geometry.type === "detour" && geometry.waypoints.length > 0)
      : false;
  return hasGeometry || Boolean(form.message.trim() || form.authorName.trim() || form.category || form.tags.length);
}
