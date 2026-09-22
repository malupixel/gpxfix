import type { RoutePageMode, SuggestionTool } from "./route-page-state";
import { useTranslation } from "react-i18next";

type Props = {
  mode: RoutePageMode;
  selectedTool: SuggestionTool;
  onView: () => void;
  onSuggest: (tool?: SuggestionTool) => void;
  onSelectTool: (tool: Exclude<SuggestionTool, null>) => void;
};

export function RouteMapToolbar({ mode, selectedTool, onView, onSuggest, onSelectTool }: Props) {
  const { t } = useTranslation();
  return <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 p-1 sm:flex-row sm:items-center sm:justify-between">
    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:flex" role="tablist" aria-label={t("toolbar.mode")}>
      <button type="button" role="tab" aria-selected={mode === "view"} onClick={onView} className={`rounded-md px-5 py-2 ${mode === "view" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{t("route.viewRoute")}</button>
      <button type="button" role="tab" aria-selected={mode === "suggest"} onClick={() => onSuggest()} className={`rounded-md px-5 py-2 ${mode === "suggest" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{t("route.suggestChanges")}</button>
    </div>
    {mode === "view" ? <div className="grid grid-cols-3 gap-2 text-xs font-semibold sm:flex sm:text-sm">
      <ToolbarAction icon="●" label={t("toolbar.addNote")} tone="blue" onClick={() => onSuggest("note")} />
      <ToolbarAction icon="△" label={t("toolbar.flagSection")} tone="red" onClick={() => onSuggest("issue")} />
      <ToolbarAction icon="✎" label={t("toolbar.editRoute")} tone="green" onClick={() => onSuggest("detour")} />
    </div> : <SuggestionToolStatus selectedTool={selectedTool} onSelectTool={onSelectTool} />}
  </div>;
}

function ToolbarAction({ icon, label, tone, onClick }: { icon: string; label: string; tone: "blue" | "red" | "green"; onClick: () => void }) {
  const tones = { blue: "text-blue-700", red: "text-red-600", green: "text-emerald-700" };
  return <button type="button" onClick={onClick} className="route-button min-h-10 bg-white hover:bg-slate-50"><span className={tones[tone]}>{icon}</span> {label}</button>;
}

function SuggestionToolStatus({ selectedTool, onSelectTool }: Pick<Props, "selectedTool" | "onSelectTool">) {
  const { t } = useTranslation(); const tools = [{ type: "issue", key: "toolbar.issue" }, { type: "detour", key: "toolbar.detour" }, { type: "note", key: "toolbar.note" }] as const;
  return <div className="flex flex-wrap items-center gap-1 px-1 text-xs font-semibold sm:text-sm"><span className="mr-1 text-slate-500">{t("toolbar.suggesting")}</span>{tools.map((tool) => <button key={tool.type} type="button" aria-pressed={selectedTool === tool.type} onClick={() => onSelectTool(tool.type)} className={`rounded-md border px-3 py-2 ${selectedTool === tool.type ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{t(tool.key)}</button>)}</div>;
}

export function CommunityMarkerLegend() {
  const { t } = useTranslation(); return <div className="sr-only" aria-label={t("toolbar.futureStyles")}>
    <span className="community-marker community-marker-issue">{t("toolbar.issue")}</span>
    <span className="community-marker community-marker-detour">{t("toolbar.detour")}</span>
    <span className="community-marker community-marker-note">{t("toolbar.note")}</span>
    <span className="community-marker community-marker-positive">{t("toolbar.positive")}</span>
  </div>;
}
