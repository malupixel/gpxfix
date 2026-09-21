export type RoutePageMode = "view" | "suggest";

export type SuggestionTool = "issue" | "detour" | "note" | null;

export interface SuggestionDraft {
  type: SuggestionTool;
  startPosition?: [number, number];
  endPosition?: [number, number];
  geometry?: { type: "LineString"; coordinates: [number, number][] };
  message?: string;
}

export const EMPTY_SUGGESTION_DRAFT: SuggestionDraft = { type: null };
