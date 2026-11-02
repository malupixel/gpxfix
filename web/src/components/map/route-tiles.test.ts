import assert from "node:assert/strict";
import test from "node:test";
import { routeTileCoverage } from "./route-tiles";
import { lonLatToTilePosition, SQUADRATS_ZOOM, SQUADRATINHOS_ZOOM, tileToBounds } from "./xyz-tiles";

const z = SQUADRATS_ZOOM;
const xy = (x: number, y: number, zoom: number = z) => { const b = tileToBounds(x, y, zoom); return [b.west, b.north]; };
const keys = (points: number[][], kind: "large" | "fine" = "large") => routeTileCoverage(points)[kind].features.map(f => `${f.properties!.x},${f.properties!.y}`).sort();

test("a segment inside a cell, empty geometry, single/duplicate points", () => {
  assert.deepEqual(keys([xy(8298.2, 5636.2), xy(8298.8, 5636.8)]), ['8298,5636']);
  assert.deepEqual(keys([]), []);
  assert.deepEqual(keys([xy(8298.2, 5636.2)]), []);
  assert.deepEqual(keys([xy(8298.2, 5636.2), xy(8298.2, 5636.2)]), []);
});

test("sparse long segments enumerate intermediate cells, in either direction", () => {
  const route = [xy(8298.2, 5636.4), xy(8302.8, 5636.4)];
  assert.deepEqual(keys(route), ['8298,5636', '8299,5636', '8300,5636', '8301,5636', '8302,5636']);
  assert.deepEqual(keys([...route].reverse()), keys(route));
});

test("repeat visits and reversed segments count each cell once", () => {
  const a = xy(8298.2, 5636.4), b = xy(8302.8, 5636.4);
  assert.deepEqual(keys([a, b, a, b, a]), keys([a, b]));
});

test("horizontal and vertical paths exactly on grid boundaries count neither neighbour", () => {
  assert.deepEqual(keys([xy(8298, 5636.2), xy(8298, 5640.8)]), []);
  assert.deepEqual(keys([xy(8298.2, 5636), xy(8302.8, 5636)]), []);
  assert.deepEqual(keys([xy(8298.2, 5636), xy(8302.8, 5636)].reverse()), []);
});

test("diagonal corner crossings exclude both side cells and endpoint-only touches", () => {
  assert.deepEqual(keys([xy(8298.25, 5636.25), xy(8300.75, 5638.75)]), ['8298,5636', '8299,5637', '8300,5638']);
  assert.deepEqual(keys([xy(8298.25, 5636.25), xy(8299, 5637)]), ['8298,5636']);
  assert.deepEqual(keys([xy(8299, 5637), xy(8298.25, 5636.25)]), ['8298,5636']);
  // The route turns at a corner, only touching the lower-right cell.
  assert.deepEqual(keys([xy(8298.5, 5636.5), xy(8299, 5637), xy(8298.5, 5637.5)]), ['8298,5636', '8298,5637']);
});

test("passing close to a corner still counts a genuine short interior interval", () => {
  assert.deepEqual(keys([xy(8298.25, 5636.25), xy(8299.75, 5637.75001)]), ['8298,5636', '8298,5637', '8299,5637']);
});

test("a fine-grid border within a squadrat counts the parent, with no fine cells", () => {
  const a = xy(8298 * 8 + 1, 5636 * 8 + .2, 17), b = xy(8298 * 8 + 1, 5636 * 8 + 6.8, 17);
  assert.deepEqual(keys([a, b]), ['8298,5636']);
  assert.deepEqual(keys([a, b], 'fine'), []);
});

test("Mercator projection is shared at high latitude; polygons match existing grid bounds", () => {
  for (const [x, y] of [[8298, 5636], [7000, 1000], [100, 15000]]) {
    const a = xy(x + .2, y + .3), b = xy(x + 2.8, y + .3);
    assert.equal(keys([a, b]).length, 3);
    const coverage = routeTileCoverage([a, b]);
    for (const f of coverage.fine.features) {
      const bounds = tileToBounds(f.properties!.x, f.properties!.y, SQUADRATINHOS_ZOOM);
      assert.deepEqual(f.geometry.coordinates[0][0], [bounds.west, bounds.north]);
    }
    const p = lonLatToTilePosition(a[0], a[1], z);
    assert.ok(Math.abs(p.y - (y + .3)) < 1e-9);
  }
});

test("coverage has no viewport dependency and recomputes from the supplied geometry only", () => {
  const a = xy(8298.2, 5636.4), b = xy(8398.8, 5636.4);
  assert.equal(routeTileCoverage([a, b]).large.features.length, 101);
  assert.equal(routeTileCoverage([a, xy(8298.8, 5636.8)]).large.features.length, 1);
});

test("world copies deduplicate and raw antimeridian segments match MapLibre's projected line", () => {
  const a = xy(-.8, 8191.2), b = xy(.8, 8191.2);
  assert.deepEqual(keys([a, b]), ['0,8191', '16383,8191']);
  assert.deepEqual(keys([[a[0] + 360, a[1]], [b[0] + 360, b[1]]]), keys([a, b]));
});

test("invalid coordinates break the polyline instead of creating a spurious bridge", () => {
  assert.deepEqual(keys([xy(8298.2, 5636.2), [NaN, 0], xy(8400.2, 5636.2)]), []);
});

test("500 km route with 20,001 points stays bounded and deduplicates the return leg", () => {
  const points = Array.from({ length: 20_001 }, (_, i) => [16 + i / 20_000 * 7.3, 52.12345]);
  const started = performance.now();
  const result = routeTileCoverage(points);
  const elapsed = performance.now() - started;
  assert.ok(result.large.features.length > 300 && result.large.features.length < 400);
  assert.ok(result.fine.features.length > 2600 && result.fine.features.length < 2800);
  assert.deepEqual(routeTileCoverage([...points, ...points.toReversed()]), result);
  console.log(`500 km / 20,001 points: ${elapsed.toFixed(1)} ms, ${result.large.features.length} Squadrats / ${result.fine.features.length} Squadratinhos`);
});


test("corner crossings are stable at both resolutions and across Mercator latitudes", () => {
  for (const zoom of [14, 17]) for (const y of [200, 1000, 5636, 7000, 11000]) {
    const kind = zoom === 14 ? "large" : "fine";
    for (const fraction of [.1, .2, .4, .7]) {
      const a = xy(8298 + fraction, y + fraction, zoom), b = xy(8300 + fraction, y + 2 + fraction, zoom);
      assert.deepEqual(keys([a, b], kind), [`8298,${y}`, `8299,${y + 1}`, `8300,${y + 2}`]);
    }
  }
});

test("DDA agrees with independent open-rectangle clipping for deterministic random segments", () => {
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = 0; i < 40; i++) {
    const points = [xy(8298 + random() * 5, 5636 + random() * 5), xy(8298 + random() * 5, 5636 + random() * 5)];
    for (const [kind, zoom] of [['large', 14], ['fine', 17]] as const) {
      const a = lonLatToTilePosition(points[0][0], points[0][1], zoom), b = lonLatToTilePosition(points[1][0], points[1][1], zoom);
      const dx = b.x - a.x, dy = b.y - a.y;
      const expected: string[] = [];
      for (let x = Math.floor(Math.min(a.x, b.x)); x <= Math.floor(Math.max(a.x, b.x)); x++) {
        for (let y = Math.floor(Math.min(a.y, b.y)); y <= Math.floor(Math.max(a.y, b.y)); y++) {
          const tx = [(x - a.x) / dx, (x + 1 - a.x) / dx].sort((a, b) => a - b);
          const ty = [(y - a.y) / dy, (y + 1 - a.y) / dy].sort((a, b) => a - b);
          const enter = Math.max(0, tx[0], ty[0]), exit = Math.min(1, tx[1], ty[1]);
          if (exit - enter > 1e-10) expected.push(`${x},${y}`);
        }
      }
      assert.deepEqual(keys(points, kind), expected.sort());
      assert.deepEqual(keys([...points].reverse(), kind), expected.sort());
    }
  }
});

test("pathological world-spanning routes fail explicitly instead of returning partial counts", () => {
  assert.throws(() => routeTileCoverage([[-179.9, 1], [179.9, 1]]), /limit exceeded/);
});
