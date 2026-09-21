"use client";

import { useState } from "react";

import { RouteMap } from "@/components/map/route-map";
import type { RouteData } from "@/types/route";
import { ElevationProfile } from "./elevation-profile";
import { RouteFeedbackSidebar, ShareRouteCard } from "./route-feedback";
import { RouteInformation } from "./route-information";
import { CommunityMarkerLegend, RouteMapToolbar } from "./route-map-toolbar";
import { EMPTY_SUGGESTION_DRAFT, type RoutePageMode, type SuggestionDraft, type SuggestionTool } from "./route-page-state";
import { SuggestionWorkspace } from "./suggestion-workspace";

export function RoutePageContent({ route }: { route: RouteData }) {
  const [mode, setMode] = useState<RoutePageMode>("view");
  const [draft, setDraft] = useState<SuggestionDraft>(EMPTY_SUGGESTION_DRAFT);

  function enterViewMode() {
    setMode("view");
    setDraft(EMPTY_SUGGESTION_DRAFT);
  }

  function enterSuggestMode(tool: SuggestionTool = null) {
    setMode("suggest");
    setDraft({ type: tool });
  }

  function selectTool(tool: Exclude<SuggestionTool, null>) {
    // Starting a different tool intentionally clears its temporary map selection.
    setDraft({ type: tool });
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <RouteMapToolbar mode={mode} selectedTool={draft.type} onView={enterViewMode} onSuggest={enterSuggestMode} onSelectTool={selectTool} />
          <RouteMap geometry={route.geometry} />
          <CommunityMarkerLegend />
        </section>
        {mode === "view" && (
          <>
            <ElevationProfile elevationGainMeters={route.elevationGainMeters} />
            <RouteInformation route={route} />
          </>
        )}
      </div>
      <div className="space-y-4 xl:sticky xl:top-4">
        {mode === "view" ? (
          <><ShareRouteCard /><RouteFeedbackSidebar onAddSuggestion={() => enterSuggestMode()} /></>
        ) : (
          <SuggestionWorkspace selectedTool={draft.type} onSelectTool={selectTool} />
        )}
      </div>
    </div>
  );
}
