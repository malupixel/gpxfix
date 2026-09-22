import type { ElevationSample } from "@/types/route";

export type ValidElevationSample = ElevationSample & { elevationMeters: number };
export type ElevationSummary = { gainMeters: number; lossMeters: number; minMeters: number; maxMeters: number };
export type ElevationProfileModel = {
  chartSamples: ValidElevationSample[];
  summary: ElevationSummary;
  maximumDistance: number;
};

const ELEVATION_NOISE_THRESHOLD_METERS = 3;

export function validElevationSamples(samples: ElevationSample[]): ValidElevationSample[] {
  return samples.filter((sample): sample is ValidElevationSample => sample.elevationMeters !== null && Number.isFinite(sample.elevationMeters));
}

export function elevationProfileModel(samples: ElevationSample[]): ElevationProfileModel | null {
  const summary = elevationSummary(samples);
  const chartSamples = chartElevationSamples(samples);
  if (!summary || chartSamples.length < 2) return null;
  return {
    chartSamples,
    summary,
    maximumDistance: samples.at(-1)?.distanceMeters || chartSamples.at(-1)!.distanceMeters || 1,
  };
}

export function elevationSummary(samples: ElevationSample[]): ElevationSummary | null {
  const valid = validElevationSamples(samples);
  if (!valid.length) return null;
  let gainMeters = 0, lossMeters = 0, anchor: number | null = null;
  for (const sample of samples) {
    if (sample.elevationMeters === null || !Number.isFinite(sample.elevationMeters)) { anchor = null; continue; }
    if (anchor === null) { anchor = sample.elevationMeters; continue; }
    // A 3 m deadband suppresses common point-to-point GPS altitude jitter while
    // still accumulating gradual climbs once they move far enough from the anchor.
    const change = sample.elevationMeters - anchor;
    if (change >= ELEVATION_NOISE_THRESHOLD_METERS) { gainMeters += change; anchor = sample.elevationMeters; }
    else if (change <= -ELEVATION_NOISE_THRESHOLD_METERS) { lossMeters += -change; anchor = sample.elevationMeters; }
  }
  let minMeters=valid[0].elevationMeters,maxMeters=valid[0].elevationMeters;
  for(const sample of valid){minMeters=Math.min(minMeters,sample.elevationMeters);maxMeters=Math.max(maxMeters,sample.elevationMeters);}
  return { gainMeters, lossMeters, minMeters, maxMeters };
}

export function chartElevationSamples(samples: ElevationSample[], maximum = 600): ValidElevationSample[] {
  const valid = smooth(validElevationSamples(samples));
  if (valid.length <= maximum) return valid;
  const result: ValidElevationSample[] = [valid[0]];
  const bucketSize = (valid.length - 2) / Math.max(1, Math.floor((maximum - 2) / 2));
  for (let start = 1; start < valid.length - 1; start += bucketSize) {
    const bucket = valid.slice(Math.floor(start), Math.min(valid.length - 1, Math.floor(start + bucketSize)));
    if (!bucket.length) continue;
    const min = bucket.reduce((a, b) => a.elevationMeters <= b.elevationMeters ? a : b);
    const max = bucket.reduce((a, b) => a.elevationMeters >= b.elevationMeters ? a : b);
    result.push(...(min.distanceMeters <= max.distanceMeters ? [min, max] : [max, min]));
  }
  return [...result.slice(0, maximum - 1), valid.at(-1)!];
}

export function nearestElevationSample(samples: ValidElevationSample[], distanceMeters: number): ValidElevationSample | null {
  if (!samples.length) return null;
  let low = 0, high = samples.length - 1;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (samples[middle].distanceMeters < distanceMeters) low = middle + 1; else high = middle; }
  if (low === 0) return samples[0];
  return distanceMeters - samples[low - 1].distanceMeters <= samples[low].distanceMeters - distanceMeters ? samples[low - 1] : samples[low];
}

function smooth(samples: ValidElevationSample[]): ValidElevationSample[] {
  return samples.map((sample, index) => {
    const nearby = samples.slice(Math.max(0, index - 2), Math.min(samples.length, index + 3));
    return { ...sample, elevationMeters: nearby.reduce((sum, item) => sum + item.elevationMeters, 0) / nearby.length };
  });
}
