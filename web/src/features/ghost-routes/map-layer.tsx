"use client";
import type { Map as MapLibreMap, GeoJSONSource, LineLayerSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { ghostFeatures } from "./model";
import { useGhostRoutes } from "./provider";

export const GHOST_SOURCE = "ghost-routes";
export const GHOST_LAYER = "ghost-routes-lines";
export function ghostLayer(): LineLayerSpecification {
  return { id: GHOST_LAYER, type: "line", source: GHOST_SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-opacity": ["case", ["get", "primary"], 0.8, 0.45], "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["get", "primary"], 8, 6], 12, ["case", ["get", "primary"], 14, 10], 18, ["case", ["get", "primary"], 20, 14]], "line-dasharray": [2, 1] } };
}
/** One passive GeoJSON layer shared by both existing MapLibre maps. No hit handlers. */
export function GhostMapLayer({ map, beforeLayerId }: { map: MapLibreMap | null; beforeLayerId: string }) {
  const { state, focus } = useGhostRoutes();
  const data = useMemo(() => ghostFeatures(state), [state]);
  const dataRef = useRef(data);
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    dataRef.current = data;
    syncRef.current();
    (map?.getSource(GHOST_SOURCE) as GeoJSONSource | undefined)?.setData(data);
  }, [map, data]);
  useEffect(() => {
    if (!map) return;
    let syncing = false;
    const sync = () => {
      if (syncing) return;
      if (!map.getStyle()) return;
      if (!dataRef.current.features.length) {
        syncing = true;
        try {
          if (map.getLayer(GHOST_LAYER)) map.removeLayer(GHOST_LAYER);
          if (map.getSource(GHOST_SOURCE)) map.removeSource(GHOST_SOURCE);
        } finally { syncing = false; }
        return;
      }
      if (!map.getLayer(beforeLayerId)) return;
      syncing = true;
      try {
        if (!map.getSource(GHOST_SOURCE)) map.addSource(GHOST_SOURCE, { type: "geojson", data: dataRef.current });
        if (!map.getLayer(GHOST_LAYER)) map.addLayer(ghostLayer(), beforeLayerId);
      } finally { syncing = false; }
    };
    syncRef.current = sync;
    sync(); map.on("style.load", sync); map.on("styledata", sync);
    return () => {
      syncRef.current = () => {};
      map.off("style.load", sync); map.off("styledata", sync);
      if (map.getStyle()) { if (map.getLayer(GHOST_LAYER)) map.removeLayer(GHOST_LAYER); if (map.getSource(GHOST_SOURCE)) map.removeSource(GHOST_SOURCE); }
    };
  }, [map, beforeLayerId]);
  const previousCamera = useRef<{ center: [number, number]; zoom: number; bearing: number; pitch: number } | null>(null);
  const comparing = state.comparison !== null;
  useEffect(() => {
    if (!map) return;
    if (comparing && !previousCamera.current) {
      previousCamera.current = { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
    } else if (!comparing && previousCamera.current) {
      map.jumpTo(previousCamera.current); previousCamera.current = null;
    }
  }, [map, comparing]);
  useEffect(() => {
    if (!map || !focus) return;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (const route of focus.routes) for (const segment of route.geometry.coordinates) for (const [lng, lat] of segment) {
      // Keep routes near the antimeridian in a single world copy.
      const longitude = Number.isFinite(west) ? lng + 360 * Math.round(((west + east) / 2 - lng) / 360) : lng;
      west = Math.min(west, longitude); east = Math.max(east, longitude); south = Math.min(south, lat); north = Math.max(north, lat);
    }
    if (Number.isFinite(west)) map.fitBounds([[west, south], [east, north]], { padding: 60, maxZoom: 16, duration: 400 });
  }, [map, focus]);
  return null;
}
