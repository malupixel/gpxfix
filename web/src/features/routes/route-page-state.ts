import type { RouteCoordinate, RoutePosition } from "./route-geometry";

export type RoutePageMode = "view" | "suggest";
export type SuggestionTool = "issue" | "detour" | "note" | null;
export type SuggestionReviewState = "edit" | "review";

type DraftBase = { message: string; authorName: string; step: SuggestionReviewState };

export type SuggestionDraft =
  | { type: null }
  | (DraftBase & { type: "note"; position: RoutePosition | null; category: string })
  | (DraftBase & { type: "issue"; start: RoutePosition | null; end: RoutePosition | null; category: string })
  | (DraftBase & { type: "detour"; start: RoutePosition | null; end: RoutePosition | null; waypoints: RouteCoordinate[]; tags: string[] });

export function createSuggestionDraft(type: SuggestionTool): SuggestionDraft {
  const common = { message: "", authorName: "", step: "edit" as const };
  if (type === "note") return { ...common, type, position: null, category: "" };
  if (type === "issue") return { ...common, type, start: null, end: null, category: "" };
  if (type === "detour") return { ...common, type, start: null, end: null, waypoints: [], tags: [] };
  return { type: null };
}

export const EMPTY_SUGGESTION_DRAFT: SuggestionDraft = { type: null };
