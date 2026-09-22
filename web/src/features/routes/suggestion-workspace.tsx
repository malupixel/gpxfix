import type { ButtonHTMLAttributes, Dispatch, SetStateAction } from "react";

import { calculatePolylineDistance, type RouteCoordinate } from "./route-geometry";
import { createSuggestionDraft, type SuggestionDraft, type SuggestionTool } from "./route-page-state";
import { useTranslation } from "react-i18next";

const suggestionTypes = [
  { type: "issue", icon: "!", labelKey: "suggestion.reportIssue", descriptionKey: "suggestion.reportIssueHelp" },
  { type: "detour", icon: "↗", labelKey: "suggestion.suggestDetour", descriptionKey: "suggestion.suggestDetourHelp" },
  { type: "note", icon: "◆", labelKey: "suggestion.addNote", descriptionKey: "suggestion.addNoteHelp" },
] as const;

type Props = {
  draft: SuggestionDraft;
  onDraftChange: Dispatch<SetStateAction<SuggestionDraft>>;
  onSelectTool: (tool: Exclude<SuggestionTool, null>) => void;
};

export function SuggestionWorkspace({ draft, onDraftChange, onSelectTool }: Props) {
  const { t } = useTranslation();
  const setField = (field: "message" | "authorName", value: string) => onDraftChange((current) => current.type ? { ...current, [field]: value } : current);
  const review = () => onDraftChange((current) => current.type ? { ...current, step: "review" } : current);
  const edit = () => onDraftChange((current) => current.type ? { ...current, step: "edit" } : current);

  if (draft.type && draft.step === "review") return <ReviewSuggestion draft={draft} onBack={edit} />;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:p-5">
      <h2 className="text-xl font-bold">{t("suggestion.create")}</h2><p className="mt-1 text-sm text-slate-600">{t("suggestion.intro")}</p>
      <SuggestionTypeSelector selectedTool={draft.type} onSelectTool={onSelectTool} />

      <div className="mt-5 border-t border-slate-200 pt-5" aria-live="polite">
        {draft.type === null && <Instruction heading={t("suggestion.chooseType")} text={t("suggestion.chooseTypeHelp")} />}
        {draft.type === "note" && <NoteEditor draft={draft} setDraft={onDraftChange} setField={setField} review={review} />}
        {draft.type === "issue" && <IssueEditor draft={draft} setDraft={onDraftChange} setField={setField} review={review} />}
        {draft.type === "detour" && <DetourEditor draft={draft} setDraft={onDraftChange} setField={setField} review={review} />}
      </div>
    </aside>
  );
}

function SuggestionTypeSelector({ selectedTool, onSelectTool }: { selectedTool: SuggestionTool; onSelectTool: Props["onSelectTool"] }) {
  const { t } = useTranslation(); return <div className="mt-5 space-y-2" aria-label={t("suggestion.type")}>{suggestionTypes.map((suggestion) => {
    const selected = suggestion.type === selectedTool;
    return <button key={suggestion.type} type="button" aria-pressed={selected} onClick={() => onSelectTool(suggestion.type)} className={`flex w-full gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-lg font-black ${toolIconClass(suggestion.type)}`}>{suggestion.icon}</span>
      <span><span className="block text-sm font-bold text-slate-900">{t(suggestion.labelKey)}</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">{t(suggestion.descriptionKey)}</span></span>
    </button>;
  })}</div>;
}

function NoteEditor({ draft, setDraft, setField, review }: EditorProps<"note">) {
  const { t } = useTranslation(); if (!draft.position) return <Instruction heading={t("suggestion.chooseLocation")} text={t("suggestion.chooseLocationHelp")} />;
  return <>
    <SelectionSummary label={t("suggestion.location")} value={formatKilometer(draft.position.distanceMeters)} /><h3 className="mt-5 text-base font-bold">{t("suggestion.addNote")}</h3>
    <SelectField label={t("suggestion.categoryOptional")} value={draft.category} options={["water", "food", "surface", "view", "services", "other"]} onChange={(category) => setDraft((current) => current.type === "note" ? { ...current, category } : current)} />
    <DraftFields placeholder={t("suggestion.notePlaceholder")} draft={draft} setField={setField} /><PrimaryButton disabled={!canReview(draft)} onClick={review}>{t("suggestion.review")}</PrimaryButton>
    <div className="mt-2"><SecondaryButton onClick={() => setDraft((current) => current.type === "note" ? { ...current, position: null, step: "edit" } : current)}>{t("suggestion.chooseAnotherLocation")}</SecondaryButton></div>
  </>;
}

function IssueEditor({ draft, setDraft, setField, review }: EditorProps<"issue">) {
  const { t } = useTranslation(); if (!draft.start) return <Instruction heading={t("suggestion.selectIssue")} text={t("suggestion.selectIssueStart")} />;
  if (!draft.end) return <><Instruction heading={t("suggestion.selectIssueEnd")} text={t("suggestion.selectIssueEndHelp")} /><SelectionSummary label={t("suggestion.start")} value={formatKilometer(draft.start.distanceMeters)} /></>;
  const length = draft.end.distanceMeters - draft.start.distanceMeters;
  return <>
    <SelectionSummary label={t("suggestion.affectedSection")} value={`${formatKilometer(draft.start.distanceMeters)} – ${formatKilometer(draft.end.distanceMeters)}`} detail={t("suggestion.length", { value: formatDistance(length) })} />
    <h3 className="mt-5 text-base font-bold">{t("suggestion.describeIssue")}</h3>
    <SelectField label={t("suggestion.category")} value={draft.category} options={["highTraffic", "badSurface", "roadClosed", "construction", "dangerous", "unpaved", "other"]} onChange={(category) => setDraft((current) => current.type === "issue" ? { ...current, category } : current)} />
    <DraftFields placeholder={t("suggestion.issuePlaceholder")} draft={draft} setField={setField} /><PrimaryButton disabled={!canReview(draft)} onClick={review}>{t("suggestion.review")}</PrimaryButton>
    <div className="mt-2"><SecondaryButton onClick={() => setDraft((current) => current.type === "issue" ? { ...current, start: null, end: null, step: "edit" } : current)}>{t("suggestion.anotherSection")}</SecondaryButton></div>
  </>;
}

function DetourEditor({ draft, setDraft, setField, review }: EditorProps<"detour">) {
  const { t } = useTranslation();
  const startOver = () => setDraft(createSuggestionDraft("detour"));
  const undo = () => setDraft((current) => current.type === "detour" && current.waypoints.length ? { ...current, waypoints: current.waypoints.slice(0, -1), step: "edit" } : current);
  if (!draft.start) return <Instruction heading={t("suggestion.detourStart")} text={t("suggestion.detourStartHelp")} />;
  if (!draft.end) return <>
    <Instruction heading={t("suggestion.drawAlternative")} text={t("suggestion.drawAlternativeHelp")} /><p className="mt-3 text-xs font-semibold text-slate-600">{t("suggestion.intermediatePoints", { count: draft.waypoints.length })}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><SecondaryButton disabled={!draft.waypoints.length} onClick={undo}>{t("suggestion.undo")}</SecondaryButton><SecondaryButton onClick={startOver}>{t("suggestion.startOver")}</SecondaryButton></div>
  </>;
  const originalDistance = draft.end.distanceMeters - draft.start.distanceMeters;
  const proposedDistance = calculatePolylineDistance(detourCoordinates(draft));
  return <>
    <DistanceComparison original={originalDistance} proposed={proposedDistance} />
    <h3 className="mt-5 text-base font-bold">{t("suggestion.describeDetour")}</h3>
    <TagSelector selected={draft.tags} onChange={(tags) => setDraft((current) => current.type === "detour" ? { ...current, tags } : current)} />
    <DraftFields placeholder={t("suggestion.detourPlaceholder")} draft={draft} setField={setField} /><PrimaryButton disabled={!canReview(draft)} onClick={review}>{t("suggestion.review")}</PrimaryButton>
    <div className="mt-2 grid grid-cols-2 gap-2"><SecondaryButton disabled={!draft.waypoints.length} onClick={undo}>{t("suggestion.undo")}</SecondaryButton><SecondaryButton onClick={startOver}>{t("suggestion.startOver")}</SecondaryButton></div>
  </>;
}

function ReviewSuggestion({ draft, onBack }: { draft: Exclude<SuggestionDraft, { type: null }>; onBack: () => void }) {
  const { t } = useTranslation();
  let location = "";
  if (draft.type === "note" && draft.position) location = formatKilometer(draft.position.distanceMeters);
  if ((draft.type === "issue" || draft.type === "detour") && draft.start && draft.end) location = `${formatKilometer(draft.start.distanceMeters)} – ${formatKilometer(draft.end.distanceMeters)}`;
  const proposed = draft.type === "detour" && draft.start && draft.end ? calculatePolylineDistance(detourCoordinates(draft)) : null;
  const original = draft.type === "detour" && draft.start && draft.end ? draft.end.distanceMeters - draft.start.distanceMeters : null;
  return <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:p-5">
    <h2 className="text-xl font-bold">{t("suggestion.reviewTitle")}</h2><p className="mt-1 text-sm text-slate-600">{t("suggestion.reviewHelp")}</p>
    <dl className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><ReviewRow label={t("suggestion.type")} value={t(`suggestion.type${capitalize(draft.type)}`)} /><ReviewRow label={draft.type === "note" ? t("suggestion.location") : t("suggestion.section")} value={location} />{original !== null && proposed !== null && <><ReviewRow label={t("suggestion.originalDistance")} value={formatDistance(original)} /><ReviewRow label={t("suggestion.proposedDistance")} value={formatDistance(proposed)} /><ReviewRow label={t("suggestion.difference")} value={formatDifference(proposed - original)} /></>}<ReviewRow label={t("common.description")} value={draft.message} /><ReviewRow label={t("common.name")} value={draft.authorName} /></dl>
    <PrimaryButton disabled title={t("suggestion.savingSoon")}>{t("suggestion.submit")}</PrimaryButton><p className="mt-2 text-center text-xs text-slate-500">{t("suggestion.savingSoon")}</p><SecondaryButton onClick={onBack}>{t("suggestion.backToEdit")}</SecondaryButton>
  </aside>;
}

type EditorProps<T extends Exclude<SuggestionTool, null>> = { draft: Extract<SuggestionDraft, { type: T }>; setDraft: Dispatch<SetStateAction<SuggestionDraft>>; setField: (field: "message" | "authorName", value: string) => void; review: () => void };
function Instruction({ heading, text }: { heading: string; text: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-bold">{heading}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>; }
function SelectionSummary({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-600">{detail}</p>}</div>; }
function DraftFields({ placeholder, draft, setField }: { placeholder: string; draft: Exclude<SuggestionDraft, { type: null }>; setField: EditorProps<"note">["setField"] }) { const { t } = useTranslation(); return <><label className="mt-4 block text-xs font-bold text-slate-700">{t("common.description")}<textarea rows={4} value={draft.message} onChange={(event) => setField("message", event.target.value)} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-blue-500" /></label><label className="mt-4 block text-xs font-bold text-slate-700">{t("suggestion.yourName")}<input value={draft.authorName} onChange={(event) => setField("authorName", event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500" /></label><p className="mt-1 text-xs text-slate-500">{t("common.noAccount")}</p></>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { const { t } = useTranslation(); return <label className="mt-4 block text-xs font-bold text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"><option value="">{t("common.select")}</option>{options.map((option) => <option key={option} value={option}>{t(`options.${option}`)}</option>)}</select></label>; }
function TagSelector({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) { const { t } = useTranslation(); const tags = ["betterSurface", "lessTraffic", "safer", "scenic", "avoidsClosure", "other"]; return <fieldset className="mt-4"><legend className="text-xs font-bold text-slate-700">{t("suggestion.tagsOptional")}</legend><div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <button key={tag} type="button" aria-pressed={selected.includes(tag)} onClick={() => onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected.includes(tag) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{t(`options.${tag}`)}</button>)}</div></fieldset>; }
function DistanceComparison({ original, proposed }: { original: number; proposed: number }) { const { t } = useTranslation(); return <div className="grid grid-cols-3 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center"><Metric label={t("suggestion.original")} value={formatDistance(original)} /><Metric label={t("suggestion.proposed")} value={formatDistance(proposed)} /><Metric label={t("suggestion.difference")} value={formatDifference(proposed - original)} /></div>; }
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
