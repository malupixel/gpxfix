import type { RoutePageMode, SuggestionTool } from "./route-page-state";

type Props = {
  mode: RoutePageMode;
  selectedTool: SuggestionTool;
  onView: () => void;
  onSuggest: (tool?: SuggestionTool) => void;
  onSelectTool: (tool: Exclude<SuggestionTool, null>) => void;
};

export function RouteMapToolbar({ mode, selectedTool, onView, onSuggest, onSelectTool }: Props) {
  return <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 p-1 sm:flex-row sm:items-center sm:justify-between">
    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:flex" role="tablist" aria-label="Route page mode">
      <button type="button" role="tab" aria-selected={mode === "view"} onClick={onView} className={`rounded-md px-5 py-2 ${mode === "view" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>View route</button>
      <button type="button" role="tab" aria-selected={mode === "suggest"} onClick={() => onSuggest()} className={`rounded-md px-5 py-2 ${mode === "suggest" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>Suggest changes</button>
    </div>
    {mode === "view" ? <div className="grid grid-cols-3 gap-2 text-xs font-semibold sm:flex sm:text-sm">
      <ToolbarAction icon="●" label="Add note" tone="blue" onClick={() => onSuggest("note")} />
      <ToolbarAction icon="△" label="Flag section" tone="red" onClick={() => onSuggest("issue")} />
      <ToolbarAction icon="✎" label="Edit route" tone="green" onClick={() => onSuggest("detour")} />
    </div> : <SuggestionToolStatus selectedTool={selectedTool} onSelectTool={onSelectTool} />}
  </div>;
}

function ToolbarAction({ icon, label, tone, onClick }: { icon: string; label: string; tone: "blue" | "red" | "green"; onClick: () => void }) {
  const tones = { blue: "text-blue-700", red: "text-red-600", green: "text-emerald-700" };
  return <button type="button" onClick={onClick} className="route-button min-h-10 bg-white hover:bg-slate-50"><span className={tones[tone]}>{icon}</span> {label}</button>;
}

function SuggestionToolStatus({ selectedTool, onSelectTool }: Pick<Props, "selectedTool" | "onSelectTool">) {
  const tools = [{ type: "issue", label: "Issue" }, { type: "detour", label: "Detour" }, { type: "note", label: "Note" }] as const;
  return <div className="flex flex-wrap items-center gap-1 px-1 text-xs font-semibold sm:text-sm"><span className="mr-1 text-slate-500">Suggesting:</span>{tools.map((tool) => <button key={tool.type} type="button" aria-pressed={selectedTool === tool.type} onClick={() => onSelectTool(tool.type)} className={`rounded-md border px-3 py-2 ${selectedTool === tool.type ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{tool.label}</button>)}</div>;
}

export function CommunityMarkerLegend() {
  return <div className="sr-only" aria-label="Future community marker styles">
    <span className="community-marker community-marker-issue">Issue</span>
    <span className="community-marker community-marker-detour">Detour</span>
    <span className="community-marker community-marker-note">Note</span>
    <span className="community-marker community-marker-positive">Positive</span>
  </div>;
}
