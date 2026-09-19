"use client";

import {
  Map as MapLibreMap,
  Marker,
  type ErrorEvent as MapLibreErrorEvent,
  type LngLatBoundsLike,
} from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  areRouteEndpointsClose,
  calculateDistanceMarkers,
} from "@/features/routes/route-geometry";
import type { RouteData } from "@/types/route";

const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-line";
const DEFAULT_DISTANCE_INTERVAL_METERS = 10_000;

const DISTANCE_INTERVAL_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "5 km", value: 5_000 },
  { label: "10 km", value: 10_000 },
  { label: "20 km", value: 20_000 },
] as const;

type RouteMapProps = {
  geometry: RouteData["geometry"];
};

export function RouteMap({ geometry }: RouteMapProps) {
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackFullscreenRef = useRef(false);
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);
  const [distanceInterval, setDistanceInterval] = useState(DEFAULT_DISTANCE_INTERVAL_METERS);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

      // Layers appended without `beforeId` render above every existing style layer.
      map.moveLayer(ROUTE_LAYER_ID);
      endpointMarkers.push(...addEndpointMarkers(map, coordinates));
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
    if (!loadedMap || distanceInterval === 0) return;

    const markers = calculateDistanceMarkers(geometry.coordinates, distanceInterval).map(
      ({ coordinate, distanceMeters }) =>
        new Marker({ element: createDistanceMarkerElement(distanceMeters), anchor: "center" })
          .setLngLat(coordinate)
          .addTo(loadedMap),
    );

    return () => markers.forEach((marker) => marker.remove());
  }, [distanceInterval, geometry.coordinates, loadedMap]);

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
        aria-label="Interactive route map"
      />
      <div className="absolute right-3 top-3 z-10 flex items-start gap-2">
        <label className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
          <span className="mr-2">Distance markers:</span>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
            value={distanceInterval}
            onChange={(event) => setDistanceInterval(Number(event.target.value))}
          >
            {DISTANCE_INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen map"}
          aria-label={isFullscreen ? "Exit fullscreen map" : "Fullscreen map"}
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

function addEndpointMarkers(map: MapLibreMap, coordinates: [number, number][]): Marker[] {
  const endpointsAreClose = areRouteEndpointsClose(coordinates);
  const startOffset: [number, number] = endpointsAreClose ? [-18, 0] : [0, 0];
  const finishOffset: [number, number] = endpointsAreClose ? [18, 0] : [0, 0];

  const startMarker = new Marker({
    element: createEndpointMarkerElement("S", "Start", "bg-emerald-600"),
    anchor: "bottom",
    offset: startOffset,
  })
    .setLngLat(coordinates[0])
    .addTo(map);

  const finishMarker = new Marker({
    element: createEndpointMarkerElement("F", "Finish", "bg-red-600"),
    anchor: "bottom",
    offset: finishOffset,
  })
    .setLngLat(coordinates.at(-1)!)
    .addTo(map);

  return [startMarker, finishMarker];
}

function createEndpointMarkerElement(label: string, title: string, colorClass: string): HTMLElement {
  const element = document.createElement("div");
  element.className = `${colorClass} flex size-9 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow-lg`;
  element.textContent = label;
  element.title = title;
  element.setAttribute("aria-label", title);
  return element;
}

function createDistanceMarkerElement(distanceMeters: number): HTMLElement {
  const distanceKilometers = distanceMeters / 1_000;
  const element = document.createElement("div");
  element.className =
    "min-w-7 rounded-full border border-slate-400 bg-white/95 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-slate-800 shadow-sm";
  element.textContent = String(distanceKilometers);
  element.title = `${distanceKilometers} km`;
  element.setAttribute("aria-label", `${distanceKilometers} km route marker`);
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
