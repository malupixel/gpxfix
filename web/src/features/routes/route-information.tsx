import type { RouteData } from "@/types/route";
import { formatRouteDate } from "./route-format";
import { useTranslation } from "react-i18next";
import { areRouteEndpointsClose } from "./route-geometry";
import { elevationSummary } from "./elevation-profile-data";
import { RouteActivityCard } from "./route-activity";
import { RouteDownload } from "./gpx-export";

export function RouteInformation({ route, isOwner }: { route: RouteData; isOwner: boolean }) {
  return <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]"><RouteDetails route={route} /><RouteActivityCard routeId={route.publicId} isOwner={isOwner} /><RouteDownload route={route} /></div>;
}
function RouteDetails({ route }: { route: RouteData }) {
  const { t, i18n } = useTranslation(); const heights = elevationSummary(route.elevationProfile);
  const meters = (value: number) => `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value)} m`;
  return <section id="route-details" tabIndex={-1} className="route-card p-4"><h2 className="text-lg font-bold">{t("route.details")}</h2><dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
    <Detail label={t("upload.routeName")} value={route.name} />
    <Detail label={t("common.description")} value={route.description ?? t("routeMetadata.noDescription")} />
    <Detail label={t("route.distance")} value={`${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(route.distanceMeters / 1000)} km`} />
    {!heights && <Detail label={t("elevation.title")} value={t("elevation.noData")} />}
    {heights && <><Detail label={t("routeMetadata.gain")} value={meters(heights.gainMeters)} /><Detail label={t("routeMetadata.loss")} value={meters(heights.lossMeters)} /><Detail label={t("routeMetadata.minElevation")} value={meters(heights.minMeters)} /><Detail label={t("routeMetadata.maxElevation")} value={meters(heights.maxMeters)} /></>}
    <Detail label={t("route.created")} value={formatRouteDate(route.createdAt, i18n.language)} />
    <Detail label={t("routeMetadata.modified")} value={formatRouteDate(route.updatedAt, i18n.language)} />
    <Detail label={t("routeMetadata.viewedVersion")} value={`v${route.viewedVersion}`} />
    <Detail label={t("versions.current")} value={`v${route.currentVersion}`} />
    <Detail label={t("routeMetadata.versionCount")} value={String(route.versionCount)} />
    <Detail label={t("routeMetadata.type")} value={t(areRouteEndpointsClose(route.geometry.coordinates) ? "routeMetadata.loop" : "routeMetadata.pointToPoint")} />
    {route.creationSource === "INITIAL_UPLOAD" && route.originalFilename && <Detail label={t("route.uploadedFile")} value={route.originalFilename} />}
    <Detail label={t("routeMetadata.source")} value={t(route.creationSource === "INITIAL_UPLOAD" ? "versionOrigin.initialUpload" : "versionOrigin.initialDrawn")} />
    <Detail label={t("routeMetadata.suggestions")} value={t(route.suggestionsEnabled ? "route.openSuggestions" : "routeMetadata.closed")} />
  </dl></section>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words whitespace-pre-wrap text-sm font-semibold text-slate-800">{value}</dd></div>;
}
