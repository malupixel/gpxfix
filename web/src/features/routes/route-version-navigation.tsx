"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { RouteData } from "@/types/route";
import { getRouteVersions } from "./api";
import { publicRoutePath, routeVersionPath } from "./route-links";
import { RouteDialog } from "./route-dialog";
import { GpxExportDialog } from "./gpx-export";

export function RouteVersionNavigation({ route, open, onToggle }: { route: RouteData; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation(); const [exportVersion, setExportVersion] = useState<number | null>(null);
  const query = useQuery({ queryKey: ["route-versions", route.publicId, route.currentVersion], queryFn: () => getRouteVersions(route.publicId), enabled: open, staleTime: 0 });
  const originKeys = { INITIAL_UPLOAD: "versionOrigin.initialUpload", INITIAL_DRAWN: "versionOrigin.initialDrawn", SUGGESTION_MERGE: "versionOrigin.suggestionMerge", OWNER_EDIT: "versionOrigin.ownerEdit" } as const;
  return <>
  {open && <RouteDialog title={t("versions.history")} onClose={onToggle}>
    {(query.isPending ? <p role="status" className="mt-3">{t("export.loading")}</p> : query.isError ? <div role="alert" className="mt-3"><p>{t("export.versionsFailed")}</p><button onClick={() => void query.refetch()} className="route-button">{t("pages.retry")}</button></div> : !query.data.length ? <p>{t("export.empty")}</p> :
    <ol className="mt-3 max-w-xl divide-y rounded-lg border bg-white">{query.data.map(version => <li key={version.versionNumber} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
      <div><Link className="font-bold text-blue-700" onClick={onToggle} href={version.current ? publicRoutePath(route.publicId) : routeVersionPath(route.publicId, version.versionNumber)}>v{version.versionNumber}</Link><span className="ml-2 text-slate-500">{t(originKeys[version.source])}</span>{version.mergedSuggestionPublicId && <span className="ml-2 text-slate-500">{t("versions.suggestion", { id: version.mergedSuggestionPublicId })}</span>}</div>
      <button onClick={() => { onToggle(); setExportVersion(version.versionNumber); }} className="route-button" aria-label={t("export.downloadVersion", { version: version.versionNumber })}>{t("info.download")}</button>
      {version.current && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">{t("versions.current")}</span>}
    </li>)}</ol>)}
  </RouteDialog>}
    {exportVersion !== null && <GpxExportDialog route={route} initialVersion={exportVersion} onClose={() => setExportVersion(null)} />}
  </>;
}
