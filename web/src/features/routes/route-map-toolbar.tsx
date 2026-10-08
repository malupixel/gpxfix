import type { RoutePageMode, SuggestionTool } from "./route-page-state";
import { useTranslation } from "react-i18next";

type Props = {
  mode: RoutePageMode;
  selectedTool: SuggestionTool;
  onView: () => void;
  onSuggest: (tool?: SuggestionTool) => void;
  onEdit?: () => void;
  suggestionsEnabled?: boolean;
};

export function RouteMapToolbar({ mode, selectedTool, onView, onSuggest, onEdit, suggestionsEnabled = true }: Props) {
  const { t } = useTranslation();
  return <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 p-1 sm:flex-row sm:items-center sm:justify-between">
    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:flex" role="tablist" aria-label={t("toolbar.mode")}>
      <button type="button" role="tab" aria-selected={mode === "view"} onClick={onView} className={`rounded-md px-5 py-2 ${mode === "view" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{t("route.viewRoute")}</button>
      {onEdit && <button type="button" onClick={onEdit} className="rounded-md px-5 py-2 text-emerald-700">{t("ownerEdit.edit")}</button>}
      <button type="button" role="tab" disabled={!suggestionsEnabled} aria-selected={mode === "suggest"} onClick={() => onSuggest()} className={`rounded-md px-5 py-2 ${mode === "suggest" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{t("route.suggestChanges")}</button>
    </div>
    {mode === "view" ? <div className="grid grid-cols-3 gap-2 text-xs font-semibold sm:flex sm:text-sm">
      <ToolbarAction icon="●" label={t("toolbar.addNote")} tone="blue" disabled={!suggestionsEnabled} onClick={() => onSuggest("note")} />
      <ToolbarAction icon="△" label={t("toolbar.flagSection")} tone="red" disabled={!suggestionsEnabled} onClick={() => onSuggest("issue")} />
      <ToolbarAction icon="✎" label={t("suggestion.suggestDetour")} tone="green" disabled={!suggestionsEnabled} onClick={() => onSuggest("detour")} />
    </div> : <SuggestionToolStatus selectedTool={selectedTool} />}
  </div>;
}

function ToolbarAction({ icon, label, tone, onClick, disabled }: { icon: string; label: string; tone: "blue" | "red" | "green"; onClick: () => void; disabled?: boolean }) {
  const tones = { blue: "text-blue-700", red: "text-red-600", green: "text-emerald-700" };
  return <button type="button" disabled={disabled} onClick={onClick} className="route-button min-h-10 bg-white hover:bg-slate-50"><span className={tones[tone]}>{icon}</span> {label}</button>;
}

function SuggestionToolStatus({ selectedTool }: Pick<Props, "selectedTool">) {
  const { t } = useTranslation();
  return <div className="px-3 py-2 text-xs font-semibold text-slate-600 sm:text-sm"><span>{t("toolbar.suggesting")}</span>{selectedTool && <span className="ml-1 text-blue-700">{t(`suggestion.type${selectedTool[0].toUpperCase()}${selectedTool.slice(1)}`)}</span>}</div>;
}

export function CommunityMarkerLegend() {
  const { t } = useTranslation(); return <div className="sr-only" aria-label={t("toolbar.futureStyles")}>
    <span className="community-marker community-marker-issue">{t("toolbar.issue")}</span>
    <span className="community-marker community-marker-detour">{t("toolbar.detour")}</span>
    <span className="community-marker community-marker-note">{t("toolbar.note")}</span>
    <span className="community-marker community-marker-positive">{t("toolbar.positive")}</span>
  </div>;
}
