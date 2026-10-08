"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RouteData } from "@/types/route";
import { RouteMoreMenu } from "./route-more-menu";
import { RouteVersionNavigation } from "./route-version-navigation";
import { RouteDownload } from "./gpx-export";
import { RouteShareDialog } from "./route-share-dialog";
import { elevationSummary } from "./elevation-profile-data";
import { routeVersionPath, publicRoutePath } from "./route-links";
import Link from "next/link";

type Props = { route: RouteData; isOwner: boolean };

export function RouteHeader({ route, isOwner }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false), [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState(false);
  const { t, i18n } = useTranslation();
  const elevation = elevationSummary(route.elevationProfile);
  const format = (value: number, digits = 0) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value);
  async function copyVersion() {
    setCopyError(false);
    try { await navigator.clipboard.writeText(new URL(routeVersionPath(route.publicId, route.viewedVersion), window.location.origin).toString()); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopyError(true); setShareOpen(true); }
  }
  return <header className="mb-5">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5 text-slate-600"><span aria-hidden="true" className={`size-1.5 rounded-full ${route.suggestionsEnabled ? "bg-emerald-600" : "bg-slate-400"}`} />{t(route.suggestionsEnabled ? "route.openSuggestions" : "routeMetadata.closed")}</span>
          {isOwner && <span className="border-l border-slate-300 pl-3 text-amber-800">{t("route.ownerMode")}</span>}
        </div>
        <div className="flex items-start gap-3">
          <h1 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">{route.name}</h1>
          <button onClick={() => setHistoryOpen(true)} aria-label={t("routeUi.versionLabel", { version: route.viewedVersion })} className="route-button mt-0.5 shrink-0 bg-white text-slate-700">v{route.viewedVersion} <span aria-hidden="true">▾</span></button>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
          <Metric label={t("route.distance")} value={`${format(route.distanceMeters / 1000, 1)} km`} />
          {elevation && <Metric label={t("routeMetadata.gain")} value={`${format(elevation.gainMeters)} m`} />}
        </dl>
      </div>
      <div className="route-header-actions grid grid-cols-[1fr_1fr_auto] items-center gap-2 lg:shrink-0">
        <button onClick={() => setShareOpen(true)} className="route-button bg-white hover:bg-slate-50">{t("route.share")}</button>
        <RouteDownload route={route} />
        <RouteMoreMenu route={route} isOwner={isOwner} onHistory={() => setHistoryOpen(true)} onCopy={() => void copyVersion()} />
      </div>
    </div>
    {!route.isCurrentVersion && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>{t("versions.historical")}</span><Link className="font-semibold underline" href={publicRoutePath(route.publicId)}>{t("versions.goCurrent", { version: route.currentVersion })}</Link></div>}
    {copied && <p role="status" className="mt-2 text-sm text-emerald-800">{t("common.copied")}</p>}
    {copyError && <p role="alert" className="mt-2 text-sm text-red-700">{t("management.copyFailed")}</p>}
    <RouteVersionNavigation route={route} open={historyOpen} onToggle={() => setHistoryOpen(false)} />
    {shareOpen && <RouteShareDialog route={route} onClose={() => setShareOpen(false)} />}
  </header>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</dd></div>;
}
