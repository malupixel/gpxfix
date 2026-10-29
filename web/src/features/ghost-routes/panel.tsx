"use client";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { COLORS, MAX_GHOSTS } from "./model";
import { readGhostFile } from "./gpx";
import { useGhostRoutes } from "./provider";
export function GhostRoutesPanel({ align = "right" }: { align?: "left" | "right" }) {
  const { t } = useTranslation();
  const { state, update, zoom, closeComparison } = useGhostRoutes();
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const entries = [...state.routes, ...(state.comparison ?? [])];
  async function importFiles(files: File[]) {
    setBusy(true); const failures: string[] = [];
    // Read sequentially to bound transient XML memory. Successful files survive partial failures.
    for (const file of files.slice(0, MAX_GHOSTS)) {
      try {
        const geometry = await readGhostFile(file);
        update({ type: "add", route: { id: crypto.randomUUID(), name: file.name, source: "gpx", geometry, visible: true, color: COLORS[(state.routes.length + files.indexOf(file)) % COLORS.length] } });
      } catch (error) { failures.push(`${file.name}: ${t(error instanceof Error && error.message.startsWith("ghost.") ? error.message : "ghost.readFailed")}`); }
    }
    if (files.length > MAX_GHOSTS) failures.push(t("ghost.limit"));
    setErrors(failures); setBusy(false);
  }
  return <details className="rounded-md border border-slate-200 bg-white/95 text-xs text-slate-700 shadow-sm">
    <summary className="cursor-pointer px-3 py-3 font-semibold">{t("ghost.title")} ({entries.length})</summary>
    <div className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full z-30 mt-1 max-h-[min(55dvh,400px)] w-72 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto rounded-lg border bg-white p-3 shadow-xl`}>
      <input ref={input} type="file" accept=".gpx,application/gpx+xml" multiple hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importFiles(files); }} />
      <button type="button" disabled={busy} className="route-button w-full" onClick={() => input.current?.click()}>{t(busy ? "ghost.loading" : "ghost.addGpx")}</button>
      <p className="text-slate-500">{t("ghost.localOnly")}</p>
      {errors.length > 0 && <div role="alert" className="break-words text-red-700">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
      {!entries.length && <p>{t("ghost.empty")}</p>}
      <ul className="space-y-3">{entries.map(route => <li key={route.id} className="space-y-1 border-t pt-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={route.visible} onChange={() => update({ type: "toggle", id: route.id })} aria-label={t(route.visible ? "ghost.hide" : "ghost.show", { name: route.name })} /><span className="size-3 shrink-0 rounded-full" style={{ background: route.color }} /><span className="min-w-0 break-words font-semibold">{route.role ? `${route.role}: ` : ""}{route.name}</span></label>
        <p className="text-slate-500">{t(route.source === "gpx" ? "ghost.gpx" : "ghost.version")}{route.role && ` · ${t(route.role === "A" ? "ghost.primary" : "ghost.secondary")}`}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="route-button" onClick={() => zoom([route])}>{t("ghost.zoom")}</button><button type="button" className="route-button" onClick={() => route.role ? closeComparison() : update({ type: "remove", id: route.id })}>{t("ghost.remove")}</button></div>
      </li>)}</ul>
      {state.comparison && <button type="button" className="route-button w-full" onClick={closeComparison}>{t("ghost.closeComparison")}</button>}
    </div>
  </details>;
}
