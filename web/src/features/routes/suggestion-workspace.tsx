import { useEffect, useRef, type ButtonHTMLAttributes, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import type { CreateSuggestionRequest } from "@/types/route";
import { calculatePolylineDistance, type RouteCoordinate } from "./route-geometry";
import type { SuggestionFormData, SuggestionGeometry, SuggestionProcessStep, SuggestionTool } from "./route-page-state";

const suggestionTypes = [
  { type: "issue", icon: "!", labelKey: "suggestion.reportIssue", descriptionKey: "suggestion.reportIssueHelp" },
  { type: "detour", icon: "↗", labelKey: "suggestion.suggestDetour", descriptionKey: "suggestion.suggestDetourHelp" },
  { type: "note", icon: "◆", labelKey: "suggestion.addNote", descriptionKey: "suggestion.addNoteHelp" },
] as const;

export function SuggestionTypePicker({ onSelect, onCancel }: { onSelect: (tool: Exclude<SuggestionTool, null>) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/35 p-3 backdrop-blur-[1px]">
    <section className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5" aria-labelledby="suggestion-type-title">
      <div className="flex items-start justify-between gap-4"><div><h2 id="suggestion-type-title" className="text-xl font-bold">{t("suggestion.chooseType")}</h2><p className="mt-1 text-sm text-slate-600">{t("suggestion.chooseTypeHelp")}</p></div><CloseButton label={t("suggestion.cancel")} onClick={onCancel} /></div>
      <div className="mt-4 space-y-2">{suggestionTypes.map((suggestion) => <button key={suggestion.type} type="button" onClick={() => onSelect(suggestion.type)} className="flex w-full gap-3 rounded-xl border border-slate-200 p-3 text-left shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg text-lg font-black ${toolIconClass(suggestion.type)}`}>{suggestion.icon}</span>
        <span><span className="block text-sm font-bold text-slate-900">{t(suggestion.labelKey)}</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">{t(suggestion.descriptionKey)}</span></span>
      </button>)}</div>
      <button type="button" onClick={onCancel} className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">{t("suggestion.cancel")}</button>
    </section>
  </div>;
}

export function DrawingControls({ geometry, onUndo, onRedraw, onCancel, onContinue }: {
  geometry: Exclude<SuggestionGeometry, { type: null }>;
  onUndo: () => void;
  onRedraw: () => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const complete = geometryComplete(geometry);
  const instruction = drawingInstruction(geometry, t);
  const canUndo = geometry.type === "detour" && Boolean(geometry.start);
  const canRedraw = geometry.type === "note" ? Boolean(geometry.position) : geometry.type === "issue" ? Boolean(geometry.start) : false;
  return <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 sm:justify-start sm:p-4">
    <section className="pointer-events-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md sm:w-auto sm:min-w-80" aria-live="polite">
      <div className="flex items-start gap-3"><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg font-black ${toolIconClass(geometry.type)}`}>{toolIcon(geometry.type)}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t(`suggestion.type${capitalize(geometry.type)}`)}</p><p className="text-sm font-bold text-slate-950">{instruction}</p>{geometry.type === "detour" && geometry.start && !geometry.end && <p className="mt-0.5 text-xs text-slate-600">{t("suggestion.intermediatePoints", { count: geometry.waypoints.length })}</p>}</div></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {complete && <SmallPrimary onClick={onContinue}>{t("suggestion.continue")}</SmallPrimary>}
        {geometry.type === "detour" ? <SmallButton disabled={!canUndo} onClick={onUndo}>{t("suggestion.undo")}</SmallButton> : <SmallButton disabled={!canRedraw} onClick={onRedraw}>{geometry.type === "note" ? t("suggestion.chooseAnotherLocation") : t("suggestion.redraw")}</SmallButton>}
        <SmallButton onClick={onCancel} danger>{t("suggestion.cancel")}</SmallButton>
      </div>
    </section>
  </div>;
}

export function SuggestionDetailsDialog({ geometry, form, setForm, step, onBack, onClose, onSubmit, onDone }: {
  geometry: Exclude<SuggestionGeometry, { type: null }>;
  form: SuggestionFormData;
  setForm: Dispatch<SetStateAction<SuggestionFormData>>;
  step: Extract<SuggestionProcessStep, "describe" | "submitting" | "success">;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const firstFieldRef = useRef<HTMLSelectElement | HTMLTextAreaElement>(null);
  const busy = step === "submitting";
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (step === "describe") window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => { document.body.style.overflow = previousOverflow; };
  }, [step]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && step === "describe") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose, step]);

  if (step === "success") return <div className="fixed inset-0 z-[10020] grid bg-slate-950/45 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="suggestion-success-title">
    <section className="mt-auto w-full rounded-t-2xl bg-white p-6 text-center shadow-2xl sm:mt-0 sm:max-w-md sm:rounded-2xl">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">✓</div>
      <h2 id="suggestion-success-title" className="mt-4 text-xl font-bold">{t("suggestion.sentTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t("persistence.awaitingModeration")}</p>
      <PrimaryButton onClick={onDone}>{t("suggestion.done")}</PrimaryButton>
    </section>
  </div>;

  return <div className="fixed inset-0 z-[10020] flex bg-slate-950/45 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="suggestion-details-title">
    <section className="flex h-dvh w-full flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{t("suggestion.drawingFinished")}</p><h2 id="suggestion-details-title" className="mt-1 text-xl font-bold">{t("suggestion.describeTitle")}</h2><p className="mt-1 text-sm text-slate-600">{t("suggestion.describeHelp")}</p></div>
        <CloseButton disabled={busy} label={t("suggestion.backToMap")} onClick={onClose} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <GeometrySummary geometry={geometry} />
        {geometry.type === "note" && <SelectField inputRef={firstFieldRef as React.RefObject<HTMLSelectElement | null>} label={t("suggestion.categoryOptional")} value={form.category} options={["water", "food", "surface", "view", "services", "other"]} onChange={(category) => setForm((current) => ({ ...current, category }))} />}
        {geometry.type === "issue" && <SelectField inputRef={firstFieldRef as React.RefObject<HTMLSelectElement | null>} required label={t("suggestion.category")} value={form.category} options={["highTraffic", "badSurface", "roadClosed", "construction", "dangerous", "unpaved", "other"]} onChange={(category) => setForm((current) => ({ ...current, category }))} />}
        {geometry.type === "detour" && <TagSelector selected={form.tags} onChange={(tags) => setForm((current) => ({ ...current, tags }))} />}
        <label className="mt-4 block text-xs font-bold text-slate-700">{t("common.description")}<textarea ref={geometry.type === "detour" ? firstFieldRef as React.RefObject<HTMLTextAreaElement | null> : undefined} rows={4} maxLength={2000} required value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder={descriptionPlaceholder(geometry.type, t)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-base font-normal outline-none focus:border-blue-500 sm:text-sm" /></label>
        <label className="mt-4 block text-xs font-bold text-slate-700">{t("suggestion.yourName")}<input maxLength={80} required value={form.authorName} onChange={(event) => setForm((current) => ({ ...current, authorName: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-blue-500 sm:text-sm" /></label>
        <p className="mt-1 text-xs text-slate-500">{t("common.noAccount")}</p>
        {step === "describe" && !canSubmit(geometry, form) && <p className="mt-4 text-xs text-slate-500">{t("suggestion.requiredHelp")}</p>}
        {step === "describe" ? null : <p role="status" className="mt-4 text-center text-sm font-semibold text-emerald-700">{t("persistence.saving")}</p>}
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex sm:flex-row-reverse sm:gap-3 sm:px-6 sm:pb-5">
        <PrimaryButton disabled={busy || !canSubmit(geometry, form)} onClick={onSubmit}>{busy ? t("persistence.saving") : t("suggestion.submit")}</PrimaryButton>
        <SecondaryButton disabled={busy} onClick={onBack}>{t("suggestion.backToMap")}</SecondaryButton>
      </footer>
    </section>
  </div>;
}

function GeometrySummary({ geometry }: { geometry: Exclude<SuggestionGeometry, { type: null }> }) {
  const { t } = useTranslation();
  let value = "";
  if (geometry.type === "note" && geometry.position) value = formatKilometer(geometry.position.distanceMeters);
  if ((geometry.type === "issue" || geometry.type === "detour") && geometry.start && geometry.end) value = `${formatKilometer(geometry.start.distanceMeters)} – ${formatKilometer(geometry.end.distanceMeters)}`;
  if (geometry.type === "detour" && geometry.start && geometry.end) {
    const original = geometry.end.distanceMeters - geometry.start.distanceMeters;
    const proposed = calculatePolylineDistance(detourCoordinates(geometry));
    return <div className="grid grid-cols-3 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center"><Metric label={t("suggestion.original")} value={formatDistance(original)} /><Metric label={t("suggestion.proposed")} value={formatDistance(proposed)} /><Metric label={t("suggestion.difference")} value={formatDifference(proposed - original)} /></div>;
  }
  return <div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-700">{geometry.type === "note" ? t("suggestion.location") : t("suggestion.affectedSection")}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>;
}

function SelectField({ inputRef, label, value, options, required, onChange }: { inputRef?: React.RefObject<HTMLSelectElement | null>; label: string; value: string; options: string[]; required?: boolean; onChange: (value: string) => void }) { const { t } = useTranslation(); return <label className="mt-4 block text-xs font-bold text-slate-700">{label}<select ref={inputRef} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal sm:text-sm"><option value="">{t("common.select")}</option>{options.map((option) => <option key={option} value={option}>{t(`options.${option}`)}</option>)}</select></label>; }
function TagSelector({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) { const { t } = useTranslation(); const tags = ["betterSurface", "lessTraffic", "safer", "scenic", "avoidsClosure", "other"]; return <fieldset className="mt-4"><legend className="text-xs font-bold text-slate-700">{t("suggestion.tagsOptional")}</legend><div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <button key={tag} type="button" aria-pressed={selected.includes(tag)} onClick={() => onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag])} className={`rounded-full border px-3 py-2 text-xs font-semibold ${selected.includes(tag) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{t(`options.${tag}`)}</button>)}</div></fieldset>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value}</p></div>; }
function PrimaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-44">{children}</button>; }
function SecondaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:mt-0 sm:w-auto">{children}</button>; }
function SmallButton({ children, danger, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) { return <button type="button" {...props} className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 ${danger ? "border-red-200 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-700"}`}>{children}</button>; }
function SmallPrimary({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{children}</button>; }
function CloseButton({ label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button type="button" {...props} aria-label={label} title={label} className="grid size-9 shrink-0 place-items-center rounded-full text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">×</button>; }

function drawingInstruction(geometry: Exclude<SuggestionGeometry, { type: null }>, t: ReturnType<typeof useTranslation>["t"]) {
  if (geometryComplete(geometry)) return t("suggestion.geometryReady");
  if (geometry.type === "note") return t("suggestion.mapSelectNote");
  if (geometry.type === "issue") return geometry.start ? t("suggestion.mapSelectIssueEnd") : t("suggestion.mapSelectIssueStart");
  if (!geometry.start) return t("suggestion.mapSelectDetourStart");
  return geometry.waypoints.length ? t("suggestion.mapFinishDetour") : t("suggestion.mapDrawDetour");
}
function descriptionPlaceholder(type: Exclude<SuggestionTool, null>, t: ReturnType<typeof useTranslation>["t"]) { return type === "note" ? t("suggestion.notePlaceholder") : type === "issue" ? t("suggestion.issuePlaceholder") : t("suggestion.detourPlaceholder"); }
function geometryComplete(geometry: Exclude<SuggestionGeometry, { type: null }>) { return geometry.type === "note" ? Boolean(geometry.position) : Boolean(geometry.start && geometry.end); }
function canSubmit(geometry: Exclude<SuggestionGeometry, { type: null }>, form: SuggestionFormData) { return geometryComplete(geometry) && Boolean(form.message.trim()) && form.message.trim().length <= 2000 && Boolean(form.authorName.trim()) && form.authorName.trim().length <= 80 && (geometry.type !== "issue" || Boolean(form.category)); }
export function detourCoordinates(geometry: Extract<SuggestionGeometry, { type: "detour" }>): RouteCoordinate[] { return geometry.start ? [[geometry.start.lng, geometry.start.lat], ...geometry.waypoints, ...(geometry.end ? [[geometry.end.lng, geometry.end.lat] as RouteCoordinate] : [])] : []; }
export function suggestionRequest(geometry: Exclude<SuggestionGeometry, { type: null }>, data: SuggestionFormData): CreateSuggestionRequest {
  const anchor = (position: { lng: number; lat: number; distanceMeters: number }) => ({ longitude: position.lng, latitude: position.lat, distanceMeters: position.distanceMeters });
  if (geometry.type === "note" && geometry.position) return { type: "NOTE", authorName: data.authorName.trim(), description: data.message.trim(), category: data.category || null, tags: [], start: anchor(geometry.position), end: null, proposedGeometry: null };
  if (geometry.type === "issue" && geometry.start && geometry.end) return { type: "PROBLEM", authorName: data.authorName.trim(), description: data.message.trim(), category: data.category, tags: [], start: anchor(geometry.start), end: anchor(geometry.end), proposedGeometry: null };
  if (geometry.type === "detour" && geometry.start && geometry.end) return { type: "DETOUR", authorName: data.authorName.trim(), description: data.message.trim(), category: null, tags: data.tags, start: anchor(geometry.start), end: anchor(geometry.end), proposedGeometry: { type: "LineString", coordinates: detourCoordinates(geometry) } };
  throw new Error("Incomplete suggestion geometry");
}
function formatKilometer(meters: number) { return `km ${(meters / 1_000).toFixed(1)}`; }
function formatDistance(meters: number) { return `${(meters / 1_000).toFixed(1)} km`; }
function formatDifference(meters: number) { return `${meters >= 0 ? "+" : "−"}${formatDistance(Math.abs(meters))}`; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function toolIcon(tool: Exclude<SuggestionTool, null>) { return tool === "issue" ? "!" : tool === "detour" ? "↗" : "◆"; }
function toolIconClass(tool: Exclude<SuggestionTool, null>) { return tool === "issue" ? "bg-red-100 text-red-600" : tool === "detour" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"; }
