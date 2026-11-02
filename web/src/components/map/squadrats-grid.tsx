"use client";

import type { FeatureCollection, Polygon } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createSquadratsGrid, SQUADRATS_ZOOM, SQUADRATINHOS_ZOOM } from "./xyz-tiles";
import { useRouteTiles } from "./use-route-tiles";

const EMPTY = { type: "FeatureCollection" as const, features: [] };
const VARIANTS = {
  large: { source: "squadrats-grid", zoom: SQUADRATS_ZOOM, minZoom: 10, color: "#16a34a", opacity: 0.15 },
  fine: { source: "squadratinhos-grid", zoom: SQUADRATINHOS_ZOOM, minZoom: 14, color: "#0891b2", opacity: 0.2 },
} as const;

type MapProps = { map: MapLibreMap | null; beforeLayerId: string };

/** Shared by viewing, historical versions, and drawing/editing the official route. */
export function SquadratsGrid({ map, beforeLayerId, coordinates }: MapProps & { coordinates: readonly (readonly number[])[] }) {
  const { t, i18n } = useTranslation();
  const [large, setLarge] = useState(false), [fine, setFine] = useState(false);
  const [largeNeedsZoom, setLargeNeedsZoom] = useState(false), [fineNeedsZoom, setFineNeedsZoom] = useState(false);
  const result = useRouteTiles(coordinates);
  const count = (kind: "large" | "fine") => result?.coverage ? result.coverage[kind].features.length.toLocaleString(i18n.language) : "…";
  return <div className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)} className="accent-violet-600" aria-label={t("map.showSquadratsGrid")} />
      {t("map.squadratsCount", { total: count("large") })}
    </label>
    <label className="mt-1 flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={fine} onChange={event => setFine(event.target.checked)} className="accent-violet-600" aria-label={t("map.showSquadratinhosGrid")} />
      {t("map.squadratinhosCount", { total: count("fine") })}
    </label>
    {large && largeNeedsZoom && <p role="status" className="mt-1 max-w-52 text-slate-500">{t("map.squadratsZoomIn")}</p>}
    {fine && fineNeedsZoom && <p role="status" className="mt-1 max-w-52 text-slate-500">{t("map.squadratinhosZoomIn")}</p>}
    {!result && <p role="status" className="mt-1 max-w-52 text-slate-500">{t("map.tilesCalculating")}</p>}
    {result?.error && <p role="status" className="mt-1 max-w-52 text-slate-500">{t("map.tilesUnavailable")}</p>}
    <GridOverlay map={map} beforeLayerId={beforeLayerId} kind="large" enabled={large} parentEnabled={large} coverage={result?.coverage?.large} onNeedsZoom={setLargeNeedsZoom} />
    <GridOverlay map={map} beforeLayerId={beforeLayerId} kind="fine" enabled={fine} parentEnabled={large} coverage={result?.coverage?.fine} onNeedsZoom={setFineNeedsZoom} />
  </div>;
}

function GridOverlay({ map, beforeLayerId, kind, enabled, parentEnabled, coverage, onNeedsZoom }: MapProps & {
  kind: keyof typeof VARIANTS; enabled: boolean; parentEnabled: boolean;
  coverage?: FeatureCollection<Polygon>; onNeedsZoom: (value: boolean) => void;
}) {
  const dataRef = useRef(coverage);
  const syncFillRef = useRef<() => void>(() => {});
  useEffect(() => { dataRef.current = coverage; syncFillRef.current(); }, [coverage]);
  useEffect(() => {
    if (!map || !enabled) return;
    const config = VARIANTS[kind], sourceId = config.source, lineId = `${sourceId}-lines`;
    const fillSource = `${sourceId}-coverage`, fillId = `${sourceId}-fill`;
    const syncFill = () => {
      if (!map.getStyle()) return;
      const source = map.getSource(fillSource) as GeoJSONSource | undefined;
      if (source) source.setData(dataRef.current ?? EMPTY);
      else map.addSource(fillSource, { type: "geojson", data: dataRef.current ?? EMPTY, tolerance: 0 });
      if (!map.getLayer(fillId)) {
        const firstGrid = map.getStyle().layers.find(layer => layer.id === "squadrats-grid-lines" || layer.id === "squadratinhos-grid-lines")?.id;
        map.addLayer({ id: fillId, type: "fill", source: fillSource, minzoom: config.minZoom, paint: { "fill-color": config.color, "fill-opacity": config.opacity, "fill-antialias": false } }, firstGrid ?? (map.getLayer(beforeLayerId) ? beforeLayerId : undefined));
      }
    };
    const updateGrid = () => {
      if (!map.getStyle()) return;
      const b = map.getBounds();
      const data = map.getZoom() < config.minZoom ? null : createSquadratsGrid({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }, config.zoom, !parentEnabled);
      onNeedsZoom(data === null);
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (source) source.setData(data ?? EMPTY);
      else map.addSource(sourceId, { type: "geojson", data: data ?? EMPTY });
      if (!map.getLayer(lineId)) {
        const before = kind === "fine" && map.getLayer("squadrats-grid-lines") ? "squadrats-grid-lines" : beforeLayerId;
        map.addLayer({ id: lineId, type: "line", source: sourceId, minzoom: config.minZoom, paint: { "line-color": "#7c3aed", "line-width": kind === "fine" ? 0.75 : 1, "line-opacity": kind === "fine" ? 0.3 : 0.55 } }, map.getLayer(before) ? before : undefined);
      }
    };
    const restore = () => { updateGrid(); syncFill(); };
    syncFillRef.current = syncFill;
    restore();
    map.on("moveend", updateGrid); map.on("resize", updateGrid); map.on("style.load", restore);
    return () => {
      syncFillRef.current = () => {};
      map.off("moveend", updateGrid); map.off("resize", updateGrid); map.off("style.load", restore);
      if (map.getStyle()) {
        for (const layer of [fillId, lineId]) if (map.getLayer(layer)) map.removeLayer(layer);
        for (const source of [fillSource, sourceId]) if (map.getSource(source)) map.removeSource(source);
      }
    };
  }, [map, beforeLayerId, kind, enabled, parentEnabled, onNeedsZoom]);
  return null;
}
