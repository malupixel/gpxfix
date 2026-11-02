import { routeTileCoverage } from "./route-tiles";

self.onmessage = (event: MessageEvent<readonly (readonly number[])[]>) => {
  try {
    self.postMessage({ coverage: routeTileCoverage(event.data) });
  } catch {
    // Fail explicitly rather than publishing a partial/incorrect count.
    self.postMessage({ error: true });
  }
};
