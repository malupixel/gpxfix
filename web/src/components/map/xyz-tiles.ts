import type { FeatureCollection, LineString } from "geojson";

export const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;
export const SQUADRATS_ZOOM = 14;
export type GeographicBounds = { west: number; south: number; east: number; north: number };

const clampLatitude = (latitude: number) => Math.max(-WEB_MERCATOR_MAX_LATITUDE, Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude));
// Inverse projection can land a few ulps away from an integer tile boundary.
const snapBoundary = (value: number) => Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value;
const tileX = (longitude: number, zoom: number) => snapBoundary((longitude + 180) / 360 * 2 ** zoom);
const tileY = (latitude: number, zoom: number) => snapBoundary((1 - Math.asinh(Math.tan(clampLatitude(latitude) * Math.PI / 180)) / Math.PI) / 2 * 2 ** zoom);
const longitude = (x: number, zoom: number) => x / 2 ** zoom * 360 - 180;
const latitude = (y: number, zoom: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** zoom))) * 180 / Math.PI;

/** XYZ uses half-open cells: west/north belongs to this tile, east/south to the next. */
export function lonLatToTile(lon: number, lat: number, zoom: number) {
  const count = 2 ** zoom;
  const x = Math.floor(tileX(lon, zoom));
  return { x: ((x % count) + count) % count, y: Math.max(0, Math.min(count - 1, Math.floor(tileY(lat, zoom)))) };
}

/** Unwrapped x is intentional: MapLibre viewports can extend into adjacent world copies. */
export function tileToBounds(x: number, y: number, zoom: number): GeographicBounds {
  return { west: longitude(x, zoom), east: longitude(x + 1, zoom), north: latitude(y, zoom), south: latitude(y + 1, zoom) };
}

/** Inclusive tile ranges, excluding cells merely touching the east/south viewport edge. */
export function tilesIntersectingBounds(bounds: GeographicBounds, zoom: number) {
  const east = bounds.east < bounds.west ? bounds.east + 360 : bounds.east;
  const count = 2 ** zoom;
  return {
    minX: Math.floor(tileX(bounds.west, zoom)),
    maxX: Math.ceil(tileX(east, zoom)) - 1,
    minY: Math.max(0, Math.floor(tileY(bounds.north, zoom))),
    maxY: Math.min(count - 1, Math.ceil(tileY(bounds.south, zoom)) - 1),
  };
}

/** Shared cell edges need only O(rows + columns) lines, rather than O(rows * columns) polygons. */
export function createSquadratsGrid(bounds: GeographicBounds): FeatureCollection<LineString> | null {
  const { minX, maxX, minY, maxY } = tilesIntersectingBounds(bounds, SQUADRATS_ZOOM);
  const features: FeatureCollection<LineString>["features"] = [];
  if (maxX < minX || maxY < minY) return { type: "FeatureCollection", features };
  // Also bound unusually large/rotated viewports, without substituting a coarser grid.
  if (maxX - minX + maxY - minY + 4 > 2048) return null;
  const nw = tileToBounds(minX, minY, SQUADRATS_ZOOM);
  const se = tileToBounds(maxX, maxY, SQUADRATS_ZOOM);
  const addLine = (coordinates: number[][]) => features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
  for (let x = minX; x <= maxX + 1; x++) {
    const lon = longitude(x, SQUADRATS_ZOOM);
    addLine([[lon, se.south], [lon, nw.north]]);
  }
  for (let y = minY; y <= maxY + 1; y++) {
    const lat = latitude(y, SQUADRATS_ZOOM);
    addLine([[nw.west, lat], [se.east, lat]]);
  }
  return { type: "FeatureCollection", features };
}
