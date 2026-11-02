import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DURATIONS, demoReducer, initialDemoState } from './demo-model';
import { demoRoutes, demoPath } from './demo-data';

test('automatic sequence visits all five scenes once and ends without looping', () => {
  let state = initialDemoState;
  for (let step = 1; step <= 4; step++) { state = demoReducer(state, { type: 'tick' }); assert.equal(state.step, step); }
  state = demoReducer(state, { type: 'tick' });
  assert.equal(state.playing, false);
  assert.equal(state.step, 4);
  assert.ok(DEMO_DURATIONS.reduce((sum, ms) => sum + ms, 0) >= 12000);
  assert.ok(DEMO_DURATIONS.reduce((sum, ms) => sum + ms, 0) <= 18000);
});
test('manual navigation pauses automatic decisions; acceptance only works at review', () => {
  let state = demoReducer(initialDemoState, { type: 'select', step: 3 });
  assert.equal(state.playing, false);
  assert.equal(state.manual, true);
  assert.equal(demoReducer(state, { type: 'toggle' }).manual, false);
  assert.deepEqual(demoReducer(state, { type: 'tick' }), state);
  state = demoReducer(state, { type: 'accept' });
  assert.equal(state.step, 4);
  assert.equal(state.playing, false);
  assert.deepEqual(demoReducer(initialDemoState, { type: 'accept' }), initialDemoState);
  for (const step of [-1, 5, 1.5, NaN]) assert.deepEqual(demoReducer(state, { type: 'select', step }), state);
});
test('pause, resume and replay preserve a coherent state and restart the drawing', () => {
  const paused = demoReducer(initialDemoState, { type: 'toggle' });
  assert.equal(paused.playing, false);
  assert.equal(demoReducer(paused, { type: 'toggle' }).playing, true);
  const replay = demoReducer({ step: 4, playing: false, revision: 7 }, { type: 'restart' });
  assert.deepEqual(replay, { step: 0, playing: true, revision: 8 });
  assert.deepEqual(demoReducer({ step: 4, playing: false, revision: 7 }, { type: 'toggle' }), replay);
});
test('the replacement and original segment share exact anchors and keep the final route continuous', () => {
  const [start, replaced, finish, alternative] = demoRoutes.features.map(f => f.geometry.coordinates);
  assert.deepEqual(start.at(-1), replaced[0]);
  assert.deepEqual(replaced.at(-1), finish[0]);
  assert.deepEqual(alternative[0], replaced[0]);
  assert.deepEqual(alternative.at(-1), replaced.at(-1));
  assert.notDeepEqual(alternative, replaced);
  assert.equal(demoPath('start'), 'M85,330 L180,330 L180,260 L295,260');
});
