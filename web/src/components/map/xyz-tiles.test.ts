import assert from "node:assert/strict";
import test from "node:test";
import { createSquadratsGrid, lonLatToTile, SQUADRATS_ZOOM, tileToBounds, tilesIntersectingBounds, WEB_MERCATOR_MAX_LATITUDE } from "./xyz-tiles";

const z = SQUADRATS_ZOOM;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("fixed z=14 XYZ reference coordinates include western longitudes", () => {
  assert.equal(z, 14);
  assert.deepEqual(lonLatToTile(0, 0, z), { x: 8192, y: 8192 });
  assert.deepEqual(lonLatToTile(-0.1276, 51.5072, z), { x: 8186, y: 5448 });
  assert.deepEqual(lonLatToTile(-74.006, 40.7128, z), { x: 4823, y: 6160 });
  // Paris example from a public Squadrats viewer; expected XYZ evaluated independently.
  // https://gist.github.com/dhardy92/28bba665235b4d7e06e0445b22778f64 (main.js)
  assert.deepEqual(lonLatToTile(2.3488, 48.85341, z), { x: 8298, y: 5636 });
});

test("inverse conversion pins exact geographic bounds rather than approximate kilometre sizes", () => {
  const bounds = tileToBounds(8192, 8192, z);
  assert.equal(bounds.west, 0);
  assert.equal(bounds.east, 0.02197265625);
  assert.equal(bounds.north, 0);
  near(bounds.south, -0.021972655711418845);
  const paris = tileToBounds(8298, 5636, z);
  assert.equal(paris.west, 2.3291015625);
  assert.equal(paris.east, 2.35107421875);
  near(paris.south, 48.850258199721495);
  near(paris.north, 48.86471476180277);
});

test("tile borders follow the XYZ west/north inclusive convention", () => {
  for (const [x, y] of [[8298, 5636], [4823, 6160], [8192, 8192], [100, 100]]) {
    const b = tileToBounds(x, y, z);
    assert.deepEqual(lonLatToTile(b.west, b.north, z), { x, y });
    assert.deepEqual(lonLatToTile(b.east, b.south, z), { x: x + 1, y: y + 1 });
    assert.deepEqual(lonLatToTile(b.west - 1e-7, b.north + 1e-7, z), { x: x - 1, y: y - 1 });
    assert.deepEqual(lonLatToTile(b.west + 1e-7, b.north - 1e-7, z), { x, y });
    assert.deepEqual(tilesIntersectingBounds(b, z), { minX: x, maxX: x, minY: y, maxY: y });
  }
});

test("Mercator latitude limits clamp safely and longitude wraps around the world", () => {
  assert.deepEqual(lonLatToTile(-180, WEB_MERCATOR_MAX_LATITUDE, z), { x: 0, y: 0 });
  assert.deepEqual(lonLatToTile(180, -WEB_MERCATOR_MAX_LATITUDE, z), { x: 0, y: 16383 });
  assert.deepEqual(lonLatToTile(0, 90, z), { x: 8192, y: 0 });
  assert.deepEqual(lonLatToTile(0, -90, z), { x: 8192, y: 16383 });
  near(tileToBounds(0, 0, z).north, WEB_MERCATOR_MAX_LATITUDE);
  near(tileToBounds(0, 16383, z).south, -WEB_MERCATOR_MAX_LATITUDE);
});

test("viewport spanning 3 columns and 2 rows emits each shared edge once", () => {
  const nw = tileToBounds(8298, 5636, z), se = tileToBounds(8300, 5637, z);
  const bbox = { west: nw.west + 0.001, north: nw.north - 0.001, east: se.east - 0.001, south: se.south + 0.001 };
  assert.deepEqual(tilesIntersectingBounds(bbox, z), { minX: 8298, maxX: 8300, minY: 5636, maxY: 5637 });
  const grid = createSquadratsGrid(bbox)!;
  assert.equal(grid.features.length, 7);
  assert.deepEqual(grid.features[0].geometry.coordinates, [[nw.west, se.south], [nw.west, nw.north]]);
  assert.deepEqual(grid.features[6].geometry.coordinates, [[nw.west, se.south], [se.east, se.south]]);
});

test("antimeridian viewports stay local and world copies keep identical tile boundaries", () => {
  const bbox = { west: 179.99, east: -179.99, north: 0.01, south: -0.01 };
  assert.deepEqual(tilesIntersectingBounds(bbox, z), { minX: 16383, maxX: 16384, minY: 8191, maxY: 8192 });
  assert.equal(createSquadratsGrid(bbox)!.features.length, 6);
  assert.deepEqual(tilesIntersectingBounds({ ...bbox, east: 180.01 }, z), tilesIntersectingBounds(bbox, z));
  assert.deepEqual(lonLatToTile(-180.01, 0, z), lonLatToTile(179.99, 0, z));
});

test("huge viewports do not allocate a global grid and zero-area viewports are empty", () => {
  assert.equal(createSquadratsGrid({ west: -180, east: 180, north: 90, south: -90 }), null);
  assert.deepEqual(createSquadratsGrid({ west: 0, east: 0, north: 0, south: 0 })!.features, []);
});
