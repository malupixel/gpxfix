"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { getRouteVersion } from "@/features/routes/api";
import { COLORS, EMPTY_GHOST_STATE, ghostReducer, versionGhost, type GhostAction, type GhostRoute } from "./model";

function useGhostStore() {
  const [state, setState] = useState(EMPTY_GHOST_STATE);
  const stateRef = useRef(state);
  const [focus, setFocus] = useState<{ routes: GhostRoute[]; sequence: number } | null>(null);
  const comparisonRequest = useRef(0);
  const update = useCallback((action: GhostAction) => {
    const next = ghostReducer(stateRef.current, action);
    stateRef.current = next; setState(next);
    if (action.type === "remove" || action.type === "close-comparison") setFocus(null);
  }, []);
  const zoom = useCallback((routes: GhostRoute[]) => setFocus(previous => ({ routes, sequence: (previous?.sequence ?? 0) + 1 })), []);
  const showVersion = useCallback(async (publicId: string, number: number) => {
    const existing = stateRef.current.routes.find(route => route.version?.publicId === publicId && route.version.number === number);
    const ghost = existing ?? versionGhost(await getRouteVersion(publicId, number), COLORS[stateRef.current.routes.length % COLORS.length]);
    update({ type: "add", route: ghost }); zoom([ghost]);
  }, [update, zoom]);
  const compare = useCallback(async (publicId: string, a: number, b: number) => {
    const request = ++comparisonRequest.current;
    if (a === b) throw new Error("ghost.sameVersion");
    const [first, second] = await Promise.all([getRouteVersion(publicId, a), getRouteVersion(publicId, b)]);
    if (request !== comparisonRequest.current) return;
    const routes: [GhostRoute, GhostRoute] = [versionGhost(first, "#9333ea", "A"), versionGhost(second, "#ea580c", "B")];
    update({ type: "compare", routes }); zoom(routes);
  }, [update, zoom]);
  const closeComparison = useCallback(() => { ++comparisonRequest.current; update({ type: "close-comparison" }); }, [update]);
  return { state, update, focus, zoom, showVersion, compare, closeComparison };
}
const GhostContext = createContext<ReturnType<typeof useGhostStore> | null>(null);
export function GhostRoutesProvider({ children }: { children: ReactNode }) { const store = useGhostStore(); return <GhostContext.Provider value={store}>{children}</GhostContext.Provider>; }
export function useGhostRoutes() { const value = useContext(GhostContext); if (!value) throw new Error("GhostRoutesProvider missing"); return value; }
