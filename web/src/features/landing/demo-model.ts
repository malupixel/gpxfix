export const DEMO_DURATIONS = [2600, 2200, 3200, 5000, 2200] as const;
export const DEMO_STEPS = ['prepare', 'share', 'suggest', 'accept', 'ready'] as const;
export type DemoState = { step: number; playing: boolean; revision: number; manual?: boolean };
export type DemoAction = { type: 'tick' | 'toggle' | 'restart' | 'accept' } | { type: 'select'; step: number };
export const initialDemoState: DemoState = { step: 0, playing: true, revision: 0 };
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'tick': return !state.playing ? state : state.step === 4 ? { ...state, playing: false } : { ...state, step: state.step + 1 };
    case 'toggle': return state.step === 4 && !state.playing ? { step: 0, playing: true, revision: state.revision + 1 } : { ...state, playing: !state.playing, manual: false };
    case 'restart': return { step: 0, playing: true, revision: state.revision + 1 };
    case 'select': return Number.isInteger(action.step) && action.step >= 0 && action.step <= 4 ? { step: action.step, playing: false, revision: state.revision + 1, manual: true } : state;
    case 'accept': return state.step === 3 ? { ...state, step: 4, playing: false } : state;
  }
}
