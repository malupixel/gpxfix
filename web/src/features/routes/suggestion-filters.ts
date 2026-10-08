import type { RouteSuggestion, SuggestionType } from "@/types/route";

export type SuggestionStatusFilter = "ALL" | "PENDING" | "PUBLISHED" | "MERGED" | "REJECTED";
export function filterSuggestions(items: RouteSuggestion[], owner: boolean, status: SuggestionStatusFilter, type: SuggestionType | null) {
  return items.filter(item => {
    // Defense in depth. The public API already excludes private subjects.
    if (!owner && item.moderationStatus !== "PUBLISHED") return false;
    if (type && item.type !== type) return false;
    if (status === "ALL") return true;
    if (status === "MERGED") return item.integrationStatus === "MERGED";
    if (status === "PUBLISHED") return item.moderationStatus === "PUBLISHED" && item.integrationStatus !== "MERGED";
    return item.moderationStatus === status;
  });
}
