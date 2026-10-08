"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api-client";
import { apiErrorKey } from "@/i18n/api-errors";
import type { RouteData } from "@/types/route";
import { getRouteVersions } from "./api";
import { RouteDialog } from "./route-dialog";

export function gpxExportPath(publicId: string, version: number | null, elevation: boolean, filename = ""): string {
  const path = `/api/routes/${encodeURIComponent(publicId)}${version === null ? "" : `/versions/${version}`}/gpx`;
  const query = new URLSearchParams({ elevation: String(elevation) }); if (filename.trim()) query.set("filename", filename.trim());
  return `${path}?${query}`;
}
export function GpxExportDialog({ route, initialVersion, onClose }: { route: RouteData; initialVersion?: number; onClose: () => void }) {
  const { t } = useTranslation(); const [version, setVersion] = useState(initialVersion?.toString() ?? "");
  const [filename, setFilename] = useState(""); const [elevation, setElevation] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const versions = useQuery({ queryKey: ["route-versions", route.publicId, route.currentVersion], queryFn: () => getRouteVersions(route.publicId), staleTime: 0 });
  async function download(original = false) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";
      const path = original ? `/api/routes/${encodeURIComponent(route.publicId)}/gpx/original` : gpxExportPath(route.publicId, version ? Number(version) : null, elevation, filename);
      const response = await fetch(`${base}${path}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new ApiError(response.status, "GPX export failed");
      const bytes = await response.blob(); const url = URL.createObjectURL(bytes); const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      link.download = encoded ? decodeURIComponent(encoded) : disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "route.gpx";
      link.href = url; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(!original && elevation && response.headers.get("X-Elevation-Available") === "false" ? "export.noElevation" : "export.downloaded");
    } catch (caught) { setError(apiErrorKey(caught, "export.failed")); } finally { setBusy(false); }
  }
  return <RouteDialog title={t("export.title")} onClose={onClose} busy={busy}>
    <label className="block text-sm font-bold">{t("export.version")}<select value={version} onChange={event => { setVersion(event.target.value); setNotice(null); }} disabled={busy || versions.isPending || versions.isError} className="mt-1 w-full rounded-lg border p-3"><option value="">{t("export.latest")}</option>{versions.data?.map(item => <option key={item.versionNumber} value={item.versionNumber}>v{item.versionNumber}</option>)}</select></label>
    {versions.isPending && <p role="status" className="mt-2">{t("export.loading")}</p>}
    {versions.isError && <div role="alert" className="mt-2"><p>{t("export.versionsFailed")}</p><button onClick={() => void versions.refetch()} className="route-button">{t("pages.retry")}</button></div>}
    {versions.data?.length === 0 && <p>{t("export.empty")}</p>}
    <label className="mt-4 block text-sm font-bold">{t("export.filename")}<input value={filename} onChange={event => setFilename(event.target.value)} maxLength={160} disabled={busy} placeholder={t("export.defaultFilename")} className="mt-1 w-full rounded-lg border p-3" /></label>
    <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={elevation} onChange={event => setElevation(event.target.checked)} disabled={busy} />{t("export.elevation")}</label><p className="mt-2 text-xs text-slate-600">{t("export.elevationHelp")}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p>}{notice && <p role="status" className="mt-3 text-sm text-emerald-800">{t(notice)}</p>}
    <button disabled={busy || versions.isPending || versions.isError || !versions.data?.length} onClick={() => void download()} className="route-button mt-5 w-full bg-emerald-700 text-white">{t(busy ? "export.downloading" : "info.downloadGpx")}</button>
    {route.originalAvailable && <button disabled={busy} onClick={() => void download(true)} className="route-button mt-2 w-full">{t("export.original")}</button>}
  </RouteDialog>;
}
export function RouteDownload({ route }: { route: RouteData }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="route-button border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800">{t("info.downloadGpx")}</button>{open && <GpxExportDialog route={route} onClose={() => setOpen(false)} />}</>;
}
