"use client";

import type * as GeoJSON from "geojson";
import {
  Map as MapLibreMap,
  Marker,
  type ErrorEvent as MapLibreErrorEvent,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  areRouteEndpointsClose,
  calculateDistanceMarkers,
  createRouteMeasure,
  extractRouteSection,
  findNearestPositionOnRoute,
  type RouteCoordinate,
  type RoutePosition,
} from "@/features/routes/route-geometry";
import type { RoutePageMode, SuggestionDraft } from "@/features/routes/route-page-state";
import type { RouteData } from "@/types/route";

const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-line";
const ROUTE_INTERACTION_LAYER_ID = "route-interaction";
const SELECTION_SOURCE_ID = "suggestion-selected-section-source";
const SELECTION_LAYER_ID = "suggestion-selected-section";
const DETOUR_SOURCE_ID = "suggestion-detour-source";
const DETOUR_LAYER_ID = "suggestion-detour";
const DETOUR_PREVIEW_SOURCE_ID = "suggestion-detour-preview-source";
const DETOUR_PREVIEW_LAYER_ID = "suggestion-detour-preview";
const HANDLES_SOURCE_ID = "suggestion-handles-source";
const HANDLES_LAYER_ID = "suggestion-handles";
const DEFAULT_DISTANCE_INTERVAL_METERS = 10_000;

type RouteMapProps = {
  geometry: RouteData["geometry"];
  mode: RoutePageMode;
  draft: SuggestionDraft;
  onRouteClick: (position: RoutePosition) => void;
  onMapClick: (coordinate: RouteCoordinate) => void;
  onCancelSelection: () => void;
};

export function RouteMap({ geometry, mode, draft, onRouteClick, onMapClick, onCancelSelection }: RouteMapProps) {
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackFullscreenRef = useRef(false);
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);
  const [distanceInterval, setDistanceInterval] = useState(DEFAULT_DISTANCE_INTERVAL_METERS);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t, i18n } = useTranslation();
  const labelsRef = useRef({ start: t("route.start"), finish: t("route.finish") });
  const distanceOptions = [{ label: t("route.off"), value: 0 }, { label: "5 km", value: 5_000 }, { label: "10 km", value: 10_000 }, { label: "20 km", value: 20_000 }];
  const routeMeasure = useMemo(() => createRouteMeasure(geometry.coordinates), [geometry.coordinates]);

  useEffect(() => { labelsRef.current = { start: t("route.start"), finish: t("route.finish") }; }, [i18n.language, t]);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenContainer = fullscreenContainerRef.current;
    if (!fullscreenContainer) return;

    if (document.fullscreenElement === fullscreenContainer) {
      await document.exitFullscreen();
      return;
    }

    if (fallbackFullscreenRef.current) {
      fallbackFullscreenRef.current = false;
      setIsFullscreen(false);
      return;
    }

    try {
      await fullscreenContainer.requestFullscreen();
    } catch {
      // Some embedded mobile browsers deny or do not expose the Fullscreen API.
      fallbackFullscreenRef.current = true;
      setIsFullscreen(true);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || geometry.coordinates.length < 2) {
      return;
    }

    const coordinates = geometry.coordinates;
    const endpointMarkers: Marker[] = [];
    const map = new MapLibreMap({
      container,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE_URL,
      center: coordinates[0],
      zoom: 10,
    });

    const handleError = (event: MapLibreErrorEvent) => {
      console.error("MapLibre error:", event.error);
    };

    map.on("error", handleError);
    map.once("load", () => {
      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry,
          },
        });
      }

      if (!map.getLayer(ROUTE_LAYER_ID)) {
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-opacity": 1,
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 5, 18, 8],
          },
        });
      }

      map.addLayer({ id: ROUTE_INTERACTION_LAYER_ID, type: "line", source: ROUTE_SOURCE_ID, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 24, "line-opacity": 0 } });
      addGeoJsonSource(map, SELECTION_SOURCE_ID);
      map.addLayer({ id: SELECTION_LAYER_ID, type: "line", source: SELECTION_SOURCE_ID, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#dc2626", "line-opacity": 0.78, "line-width": 9 } });
      addGeoJsonSource(map, DETOUR_SOURCE_ID);
      map.addLayer({ id: DETOUR_LAYER_ID, type: "line", source: DETOUR_SOURCE_ID, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#059669", "line-width": 6, "line-dasharray": [1, 1.2] } });
      addGeoJsonSource(map, DETOUR_PREVIEW_SOURCE_ID);
      map.addLayer({ id: DETOUR_PREVIEW_LAYER_ID, type: "line", source: DETOUR_PREVIEW_SOURCE_ID, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#10b981", "line-opacity": 0.75, "line-width": 4, "line-dasharray": [1, 1.5] } });
      addGeoJsonSource(map, HANDLES_SOURCE_ID);
      map.addLayer({ id: HANDLES_LAYER_ID, type: "circle", source: HANDLES_SOURCE_ID, paint: { "circle-radius": 7, "circle-color": ["match", ["get", "kind"], "note", "#2563eb", "waypoint", "#ffffff", "#059669"], "circle-stroke-color": ["match", ["get", "kind"], "note", "#ffffff", "#047857"], "circle-stroke-width": 3 } });

      // Layers appended without `beforeId` render above every existing style layer.
      map.moveLayer(ROUTE_LAYER_ID);
      endpointMarkers.push(...addEndpointMarkers(map, coordinates, labelsRef.current));
      map.resize();
      map.fitBounds(getRouteBounds(coordinates), {
        padding: 50,
        maxZoom: 16,
        duration: 0,
      });
      setLoadedMap(map);
    });

    return () => {
      setLoadedMap(null);
      endpointMarkers.forEach((marker) => marker.remove());
      map.off("error", handleError);
      map.remove();
    };
  }, [geometry]);

  useEffect(() => {
    if (!loadedMap) return;
    const empty = emptyFeatureCollection();
    let selected: GeoJSON.FeatureCollection = empty;
    let detour: GeoJSON.FeatureCollection = empty;
    const handles: GeoJSON.Feature[] = [];

    if (mode === "suggest" && draft.type === "note" && draft.position) handles.push(pointFeature([draft.position.lng, draft.position.lat], "note"));
    if (mode === "suggest" && (draft.type === "issue" || draft.type === "detour")) {
      if (draft.start) handles.push(pointFeature([draft.start.lng, draft.start.lat], "anchor"));
      if (draft.end) handles.push(pointFeature([draft.end.lng, draft.end.lat], "anchor"));
      if (draft.start && draft.end) selected = featureCollection([lineFeature(extractRouteSection(routeMeasure, draft.start, draft.end).coordinates)]);
      if (draft.type === "detour") {
        handles.push(...draft.waypoints.map((point) => pointFeature(point, "waypoint")));
        const points = detourCoordinates(draft);
        if (points.length >= 2) detour = featureCollection([lineFeature(points)]);
      }
    }
    setSourceData(loadedMap, SELECTION_SOURCE_ID, selected);
    setSourceData(loadedMap, DETOUR_SOURCE_ID, detour);
    setSourceData(loadedMap, DETOUR_PREVIEW_SOURCE_ID, empty);
    setSourceData(loadedMap, HANDLES_SOURCE_ID, featureCollection(handles));
    loadedMap.setPaintProperty(SELECTION_LAYER_ID, "line-color", draft.type === "detour" ? "#f59e0b" : "#dc2626");
    loadedMap.setPaintProperty(SELECTION_LAYER_ID, "line-opacity", draft.type === "detour" ? 0.55 : 0.78);
  }, [draft, loadedMap, mode, routeMeasure]);

  useEffect(() => {
    if (!loadedMap) return;
    const canvas = loadedMap.getCanvas();
    const suggestionActive = mode === "suggest" && draft.type !== null && draft.step === "edit";
    const onClick = (event: MapMouseEvent) => {
      if (!suggestionActive) return;
      const coordinate: RouteCoordinate = [event.lngLat.lng, event.lngLat.lat];
      const hitsRoute = loadedMap.queryRenderedFeatures(event.point, { layers: [ROUTE_INTERACTION_LAYER_ID] }).length > 0;
      if (hitsRoute) {
        const position = findNearestPositionOnRoute(coordinate, routeMeasure);
        if (position) onRouteClick(position);
      } else if (draft.type === "detour" && draft.start && !draft.end) onMapClick(coordinate);
    };
    const onMouseMove = (event: MapMouseEvent) => {
      if (draft.type !== "detour" || !draft.start || draft.end || draft.step !== "edit") return;
      const preview = [...detourCoordinates(draft), [event.lngLat.lng, event.lngLat.lat] as RouteCoordinate];
      setSourceData(loadedMap, DETOUR_PREVIEW_SOURCE_ID, preview.length >= 2 ? featureCollection([lineFeature(preview)]) : emptyFeatureCollection());
    };
    const onRouteEnter = () => { if (suggestionActive) canvas.style.cursor = draft.type === "detour" && draft.start ? "crosshair" : "pointer"; };
    const onRouteLeave = () => { canvas.style.cursor = draft.type === "detour" && draft.start && !draft.end ? "crosshair" : ""; };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && suggestionActive) onCancelSelection(); };
    if (draft.type === "detour" && draft.start && !draft.end) canvas.style.cursor = "crosshair";
    loadedMap.on("click", onClick);
    loadedMap.on("mousemove", onMouseMove);
    loadedMap.on("mouseenter", ROUTE_INTERACTION_LAYER_ID, onRouteEnter);
    loadedMap.on("mouseleave", ROUTE_INTERACTION_LAYER_ID, onRouteLeave);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      loadedMap.off("click", onClick);
      loadedMap.off("mousemove", onMouseMove);
      loadedMap.off("mouseenter", ROUTE_INTERACTION_LAYER_ID, onRouteEnter);
      loadedMap.off("mouseleave", ROUTE_INTERACTION_LAYER_ID, onRouteLeave);
      document.removeEventListener("keydown", onKeyDown);
      canvas.style.cursor = "";
    };
  }, [draft, loadedMap, mode, onCancelSelection, onMapClick, onRouteClick, routeMeasure]);

  useEffect(() => {
    if (!loadedMap || distanceInterval === 0) return;

    const markers = calculateDistanceMarkers(geometry.coordinates, distanceInterval).map(
      ({ coordinate, distanceMeters }) =>
        new Marker({ element: createDistanceMarkerElement(distanceMeters, t("route.markerAria", { distance: distanceMeters / 1_000 })), anchor: "center" })
          .setLngLat(coordinate)
          .addTo(loadedMap),
    );

    return () => markers.forEach((marker) => marker.remove());
  }, [distanceInterval, geometry.coordinates, loadedMap, i18n.language, t]);

  useEffect(() => {
    const root = fullscreenContainerRef.current;
    const labels = labelsRef.current;
    for (const kind of ["start", "finish"] as const) {
      const element = root?.querySelector<HTMLElement>(`[data-route-endpoint="${kind}"]`);
      if (element) { element.textContent = endpointGlyph(labels[kind]); element.title = labels[kind]; element.setAttribute("aria-label", labels[kind]); }
    }
  }, [i18n.language]);

  useEffect(() => {
    const fullscreenContainer = fullscreenContainerRef.current;
    if (!fullscreenContainer) return;

    const handleFullscreenChange = () => {
      fallbackFullscreenRef.current = false;
      setIsFullscreen(document.fullscreenElement === fullscreenContainer);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fallbackFullscreenRef.current) {
        fallbackFullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const fullscreenContainer = fullscreenContainerRef.current;
    if (!loadedMap || !fullscreenContainer) return;

    let animationFrame = 0;
    const resizeMap = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => loadedMap.resize());
    };
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(fullscreenContainer);
    resizeMap();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [isFullscreen, loadedMap]);

  useEffect(() => {
    if (!isFullscreen || !fallbackFullscreenRef.current) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  return (
    <div
      ref={fullscreenContainerRef}
      className={`relative bg-white ${isFullscreen ? "fixed inset-0 z-[9999] h-dvh w-screen overflow-hidden" : ""}`}
    >
      <div
        ref={containerRef}
        className={`w-full overflow-hidden ${
          isFullscreen
            ? "h-dvh min-h-0"
            : "h-[52vh] min-h-[360px] sm:min-h-[480px] lg:h-[570px] lg:min-h-0"
        }`}
        aria-label={t("route.interactiveMap")}
      />
      <div className="absolute right-3 top-3 z-10 flex items-start gap-2">
        <label className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
          <span className="mr-2">{t("route.distanceMarkers")}</span>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
            value={distanceInterval}
            onChange={(event) => setDistanceInterval(Number(event.target.value))}
          >
            {distanceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          title={isFullscreen ? t("route.exitFullscreen") : t("route.fullscreen")}
          aria-label={isFullscreen ? t("route.exitFullscreen") : t("route.fullscreen")}
          aria-pressed={isFullscreen}
          onClick={toggleFullscreen}
        >
          <FullscreenIcon isFullscreen={isFullscreen} />
        </button>
      </div>
    </div>
  );
}

function FullscreenIcon({ isFullscreen }: { isFullscreen: boolean }) {
  return isFullscreen ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function addEndpointMarkers(map: MapLibreMap, coordinates: [number, number][], labels: { start: string; finish: string }): Marker[] {
  const endpointsAreClose = areRouteEndpointsClose(coordinates);
  const startOffset: [number, number] = endpointsAreClose ? [-18, 0] : [0, 0];
  const finishOffset: [number, number] = endpointsAreClose ? [18, 0] : [0, 0];

  const startMarker = new Marker({
    element: createEndpointMarkerElement("start", labels.start, "bg-emerald-600"),
    anchor: "bottom",
    offset: startOffset,
  })
    .setLngLat(coordinates[0])
    .addTo(map);

  const finishMarker = new Marker({
    element: createEndpointMarkerElement("finish", labels.finish, "bg-red-600"),
    anchor: "bottom",
    offset: finishOffset,
  })
    .setLngLat(coordinates.at(-1)!)
    .addTo(map);

  return [startMarker, finishMarker];
}

function createEndpointMarkerElement(kind: "start" | "finish", title: string, colorClass: string): HTMLElement {
  const element = document.createElement("div");
  element.className = `${colorClass} flex size-9 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow-lg`;
  element.textContent = endpointGlyph(title);
  element.dataset.routeEndpoint = kind;
  element.title = title;
  element.setAttribute("aria-label", title);
  return element;
}

function endpointGlyph(label: string): string { return label.charAt(0).toUpperCase(); }

function createDistanceMarkerElement(distanceMeters: number, ariaLabel: string): HTMLElement {
  const distanceKilometers = distanceMeters / 1_000;
  const element = document.createElement("div");
  element.className =
    "min-w-7 rounded-full border border-slate-400 bg-white/95 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-slate-800 shadow-sm";
  element.textContent = String(distanceKilometers);
  element.title = `${distanceKilometers} km`;
  element.setAttribute("aria-label", ariaLabel);
  return element;
}

function getRouteBounds(coordinates: [number, number][]): LngLatBoundsLike {
  const unwrapped = unwrapLongitudes(coordinates);
  let west = unwrapped[0][0];
  let east = west;
  let south = unwrapped[0][1];
  let north = south;

  for (const [longitude, latitude] of unwrapped) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }

  return [
    [west, south],
    [east, north],
  ];
}

function unwrapLongitudes(coordinates: [number, number][]): [number, number][] {
  const result: [number, number][] = [coordinates[0]];

  for (let index = 1; index < coordinates.length; index += 1) {
    let longitude = coordinates[index][0];
    const previousLongitude = result[index - 1][0];

    while (longitude - previousLongitude > 180) longitude -= 360;
    while (longitude - previousLongitude < -180) longitude += 360;

    result.push([longitude, coordinates[index][1]]);
  }

  return result;
}

function addGeoJsonSource(map: MapLibreMap, id: string) {
  map.addSource(id, { type: "geojson", data: emptyFeatureCollection() });
}

function setSourceData(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function featureCollection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

function lineFeature(coordinates: RouteCoordinate[]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

function pointFeature(coordinate: RouteCoordinate, kind: string): GeoJSON.Feature<GeoJSON.Point> {
  return { type: "Feature", properties: { kind }, geometry: { type: "Point", coordinates: coordinate } };
}

function detourCoordinates(draft: Extract<SuggestionDraft, { type: "detour" }>): RouteCoordinate[] {
  if (!draft.start) return [];
  return [[draft.start.lng, draft.start.lat], ...draft.waypoints, ...(draft.end ? [[draft.end.lng, draft.end.lat] as RouteCoordinate] : [])];
}
