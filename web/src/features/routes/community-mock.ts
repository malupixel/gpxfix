export type SuggestionKind = "issue" | "detour" | "note" | "positive";

export type RouteSuggestion = {
  id: string;
  kind: SuggestionKind;
  distance: string;
  detailKey: string;
  message: string;
  author: string;
  date: string;
  likes: number;
  comments: number;
};

// Demo-only community content. Replace this module with API-backed data when
// suggestions are implemented. It is never submitted or merged into the GPX.
export const routeSuggestionsMock: RouteSuggestion[] = [
  { id: "demo-issue-traffic", kind: "issue", distance: "km 42.8", detailKey: "options.highTraffic", message: "Bardzo duży ruch na tej drodze, szczególnie w weekend. Lepiej objechać przez Górki.", author: "Adam", date: "2026-09-16", likes: 7, comments: 2 },
  { id: "demo-detour", kind: "detour", distance: "km 71.2 – 76.4", detailKey: "+1.8 km", message: "Lepszy asfaltowy objazd. Unika odcinka z luźnym piaskiem.", author: "Marek", date: "2026-09-15", likes: 12, comments: 4 },
  { id: "demo-note-water", kind: "note", distance: "km 126.2", detailKey: "options.water", message: "Tu jest źródełko z wodą.", author: "Kasia", date: "2026-09-14", likes: 5, comments: 1 },
  { id: "demo-issue-surface", kind: "issue", distance: "km 158.7", detailKey: "options.unpaved", message: "Około 2 km szutru. Na szosie może być ciężko po deszczu.", author: "Piotr", date: "2026-09-14", likes: 3, comments: 2 },
  { id: "demo-positive", kind: "positive", distance: "km 23.4", detailKey: "options.view", message: "Super widok na Kampinos. Warto się zatrzymać!", author: "Ewa", date: "2026-09-13", likes: 8, comments: 1 },
];

export const recentActivityMock = [
  { id: "demo-activity-1", kind: "detour" as const, name: "Marek", distance: "km 71.2 – 76.4", ageKey: "activity.hoursAgo" },
  { id: "demo-activity-2", kind: "note" as const, name: "Kasia", distance: "km 126.2", ageKey: "activity.dayAgo" },
  { id: "demo-activity-3", kind: "issue" as const, name: "Adam", distance: "km 42.8", ageKey: "activity.dayAgo" },
  { id: "demo-activity-4", kind: "positive" as const, name: "Ewa", distance: "km 23.4", ageKey: "activity.daysAgo" },
];
