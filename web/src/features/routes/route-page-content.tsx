"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { RouteMap } from "@/components/map/route-map";
import type { RouteData, RouteSuggestion } from "@/types/route";
import { ElevationProfile } from "./elevation-profile";
import { createRouteSuggestion, getOwnerRouteSuggestions, getRouteSuggestions } from "./api";
import { normalizeRoutePositions, type RouteCoordinate, type RoutePosition } from "./route-geometry";
import { RouteFeedbackSidebar, ShareRouteCard } from "./route-feedback";
import { RouteInformation } from "./route-information";
import { CommunityMarkerLegend, RouteMapToolbar } from "./route-map-toolbar";
import {
  createSuggestionGeometry,
  EMPTY_SUGGESTION_FORM,
  EMPTY_SUGGESTION_GEOMETRY,
  hasSuggestionWork,
  type RoutePageMode,
  type SuggestionFormData,
  type SuggestionGeometry,
  type SuggestionProcessStep,
  type SuggestionTool,
} from "./route-page-state";
import { DrawingControls, SuggestionDetailsDialog, SuggestionTypePicker, suggestionRequest } from "./suggestion-workspace";

export function RoutePageContent({ route, isOwner }: { route: RouteData; isOwner: boolean }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RoutePageMode>("view");
  const [geometry, setGeometry] = useState<SuggestionGeometry>(EMPTY_SUGGESTION_GEOMETRY);
  const [form, setForm] = useState<SuggestionFormData>(EMPTY_SUGGESTION_FORM);
  const [processStep, setProcessStep] = useState<SuggestionProcessStep>("chooseType");
  const [submitError, setSubmitError] = useState(false);
  const [profileHighlight, setProfileHighlight] = useState<RouteCoordinate | null>(null);
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);

  useEffect(() => { let active = true; (isOwner ? getOwnerRouteSuggestions(route.publicId) : getRouteSuggestions(route.publicId)).then((items) => { if (active) setSuggestions(items); }).catch(() => { if (active) setSuggestions([]); }).finally(() => { if (active) setSuggestionsLoading(false); }); return () => { active = false; }; }, [route.publicId, isOwner]);

  const clearSuggestion = useCallback(() => {
    setGeometry(EMPTY_SUGGESTION_GEOMETRY);
    setForm(EMPTY_SUGGESTION_FORM);
    setProcessStep("chooseType");
    setSubmitError(false);
  }, []);

  const finishSuggestion = useCallback(() => {
    clearSuggestion();
    setMode("view");
  }, [clearSuggestion]);

  const cancelSuggestion = useCallback(() => {
    if (hasSuggestionWork(geometry, form) && !window.confirm(t("suggestion.discardConfirm"))) return;
    finishSuggestion();
  }, [finishSuggestion, form, geometry, t]);

  function enterSuggestMode(tool: SuggestionTool = null) {
    setMode("suggest");
    setSelectedSuggestionId(null);
    setSubmitError(false);
    setGeometry(createSuggestionGeometry(tool));
    setForm(EMPTY_SUGGESTION_FORM);
    setProcessStep(tool ? "drawing" : "chooseType");
  }

  function selectTool(tool: Exclude<SuggestionTool, null>) {
    setGeometry(createSuggestionGeometry(tool));
    setProcessStep("drawing");
  }

  async function submitSuggestion() {
    if (geometry.type === null || processStep === "submitting") return;
    setSubmitError(false);
    setProcessStep("submitting");
    try {
      await createRouteSuggestion(route.publicId, suggestionRequest(geometry, form));
      setProcessStep("success");
    } catch {
      setSubmitError(true);
      setProcessStep("describe");
    }
  }

  function handleRouteClick(position: RoutePosition) {
    if (processStep !== "drawing") return;
    if (geometry.type === "note" && !geometry.position) {
      setGeometry({ ...geometry, position });
      setProcessStep("describe");
      return;
    }
    if (geometry.type === "issue") {
      if (!geometry.start) setGeometry({ ...geometry, start: position });
      else if (!geometry.end) {
        const [start, end] = normalizeRoutePositions(geometry.start, position);
        setGeometry({ ...geometry, start, end });
        setProcessStep("describe");
      }
      return;
    }
    if (geometry.type === "detour") {
      if (!geometry.start) setGeometry({ ...geometry, start: position });
      else if (!geometry.end && Math.abs(position.distanceMeters - geometry.start.distanceMeters) >= 100) {
        const [start, end] = normalizeRoutePositions(geometry.start, position);
        const waypoints = start === geometry.start ? geometry.waypoints : [...geometry.waypoints].reverse();
        setGeometry({ ...geometry, start, end, waypoints });
        setProcessStep("describe");
      }
    }
  }

  function handleMapClick(coordinate: RouteCoordinate) {
    if (processStep !== "drawing") return;
    setGeometry((current) => current.type === "detour" && current.start && !current.end
      ? { ...current, waypoints: [...current.waypoints, coordinate] }
      : current);
  }

  function undo() {
    setGeometry((current) => {
      if (current.type !== "detour") return current;
      if (current.end) return { ...current, end: null };
      if (current.waypoints.length) return { ...current, waypoints: current.waypoints.slice(0, -1) };
      if (current.start) return { ...current, start: null };
      return current;
    });
    setProcessStep("drawing");
  }

  function redraw() {
    setGeometry((current) => createSuggestionGeometry(current.type));
    setProcessStep("drawing");
  }

  let workflowOverlay = null;
  if (mode === "suggest" && processStep === "chooseType") workflowOverlay = <SuggestionTypePicker onSelect={selectTool} onCancel={cancelSuggestion} />;
  if (mode === "suggest" && processStep === "drawing" && geometry.type !== null) workflowOverlay = <DrawingControls geometry={geometry} onUndo={undo} onRedraw={redraw} onCancel={cancelSuggestion} onContinue={() => setProcessStep("describe")} />;
  if (mode === "suggest" && geometry.type !== null && (processStep === "describe" || processStep === "submitting" || processStep === "success")) workflowOverlay = <>
    <SuggestionDetailsDialog geometry={geometry} form={form} setForm={setForm} step={processStep} onBack={() => setProcessStep("drawing")} onClose={() => setProcessStep("drawing")} onSubmit={submitSuggestion} onDone={finishSuggestion} />
    {submitError && <div role="alert" className="fixed inset-x-4 top-4 z-[10030] mx-auto max-w-md rounded-lg bg-red-700 p-3 text-center text-sm font-bold text-white shadow-xl">{t("persistence.saveFailed")}</div>}
  </>;

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="min-w-0 space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <RouteMapToolbar mode={mode} selectedTool={geometry.type} onView={mode === "suggest" ? cancelSuggestion : () => setMode("view")} onSuggest={enterSuggestMode} />
        <RouteMap geometry={route.geometry} elevationProfile={route.elevationProfile} mode={mode} draft={geometry} drawingActive={processStep === "drawing"} suggestions={suggestions} selectedSuggestionId={selectedSuggestionId} onSuggestionSelect={setSelectedSuggestionId} highlightedCoordinate={profileHighlight} onElevationHighlight={setProfileHighlight} onRouteClick={handleRouteClick} onMapClick={handleMapClick} workflowOverlay={workflowOverlay} />
        <CommunityMarkerLegend />
      </section>
      {mode === "view" && <><ElevationProfile samples={route.elevationProfile} onHighlight={setProfileHighlight} /><RouteInformation route={route} /></>}
    </div>
    <div className="space-y-4 xl:sticky xl:top-4">
      {mode === "view" ? <><ShareRouteCard /><RouteFeedbackSidebar routeId={route.publicId} isOwner={isOwner} suggestions={suggestions} onSuggestionsChange={setSuggestions} loading={suggestionsLoading} selectedId={selectedSuggestionId} onSelect={(item) => setSelectedSuggestionId(item.publicId)} onAddSuggestion={() => enterSuggestMode()} /></> : <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">{t("suggestion.create")}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{geometry.type ? t("suggestion.mapGuidance") : t("suggestion.chooseTypeHelp")}</p><button type="button" onClick={cancelSuggestion} className="mt-4 text-sm font-bold text-red-700">{t("suggestion.cancel")}</button></aside>}
    </div>
  </div>;
}
