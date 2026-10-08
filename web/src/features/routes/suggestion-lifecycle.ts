import type { RouteSuggestion } from "@/types/route";

export function activeSuggestionsForVersion(suggestions: RouteSuggestion[], version: number) {
  return suggestions.filter(s => s.baseVersionNumber === version && s.moderationStatus === "PUBLISHED" && s.integrationStatus !== "MERGED");
}

export function canModerateSuggestion(suggestion: RouteSuggestion) {
  return suggestion.integrationStatus !== "MERGED" && (suggestion.moderationStatus === "PENDING" || suggestion.moderationStatus === "PUBLISHED");
}
