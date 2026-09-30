import type { RouteCoordinate } from "@/features/routes/route-geometry";

export type SegmentMode = "ROUTED" | "DIRECT";
export type ControlPoint = { id: string; coordinate: RouteCoordinate };
export type RouteSegment = {
  id: string;
  fromId: string;
  toId: string;
  mode: SegmentMode;
  geometry: RouteCoordinate[];
  intendedGeometry: RouteCoordinate[];
  routingStatus: "idle" | "routing" | "failed";
  requestVersion: number;
};
export type RouteEditorDocument = { version: 1; points: ControlPoint[]; segments: RouteSegment[] };
export type EditorState = { present: RouteEditorDocument; past: RouteEditorDocument[]; future: RouteEditorDocument[] };

export const emptyDocument = (): RouteEditorDocument => ({ version: 1, points: [], segments: [] });
export const createEditorState = (document = emptyDocument()): EditorState => ({ present: document, past: [], future: [] });
const copy = (value: RouteEditorDocument): RouteEditorDocument => structuredClone(value);
const commit = (state: EditorState, next: RouteEditorDocument): EditorState => ({ present: next, past: [...state.past, copy(state.present)].slice(-100), future: [] });
const point = (document: RouteEditorDocument, id: string) => document.points.find((item) => item.id === id)!;
const directGeometry = (document: RouteEditorDocument, segment: RouteSegment): RouteCoordinate[] => [point(document, segment.fromId).coordinate, point(document, segment.toId).coordinate];

export type EditorAction =
  | { type: "add"; coordinate: RouteCoordinate; mode: SegmentMode; id: string; segmentId?: string }
  | { type: "insert"; segmentId: string; coordinate: RouteCoordinate; id: string; leftId: string; rightId: string }
  | { type: "move"; pointId: string; coordinate: RouteCoordinate }
  | { type: "remove"; pointId: string; replacementId?: string }
  | { type: "mode"; segmentId: string; mode: SegmentMode }
  | { type: "routing-start"; segmentId: string; version: number }
  | { type: "routing-success"; segmentId: string; version: number; geometry: RouteCoordinate[] }
  | { type: "routing-failure"; segmentId: string; version: number }
  | { type: "undo" } | { type: "redo" };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "undo") return state.past.length ? { present: state.past.at(-1)!, past: state.past.slice(0, -1), future: [copy(state.present), ...state.future] } : state;
  if (action.type === "redo") return state.future.length ? { present: state.future[0], past: [...state.past, copy(state.present)], future: state.future.slice(1) } : state;
  const document = copy(state.present);
  if (action.type === "routing-start" || action.type === "routing-success" || action.type === "routing-failure") {
    const segment = document.segments.find((item) => item.id === action.segmentId);
    if (!segment || (action.type !== "routing-start" && segment.requestVersion !== action.version)) return state;
    if (action.type === "routing-start") { segment.requestVersion = action.version; segment.routingStatus = "routing"; }
    if (action.type === "routing-success") {
      const from = point(document, segment.fromId).coordinate;
      const to = point(document, segment.toId).coordinate;
      segment.geometry = action.geometry.length >= 2
        ? [from, ...action.geometry.slice(1, -1), to]
        : [from, to];
      segment.routingStatus = "idle";
    }
    if (action.type === "routing-failure") segment.routingStatus = "failed";
    return { ...state, present: document };
  }
  if (action.type === "add") {
    const previous = document.points.at(-1); document.points.push({ id: action.id, coordinate: action.coordinate });
    if (previous) document.segments.push({ id: action.segmentId!, fromId: previous.id, toId: action.id, mode: action.mode, geometry: [previous.coordinate, action.coordinate], intendedGeometry: [previous.coordinate, action.coordinate], routingStatus: "idle", requestVersion: 0 });
  }
  if (action.type === "move") {
    const moved = point(document, action.pointId); moved.coordinate = action.coordinate;
    for (const segment of document.segments.filter((item) => item.fromId === action.pointId || item.toId === action.pointId)) { segment.intendedGeometry = directGeometry(document, segment); segment.geometry = directGeometry(document, segment); segment.routingStatus = "idle"; }
  }
  if (action.type === "mode") {
    const segment = document.segments.find((item) => item.id === action.segmentId)!; segment.mode = action.mode;
    if (action.mode === "DIRECT") { segment.geometry = directGeometry(document, segment); segment.routingStatus = "idle"; }
  }
  if (action.type === "insert") {
    const index = document.segments.findIndex((item) => item.id === action.segmentId); const original = document.segments[index];
    const pointIndex = document.points.findIndex((item) => item.id === original.toId); document.points.splice(pointIndex, 0, { id: action.id, coordinate: action.coordinate });
    const make = (id:string,fromId:string,toId:string):RouteSegment => ({ id, fromId, toId, mode: original.mode, geometry: [point(document,fromId).coordinate,point(document,toId).coordinate], intendedGeometry: [point(document,fromId).coordinate,point(document,toId).coordinate], routingStatus:"idle",requestVersion:0 });
    document.segments.splice(index,1,make(action.leftId,original.fromId,action.id),make(action.rightId,action.id,original.toId));
  }
  if (action.type === "remove") {
    const index = document.points.findIndex((item) => item.id === action.pointId); if (index < 0) return state;
    const before = document.segments.find((item) => item.toId === action.pointId), after = document.segments.find((item) => item.fromId === action.pointId);
    document.points.splice(index,1); document.segments = document.segments.filter((item) => item !== before && item !== after);
    if (before && after) document.segments.splice(index-1,0,{ id:action.replacementId!,fromId:before.fromId,toId:after.toId,mode:after.mode,geometry:[point(document,before.fromId).coordinate,point(document,after.toId).coordinate],intendedGeometry:[point(document,before.fromId).coordinate,point(document,after.toId).coordinate],routingStatus:"idle",requestVersion:0 });
  }
  return commit(state, document);
}

export function finalGeometry(document: RouteEditorDocument): RouteCoordinate[] {
  return document.segments.flatMap((segment, index) => index ? segment.geometry.slice(1) : segment.geometry);
}
export function affectedRoutedSegments(document: RouteEditorDocument, pointId: string) { return document.segments.filter((segment) => segment.mode === "ROUTED" && (segment.fromId === pointId || segment.toId === pointId)); }
