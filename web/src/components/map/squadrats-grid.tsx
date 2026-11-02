"use client";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createSquadratsGrid, SQUADRATINHOS_ZOOM } from "./xyz-tiles";

const SOURCE = "squadrats-grid";
const LAYER = "squadrats-grid-lines";
const MIN_MAP_ZOOM = 10;
const FINE_MIN_MAP_ZOOM = 14;
const FINE_SOURCE = "squadratinhos-grid";
const FINE_LAYER = "squadratinhos-grid-lines";

/** Shared control/layer lifecycle for route viewing and drawing maps. */
export function SquadratsGrid({ map, beforeLayerId }: { map: MapLibreMap | null; beforeLayerId: string }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [needsZoom, setNeedsZoom] = useState(false);
  const [fineVisible, setFineVisible] = useState(false);

  useEffect(() => {
    if (!map || !enabled) return;
    const update = () => {
      // Route sources may still be updating; that must not postpone enabling the grid.
      if (!map.getStyle()) return;
      const bounds = map.getBounds();
      const viewport = { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
      const data = map.getZoom() < MIN_MAP_ZOOM ? null : createSquadratsGrid(viewport);
      const fineData = map.getZoom() < FINE_MIN_MAP_ZOOM ? null : createSquadratsGrid(viewport, SQUADRATINHOS_ZOOM);
      setFineVisible(fineData !== null);
      setNeedsZoom(data === null);
      const geojson = data ?? { type: "FeatureCollection" as const, features: [] };
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source) source.setData(geojson);
      else map.addSource(SOURCE, { type: "geojson", data: geojson });
      if (!map.getLayer(LAYER)) {
        map.addLayer({ id: LAYER, type: "line", source: SOURCE, paint: { "line-color": "#7c3aed", "line-width": 1, "line-opacity": 0.55 } }, map.getLayer(beforeLayerId) ? beforeLayerId : undefined);
      }
      const fineGeojson = fineData ?? { type: "FeatureCollection" as const, features: [] };
      const fineSource = map.getSource(FINE_SOURCE) as GeoJSONSource | undefined;
      if (fineSource) fineSource.setData(fineGeojson);
      else map.addSource(FINE_SOURCE, { type: "geojson", data: fineGeojson });
      if (!map.getLayer(FINE_LAYER)) {
        map.addLayer({ id: FINE_LAYER, type: "line", source: FINE_SOURCE, minzoom: FINE_MIN_MAP_ZOOM, paint: { "line-color": "#7c3aed", "line-width": 0.75, "line-opacity": 0.3 } }, LAYER);
      }
    };
    update();
    map.on("moveend", update);
    map.on("resize", update);
    map.on("style.load", update);
    return () => {
      map.off("moveend", update);
      map.off("resize", update);
      map.off("style.load", update);
      // A parent map effect can remove the map before this child effect is cleaned up.
      if (map.getStyle()) {
        if (map.getLayer(FINE_LAYER)) map.removeLayer(FINE_LAYER);
        if (map.getSource(FINE_SOURCE)) map.removeSource(FINE_SOURCE);
        if (map.getLayer(LAYER)) map.removeLayer(LAYER);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      }
    };
  }, [map, enabled, beforeLayerId]);

  return <div className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-violet-600" />
      {t("map.showSquadratsGrid")}
    </label>
    {enabled && (!fineVisible || needsZoom) && <p role="status" className="mt-1 max-w-52 text-slate-500">{t(needsZoom ? "map.squadratsZoomIn" : "map.squadratinhosZoomIn")}</p>}
  </div>;
}
