import type { RouteData } from "@/types/route";
import { recentActivityMock } from "./community-mock";
import { formatRouteDate } from "./route-format";
import { useTranslation } from "react-i18next";

export function RouteInformation({ route }: { route: RouteData }) {
  return <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]"><RouteDetails route={route} /><RecentActivity /><RouteDownload /></div>;
}

function RouteDetails({ route }: { route: RouteData }) {
  const { t, i18n } = useTranslation(); return <section className="route-card p-4"><h2 className="text-lg font-bold">{t("route.details")}</h2><dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
    <Detail label={t("route.distance")} value={`${(route.distanceMeters / 1000).toFixed(1)} km`} />
    {route.elevationGainMeters !== null && <Detail label={t("route.elevationGain")} value={`${Math.round(route.elevationGainMeters)} m`} />}
    <Detail label={t("route.uploadedFile")} value={route.originalFilename} accent />
    <Detail label={t("route.created")} value={formatRouteDate(route.createdAt, i18n.language)} />
  </dl></section>;
}

function Detail({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="grid grid-cols-[24px_auto] gap-x-2"><span className="row-span-2 text-slate-500">◇</span><dt className="text-xs text-slate-500">{label}</dt><dd className={`min-w-0 break-words text-sm font-semibold ${accent ? "text-blue-600" : "text-slate-800"}`}>{value}</dd></div>;
}

function RecentActivity() {
  const { t } = useTranslation(); return <section className="route-card p-4"><div className="flex justify-between gap-3"><h2 className="text-lg font-bold">{t("info.recentActivity")}</h2><button disabled title={t("info.historySoon")} className="text-xs font-semibold text-blue-600 disabled:cursor-not-allowed">{t("info.viewAll")}</button></div><div className="mt-4 space-y-3">{recentActivityMock.map((item) => <div key={item.id} className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs">{item.kind === "issue" ? "!" : item.kind === "detour" ? "↗" : item.kind === "positive" ? "♥" : "◆"}</span><p className="text-xs leading-4"><strong className="text-slate-800">{t(`activity.${item.kind}`, { name: item.name })}</strong><br /><span className="text-slate-500">{item.distance} · {t(item.ageKey)}</span></p></div>)}</div></section>;
}

function RouteDownload() {
  const { t } = useTranslation(); return <section className="route-card p-4"><h2 className="text-lg font-bold">{t("info.download")}</h2><button disabled title={t("info.downloadSoon")} className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60">{t("info.downloadGpx")}</button><button disabled title={t("info.originalSoon")} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60">{t("info.viewOriginal")}</button><p className="mt-4 text-xs leading-5 text-slate-500">{t("info.unchanged")}</p></section>;
}
