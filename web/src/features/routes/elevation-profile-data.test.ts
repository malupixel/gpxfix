import assert from "node:assert/strict";
import test from "node:test";
import type { ElevationSample } from "@/types/route";
import { chartElevationSamples, elevationSummary, nearestElevationSample } from "./elevation-profile-data";

const sample = (distanceMeters: number, elevationMeters: number | null): ElevationSample => ({ distanceMeters, elevationMeters, longitude: 21 + distanceMeters / 100_000, latitude: 52 });

test("summarizes gain/loss while ignoring sub-three-metre GPS noise", () => {
  const summary = elevationSummary([sample(0,100),sample(100,101),sample(200,99),sample(300,104),sample(400,110),sample(500,106)]);
  assert.deepEqual(summary, { gainMeters: 10, lossMeters: 4, minMeters: 99, maxMeters: 110 });
});

test("missing elevation produces no summary or chart", () => {
  const samples = [sample(0,null),sample(100,null)];
  assert.equal(elevationSummary(samples), null); assert.deepEqual(chartElevationSamples(samples), []);
});

test("dense profiles are bounded and retain route endpoints", () => {
  const dense = Array.from({ length: 20_000 }, (_, index) => sample(index * 10, 100 + Math.sin(index / 50) * 25));
  const chart = chartElevationSamples(dense, 600);
  assert.ok(chart.length <= 600); assert.equal(chart[0].distanceMeters, 0); assert.equal(chart.at(-1)!.distanceMeters, 199_990);
  assert.equal(nearestElevationSample(chart, 100_000)?.distanceMeters !== undefined, true);
});
