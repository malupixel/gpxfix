import { createRouteMeasure, findNearestPositionOnRoute, type RouteCoordinate } from "@/features/routes/route-geometry";

export type SegmentMode = "ROUTED" | "DIRECT";
export type ControlPoint = { id: string; coordinate: RouteCoordinate };
export type RouteSegment = { id: string; fromId: string; toId: string; mode: SegmentMode; geometry: RouteCoordinate[]; intendedGeometry: RouteCoordinate[]; routingStatus: "idle" | "routing" | "failed"; requestVersion: number };
export type RouteEditorDocument = { version: 1; points: ControlPoint[]; segments: RouteSegment[] };
export type EditorState = { present: RouteEditorDocument; past: RouteEditorDocument[]; future: RouteEditorDocument[] };

export const emptyDocument = (): RouteEditorDocument => ({ version: 1, points: [], segments: [] });
export const createEditorState = (document = emptyDocument()): EditorState => ({ present: document, past: [], future: [] });

/** Preserve every geometry vertex while using a bounded number of draggable controls. */
export function documentFromGeometry(coordinates: RouteCoordinate[]): RouteEditorDocument {
  if (coordinates.length < 2) return emptyDocument();
  const stride = Math.max(1, Math.ceil((coordinates.length - 1) / 100));
  const indices = [0];
  for (let i = stride; i < coordinates.length - 1; i += stride) indices.push(i);
  indices.push(coordinates.length - 1);
  const points = indices.map((index) => ({ id: `import-point-${index}`, coordinate: [...coordinates[index]] as RouteCoordinate }));
  const segments = points.slice(1).map((to, i) => newSegment(`import-segment-${i}`, points[i].id, to.id, "ROUTED", coordinates.slice(indices[i], indices[i + 1] + 1).map(c => [...c] as RouteCoordinate)));
  return { version: 1, points, segments };
}

export function initializeExistingDocument(coordinates: RouteCoordinate[], saved: RouteEditorDocument | null): RouteEditorDocument {
  const document = saved ? structuredClone(saved) : documentFromGeometry(coordinates);
  return { ...document, segments: document.segments.map(segment => ({ ...segment, routingStatus: "idle", requestVersion: 0 })) };
}
const copy = (value: RouteEditorDocument): RouteEditorDocument => structuredClone(value);
const commit = (state: EditorState, next: RouteEditorDocument): EditorState => ({ present: next, past: [...state.past, copy(state.present)].slice(-100), future: [] });
const point = (document: RouteEditorDocument, pointId: string) => document.points.find((item) => item.id === pointId)!;
const directGeometry = (document: RouteEditorDocument, segment: RouteSegment): RouteCoordinate[] => [point(document, segment.fromId).coordinate, point(document, segment.toId).coordinate];

export type EditorAction =
  | { type: "add"; coordinate: RouteCoordinate; mode: SegmentMode; id: string; segmentId?: string; atStart?: boolean }
  | { type: "insert"; segmentId: string; coordinate: RouteCoordinate; id: string; leftId: string; rightId: string }
  | { type: "move"; pointId: string; coordinate: RouteCoordinate }
  | { type: "remove"; pointId: string; replacementId?: string }
  | { type: "mode"; segmentId: string; mode: SegmentMode }
  | { type: "routing-start"; segmentId: string; version: number }
  | { type: "routing-success"; segmentId: string; version: number; geometry: RouteCoordinate[] }
  | { type: "routing-failure"; segmentId: string; version: number }
  | { type: "undo" } | { type: "redo" };

/** Returns a snapped point and two polylines whose concatenation is the original shape. */
export function splitSegmentGeometry(geometry: RouteCoordinate[], click: RouteCoordinate) {
  const nearest = findNearestPositionOnRoute(click, createRouteMeasure(geometry));
  if (!nearest) throw new Error("A route segment needs at least two coordinates");
  const coordinate: RouteCoordinate = [nearest.lng, nearest.lat];
  const left = [...geometry.slice(0, nearest.segmentIndex + 1), coordinate];
  const right = [coordinate, ...geometry.slice(nearest.segmentIndex + 1)];
  return { coordinate, left, right };
}

/** Local drag preview. The reducer commits this result only once, at drag end. */
export function previewPointMove(source: RouteEditorDocument, pointId: string, coordinate: RouteCoordinate): RouteEditorDocument {
  const document = copy(source);
  const moved = point(document, pointId);
  moved.coordinate = coordinate;
  for (const segment of adjacentSegments(document, pointId)) {
    segment.intendedGeometry = directGeometry(document, segment);
    if (segment.mode === "DIRECT") segment.geometry = directGeometry(document, segment);
    else if (segment.fromId === pointId) segment.geometry[0] = coordinate;
    else segment.geometry[segment.geometry.length - 1] = coordinate;
    segment.routingStatus = "idle";
  }
  return document;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "undo") return state.past.length ? { present: state.past.at(-1)!, past: state.past.slice(0, -1), future: [copy(state.present), ...state.future] } : state;
  if (action.type === "redo") return state.future.length ? { present: state.future[0], past: [...state.past, copy(state.present)], future: state.future.slice(1) } : state;
  const document = copy(state.present);
  if (action.type === "routing-start" || action.type === "routing-success" || action.type === "routing-failure") {
    const segment = document.segments.find((item) => item.id === action.segmentId);
    if (!segment || (action.type !== "routing-start" && segment.requestVersion !== action.version)) return state;
    if (action.type === "routing-start") { segment.requestVersion = action.version; segment.routingStatus = "routing"; }
    if (action.type === "routing-success") {
      const from = point(document, segment.fromId).coordinate, to = point(document, segment.toId).coordinate;
      segment.geometry = action.geometry.length >= 2 ? [from, ...action.geometry.slice(1, -1), to] : [from, to];
      segment.intendedGeometry = [from, to]; segment.routingStatus = "idle";
    }
    if (action.type === "routing-failure") segment.routingStatus = "failed";
    return { ...state, present: document };
  }
  if (action.type === "add") {
    if (action.atStart) {
      const previous = document.points[0]; document.points.unshift({ id: action.id, coordinate: action.coordinate });
      if (previous) document.segments.unshift(newSegment(action.segmentId!, action.id, previous.id, action.mode, [action.coordinate, previous.coordinate]));
    } else {
      const previous = document.points.at(-1); document.points.push({ id: action.id, coordinate: action.coordinate });
      if (previous) document.segments.push(newSegment(action.segmentId!, previous.id, action.id, action.mode, [previous.coordinate, action.coordinate]));
    }
  }
  if (action.type === "move") return commit(state, previewPointMove(document, action.pointId, action.coordinate));
  if (action.type === "mode") {
    const segment = document.segments.find((item) => item.id === action.segmentId); if (!segment) return state;
    segment.mode = action.mode;
    if (action.mode === "DIRECT") { segment.geometry = directGeometry(document, segment); segment.intendedGeometry = segment.geometry; segment.routingStatus = "idle"; }
  }
  if (action.type === "insert") {
    const index = document.segments.findIndex((item) => item.id === action.segmentId); if (index < 0) return state;
    const original = document.segments[index], split = splitSegmentGeometry(original.geometry, action.coordinate);
    const pointIndex = document.points.findIndex((item) => item.id === original.toId);
    document.points.splice(pointIndex, 0, { id: action.id, coordinate: split.coordinate });
    document.segments.splice(index, 1, newSegment(action.leftId, original.fromId, action.id, original.mode, split.left), newSegment(action.rightId, action.id, original.toId, original.mode, split.right));
  }
  if (action.type === "remove") {
    const index = document.points.findIndex((item) => item.id === action.pointId); if (index < 0) return state;
    const before = document.segments.find((item) => item.toId === action.pointId), after = document.segments.find((item) => item.fromId === action.pointId);
    document.points.splice(index, 1); document.segments = document.segments.filter((item) => item !== before && item !== after);
    if (before && after) {
      // A routed neighbour wins: joining it as DIRECT would silently change user intent.
      const mode: SegmentMode = before.mode === "ROUTED" || after.mode === "ROUTED" ? "ROUTED" : "DIRECT";
      const geometry = [point(document, before.fromId).coordinate, point(document, after.toId).coordinate];
      document.segments.splice(index - 1, 0, newSegment(action.replacementId!, before.fromId, after.toId, mode, geometry));
    }
  }
  return commit(state, document);
}

function newSegment(id: string, fromId: string, toId: string, mode: SegmentMode, geometry: RouteCoordinate[]): RouteSegment {
  return { id, fromId, toId, mode, geometry, intendedGeometry: [geometry[0], geometry.at(-1)!], routingStatus: "idle", requestVersion: 0 };
}
export function finalGeometry(document: RouteEditorDocument): RouteCoordinate[] { return document.segments.flatMap((segment, index) => index ? segment.geometry.slice(1) : segment.geometry); }
export function adjacentSegments(document: RouteEditorDocument, pointId: string) { return document.segments.filter((segment) => segment.fromId === pointId || segment.toId === pointId); }
export function affectedRoutedSegments(document: RouteEditorDocument, pointId: string) { return adjacentSegments(document, pointId).filter((segment) => segment.mode === "ROUTED"); }
