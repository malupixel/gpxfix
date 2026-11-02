import type { FeatureCollection, Polygon } from "geojson";
import { lonLatToTilePosition, snapBoundary, SQUADRATS_ZOOM, SQUADRATINHOS_ZOOM, TILE_BOUNDARY_EPSILON, tileToBounds } from "./xyz-tiles";

export type TileCoverage = { large: FeatureCollection<Polygon>; fine: FeatureCollection<Polygon> };
type Point = { x: number; y: number };
const MAX_UNIQUE_TILES = 100_000;
const MAX_STEPS = 2_000_000;

/** DDA traversal of open cell interiors, in the same projected plane as MapLibre lines.
 * Axis-aligned boundary segments count neither neighbour. At a corner both axes
 * advance together, so side cells touched at that point are never counted.
 */
function traverse(a: Point, b: Point, zoom: number, cells: Set<number>, budget: { steps: number }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((!dx && !dy) || (!dx && Number.isInteger(a.x)) || (!dy && Number.isInteger(a.y))) return;
  const n = 2 ** zoom;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  let x = Math.floor(a.x) - (dx < 0 && Number.isInteger(a.x) ? 1 : 0);
  let y = Math.floor(a.y) - (dy < 0 && Number.isInteger(a.y) ? 1 : 0);
  let t = 0;
  while (t < 1) {
    if (++budget.steps > MAX_STEPS) throw new Error("Tile coverage work limit exceeded");
    const tx = dx ? ((dx > 0 ? x + 1 : x) - a.x) / dx : Infinity;
    const ty = dy ? ((dy > 0 ? y + 1 : y) - a.y) / dy : Infinity;
    const next = Math.min(1, tx, ty);
    // Use the grid's existing spatial precision, converted to segment time.
    // Inverse/forward Mercator projection otherwise makes exact corners look
    // like microscopic passages through a neighbouring cell.
    const epsilon = Math.max(16 * Number.EPSILON, TILE_BOUNDARY_EPSILON / Math.max(Math.abs(dx), Math.abs(dy), 1));
    if (next > t + epsilon && y >= 0 && y < n) {
      const wrappedX = ((x % n) + n) % n;
      cells.add(y * n + wrappedX);
      if (cells.size > MAX_UNIQUE_TILES) throw new Error("Tile coverage size limit exceeded");
    }
    if (next >= 1) break;
    if (tx <= next + epsilon) x += sx;
    if (ty <= next + epsilon) y += sy;
    t = next;
  }
}

function polygons(cells: Set<number>, zoom: number): FeatureCollection<Polygon> {
  const n = 2 ** zoom;
  return { type: "FeatureCollection", features: Array.from(cells, id => {
    const x = id % n, y = Math.floor(id / n);
    const b = tileToBounds(x, y, zoom);
    return { type: "Feature", id, properties: { x, y }, geometry: { type: "Polygon", coordinates: [[
      [b.west, b.north], [b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north],
    ]] } };
  }) };
}

/** Entire official/displayed polyline only. Never reads viewport, ghosts or suggestions.
 * Project each vertex once at z=17, reusing it for z=14. Traverse both levels:
 * deriving parents from fine cells would miss paths along fine-grid borders.
 * Longitudes are kept unwrapped, matching the existing MapLibre GeoJSON source.
 */
export function routeTileCoverage(coordinates: readonly (readonly number[])[]): TileCoverage {
  const large = new Set<number>(), fine = new Set<number>(), budget = { steps: 0 };
  let previous: Point | null = null;
  for (const coordinate of coordinates) {
    if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) { previous = null; continue; }
    const point = lonLatToTilePosition(coordinate[0], coordinate[1], SQUADRATINHOS_ZOOM);
    if (previous) {
      traverse(previous, point, SQUADRATINHOS_ZOOM, fine, budget);
      traverse(
        { x: snapBoundary(previous.x / 8), y: snapBoundary(previous.y / 8) },
        { x: snapBoundary(point.x / 8), y: snapBoundary(point.y / 8) },
        SQUADRATS_ZOOM, large, budget,
      );
    }
    previous = point;
  }
  return { large: polygons(large, SQUADRATS_ZOOM), fine: polygons(fine, SQUADRATINHOS_ZOOM) };
}
