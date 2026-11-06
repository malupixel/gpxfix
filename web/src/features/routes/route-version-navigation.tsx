"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { RouteData } from "@/types/route";
import { useGhostRoutes } from "@/features/ghost-routes/provider";
import { getRouteVersions } from "./api";
import { publicRoutePath, routeVersionPath } from "./route-links";
import { RouteDialog } from "./route-dialog";
import { VersionActions } from "./version-actions";
import { VersionCreateDialog, type VersionAction } from "./version-create-dialog";
import type { RouteVersionSummary } from "@/types/route";
import { GpxExportDialog } from "./gpx-export";

export function RouteVersionNavigation({ route, isOwner = false, open, onToggle }: { route: RouteData; isOwner?: boolean; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation(); const [exportVersion, setExportVersion] = useState<number | null>(null);
  const [action, setAction] = useState<{ kind: VersionAction; version: RouteVersionSummary } | null>(null);
  const { showVersion, compare, state: ghostState } = useGhostRoutes();
  const [pending, setPending] = useState<number | "compare" | null>(null);
  const [ghostError, setGhostError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [primary, setPrimary] = useState(route.viewedVersion);
  const [secondary, setSecondary] = useState(route.viewedVersion === 1 ? route.currentVersion : 1);
  async function showGhost(version: number) {
    setPending(version); setGhostError(null);
    try { await showVersion(route.publicId, version); onToggle(); }
    catch (error) { setGhostError(error instanceof Error && error.message.startsWith("ghost.") ? error.message : "ghost.versionFailed"); }
    finally { setPending(null); }
  }
  async function startComparison() {
    setPending("compare"); setGhostError(null);
    try { await compare(route.publicId, primary, secondary); onToggle(); }
    catch (error) { setGhostError(error instanceof Error && error.message.startsWith("ghost.") ? error.message : "ghost.versionFailed"); }
    finally { setPending(null); }
  }
  const query = useQuery({ queryKey: ["route-versions", route.publicId, route.branchId, route.currentVersion], queryFn: () => getRouteVersions(route.publicId), enabled: open, staleTime: 0 });
  const originKeys = { INITIAL_COPY: "branches.copiedOrigin", INITIAL_UPLOAD: "versionOrigin.initialUpload", INITIAL_DRAWN: "versionOrigin.initialDrawn", SUGGESTION_MERGE: "versionOrigin.suggestionMerge", OWNER_EDIT: "versionOrigin.ownerEdit" } as const;
  return <>
  {open && <RouteDialog title={t("versions.history")} onClose={onToggle}>
    <button type="button" className="route-button mt-3" onClick={() => setCompareOpen(value => !value)} aria-expanded={compareOpen}>{t("ghost.compare")}</button>
    {compareOpen && query.data && <div className="mt-3 space-y-3 rounded-lg border p-3">
      <p className="text-sm text-slate-600">{t("ghost.compareHelp")}</p>
      {[{ label: "ghost.primary", value: primary, set: setPrimary }, { label: "ghost.secondary", value: secondary, set: setSecondary }].map(field => <label key={field.label} className="block text-sm font-semibold">{t(field.label)}<select className="ml-2 rounded border p-2" value={field.value} onChange={event => field.set(Number(event.target.value))}>{query.data.map(version => <option key={version.versionNumber} value={version.versionNumber}>v{version.versionNumber}</option>)}</select></label>)}
      <button type="button" className="route-button" disabled={pending !== null || primary === secondary} onClick={() => void startComparison()}>{t(pending === "compare" ? "ghost.loading" : "ghost.compare")}</button>
    </div>}
    {ghostError && <p role="alert" className="mt-3 text-sm text-red-700">{t(ghostError)}</p>}
    {pending !== null && <p role="status" className="mt-2 text-sm">{t("ghost.loading")}</p>}
    {(query.isPending ? <p role="status" className="mt-3">{t("export.loading")}</p> : query.isError ? <div role="alert" className="mt-3"><p>{t("export.versionsFailed")}</p><button onClick={() => void query.refetch()} className="route-button">{t("pages.retry")}</button></div> : !query.data.length ? <p>{t("export.empty")}</p> :
    <ol className="mt-3 max-w-xl divide-y rounded-lg border bg-white">{query.data.map(version => <li key={version.versionNumber} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div className="min-w-0 break-words"><Link className="font-bold text-blue-700" onClick={onToggle} href={version.current ? publicRoutePath(route.publicId, route.branchId) : routeVersionPath(route.publicId, version.versionNumber, route.branchId)}>v{version.versionNumber}</Link>{version.label && <span className="ml-2 font-semibold">{version.label}</span>}<span className="ml-2 text-slate-500">{t(originKeys[version.source])}</span>{version.mergedSuggestionPublicId && <span className="ml-2 text-slate-500">{t("versions.suggestion", { id: version.mergedSuggestionPublicId })}</span>}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {version.current && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">{t("versions.current")}</span>}
        <VersionActions label={t("branches.actions", { version: version.versionNumber })}>
          <button role="menuitem" type="button" disabled={pending !== null} className="route-menu-action" onClick={() => void showGhost(version.versionNumber)}>{t(ghostState.routes.some(item => item.version?.number === version.versionNumber && item.version.publicId === route.publicId) ? "ghost.showOnMap" : "ghost.showAsGhost")}</button>
          <button role="menuitem" onClick={() => { onToggle(); setExportVersion(version.versionNumber); }} className="route-menu-action">{t("info.downloadGpx")}</button>
          <hr className="my-2" />
          {isOwner && <button role="menuitem" className="route-menu-action" onClick={() => { onToggle(); setAction({ kind: "branch", version }); }}>{t("branches.branch")}</button>}
          <button role="menuitem" className="route-menu-action" onClick={() => { onToggle(); setAction({ kind: "copy", version }); }}>{t("branches.copy")}</button>
          {isOwner && <button role="menuitem" className="route-menu-action" onClick={() => { onToggle(); setAction({ kind: "label", version }); }}>{t("branches.label")}</button>}
        </VersionActions>
      </div>
    </li>)}</ol>)}
  </RouteDialog>}
    {action && <VersionCreateDialog route={route} version={action.version} action={action.kind} onClose={() => setAction(null)} />}
    {exportVersion !== null && <GpxExportDialog route={route} initialVersion={exportVersion} onClose={() => setExportVersion(null)} />}
  </>;
}
