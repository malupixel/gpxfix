import type { SuggestionTool } from "./route-page-state";

const suggestionTypes: Array<{
  type: Exclude<SuggestionTool, null>;
  icon: string;
  label: string;
  description: string;
}> = [
  { type: "issue", icon: "!", label: "Report an issue", description: "Mark a dangerous, blocked or problematic section." },
  { type: "detour", icon: "↗", label: "Suggest a detour", description: "Show a better way around part of the route." },
  { type: "note", icon: "◆", label: "Add a note", description: "Add useful local knowledge to a point on the route." },
];

const instructions: Record<Exclude<SuggestionTool, null>, { heading: string; text: string }> = {
  issue: { heading: "Select the problematic section", text: "Click the route to mark where the problem starts." },
  detour: { heading: "Select the section to improve", text: "Start by selecting where the alternative should leave the current route." },
  note: { heading: "Choose a location", text: "Click anywhere on the route to attach your note." },
};

type Props = {
  selectedTool: SuggestionTool;
  onSelectTool: (tool: Exclude<SuggestionTool, null>) => void;
};

export function SuggestionWorkspace({ selectedTool, onSelectTool }: Props) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:p-5">
      <h2 className="text-xl font-bold">Create a suggestion</h2>
      <p className="mt-1 text-sm text-slate-600">Help improve this route for the next rider.</p>

      <div className="mt-5 space-y-2" aria-label="Suggestion type">
        {suggestionTypes.map((suggestion) => {
          const selected = suggestion.type === selectedTool;
          return (
            <button
              key={suggestion.type}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectTool(suggestion.type)}
              className={`flex w-full gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-lg font-black ${toolIconClass(suggestion.type)}`}>{suggestion.icon}</span>
              <span>
                <span className="block text-sm font-bold text-slate-900">{suggestion.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">{suggestion.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
        {selectedTool ? (
          <>
            <h3 className="text-sm font-bold text-slate-900">{instructions[selectedTool].heading}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{instructions[selectedTool].text}</p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-bold text-slate-900">Choose a suggestion type</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Select an option above to see how to begin.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function toolIconClass(tool: Exclude<SuggestionTool, null>) {
  if (tool === "issue") return "bg-red-100 text-red-600";
  if (tool === "detour") return "bg-emerald-100 text-emerald-700";
  return "bg-blue-100 text-blue-700";
}
