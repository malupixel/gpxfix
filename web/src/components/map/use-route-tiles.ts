"use client";
import { useEffect, useState } from "react";
import type { TileCoverage } from "./route-tiles";

type Result = { coordinates: readonly (readonly number[])[]; coverage?: TileCoverage; error?: boolean };

export function useRouteTiles(coordinates: readonly (readonly number[])[]) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    let cancelled = false;
    let worker: Worker | undefined;
    // Batch committed editor operations; cursor/drag previews don't change this input.
    const timer = setTimeout(() => {
      const fail = () => { if (!cancelled) setResult({ coordinates, error: true }); };
      try {
        worker = new Worker(new URL("./squadrats.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ coverage?: TileCoverage; error?: boolean }>) => {
          if (!cancelled) setResult({ coordinates, ...event.data });
          worker?.terminate();
        };
        worker.onerror = fail;
        worker.onmessageerror = fail;
        worker.postMessage(coordinates);
      } catch { fail(); }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); worker?.terminate(); };
  }, [coordinates]);
  // A result belongs to an immutable geometry reference. Never display stale data,
  // even during the render before the old worker's effect cleanup has run.
  return result?.coordinates === coordinates ? result : null;
}
