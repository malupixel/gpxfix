export type SuggestionKind = "issue" | "detour" | "note" | "positive";

export type RouteSuggestion = {
  id: string;
  kind: SuggestionKind;
  distance: string;
  label: string;
  detail: string;
  message: string;
  author: string;
  date: string;
  likes: number;
  comments: number;
};

// Demo-only community content. Replace this module with API-backed data when
// suggestions are implemented. It is never submitted or merged into the GPX.
export const routeSuggestionsMock: RouteSuggestion[] = [
  { id: "demo-issue-traffic", kind: "issue", distance: "km 42.8", label: "Issue", detail: "High traffic", message: "Bardzo duży ruch na tej drodze, szczególnie w weekend. Lepiej objechać przez Górki.", author: "Adam", date: "Sep 16, 2026", likes: 7, comments: 2 },
  { id: "demo-detour", kind: "detour", distance: "km 71.2 – 76.4", label: "Detour", detail: "+1.8 km", message: "Lepszy asfaltowy objazd. Unika odcinka z luźnym piaskiem.", author: "Marek", date: "Sep 15, 2026", likes: 12, comments: 4 },
  { id: "demo-note-water", kind: "note", distance: "km 126.2", label: "Note", detail: "Water", message: "Tu jest źródełko z wodą.", author: "Kasia", date: "Sep 14, 2026", likes: 5, comments: 1 },
  { id: "demo-issue-surface", kind: "issue", distance: "km 158.7", label: "Issue", detail: "Unpaved", message: "Około 2 km szutru. Na szosie może być ciężko po deszczu.", author: "Piotr", date: "Sep 14, 2026", likes: 3, comments: 2 },
  { id: "demo-positive", kind: "positive", distance: "km 23.4", label: "Positive", detail: "Nice view", message: "Super widok na Kampinos. Warto się zatrzymać!", author: "Ewa", date: "Sep 13, 2026", likes: 8, comments: 1 },
];

export const recentActivityMock = [
  { id: "demo-activity-1", kind: "detour" as const, text: "Marek suggested a detour", distance: "km 71.2 – 76.4", age: "2 hours ago" },
  { id: "demo-activity-2", kind: "note" as const, text: "Kasia added a note", distance: "km 126.2", age: "1 day ago" },
  { id: "demo-activity-3", kind: "issue" as const, text: "Adam reported an issue", distance: "km 42.8", age: "1 day ago" },
  { id: "demo-activity-4", kind: "positive" as const, text: "Ewa added a positive note", distance: "km 23.4", age: "2 days ago" },
];
