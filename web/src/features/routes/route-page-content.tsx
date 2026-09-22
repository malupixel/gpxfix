"use client";

import { useState } from "react";

import { RouteMap } from "@/components/map/route-map";
import type { RouteData } from "@/types/route";
import { ElevationProfile } from "./elevation-profile";
import { RouteFeedbackSidebar, ShareRouteCard } from "./route-feedback";
import { RouteInformation } from "./route-information";
import { CommunityMarkerLegend, RouteMapToolbar } from "./route-map-toolbar";
import { normalizeRoutePositions, type RouteCoordinate, type RoutePosition } from "./route-geometry";
import { createSuggestionDraft, EMPTY_SUGGESTION_DRAFT, type RoutePageMode, type SuggestionDraft, type SuggestionTool } from "./route-page-state";
import { SuggestionWorkspace } from "./suggestion-workspace";

export function RoutePageContent({ route }: { route: RouteData }) {
  const [mode, setMode] = useState<RoutePageMode>("view");
  const [draft, setDraft] = useState<SuggestionDraft>(EMPTY_SUGGESTION_DRAFT);
  const [profileHighlight, setProfileHighlight] = useState<RouteCoordinate | null>(null);

  function enterViewMode() {
    setMode("view");
    setDraft(EMPTY_SUGGESTION_DRAFT);
  }

  function enterSuggestMode(tool: SuggestionTool = null) {
    setMode("suggest");
    setDraft(createSuggestionDraft(tool));
  }

  function selectTool(tool: Exclude<SuggestionTool, null>) {
    // Starting a different tool intentionally clears its temporary map selection.
    setDraft(createSuggestionDraft(tool));
  }

  function handleRouteClick(position: RoutePosition) {
    setDraft((current) => {
      if (current.type === "note") return { ...current, position, step: "edit" };
      if (current.type === "issue") {
        if (!current.start || current.end) return { ...current, start: position, end: null, step: "edit" };
        const [start, end] = normalizeRoutePositions(current.start, position);
        return { ...current, start, end, step: "edit" };
      }
      if (current.type === "detour") {
        if (!current.start || current.end) return { ...current, start: position, end: null, waypoints: [], step: "edit" };
        if (Math.abs(position.distanceMeters - current.start.distanceMeters) < 100) return current;
        const [start, end] = normalizeRoutePositions(current.start, position);
        const waypoints = start === current.start ? current.waypoints : [...current.waypoints].reverse();
        return { ...current, start, end, waypoints, step: "edit" };
      }
      return current;
    });
  }

  function handleMapClick(coordinate: RouteCoordinate) {
    setDraft((current) => current.type === "detour" && current.start && !current.end
      ? { ...current, waypoints: [...current.waypoints, coordinate] }
      : current);
  }

  function resetSelection() {
    setDraft((current) => current.type ? createSuggestionDraft(current.type) : current);
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <RouteMapToolbar mode={mode} selectedTool={draft.type} onView={enterViewMode} onSuggest={enterSuggestMode} onSelectTool={selectTool} />
          <RouteMap geometry={route.geometry} mode={mode} draft={draft} highlightedCoordinate={profileHighlight} onRouteClick={handleRouteClick} onMapClick={handleMapClick} onCancelSelection={resetSelection} />
          <CommunityMarkerLegend />
        </section>
        {mode === "view" && (
          <>
            <ElevationProfile samples={route.elevationProfile} onHighlight={setProfileHighlight} />
            <RouteInformation route={route} />
          </>
        )}
      </div>
      <div className="space-y-4 xl:sticky xl:top-4">
        {mode === "view" ? (
          <><ShareRouteCard /><RouteFeedbackSidebar onAddSuggestion={() => enterSuggestMode()} /></>
        ) : (
          <SuggestionWorkspace draft={draft} onDraftChange={setDraft} onSelectTool={selectTool} />
        )}
      </div>
    </div>
  );
}
