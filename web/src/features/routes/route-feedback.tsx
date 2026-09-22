import { routeSuggestionsMock, type RouteSuggestion, type SuggestionKind } from "./community-mock";
import { useTranslation } from "react-i18next";

const kindStyles: Record<SuggestionKind, { icon: string; iconClass: string; pillClass: string }> = {
  issue: { icon: "!", iconClass: "bg-red-100 text-red-600", pillClass: "bg-red-50 text-red-600" },
  detour: { icon: "↗", iconClass: "bg-emerald-100 text-emerald-700", pillClass: "bg-emerald-50 text-emerald-700" },
  note: { icon: "◆", iconClass: "bg-blue-100 text-blue-700", pillClass: "bg-blue-50 text-blue-700" },
  positive: { icon: "♥", iconClass: "bg-emerald-100 text-emerald-700", pillClass: "bg-emerald-50 text-emerald-700" },
};

export function ShareRouteCard() {
  const { t } = useTranslation();
  return <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-100 p-5">
    <div className="flex gap-4"><div className="text-4xl text-emerald-700">♧</div><div><h2 className="font-bold text-slate-950">{t("feedback.shareTitle")}</h2><p className="mt-2 text-sm leading-5 text-slate-600">{t("feedback.shareText")}</p></div></div>
  </section>;
}

export function RouteFeedbackSidebar({ onAddSuggestion }: { onAddSuggestion: () => void }) {
  const { t } = useTranslation();
  return <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{t("feedback.title")}</h2><span className="whitespace-nowrap text-sm font-semibold text-blue-600">{t("feedback.suggestions", { count: 12 })}</span></div>
    <div className="mt-4 flex flex-wrap gap-1 text-xs font-semibold">
      <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">{t("feedback.all")}&nbsp; <span className="rounded-full bg-blue-100 px-1.5">12</span></button>
      <Filter label={t("feedback.issues")} count="4" /><Filter label={t("feedback.detours")} count="3" /><Filter label={t("feedback.notes")} count="4" />
    </div>
    <label className="mt-4 flex items-center gap-3 text-xs font-semibold">{t("feedback.sortBy")} <select className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium"><option>{t("feedback.routeOrder")}</option></select></label>
    <div className="mt-3 space-y-2">{routeSuggestionsMock.map((suggestion) => <RouteSuggestionCard key={suggestion.id} suggestion={suggestion} />)}</div>
    <button type="button" onClick={onAddSuggestion} className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">{t("feedback.add")}</button>
    <p className="mt-2 text-center text-xs text-slate-500">{t("feedback.noAccountName")}</p>
  </aside>;
}

function Filter({ label, count }: { label: string; count: string }) {
  const { t } = useTranslation(); return <button disabled title={t("feedback.filterSoon", { label })} className="rounded-lg px-2 py-2 text-slate-600 disabled:cursor-not-allowed">{label}&nbsp; <span className="rounded-full bg-slate-100 px-1.5">{count}</span></button>;
}

export function RouteSuggestionCard({ suggestion }: { suggestion: RouteSuggestion }) {
  const style = kindStyles[suggestion.kind];
  const { t, i18n } = useTranslation(); const detail = suggestion.detailKey.startsWith("+") ? suggestion.detailKey : t(suggestion.detailKey); const label = t(`toolbar.${suggestion.kind}`);
  return <article className="rounded-xl border border-slate-200 p-3 shadow-sm">
    <div className="flex gap-3"><div className={`grid size-9 shrink-0 place-items-center rounded-lg text-lg font-black ${style.iconClass}`}>{style.icon}</div><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs"><strong className="text-sm text-slate-800">{suggestion.distance}</strong><span className={`rounded-full px-2 py-1 ${style.pillClass}`}>{label}</span><span className={`rounded-full px-2 py-1 ${style.pillClass}`}>{detail}</span><span className="ml-auto text-lg text-slate-600">›</span></div>
      <p className="mt-1.5 text-xs leading-5 text-slate-700">{suggestion.message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="grid size-5 place-items-center rounded-full bg-slate-500 font-semibold text-white">{suggestion.author[0]}</span><strong className="text-slate-700">{suggestion.author}</strong><span>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(suggestion.date))}</span><span className="ml-auto">♡ {suggestion.likes}</span><span>▢ {suggestion.comments}</span></div>
    </div></div>
  </article>;
}
