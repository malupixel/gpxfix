"use client";

import {
  Map as MapLibreMap,
  type ErrorEvent as MapLibreErrorEvent,
  type LngLatBoundsLike,
} from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { RouteData } from "@/types/route";

const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-line";

type RouteMapProps = {
  geometry: RouteData["geometry"];
};

export function RouteMap({ geometry }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || geometry.coordinates.length < 2) {
      return;
    }

    const coordinates = geometry.coordinates;
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
      map.resize();
      map.fitBounds(getRouteBounds(coordinates), {
        padding: 50,
        maxZoom: 16,
        duration: 0,
      });
    });

    return () => {
      map.off("error", handleError);
      map.remove();
    };
  }, [geometry]);

  return (
    <div
      ref={containerRef}
      className="h-[60vh] min-h-[500px] w-full overflow-hidden rounded-xl border border-slate-200"
      aria-label="Interactive route map"
    />
  );
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
