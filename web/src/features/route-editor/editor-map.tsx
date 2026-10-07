"use client";
import type * as GeoJSON from "geojson";
import { Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { RouteCoordinate } from "@/features/routes/route-geometry";
import { finalGeometry, previewPointMove, type RouteEditorDocument } from "./model";
import { SquadratsGrid } from "@/components/map/squadrats-grid";

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
type Props = {
  document: RouteEditorDocument;
  selectedSegmentId: string | null;
  selectedPointId: string | null;
  inserting: boolean;
  onMapClick: (value: RouteCoordinate) => void;
  onInsert: (segmentId: string, value: RouteCoordinate) => void;
  onMove: (id: string, value: RouteCoordinate) => void;
  onSelectSegment: (id: string | null) => void;
  onSelectPoint: (id: string | null) => void;
};

export function EditorMap(props: Props) {
  const { document: routeDocument, selectedSegmentId, selectedPointId, inserting } = props;
  const node = useRef<HTMLDivElement>(null), mapRef = useRef<MapLibreMap | null>(null), callbacks = useRef(props);
  const documentRef = useRef(routeDocument), selectedSegmentRef = useRef(selectedSegmentId), insertingRef = useRef(inserting);
  const [mapError, setMapError] = useState(false);
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);
  useEffect(() => { callbacks.current = props; }, [props]);
  useEffect(() => { documentRef.current = routeDocument; selectedSegmentRef.current = selectedSegmentId; insertingRef.current = inserting; }, [routeDocument, selectedSegmentId, inserting]);

  useEffect(() => {
    if (!node.current) return;
    const map = new MapLibreMap({ container: node.current, style: STYLE, center: [19.15, 52.1], zoom: 6 });
    mapRef.current = map; map.addControl(new NavigationControl(), "top-right");
    map.once("load", () => {
      map.addSource("editor-route", { type: "geojson", data: routeData(documentRef.current) });
      map.addLayer({ id: "editor-route-line", type: "line", source: "editor-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2563eb", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 14, 7] } });
      map.addSource("editor-segments", { type: "geojson", data: segmentData(documentRef.current, selectedSegmentRef.current) });
      map.addLayer({ id: "editor-segments-hit", type: "line", source: "editor-segments", paint: { "line-width": 28, "line-opacity": 0 } });
      map.addLayer({ id: "editor-selected", type: "line", source: "editor-segments", filter: ["==", ["get", "selected"], true], layout: { "line-cap": "round" }, paint: { "line-color": "#f59e0b", "line-width": 9, "line-opacity": .75 } });
      map.resize();
      setLoadedMap(map);
    });
    map.on("error", () => setMapError(true));
    map.on("mouseenter", "editor-segments-hit", () => { map.getCanvas().style.cursor = insertingRef.current ? "crosshair" : "pointer"; });
    map.on("mouseleave", "editor-segments-hit", () => { map.getCanvas().style.cursor = ""; });
    const click = (event: MapMouseEvent) => {
      const hit = map.queryRenderedFeatures(event.point, { layers: ["editor-segments-hit"] })[0];
      const segmentId = hit?.properties?.id as string | undefined;
      if (insertingRef.current && selectedSegmentRef.current && segmentId === selectedSegmentRef.current) {
        callbacks.current.onInsert(segmentId, [event.lngLat.lng, event.lngLat.lat]); return;
      }
      callbacks.current.onSelectPoint(null);
      if (segmentId) { callbacks.current.onSelectSegment(segmentId); return; }
      callbacks.current.onSelectSegment(null); callbacks.current.onMapClick([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on("click", click);
    return () => { setLoadedMap(null); mapRef.current = null; map.remove(); };
  }, []);

  useEffect(() => { updateMap(mapRef.current, routeDocument, selectedSegmentId); }, [routeDocument, selectedSegmentId]);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const markers = routeDocument.points.map((controlPoint, index) => {
      const element = window.document.createElement("button"); element.type = "button";
      element.className = `route-control-point ${controlPoint.id === selectedPointId ? "route-control-point-selected" : ""}`;
      element.dataset.kind = index === 0 ? "start" : index === routeDocument.points.length - 1 ? "end" : "control";
      element.title = `${index === 0 ? "Start" : index === routeDocument.points.length - 1 ? "Route end" : "Control point"} — drag to move`;
      element.setAttribute("aria-label", element.title);
      element.addEventListener("click", (event) => { event.stopPropagation(); callbacks.current.onSelectSegment(null); callbacks.current.onSelectPoint(controlPoint.id); });
      const marker = new Marker({ element, draggable: true }).setLngLat(controlPoint.coordinate).addTo(map);
      let dragSource = documentRef.current;
      marker.on("dragstart", () => { dragSource = documentRef.current; map.dragPan.disable(); element.classList.add("route-control-point-dragging"); });
      marker.on("drag", () => { const value = marker.getLngLat(); updateMap(map, previewPointMove(dragSource, controlPoint.id, [value.lng, value.lat]), selectedSegmentRef.current); });
      marker.on("dragend", () => { const value = marker.getLngLat(); element.classList.remove("route-control-point-dragging"); map.dragPan.enable(); callbacks.current.onMove(controlPoint.id, [value.lng, value.lat]); });
      return marker;
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [routeDocument.points, selectedPointId]);

  return <><div ref={node} className="absolute inset-0 size-full bg-slate-200" aria-label="Route editor map" /><div className="absolute left-3 top-16 z-10"><SquadratsGrid map={loadedMap} beforeLayerId="editor-route-line" /></div>{mapError && <div role="alert" className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 shadow">Nie udało się załadować części mapy. Sprawdź połączenie i odśwież stronę.</div>}</>;
}

function updateMap(map: MapLibreMap | null, document: RouteEditorDocument, selectedId: string | null) {
  if (!map?.getSource("editor-route")) return;
  (map.getSource("editor-route") as GeoJSONSource).setData(routeData(document));
  (map.getSource("editor-segments") as GeoJSONSource).setData(segmentData(document, selectedId));
}
function line(coordinates: RouteCoordinate[]): GeoJSON.Feature<GeoJSON.LineString> { return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }; }
function collection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection { return { type: "FeatureCollection", features }; }
function routeData(document: RouteEditorDocument): GeoJSON.FeatureCollection { const geometry = finalGeometry(document); return collection(geometry.length >= 2 ? [line(geometry)] : []); }
function segmentData(document: RouteEditorDocument, selectedId: string | null): GeoJSON.FeatureCollection { return collection(document.segments.map((segment) => ({ type: "Feature", properties: { id: segment.id, selected: segment.id === selectedId }, geometry: { type: "LineString", coordinates: segment.geometry } }))); }
