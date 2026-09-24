import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RouteSuggestion, SuggestionType } from "@/types/route";

const kindStyles: Record<SuggestionType, { icon: string; iconClass: string; pillClass: string }> = {
  PROBLEM: { icon: "!", iconClass: "bg-red-100 text-red-600", pillClass: "bg-red-50 text-red-600" },
  DETOUR: { icon: "↗", iconClass: "bg-emerald-100 text-emerald-700", pillClass: "bg-emerald-50 text-emerald-700" },
  NOTE: { icon: "◆", iconClass: "bg-blue-100 text-blue-700", pillClass: "bg-blue-50 text-blue-700" },
};

export function ShareRouteCard() {
  const { t } = useTranslation();
  return <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-100 p-5">
    <div className="flex gap-4"><div className="text-4xl text-emerald-700">♧</div><div><h2 className="font-bold text-slate-950">{t("feedback.shareTitle")}</h2><p className="mt-2 text-sm leading-5 text-slate-600">{t("feedback.shareText")}</p></div></div>
  </section>;
}

export function RouteFeedbackSidebar({ suggestions, loading, selectedId, onSelect, onAddSuggestion }: { suggestions: RouteSuggestion[]; loading: boolean; selectedId: string | null; onSelect: (suggestion: RouteSuggestion) => void; onAddSuggestion: () => void }) {
  const { t } = useTranslation(); const [filter,setFilter]=useState<SuggestionType|null>(null);
  const counts=(type:SuggestionType)=>suggestions.filter(item=>item.type===type).length;
  const visible=useMemo(()=>filter?suggestions.filter(item=>item.type===filter):suggestions,[filter,suggestions]);
  return <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{t("feedback.title")}</h2><span className="whitespace-nowrap text-sm font-semibold text-blue-600">{t("feedback.suggestions", { count: suggestions.length })}</span></div>
    <div className="mt-4 flex flex-wrap gap-1 text-xs font-semibold">
      <Filter active={filter===null} label={t("feedback.all")} count={suggestions.length} onClick={()=>setFilter(null)} />
      <Filter active={filter==="PROBLEM"} label={t("feedback.issues")} count={counts("PROBLEM")} onClick={()=>setFilter("PROBLEM")} />
      <Filter active={filter==="DETOUR"} label={t("feedback.detours")} count={counts("DETOUR")} onClick={()=>setFilter("DETOUR")} />
      <Filter active={filter==="NOTE"} label={t("feedback.notes")} count={counts("NOTE")} onClick={()=>setFilter("NOTE")} />
    </div>
    <label className="mt-4 flex items-center gap-3 text-xs font-semibold">{t("feedback.sortBy")} <select disabled className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium"><option>{t("feedback.routeOrder")}</option></select></label>
    <div className="mt-3 space-y-2" aria-live="polite">
      {loading&&<p className="py-5 text-center text-sm text-slate-500">{t("persistence.loading")}</p>}
      {!loading&&!visible.length&&<p className="py-5 text-center text-sm text-slate-500">{t("persistence.empty")}</p>}
      {visible.map(suggestion=><RouteSuggestionCard key={suggestion.publicId} suggestion={suggestion} selected={selectedId===suggestion.publicId} onClick={()=>onSelect(suggestion)} />)}
    </div>
    <button type="button" onClick={onAddSuggestion} className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">{t("feedback.add")}</button>
    <p className="mt-2 text-center text-xs text-slate-500">{t("feedback.noAccountName")}</p>
  </aside>;
}

function Filter({label,count,active,onClick}:{label:string;count:number;active:boolean;onClick:()=>void}){return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-lg px-2 py-2 ${active?"border border-blue-200 bg-blue-50 text-blue-700":"text-slate-600 hover:bg-slate-50"}`}>{label}&nbsp; <span className={`rounded-full px-1.5 ${active?"bg-blue-100":"bg-slate-100"}`}>{count}</span></button>}

function RouteSuggestionCard({suggestion,selected,onClick}:{suggestion:RouteSuggestion;selected:boolean;onClick:()=>void}){
  const style=kindStyles[suggestion.type]; const {t,i18n}=useTranslation(); const distance=suggestion.end?`km ${(suggestion.start.distanceMeters/1000).toFixed(1)} – ${(suggestion.end.distanceMeters/1000).toFixed(1)}`:`km ${(suggestion.start.distanceMeters/1000).toFixed(1)}`;
  const detail=suggestion.category?t(`options.${suggestion.category}`):suggestion.tags.length?suggestion.tags.map(tag=>t(`options.${tag}`)).join(", "):t("persistence.pending");
  const typeKey=`suggestion.type${suggestion.type[0]+suggestion.type.slice(1).toLowerCase()}`;
  return <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3 text-left shadow-sm ${selected?"border-blue-500 ring-2 ring-blue-100":"border-slate-200 hover:border-slate-300"}`}>
    <div className="flex gap-3"><div className={`grid size-9 shrink-0 place-items-center rounded-lg text-lg font-black ${style.iconClass}`}>{style.icon}</div><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs"><strong className="text-sm text-slate-800">{distance}</strong><span className={`rounded-full px-2 py-1 ${style.pillClass}`}>{t(typeKey)}</span><span className={`max-w-full truncate rounded-full px-2 py-1 ${style.pillClass}`}>{detail}</span><span className="ml-auto text-lg text-slate-600">›</span></div>
      <p className="mt-1.5 text-xs leading-5 text-slate-700">{suggestion.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="grid size-5 place-items-center rounded-full bg-slate-500 font-semibold text-white">{suggestion.authorName[0]}</span><strong className="text-slate-700">{suggestion.authorName}</strong><span>{new Intl.DateTimeFormat(i18n.language,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(suggestion.createdAt))}</span></div>
    </div></div>
  </button>;
}
