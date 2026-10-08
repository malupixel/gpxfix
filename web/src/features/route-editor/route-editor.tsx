"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calculatePolylineDistance, type RouteCoordinate } from "@/features/routes/route-geometry";
import { managementRouteUrl } from "@/features/routes/route-links";
import { createDrawnRoute, saveOwnerRoute, type OwnerEditorData } from "@/features/routes/api";
import { useTranslation } from "react-i18next";
import { apiErrorKey } from "@/i18n/api-errors";
import { ApiError } from "@/lib/api-client";
import { publicRoutePath } from "@/features/routes/route-links";
import { RouteMapToolbar } from "@/features/routes/route-map-toolbar";
import { EditorMap } from "./editor-map";
import { clearDraft, loadDraft, saveDraft } from "./draft";
import { affectedRoutedSegments, createEditorState, initializeExistingDocument, editorReducer, finalGeometry, type EditorAction, type RouteEditorDocument, type RouteSegment, type SegmentMode } from "./model";
import { apiRoutingService } from "./routing";

const id = () => crypto.randomUUID();
type Props = { existing?: OwnerEditorData; onClose?: () => void; onSaved?: () => void; onSuggest?: () => void };
export function RouteEditor({ existing, onClose, onSaved, onSuggest }: Props = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, dispatch] = useReducer(editorReducer, undefined, () => createEditorState(existing ? initializeExistingDocument(existing.route.geometry.coordinates, existing.editorDocument) : typeof window === "undefined" ? undefined : loadDraft() ?? undefined));
  const doc = state.present;
  const [mode, setMode] = useState<SegmentMode>("ROUTED"), [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null), [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [showSave, setShowSave] = useState(false);
  const [extendStart, setExtendStart] = useState(false), [conflicted, setConflicted] = useState(false);
  const request = useRef(0), latestRequests = useRef(new Map<string, number>());

  useEffect(() => { if (existing) return; const timer = setTimeout(() => doc.points.length ? saveDraft(doc) : clearDraft(), 250); return () => clearTimeout(timer); }, [doc, existing]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (doc.points.length) { event.preventDefault(); event.returnValue = ""; } }; addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn); }, [doc.points.length]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); dispatch({ type: event.shiftKey ? "redo" : "undo" }); } }; addEventListener("keydown", key); return () => removeEventListener("keydown", key); }, []);

  async function routeSegment(segment: RouteSegment, source: RouteEditorDocument = doc) {
    const version = ++request.current; latestRequests.current.set(segment.id, version);
    dispatch({ type: "routing-start", segmentId: segment.id, version });
    try {
      const from = source.points.find((point) => point.id === segment.fromId)!.coordinate;
      const to = source.points.find((point) => point.id === segment.toId)!.coordinate;
      const geometry = await apiRoutingService.route(from, to);
      dispatch({ type: "routing-success", segmentId: segment.id, version, geometry });
    } catch {
      dispatch({ type: "routing-failure", segmentId: segment.id, version });
      if (latestRequests.current.get(segment.id) === version) setError("editor.routingError");
    }
  }
  function nextDocument(action: EditorAction) { return editorReducer(createEditorState(doc), action).present; }
  function add(coordinate: RouteCoordinate) {
    if (inserting) return;
    const segmentId = doc.points.length ? id() : undefined, pointId = id();
    const action: EditorAction = { type: "add", coordinate, mode, id: pointId, segmentId, atStart: extendStart };
    const next = nextDocument(action); dispatch(action);
    if (segmentId && mode === "ROUTED") void routeSegment(extendStart ? next.segments[0] : next.segments.at(-1)!, next);
  }
  function insert(segmentId: string, coordinate: RouteCoordinate) {
    const action: EditorAction = { type: "insert", segmentId, coordinate, id: id(), leftId: id(), rightId: id() };
    dispatch(action); setInserting(false); setSelectedSegmentId(null);
  }
  function move(pointId: string, coordinate: RouteCoordinate) {
    const action: EditorAction = { type: "move", pointId, coordinate }, next = nextDocument(action);
    dispatch(action); setSelectedPointId(pointId); setError(null);
    affectedRoutedSegments(next, pointId).forEach((segment) => void routeSegment(segment, next));
  }
  const segment = doc.segments.find((item) => item.id === selectedSegmentId) ?? null;
  const selectedPoint = doc.points.find((item) => item.id === selectedPointId) ?? null;
  const distance = useMemo(() => calculatePolylineDistance(finalGeometry(doc)), [doc]);
  function changeMode(value: SegmentMode) {
    if (!segment) return;
    const action: EditorAction = { type: "mode", segmentId: segment.id, mode: value }, next = nextDocument(action);
    dispatch(action); setError(null);
    if (value === "ROUTED") void routeSegment(next.segments.find((item) => item.id === segment.id)!, next);
  }
  function removePoint() {
    if (!selectedPoint) return;
    const replacementId = id(), action: EditorAction = { type: "remove", pointId: selectedPoint.id, replacementId }, next = nextDocument(action);
    dispatch(action); setSelectedPointId(null); setError(null);
    const replacement = next.segments.find((item) => item.id === replacementId);
    if (replacement?.mode === "ROUTED") void routeSegment(replacement, next);
  }
  async function save(form: FormData) {
    if (saving || conflicted || doc.segments.some(s => s.routingStatus === "routing")) return;
    setSaving(true); setError(null);
    try {
      if (existing) {
        await saveOwnerRoute(existing.route.publicId, { baseVersionNumber: existing.route.viewedVersion, expectedUpdatedAt: existing.route.updatedAt, name: String(form.get("name") || ""), description: String(form.get("description") || "") || null, editorDocument: doc });
        onSaved?.(); router.refresh(); return;
      }
      const created = await createDrawnRoute({ name: String(form.get("name") || t("editor.untitled")), description: String(form.get("description") || "") || null, editorDocument: doc });
      clearDraft(); const owner = managementRouteUrl(created.publicId, created.managementToken, location.origin);
      try { await navigator.clipboard.writeText(owner); } catch { /* Clipboard access is optional. */ }
      const target = new URL(owner); router.push(target.pathname + target.search);
    } catch (caught) { if (caught instanceof ApiError && caught.status === 409) { setConflicted(true); setError("ownerEdit.conflict"); } else setError(apiErrorKey(caught, "editor.saveFailed")); setSaving(false); }
  }
  function cancel() { if ((existing ? !state.past.length : !doc.points.length) || confirm(t("ownerEdit.discard"))) { if (existing) onClose?.(); else { clearDraft(); router.push("/"); } } }

  return <main className={`fixed inset-0 z-40 bg-slate-100 ${existing ? "route-editor-owner" : "route-editor-drawing"}`}>
    {existing && <div className="absolute inset-x-0 top-0 z-20"><RouteMapToolbar mode="edit" selectedTool={null} onView={cancel} onEdit={() => {}} suggestionsEnabled={existing.route.suggestionsEnabled} onSuggest={() => { if (!state.past.length || confirm(t("ownerEdit.discard"))) onSuggest?.(); }} /></div>}
    <EditorMap document={doc} selectedSegmentId={selectedSegmentId} selectedPointId={selectedPointId} inserting={inserting} onMapClick={add} onInsert={insert} onMove={move} onSelectSegment={(value) => { setSelectedSegmentId(value); setSelectedPointId(null); setInserting(false); }} onSelectPoint={(value) => { setSelectedPointId(value); if (value) { setSelectedSegmentId(null); setInserting(false); } }} />
    <header className={`pointer-events-none absolute inset-x-0 ${existing ? "top-[72px]" : "top-0"} z-10 grid grid-cols-2 items-start gap-2 p-3 sm:flex sm:justify-between`}><button onClick={cancel} className="pointer-events-auto justify-self-start rounded-lg bg-white px-3 py-2 text-sm font-bold shadow">← {t("common.cancel")}</button><div className="pointer-events-auto order-3 col-span-2 rounded-xl bg-white/95 p-2 shadow-xl sm:order-none"><div className="flex gap-1" role="group" aria-label={t("editor.drawingMode")}><Mode active={mode === "ROUTED"} onClick={() => setMode("ROUTED")}>🧲 {t("editor.followRoads")}</Mode><Mode active={mode === "DIRECT"} onClick={() => setMode("DIRECT")}>✏ {t("editor.direct")}</Mode></div></div><button disabled={doc.points.length < 2 || doc.segments.some(s => s.routingStatus === "routing")} onClick={() => setShowSave(true)} className="pointer-events-auto order-2 justify-self-end rounded-lg bg-emerald-700 sm:order-none px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50">{existing ? t("ownerEdit.save") : t("editor.finishSave")}</button></header>
    <section className="absolute bottom-3 left-1/2 z-10 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-xl bg-white/95 p-3 shadow-xl backdrop-blur"><p className="text-sm font-semibold">{t(inserting ? "editor.insertHelp" : doc.points.length ? "editor.extendHelp" : "editor.startHelp")}</p><div className="mt-2 flex flex-wrap items-center gap-2"><button disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })} className="route-button">↶ {t("editor.undo")}</button><button disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })} className="route-button">↷ {t("editor.redo")}</button><button onClick={() => setExtendStart(value => !value)} aria-pressed={extendStart} className="route-button">{t(extendStart ? "ownerEdit.extendStart" : "ownerEdit.extendEnd")}</button><span className="ml-auto text-sm font-bold">{(distance / 1000).toFixed(1)} km · {t("editor.points", { count: doc.points.length })}</span></div>
      {segment && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3"><span className="py-2 text-xs font-bold uppercase text-slate-500">{t("editor.selectedSegment")}</span><button onClick={() => setInserting((value) => !value)} aria-pressed={inserting} className="route-button">{t(inserting ? "editor.cancelInsert" : "editor.addPoint")}</button><button onClick={() => changeMode(segment.mode === "ROUTED" ? "DIRECT" : "ROUTED")} className="route-button">{t(segment.mode === "ROUTED" ? "editor.convertDirect" : "editor.convertRouted")}</button>{segment.mode === "ROUTED" && <button onClick={() => routeSegment(segment)} className="route-button">{t("editor.retry")}</button>}{segment.routingStatus === "routing" && <span className="py-2 text-sm">{t("editor.routing")}</span>}{segment.routingStatus === "failed" && <span className="py-2 text-sm font-semibold text-red-700">{t("editor.routingFailed")}</span>}</div>}
      {selectedPoint && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3"><span className="py-2 text-xs font-bold uppercase text-slate-500">{t("editor.selectedPoint")}</span><button onClick={removePoint} className="route-button text-red-700">{t("editor.deletePoint")}</button></div>}
      {error && !showSave && <p role="alert" className="mt-2 text-sm text-red-700">{t(error)}</p>}
    </section>
    {showSave && <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/50 p-4"><form aria-busy={saving} onSubmit={event=>{event.preventDefault();void save(new FormData(event.currentTarget));}} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><h1 className="text-2xl font-bold">{existing ? t("ownerEdit.save") : t("editor.saveRoute")}</h1>{existing && <p className="mt-2 text-sm text-slate-600">{t("ownerEdit.baseVersion", { version: existing.route.viewedVersion })}</p>}<label className="mt-4 block text-sm font-bold">{t("upload.routeName")}<input name="name" defaultValue={existing?.route.name} required maxLength={200} className="mt-1 block w-full rounded-lg border p-3" /></label><label className="mt-4 block text-sm font-bold">{t("common.description")} {t("common.optional")}<textarea name="description" maxLength={10000} defaultValue={existing?.route.description ?? ""} rows={3} className="mt-1 block w-full rounded-lg border p-3" /></label>{saving && <p role="status" className="mt-3 text-sm text-slate-600">{t("editor.savingProfile")}</p>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p>}{conflicted && existing && <button type="button" onClick={() => { router.push(publicRoutePath(existing.route.publicId)); onClose?.(); router.refresh(); }} className="mt-3 text-sm font-bold text-blue-700">{t("ownerEdit.reload")}</button>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setShowSave(false)} className="route-button">{t("common.back")}</button><button disabled={saving || conflicted} className="rounded-lg bg-emerald-700 px-5 py-2 font-bold text-white disabled:opacity-50">{saving ? t("editor.saving") : existing ? t("ownerEdit.save") : t("editor.saveRoute")}</button></div></form></div>}
  </main>;
}
function Mode({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold ${active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{children}</button>; }
