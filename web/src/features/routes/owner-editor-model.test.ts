import assert from "node:assert/strict";
import test from "node:test";
import { createEditorState, documentFromGeometry, editorReducer, finalGeometry, initializeExistingDocument } from "../route-editor/model";
import type { RouteCoordinate } from "./route-geometry";

test("imported GPX retains every vertex while keeping control points bounded", () => {
  const coordinates: RouteCoordinate[] = Array.from({ length: 1501 }, (_, i) => [21 + i / 100000, 52 + Math.sin(i) / 100000]);
  const doc = documentFromGeometry(coordinates);
  assert.deepEqual(finalGeometry(doc), coordinates);
  assert.ok(doc.points.length <= 101);
  doc.segments[0].geometry[0][0] = 0;
  assert.equal(coordinates[0][0], 21);
});

test("saved editor definitions retain control points and modes and reset transient routing state", () => {
  const saved = documentFromGeometry([[0, 0], [1, 1], [2, 2]]);
  saved.segments[0].mode = "DIRECT";
  saved.segments[1].routingStatus = "routing";
  saved.segments[1].requestVersion = 42;
  const initialized = initializeExistingDocument([], saved);
  assert.deepEqual(initialized.points, saved.points);
  assert.equal(initialized.segments[0].mode, "DIRECT");
  assert.equal(initialized.segments[1].routingStatus, "idle");
  assert.equal(initialized.segments[1].requestVersion, 0);
  assert.equal(saved.segments[1].routingStatus, "routing");
});

test("existing routes can extend both ends, shorten both ends, and undo boundary changes", () => {
  let state = createEditorState(documentFromGeometry([[1, 0], [2, 0], [3, 0], [4, 0]]));
  const original = structuredClone(state.present);
  state = editorReducer(state, { type: "add", coordinate: [0, 0], mode: "DIRECT", id: "start", segmentId: "prefix", atStart: true });
  state = editorReducer(state, { type: "add", coordinate: [5, 0], mode: "DIRECT", id: "end", segmentId: "suffix" });
  assert.deepEqual(finalGeometry(state.present), [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  assert.deepEqual(state.present.segments.slice(1, -1), original.segments);
  for (let i = 0; i < 2; i++) state = editorReducer(state, { type: "remove", pointId: state.present.points[0].id });
  for (let i = 0; i < 2; i++) state = editorReducer(state, { type: "remove", pointId: state.present.points.at(-1)!.id });
  assert.deepEqual(finalGeometry(state.present), [[2, 0], [3, 0]]);
  state = editorReducer(state, { type: "undo" });
  assert.deepEqual(finalGeometry(state.present), [[2, 0], [3, 0], [4, 0]]);
});
