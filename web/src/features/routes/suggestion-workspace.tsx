import type { ButtonHTMLAttributes, Dispatch, SetStateAction } from "react";

import { calculatePolylineDistance, type RouteCoordinate } from "./route-geometry";
import { createSuggestionDraft, type SuggestionDraft, type SuggestionTool } from "./route-page-state";

const suggestionTypes = [
  { type: "issue", icon: "!", label: "Report an issue", description: "Mark a dangerous, blocked or problematic section." },
  { type: "detour", icon: "↗", label: "Suggest a detour", description: "Show a better way around part of the route." },
  { type: "note", icon: "◆", label: "Add a note", description: "Add useful local knowledge to a point on the route." },
] as const;

type Props = {
  draft: SuggestionDraft;
  onDraftChange: Dispatch<SetStateAction<SuggestionDraft>>;
  onSelectTool: (tool: Exclude<SuggestionTool, null>) => void;
};

export function SuggestionWorkspace({ draft, onDraftChange, onSelectTool }: Props) {
  const setField = (field: "message" | "authorName", value: string) => onDraftChange((current) => current.type ? { ...current, [field]: value } : current);
  const review = () => onDraftChange((current) => current.type ? { ...current, step: "review" } : current);
  const edit = () => onDraftChange((current) => current.type ? { ...current, step: "edit" } : current);

  if (draft.type && draft.step === "review") return <ReviewSuggestion draft={draft} onBack={edit} />;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:p-5">
      <h2 className="text-xl font-bold">Create a suggestion</h2>
      <p className="mt-1 text-sm text-slate-600">Help improve this route for the next rider.</p>
      <SuggestionTypeSelector selectedTool={draft.type} onSelectTool={onSelectTool} />

      <div className="mt-5 border-t border-slate-200 pt-5" aria-live="polite">
        {draft.type === null && <Instruction heading="Choose a suggestion type" text="Select an option above to see how to begin." />}
        {draft.type === "note" && <NoteEditor draft={draft} setDraft={onDraftChange} setField={setField} review={review} />}
        {draft.type === "issue" && <IssueEditor draft={draft} setDraft={onDraftChange} setField={setField} review={review} />}
        {draft.type === "detour" && <DetourEditor draft={draft} setDraft={onDraftChange} setField={setField} review={review} />}
      </div>
    </aside>
  );
}

function SuggestionTypeSelector({ selectedTool, onSelectTool }: { selectedTool: SuggestionTool; onSelectTool: Props["onSelectTool"] }) {
  return <div className="mt-5 space-y-2" aria-label="Suggestion type">{suggestionTypes.map((suggestion) => {
    const selected = suggestion.type === selectedTool;
    return <button key={suggestion.type} type="button" aria-pressed={selected} onClick={() => onSelectTool(suggestion.type)} className={`flex w-full gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-lg font-black ${toolIconClass(suggestion.type)}`}>{suggestion.icon}</span>
      <span><span className="block text-sm font-bold text-slate-900">{suggestion.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">{suggestion.description}</span></span>
    </button>;
  })}</div>;
}

function NoteEditor({ draft, setDraft, setField, review }: EditorProps<"note">) {
  if (!draft.position) return <Instruction heading="Choose a location" text="Click anywhere on the route to attach your note." />;
  return <>
    <SelectionSummary label="Location" value={formatKilometer(draft.position.distanceMeters)} />
    <h3 className="mt-5 text-base font-bold">Add a note</h3>
    <SelectField label="Category (optional)" value={draft.category} options={["Water", "Food", "Surface", "View", "Services", "Other"]} onChange={(category) => setDraft((current) => current.type === "note" ? { ...current, category } : current)} />
    <DraftFields placeholder="Share useful local knowledge..." draft={draft} setField={setField} />
    <PrimaryButton disabled={!canReview(draft)} onClick={review}>Review suggestion</PrimaryButton>
    <div className="mt-2"><SecondaryButton onClick={() => setDraft((current) => current.type === "note" ? { ...current, position: null, step: "edit" } : current)}>Choose another location</SecondaryButton></div>
  </>;
}

function IssueEditor({ draft, setDraft, setField, review }: EditorProps<"issue">) {
  if (!draft.start) return <Instruction heading="Select the problematic section" text="Click the route to mark where the problem starts." />;
  if (!draft.end) return <><Instruction heading="Now select where the problem ends" text="Click the route again to mark the end of the affected section." /><SelectionSummary label="Start" value={formatKilometer(draft.start.distanceMeters)} /></>;
  const length = draft.end.distanceMeters - draft.start.distanceMeters;
  return <>
    <SelectionSummary label="Affected section" value={`${formatKilometer(draft.start.distanceMeters)} – ${formatKilometer(draft.end.distanceMeters)}`} detail={`Length ${formatDistance(length)}`} />
    <h3 className="mt-5 text-base font-bold">Describe the issue</h3>
    <SelectField label="Category" value={draft.category} options={["High traffic", "Bad surface", "Road closed", "Construction", "Dangerous", "Unpaved", "Other"]} onChange={(category) => setDraft((current) => current.type === "issue" ? { ...current, category } : current)} />
    <DraftFields placeholder="What should other riders know?" draft={draft} setField={setField} />
    <PrimaryButton disabled={!canReview(draft)} onClick={review}>Review suggestion</PrimaryButton>
    <div className="mt-2"><SecondaryButton onClick={() => setDraft((current) => current.type === "issue" ? { ...current, start: null, end: null, step: "edit" } : current)}>Select another section</SecondaryButton></div>
  </>;
}

function DetourEditor({ draft, setDraft, setField, review }: EditorProps<"detour">) {
  const startOver = () => setDraft(createSuggestionDraft("detour"));
  const undo = () => setDraft((current) => current.type === "detour" && current.waypoints.length ? { ...current, waypoints: current.waypoints.slice(0, -1), step: "edit" } : current);
  if (!draft.start) return <Instruction heading="Select where the detour starts" text="Click the route where the alternative should leave the current route." />;
  if (!draft.end) return <>
    <Instruction heading="Draw the alternative" text="Click the map to add points. Click the route again to finish the detour." />
    <p className="mt-3 text-xs font-semibold text-slate-600">{draft.waypoints.length} intermediate {draft.waypoints.length === 1 ? "point" : "points"}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><SecondaryButton disabled={!draft.waypoints.length} onClick={undo}>Undo last point</SecondaryButton><SecondaryButton onClick={startOver}>Start over</SecondaryButton></div>
  </>;
  const originalDistance = draft.end.distanceMeters - draft.start.distanceMeters;
  const proposedDistance = calculatePolylineDistance(detourCoordinates(draft));
  return <>
    <DistanceComparison original={originalDistance} proposed={proposedDistance} />
    <h3 className="mt-5 text-base font-bold">Describe your detour</h3>
    <TagSelector selected={draft.tags} onChange={(tags) => setDraft((current) => current.type === "detour" ? { ...current, tags } : current)} />
    <DraftFields placeholder="Why is this alternative better?" draft={draft} setField={setField} />
    <PrimaryButton disabled={!canReview(draft)} onClick={review}>Review suggestion</PrimaryButton>
    <div className="mt-2 grid grid-cols-2 gap-2"><SecondaryButton disabled={!draft.waypoints.length} onClick={undo}>Undo last point</SecondaryButton><SecondaryButton onClick={startOver}>Start over</SecondaryButton></div>
  </>;
}

function ReviewSuggestion({ draft, onBack }: { draft: Exclude<SuggestionDraft, { type: null }>; onBack: () => void }) {
  let location = "";
  if (draft.type === "note" && draft.position) location = formatKilometer(draft.position.distanceMeters);
  if ((draft.type === "issue" || draft.type === "detour") && draft.start && draft.end) location = `${formatKilometer(draft.start.distanceMeters)} – ${formatKilometer(draft.end.distanceMeters)}`;
  const proposed = draft.type === "detour" && draft.start && draft.end ? calculatePolylineDistance(detourCoordinates(draft)) : null;
  const original = draft.type === "detour" && draft.start && draft.end ? draft.end.distanceMeters - draft.start.distanceMeters : null;
  return <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:p-5">
    <h2 className="text-xl font-bold">Review your suggestion</h2><p className="mt-1 text-sm text-slate-600">Check the details before submitting.</p>
    <dl className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><ReviewRow label="Type" value={capitalize(draft.type)} /><ReviewRow label={draft.type === "note" ? "Location" : "Section"} value={location} />{original !== null && proposed !== null && <><ReviewRow label="Original distance" value={formatDistance(original)} /><ReviewRow label="Approx. proposed distance" value={formatDistance(proposed)} /><ReviewRow label="Difference" value={formatDifference(proposed - original)} /></>}<ReviewRow label="Description" value={draft.message} /><ReviewRow label="Name" value={draft.authorName} /></dl>
    <PrimaryButton disabled title="Saving suggestions will be connected in the next implementation step.">Submit suggestion</PrimaryButton>
    <p className="mt-2 text-center text-xs text-slate-500">Saving suggestions will be connected in the next implementation step.</p>
    <SecondaryButton onClick={onBack}>Back to edit</SecondaryButton>
  </aside>;
}

type EditorProps<T extends Exclude<SuggestionTool, null>> = { draft: Extract<SuggestionDraft, { type: T }>; setDraft: Dispatch<SetStateAction<SuggestionDraft>>; setField: (field: "message" | "authorName", value: string) => void; review: () => void };
function Instruction({ heading, text }: { heading: string; text: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-bold">{heading}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>; }
function SelectionSummary({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-600">{detail}</p>}</div>; }
function DraftFields({ placeholder, draft, setField }: { placeholder: string; draft: Exclude<SuggestionDraft, { type: null }>; setField: EditorProps<"note">["setField"] }) { return <><label className="mt-4 block text-xs font-bold text-slate-700">Description<textarea rows={4} value={draft.message} onChange={(event) => setField("message", event.target.value)} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-blue-500" /></label><label className="mt-4 block text-xs font-bold text-slate-700">Your name<input value={draft.authorName} onChange={(event) => setField("authorName", event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500" /></label><p className="mt-1 text-xs text-slate-500">No account required.</p></>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="mt-4 block text-xs font-bold text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"><option value="">Select…</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function TagSelector({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) { const tags = ["Better surface", "Less traffic", "Safer", "Scenic", "Avoids closure", "Other"]; return <fieldset className="mt-4"><legend className="text-xs font-bold text-slate-700">Tags (optional)</legend><div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <button key={tag} type="button" aria-pressed={selected.includes(tag)} onClick={() => onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected.includes(tag) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{tag}</button>)}</div></fieldset>; }
function DistanceComparison({ original, proposed }: { original: number; proposed: number }) { return <div className="grid grid-cols-3 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center"><Metric label="Original" value={formatDistance(original)} /><Metric label="Approx. proposed" value={formatDistance(proposed)} /><Metric label="Difference" value={formatDifference(proposed - original)} /></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value}</p></div>; }
function ReviewRow({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap font-medium text-slate-900">{value}</dd></div>; }
function PrimaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
function SecondaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
function canReview(draft: Exclude<SuggestionDraft, { type: null }>) { return draft.message.trim().length > 0 && draft.authorName.trim().length > 0 && (draft.type !== "issue" || draft.category.length > 0); }
function detourCoordinates(draft: Extract<SuggestionDraft, { type: "detour" }>): RouteCoordinate[] { return draft.start ? [[draft.start.lng, draft.start.lat], ...draft.waypoints, ...(draft.end ? [[draft.end.lng, draft.end.lat] as RouteCoordinate] : [])] : []; }
function formatKilometer(meters: number) { return `km ${(meters / 1_000).toFixed(1)}`; }
function formatDistance(meters: number) { return `${(meters / 1_000).toFixed(1)} km`; }
function formatDifference(meters: number) { return `${meters >= 0 ? "+" : "−"}${formatDistance(Math.abs(meters))}`; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function toolIconClass(tool: Exclude<SuggestionTool, null>) { return tool === "issue" ? "bg-red-100 text-red-600" : tool === "detour" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"; }
