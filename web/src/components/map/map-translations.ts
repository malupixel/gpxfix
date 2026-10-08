import type { TFunction } from "i18next";

// MapLibre controls live outside React. Update their labels without rebuilding the map.
export function localizeMapControls(container: HTMLElement, t: TFunction, mapLabel: string) {
  const controls = {
    ".maplibregl-ctrl-zoom-in": "map.zoomIn",
    ".maplibregl-ctrl-zoom-out": "map.zoomOut",
    ".maplibregl-ctrl-compass": "map.resetBearing",
    ".maplibregl-ctrl-attrib-button": "map.attribution",
    ".maplibregl-ctrl-attrib-feedback": "map.feedback",
  };
  for (const [selector, key] of Object.entries(controls)) {
    const control = container.querySelector<HTMLElement>(selector);
    if (control) { control.title = t(key); control.setAttribute("aria-label", t(key)); }
  }
  container.querySelector("canvas")?.setAttribute("aria-label", mapLabel);
}
