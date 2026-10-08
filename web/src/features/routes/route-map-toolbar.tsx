import type { RoutePageMode, SuggestionTool } from "./route-page-state";
import { useTranslation } from "react-i18next";

type Props = { mode: RoutePageMode | "edit"; selectedTool: SuggestionTool; onView: () => void; onSuggest: (tool?: SuggestionTool) => void; onEdit?: () => void; suggestionsEnabled?: boolean };

export function RouteMapToolbar({ mode, selectedTool, onView, onSuggest, onEdit, suggestionsEnabled = true }: Props) {
  const { t } = useTranslation();
  return <div className="border-b border-slate-200 bg-white p-2 sm:p-3">
    <div className={`route-mode-switch grid gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold sm:inline-grid sm:text-sm ${onEdit ? "grid-cols-3" : "grid-cols-2"}`} role="group" aria-label={t("toolbar.mode")}>
      <button type="button" aria-pressed={mode === "view"} onClick={onView} className={`min-h-11 rounded-md px-2 py-2 sm:px-5 ${mode === "view" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>{t("route.viewRoute")}</button>
      {onEdit && <button type="button" aria-pressed={mode === "edit"} onClick={onEdit} className={`min-h-11 rounded-md px-2 py-2 sm:px-5 ${mode === "edit" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>{t("ownerEdit.edit")}</button>}
      <button type="button" disabled={!suggestionsEnabled} aria-pressed={mode === "suggest"} onClick={() => onSuggest()} className={`min-h-11 rounded-md px-2 py-2 sm:px-5 ${mode === "suggest" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>{t("route.suggestChanges")}</button>
    </div>
    {mode === "suggest" && selectedTool && <p className="mt-2 px-1 text-xs text-slate-600">{t("toolbar.suggesting")} <span className="font-semibold">{t(`suggestion.type${selectedTool[0].toUpperCase()}${selectedTool.slice(1)}`)}</span></p>}
  </div>;
}

export function CommunityMarkerLegend() {
  const { t } = useTranslation(); return <div className="sr-only" aria-label={t("toolbar.futureStyles")}>
    <span className="community-marker community-marker-issue">{t("toolbar.issue")}</span>
    <span className="community-marker community-marker-detour">{t("toolbar.detour")}</span>
    <span className="community-marker community-marker-note">{t("toolbar.note")}</span>
    <span className="community-marker community-marker-positive">{t("toolbar.positive")}</span>
  </div>;
}
