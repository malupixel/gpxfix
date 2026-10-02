"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calculatePolylineDistance, type RouteCoordinate } from "@/features/routes/route-geometry";
import { managementRouteUrl } from "@/features/routes/route-links";
import { createDrawnRoute } from "@/features/routes/api";
import { EditorMap } from "./editor-map";
import { clearDraft, loadDraft, saveDraft } from "./draft";
import { affectedRoutedSegments, createEditorState, editorReducer, finalGeometry, type EditorAction, type RouteEditorDocument, type RouteSegment, type SegmentMode } from "./model";
import { apiRoutingService } from "./routing";

const id = () => crypto.randomUUID();
export function RouteEditor() {
  const router = useRouter();
  const [state, dispatch] = useReducer(editorReducer, undefined, () => createEditorState(typeof window === "undefined" ? undefined : loadDraft() ?? undefined));
  const doc = state.present;
  const [mode, setMode] = useState<SegmentMode>("ROUTED"), [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null), [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [showSave, setShowSave] = useState(false);
  const request = useRef(0), latestRequests = useRef(new Map<string, number>());

  useEffect(() => { const timer = setTimeout(() => doc.points.length ? saveDraft(doc) : clearDraft(), 250); return () => clearTimeout(timer); }, [doc]);
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
      if (latestRequests.current.get(segment.id) === version) setError("Road routing failed. The moved point was kept; retry or switch the failed segment to Direct.");
    }
  }
  function nextDocument(action: EditorAction) { return editorReducer(createEditorState(doc), action).present; }
  function add(coordinate: RouteCoordinate) {
    if (inserting) return;
    const segmentId = doc.points.length ? id() : undefined, pointId = id();
    const action: EditorAction = { type: "add", coordinate, mode, id: pointId, segmentId };
    const next = nextDocument(action); dispatch(action);
    if (segmentId && mode === "ROUTED") void routeSegment(next.segments.at(-1)!, next);
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
    setSaving(true); setError(null);
    try {
      const created = await createDrawnRoute({ name: String(form.get("name") || "Untitled route"), description: String(form.get("description") || "") || null, editorDocument: doc });
      clearDraft(); const owner = managementRouteUrl(created.publicId, created.managementToken, location.origin);
      try { await navigator.clipboard.writeText(owner); } catch { /* Clipboard access is optional. */ }
      const target = new URL(owner); router.push(target.pathname + target.search);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save route"); setSaving(false); }
  }
  function cancel() { if (!doc.points.length || confirm("Discard this route draft?")) { clearDraft(); router.push("/"); } }

  return <main className="fixed inset-0 bg-slate-100">
    <EditorMap document={doc} selectedSegmentId={selectedSegmentId} selectedPointId={selectedPointId} inserting={inserting} onMapClick={add} onInsert={insert} onMove={move} onSelectSegment={(value) => { setSelectedSegmentId(value); setSelectedPointId(null); setInserting(false); }} onSelectPoint={(value) => { setSelectedPointId(value); if (value) { setSelectedSegmentId(null); setInserting(false); } }} />
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3"><button onClick={cancel} className="pointer-events-auto rounded-lg bg-white px-3 py-2 text-sm font-bold shadow">← Cancel</button><div className="pointer-events-auto rounded-xl bg-white/95 p-2 shadow-xl"><div className="flex gap-1" role="group" aria-label="Drawing mode"><Mode active={mode === "ROUTED"} onClick={() => setMode("ROUTED")}>🧲 Follow roads</Mode><Mode active={mode === "DIRECT"} onClick={() => setMode("DIRECT")}>✏ Direct</Mode></div></div><button disabled={doc.points.length < 2} onClick={() => setShowSave(true)} className="pointer-events-auto rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50">Finish & save</button></header>
    <section className="absolute bottom-3 left-1/2 z-10 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-xl bg-white/95 p-3 shadow-xl backdrop-blur"><p className="text-sm font-semibold">{inserting ? "Tap the highlighted segment where the new control point should go." : doc.points.length ? "Click the map to extend the route, or drag a control point to move it." : "Click anywhere on the map to place the start."}</p><div className="mt-2 flex flex-wrap items-center gap-2"><button disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })} className="route-button">↶ Undo</button><button disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })} className="route-button">↷ Redo</button><span className="ml-auto text-sm font-bold">{(distance / 1000).toFixed(1)} km · {doc.points.length} points</span></div>
      {segment && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3"><span className="py-2 text-xs font-bold uppercase text-slate-500">Selected segment</span><button onClick={() => setInserting((value) => !value)} aria-pressed={inserting} className="route-button">{inserting ? "Cancel adding point" : "Add point"}</button><button onClick={() => changeMode(segment.mode === "ROUTED" ? "DIRECT" : "ROUTED")} className="route-button">Convert to {segment.mode === "ROUTED" ? "Direct" : "Follow roads"}</button>{segment.mode === "ROUTED" && <button onClick={() => routeSegment(segment)} className="route-button">Retry / reroute</button>}{segment.routingStatus === "routing" && <span className="py-2 text-sm">Routing…</span>}{segment.routingStatus === "failed" && <span className="py-2 text-sm font-semibold text-red-700">Routing failed</span>}</div>}
      {selectedPoint && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3"><span className="py-2 text-xs font-bold uppercase text-slate-500">Selected control point</span><button onClick={removePoint} className="route-button text-red-700">Delete point</button></div>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
    {showSave && <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/50 p-4"><form onSubmit={event=>{event.preventDefault();void save(new FormData(event.currentTarget));}} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h1 className="text-2xl font-bold">Save route</h1><label className="mt-4 block text-sm font-bold">Route name<input name="name" required maxLength={200} className="mt-1 block w-full rounded-lg border p-3" /></label><label className="mt-4 block text-sm font-bold">Description (optional)<textarea name="description" rows={3} className="mt-1 block w-full rounded-lg border p-3" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowSave(false)} className="route-button">Back</button><button disabled={saving} className="rounded-lg bg-emerald-700 px-5 py-2 font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save route"}</button></div></form></div>}
  </main>;
}
function Mode({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-bold ${active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{children}</button>; }
