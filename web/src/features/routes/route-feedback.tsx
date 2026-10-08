import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { RouteSuggestion, SuggestionType } from "@/types/route";
import { SuggestionDetail } from "./route-suggestion-detail";
import { filterSuggestions, type SuggestionStatusFilter } from "./suggestion-filters";

const typeKeys: Record<SuggestionType, string> = { PROBLEM: "suggestion.typeIssue", DETOUR: "suggestion.typeDetour", NOTE: "suggestion.typeNote" };
const typeStyles: Record<SuggestionType, { icon: string; color: string }> = { PROBLEM: { icon: "!", color: "bg-red-50 text-red-700" }, DETOUR: { icon: "↗", color: "bg-emerald-50 text-emerald-700" }, NOTE: { icon: "◆", color: "bg-blue-50 text-blue-700" } };
export type FeedbackProps = { routeId: string; currentVersion: number; isOwner: boolean; readOnly: boolean; suggestionsEnabled?: boolean; suggestions: RouteSuggestion[]; onSuggestionsChange: Dispatch<SetStateAction<RouteSuggestion[]>>; loading: boolean; error?: boolean; onRetry?: () => void; selectedId: string | null; onSelect: (s: RouteSuggestion) => void; onAddSuggestion: () => void };

export function RouteFeedbackSidebar(p: FeedbackProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SuggestionStatusFilter>("ALL"), [type, setType] = useState<SuggestionType | null>(null);
  const selected = p.suggestions.find(item => item.publicId === p.selectedId);
  const visible = filterSuggestions(p.suggestions, p.isOwner, status, type);
  const pending = p.isOwner ? p.suggestions.filter(item => item.moderationStatus === "PENDING").length : 0;
  if (selected) return <SuggestionDetail {...p} suggestion={selected} onBack={() => p.onSelect({ ...selected, publicId: "" })} />;
  return <aside className="route-card p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{t("routeUi.suggestions")}</h2>{pending > 0 && <button onClick={() => setStatus("PENDING")} className="route-text-action text-xs font-semibold text-amber-800">{t("routeUi.needsAttention", { count: pending })}</button>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-500">{t("routeUi.statusFilter")}<select value={status} onChange={event => setStatus(event.target.value as SuggestionStatusFilter)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800">
        <option value="ALL">{t("feedback.all")}</option>{p.isOwner && <option value="PENDING">{t("routeUi.pending")}</option>}<option value="PUBLISHED">{t("routeUi.published")}</option><option value="MERGED">{t("routeUi.merged")}</option>{p.isOwner && <option value="REJECTED">{t("routeUi.rejected")}</option>}
      </select></label>
      <label className="text-xs text-slate-500">{t("routeUi.typeFilter")}<select value={type ?? ""} onChange={event => setType(event.target.value ? event.target.value as SuggestionType : null)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"><option value="">{t("feedback.all")}</option>{(["PROBLEM", "DETOUR", "NOTE"] as SuggestionType[]).map(value => <option key={value} value={value}>{t(typeKeys[value])}</option>)}</select></label>
    </div>
    <div tabIndex={0} role="region" aria-label={t("routeUi.suggestions")} className="mt-4 max-h-[420px] space-y-2 overflow-y-auto sm:max-h-[530px]">
      {p.loading ? <p role="status" className="py-6 text-sm text-slate-500">{t("persistence.loading")}</p> : p.error ? <div role="alert" className="py-4 text-sm text-red-700"><p>{t("routeUi.suggestionsFailed")}</p><button onClick={p.onRetry} className="route-button mt-3">{t("pages.retry")}</button></div> : visible.length ? visible.map(item => <SuggestionCard key={item.publicId} value={item} onClick={() => p.onSelect(item)} />) : <p className="rounded-lg bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">{t(p.suggestions.length ? "routeUi.noMatches" : "routeUi.emptySuggestions")}</p>}
    </div>
    <button disabled={p.suggestionsEnabled === false} onClick={p.onAddSuggestion} className="route-button mt-4 w-full bg-white text-emerald-700 hover:bg-emerald-50">{p.readOnly ? t("versions.suggestCurrent") : t("feedback.add")}</button>
  </aside>;
}
function SuggestionCard({ value, onClick }: { value: RouteSuggestion; onClick: () => void }) {
  const { i18n, t } = useTranslation();
  const style = typeStyles[value.type];
  const status = value.integrationStatus === "MERGED" ? "merged" : value.moderationStatus.toLowerCase();
  return <button onClick={onClick} className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
    <div className="flex gap-3"><span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-lg font-bold ${style.color}`}>{style.icon}</span><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs"><span className="font-semibold text-slate-700">{t(typeKeys[value.type])}</span><span className={status === "pending" ? "font-medium text-amber-800" : "text-slate-500"}>{t(`routeUi.${status}`)}</span></div>
      <p className="mt-1 text-xs text-slate-500">km {(value.start.distanceMeters / 1000).toFixed(1)}{value.end && `–${(value.end.distanceMeters / 1000).toFixed(1)}`} · v{value.baseVersionNumber}</p>
      <p className="mt-2 line-clamp-2 break-words text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{value.description}</p>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><time dateTime={value.createdAt}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(value.createdAt))}</time>{value.commentCount > 0 && <span>{t("routeUi.commentsCount", { count: value.commentCount })}</span>}</div>
    </div></div>
  </button>;
}
