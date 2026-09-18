"use client";

import {
  Map as MapLibreMap,
  Marker,
  type ErrorEvent as MapLibreErrorEvent,
  type LngLatBoundsLike,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);
  const [distanceInterval, setDistanceInterval] = useState(DEFAULT_DISTANCE_INTERVAL_METERS);

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

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[60vh] min-h-[500px] w-full overflow-hidden rounded-xl border border-slate-200"
        aria-label="Interactive route map"
      />
      <label className="absolute right-3 top-3 z-10 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
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
    </div>
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
