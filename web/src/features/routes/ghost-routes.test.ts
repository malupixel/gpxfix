import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_GHOST_STATE, ghostReducer, ghostFeatures, versionGhost, MAX_GHOSTS, type GhostRoute } from "../ghost-routes/model";
import { readGhostFile, parseGhostGpx } from "../ghost-routes/gpx";
import { getRouteVersion } from "./api";
import type { RouteData } from "../../types/route";

const route: RouteData = { name: "Test", description: null, originalFilename: "test.gpx", elevationGainMeters: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", versionCreatedAt: "2026-01-01", isCurrentVersion: false, versionCount: 8, creationSource: "INITIAL_UPLOAD", suggestionsEnabled: true, originalAvailable: true, publicId: "route-id", viewedVersion: 3, geometry: { type: "LineString", coordinates: [[21, 52], [22, 53]] }, distanceMeters: 123, elevationProfile: [], currentVersion: 8 };
const ghost = (id: string): GhostRoute => ({ ...versionGhost(route, "#9333ea"), id });
test("multiple ghosts toggle, reappear and remove independently without mutating route data", () => {
  const before = JSON.stringify(route);
  let state = ghostReducer(EMPTY_GHOST_STATE, { type: "add", route: ghost("first") });
  state = ghostReducer(state, { type: "add", route: { ...ghost("second"), source: "gpx" } });
  assert.equal(ghostFeatures(state).features.length, 2);
  assert.notEqual(state.routes[0].color, state.routes[1].color);
  state = ghostReducer(state, { type: "toggle", id: "first" });
  assert.equal(ghostFeatures(state).features.length, 1);
  state = ghostReducer(state, { type: "toggle", id: "first" });
  assert.equal(ghostFeatures(state).features.length, 2);
  state = ghostReducer(state, { type: "remove", id: "first" });
  assert.deepEqual(state.routes.map(item => item.id), ["second"]);
  assert.equal(JSON.stringify(route), before);
});
test("historical versions have stable identifiers and repeated adds show the existing ghost", () => {
  const version = versionGhost(route, "#9333ea");
  let state = ghostReducer(EMPTY_GHOST_STATE, { type: "add", route: version });
  state = ghostReducer(state, { type: "toggle", id: version.id });
  state = ghostReducer(state, { type: "add", route: versionGhost(route, "#ff0000") });
  assert.equal(state.routes.length, 1);
  assert.equal(state.routes[0].visible, true);
  assert.equal(state.routes[0].color, "#9333ea");
});
test("comparing nonadjacent historical versions preserves regular ghosts and closes without mutations", () => {
  const before = JSON.stringify(route);
  const state = ghostReducer(EMPTY_GHOST_STATE, { type: "add", route: ghost("gpx") });
  const pair: [GhostRoute, GhostRoute] = [versionGhost(route, "purple", "A"), versionGhost({ ...route, viewedVersion: 7 }, "orange", "B")];
  const comparing = ghostReducer(state, { type: "compare", routes: pair });
  assert.equal(ghostFeatures(comparing).features.length, 3);
  assert.deepEqual(comparing.comparison?.map(item => item.version?.number), [3, 7]);
  assert.deepEqual(ghostReducer(comparing, { type: "close-comparison" }), state);
  assert.deepEqual(ghostReducer(comparing, { type: "remove", id: pair[0].id }), state);
  assert.equal(JSON.stringify(route), before);
});
test("memory budgets bound concurrent ghosts and comparison geometries", () => {
  let state = EMPTY_GHOST_STATE;
  for (let i = 0; i < MAX_GHOSTS; i++) state = ghostReducer(state, { type: "add", route: ghost(String(i)) });
  assert.throws(() => ghostReducer(state, { type: "add", route: ghost("extra") }), /ghost.limit/);
  assert.throws(() => ghostReducer(state, { type: "compare", routes: [ghost("a"), ghost("b")] }), /ghost.limit/);
  assert.throws(() => ghostReducer(EMPTY_GHOST_STATE, { type: "add", route: { ...ghost("large"), geometry: { type: "MultiLineString", coordinates: [Array.from({ length: 300_001 }, () => [21, 52])] } } }), /ghost.limit/);
});
test("oversized local files are rejected before reading or parsing", async () => {
  await assert.rejects(readGhostFile({ size: 11 * 1024 * 1024, text: async () => { throw new Error("must not read"); } }), /ghost.fileTooLarge/);
  assert.throws(() => parseGhostGpx('<!DOCTYPE gpx><gpx/>', { parseFromString: () => { throw new Error("must not parse"); } }), /ghost.invalidGpx/);
});
test("historical geometry uses the existing read-only version API", async () => {
  const original = globalThis.fetch;
  const requests: { url: string; method: string }[] = [];
  globalThis.fetch = async (input, init) => { requests.push({ url: String(input), method: init?.method ?? "GET" }); return Response.json(route); };
  try {
    const loaded = await getRouteVersion("route/id", 3);
    assert.deepEqual(loaded.geometry, route.geometry);
    assert.ok(requests[0].url.endsWith("/api/routes/route%2Fid/versions/3"));
    assert.equal(requests[0].method, "GET");
  } finally { globalThis.fetch = original; }
});

test("ghost line paint is accepted by the actual MapLibre style validator", async () => {
  const { validateStyleMin } = await import("@maplibre/maplibre-gl-style-spec");
  const { ghostLayer, GHOST_SOURCE } = await import("../ghost-routes/map-layer");
  const errors = validateStyleMin({ version: 8, sources: { [GHOST_SOURCE]: { type: "geojson", data: ghostFeatures(EMPTY_GHOST_STATE) } }, layers: [ghostLayer()] });
  assert.deepEqual(errors, []);
});
