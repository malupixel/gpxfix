import type { FeatureCollection, MultiLineString } from "geojson";
import type { RouteData } from "../../types/route";

export const MAX_GHOSTS = 12;
export const MAX_POINTS = 100_000;
export const MAX_TOTAL_POINTS = 300_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const COLORS = ["#9333ea", "#e11d48", "#d97706", "#0891b2", "#4d7c0f", "#c026d3", "#ea580c", "#0f766e", "#92400e", "#475569", "#db2777", "#15803d"];
export interface GhostRoute {
  id: string;
  name: string;
  source: "gpx" | "version";
  geometry: MultiLineString;
  color: string;
  visible: boolean;
  version?: { publicId: string; number: number };
  role?: "A" | "B";
}
export interface GhostState { routes: GhostRoute[]; comparison: [GhostRoute, GhostRoute] | null }
export const EMPTY_GHOST_STATE: GhostState = { routes: [], comparison: null };
export type GhostAction = { type: "add"; route: GhostRoute } | { type: "toggle" | "remove"; id: string } | { type: "compare"; routes: [GhostRoute, GhostRoute] } | { type: "close-comparison" };
export function pointCount(route: GhostRoute) { return route.geometry.coordinates.reduce((sum, segment) => sum + segment.length, 0); }
function validateBudget(routes: GhostRoute[]) {
  if (routes.length > MAX_GHOSTS || routes.reduce((sum, route) => sum + pointCount(route), 0) > MAX_TOTAL_POINTS) throw new Error("ghost.limit");
}
export function ghostReducer(state: GhostState, action: GhostAction): GhostState {
  switch (action.type) {
    case "add": {
      const existing = state.routes.find(route => route.id === action.route.id);
      if (existing) return { ...state, routes: state.routes.map(route => route === existing ? { ...route, visible: true } : route) };
      const usedColors = new Set(state.routes.map(route => route.color));
      const color = usedColors.has(action.route.color) ? COLORS.find(candidate => !usedColors.has(candidate)) ?? action.route.color : action.route.color;
      const routes = [...state.routes, { ...action.route, color }];
      validateBudget([...routes, ...(state.comparison ?? [])]);
      return { ...state, routes };
    }
    case "toggle": return { routes: state.routes.map(route => route.id === action.id ? { ...route, visible: !route.visible } : route), comparison: state.comparison?.map(route => route.id === action.id ? { ...route, visible: !route.visible } : route) as GhostState["comparison"] ?? null };
    case "remove": return { routes: state.routes.filter(route => route.id !== action.id), comparison: state.comparison?.some(route => route.id === action.id) ? null : state.comparison };
    case "compare": validateBudget([...state.routes, ...action.routes]); return { ...state, comparison: action.routes };
    case "close-comparison": return { ...state, comparison: null };
  }
}
export function versionGhost(route: RouteData, color: string, role?: "A" | "B"): GhostRoute {
  return { id: `${role ? `compare-${role}:` : "version:"}${route.publicId}:${route.viewedVersion}`, name: `v${route.viewedVersion}`, source: "version", version: { publicId: route.publicId, number: route.viewedVersion }, geometry: { type: "MultiLineString", coordinates: [route.geometry.coordinates] }, color, visible: true, role };
}
export function ghostFeatures(state: GhostState): FeatureCollection<MultiLineString> {
  return { type: "FeatureCollection", features: [...state.routes, ...(state.comparison ?? [])].filter(route => route.visible).map(route => ({ type: "Feature", id: route.id, properties: { color: route.color, primary: route.role === "A" }, geometry: route.geometry })) };
}
