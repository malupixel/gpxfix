import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePolylineDistance,
  createRouteMeasure,
  extractRouteSection,
  findNearestPositionOnRoute,
  normalizeRoutePositions,
  type RouteCoordinate,
} from "./route-geometry";

test("nearest route position is projected inside a sparse segment", () => {
  const measure = createRouteMeasure([[0, 0], [0.02, 0]]);
  const position = findNearestPositionOnRoute([0.01, 0.01], measure)!;
  assert.equal(position.segmentIndex, 0);
  assert.ok(Math.abs(position.segmentFraction - 0.5) < 0.001);
  assert.ok(Math.abs(position.lng - 0.01) < 0.00001);
  assert.ok(Math.abs(position.lat) < 0.00001);
});

test("distance is cumulative along the route rather than direct from start", () => {
  const measure = createRouteMeasure([[0, 0], [0.01, 0], [0.01, 0.01]]);
  const position = findNearestPositionOnRoute([0.01, 0.005], measure)!;
  assert.equal(position.segmentIndex, 1);
  assert.ok(position.distanceMeters > 1_600 && position.distanceMeters < 1_700);
});

test("route section extraction includes original vertices and interpolated anchors", () => {
  const measure = createRouteMeasure([[0, 0], [0.01, 0], [0.01, 0.01], [0.02, 0.01]]);
  const start = findNearestPositionOnRoute([0.005, 0], measure)!;
  const end = findNearestPositionOnRoute([0.015, 0.01], measure)!;
  const section = extractRouteSection(measure, start, end).coordinates;
  assert.equal(section.length, 4);
  assert.ok(Math.abs(section[0][0] - 0.005) < 1e-10);
  assert.deepEqual(section.slice(1, 3), [[0.01, 0], [0.01, 0.01]]);
  assert.ok(Math.abs(section[3][0] - 0.015) < 1e-10);
});

test("reversed issue clicks normalize into route order", () => {
  const measure = createRouteMeasure([[0, 0], [0.02, 0]]);
  const later = findNearestPositionOnRoute([0.018, 0], measure)!;
  const earlier = findNearestPositionOnRoute([0.003, 0], measure)!;
  const [start, end] = normalizeRoutePositions(later, earlier);
  assert.ok(start.distanceMeters < end.distanceMeters);
  assert.equal(start, earlier);
});

test("detour polyline distance sums each geographic leg", () => {
  const points: RouteCoordinate[] = [[0, 0], [0.01, 0], [0.01, 0.01]];
  const distance = calculatePolylineDistance(points);
  assert.ok(distance > 2_200 && distance < 2_230);
});

test("nearby positions on a loop remain distinguishable by route distance", () => {
  const measure = createRouteMeasure([[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]);
  const outbound = findNearestPositionOnRoute([0.0001, 0], measure)!;
  const inbound = findNearestPositionOnRoute([0, 0.0001], measure)!;
  assert.ok(calculatePolylineDistance([[outbound.lng, outbound.lat], [inbound.lng, inbound.lat]]) < 20);
  assert.ok(inbound.distanceMeters - outbound.distanceMeters > 4_000);
  assert.notEqual(outbound.segmentIndex, inbound.segmentIndex);
});
