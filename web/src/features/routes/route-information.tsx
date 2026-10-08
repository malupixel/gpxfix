import { useState } from "react";
import type { RouteData } from "@/types/route";
import { formatRouteDate } from "./route-format";
import { useTranslation } from "react-i18next";
import { areRouteEndpointsClose } from "./route-geometry";
import { RouteActivityCard } from "./route-activity";
import { RouteManagementDialog } from "./route-management-dialogs";

export function RouteInformation({ route, isOwner }: { route: RouteData; isOwner: boolean }) {
  return <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]"><RouteDetails route={route} isOwner={isOwner} /><RouteActivityCard routeId={route.publicId} isOwner={isOwner} /></div>;
}
function RouteDetails({ route, isOwner }: { route: RouteData; isOwner: boolean }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  return <section id="route-details" tabIndex={-1} className="route-card p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">{t("route.details")}</h2>{isOwner && <button onClick={() => setEditing(true)} className="route-text-action text-right text-sm font-semibold text-emerald-700">{t("management.editInformation")}</button>}</div>
    <p className={`mt-4 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere] ${route.description ? "text-slate-700" : "text-slate-500"}`}>{route.description || t("routeUi.noDescription")}</p>
    <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-slate-100 pt-5">
      <Detail label={t("route.created")} value={formatRouteDate(route.createdAt, i18n.language)} />
      <Detail label={t("routeMetadata.modified")} value={formatRouteDate(route.updatedAt, i18n.language)} />
      <Detail label={t("routeMetadata.viewedVersion")} value={`v${route.viewedVersion}`} />
      <Detail label={t("versions.current")} value={`v${route.currentVersion}`} />
      <Detail label={t("routeMetadata.versionCount")} value={String(route.versionCount)} />
      <Detail label={t("routeMetadata.type")} value={t(areRouteEndpointsClose(route.geometry.coordinates) ? "routeMetadata.loop" : "routeMetadata.pointToPoint")} />
      <Detail label={t("routeMetadata.source")} value={t(route.creationSource === "INITIAL_UPLOAD" ? "versionOrigin.initialUpload" : "versionOrigin.initialDrawn")} />
      <Detail label={t("routeMetadata.suggestions")} value={t(route.suggestionsEnabled ? "route.openSuggestions" : "routeMetadata.closed")} />
      {route.creationSource === "INITIAL_UPLOAD" && route.originalFilename && <Detail label={t("route.uploadedFile")} value={route.originalFilename} />}
    </dl>
    {editing && <RouteManagementDialog route={route} action="information" onClose={() => setEditing(false)} />}
  </section>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{value}</dd></div>;
}
