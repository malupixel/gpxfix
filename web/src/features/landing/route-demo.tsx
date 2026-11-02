"use client";

import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { DEMO_DURATIONS, DEMO_STEPS, demoReducer, initialDemoState } from './demo-model';
import { demoPath, demoStreets } from './demo-data';

const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const motionSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
};
const visibilitySnapshot = () => document.visibilityState === 'visible';
const serverSnapshot = () => false;

export function RouteDemo() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLElement>(null);
  const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot, serverSnapshot);
  const tabVisible = useSyncExternalStore(subscribeVisibility, visibilitySnapshot, serverSnapshot);
  const running = visible && tabVisible && state.playing && !reduced;
  const current = DEMO_STEPS[state.step];

  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false), { threshold: .3 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), DEMO_DURATIONS[state.step]);
    return () => window.clearTimeout(timer);
  }, [running, state.step, state.revision]);

  return <section ref={root} id="how-it-works" aria-label={t('demo.title')} className="route-demo" data-stage={state.step} data-running={running} data-reduced={reduced}>
    <div className="demo-topbar"><h2>{t('demo.title')}</h2><span className="demo-example"><span aria-hidden="true" />{t('demo.example')}</span></div>
    <div className="demo-map">
      <svg viewBox="0 0 800 420" role="img" aria-label={t(state.step === 4 ? 'demo.mapMerged' : 'demo.mapOriginal')}>
        <rect width="800" height="420" fill="#f1f0e8" />
        <g fill="#e5e6dd" stroke="#dcdfd3" strokeWidth="1">
          {[[100,165,65,42],[195,165,82,42],[310,32,75,50],[400,32,85,50],[520,32,85,50],[100,275,65,40],[195,275,80,40],[520,275,85,40],[520,345,85,55],[195,345,85,55]].map(([x,y,w,h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="6" />)}
        </g>
        <path d="M310 175H485V265L455 300H350L310 250Z" fill="#dbe8d4" />
        <path d="M320 355H480V430H305Z" fill="#dbe8d4" />
        <path d="M775 -20C655 80 820 170 730 270S760 390 685 450" fill="none" stroke="#c1dedf" strokeWidth="66" />
        <path d="M775 -20C655 80 820 170 730 270S760 390 685 450" fill="none" stroke="#d8ebea" strokeWidth="2" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#dbddd3" strokeWidth="13">{demoStreets.map(path => <path key={path} d={path} />)}</g>
          <g stroke="#fffef8" strokeWidth="9">{demoStreets.map(path => <path key={path} d={path} />)}</g>
          <path d="M-20 380H260L365 420M400 -10V150M625 225L705 310" stroke="#fffef8" strokeWidth="5" />
        </g>
        <g fill="#bdcfb3">{[[340,195],[370,240],[460,200],[355,380],[430,390],[555,370],[550,70]].map(([x,y]) => <g key={x+y}><circle cx={x} cy={y} r="8"/><circle cx={x+7} cy={y+4} r="6"/></g>)}</g>
        <text x="395" y="218" textAnchor="middle" fill="#74866b" fontSize="12" letterSpacing="3">{t('demo.park')}</text>
        <g key={state.revision} className={state.step === 0 && !state.manual ? 'demo-drawing' : ''} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7">
          <path className="demo-route-start" d={demoPath('start')} pathLength="1" stroke="#2563eb" />
          <path className="demo-route-replaced" d={demoPath('replaced')} pathLength="1" stroke="#2563eb" />
          <path className="demo-route-finish" d={demoPath('finish')} pathLength="1" stroke="#2563eb" />
          <path className="demo-route-alternative-halo" d={demoPath('alternative')} stroke="#fff" strokeWidth="12" />
          <path className="demo-route-alternative" d={demoPath('alternative')} stroke="#059669" strokeDasharray="10 8" />
        </g>
        <g stroke="#fff" strokeWidth="4"><circle cx="85" cy="330" r="12" fill="#2563eb"/><circle cx="705" cy="100" r="12" fill="#f97316" /></g>
        <g fill="#334155" fontSize="11" fontWeight="700"><text x="85" y="370" textAnchor="middle">{t('route.start')}</text><text x="705" y="77" textAnchor="middle">{t('route.finish')}</text></g>
      </svg>
      {state.step === 1 && <div className="demo-share-bubble"><span className="demo-avatar" aria-hidden="true">↗</span><div><strong>{t('demo.linkSent')}</strong><span>{t('demo.linkAudience')}</span></div><span className="demo-check" aria-hidden="true">✓</span></div>}
      {state.step >= 2 && <div className={`demo-comment ${state.step === 4 ? 'demo-comment-accepted' : ''}`}><span className="demo-avatar" aria-hidden="true">{state.step === 4 ? '✓' : 'A'}</span><div><strong>{t(state.step === 4 ? 'demo.accepted' : 'demo.friend')}</strong><p>{t(state.step === 4 ? 'demo.acceptedDetail' : 'demo.comment')}</p></div></div>}
      <div className="demo-map-caption">{t('demo.illustration')}</div>
      <div className="demo-map-key"><span className="demo-key-blue">{t('demo.yourRoute')}</span>{state.step >= 2 && state.step < 4 && <span className="demo-key-green">{t('demo.suggestion')}</span>}</div>
    </div>
    <div className="demo-story">
      <div className="demo-story-copy" aria-live={state.playing && !reduced ? 'off' : 'polite'} aria-atomic="true"><span className="demo-step-count">{t('demo.stepCount', { step: state.step + 1 })}</span><h3>{t(`demo.scenes.${current}.title`)}</h3><p>{t(`demo.scenes.${current}.description`)}</p></div>
      <div className="demo-decision">{state.step === 3 ? <button className="demo-accept" onClick={() => dispatch({ type: 'accept' })}><span aria-hidden="true">✓</span> {t('demo.accept')}</button> : <span className={state.step === 4 ? 'demo-ready' : 'demo-decision-hint'}>{state.step === 4 && <span aria-hidden="true">✓ </span>}{t(state.step === 4 ? 'demo.readyHint' : 'demo.ownerDecides')}</span>}</div>
    </div>
    <nav className="demo-steps" aria-label={t('demo.stepsLabel')}>{DEMO_STEPS.map((step, index) => <button key={step} aria-label={t('demo.goTo', { step: index + 1, title: t(`demo.scenes.${step}.title`) })} aria-current={state.step === index ? 'step' : undefined} onClick={() => dispatch({ type: 'select', step: index })}><span aria-hidden="true">{index + 1}</span><span>{t(`demo.short.${step}`)}</span></button>)}</nav>
    <div className="demo-controls"><div>{!reduced && <button onClick={() => dispatch({ type: 'toggle' })}><span aria-hidden="true">{state.playing ? 'Ⅱ' : '▷'}</span>{t(state.playing ? 'demo.pause' : 'demo.play')}</button>}<button onClick={() => dispatch(reduced ? { type: 'select', step: 0 } : { type: 'restart' })}><span aria-hidden="true">↻</span>{t('demo.restart')}</button></div><div><button aria-label={t('demo.previous')} disabled={state.step === 0} onClick={() => dispatch({ type: 'select', step: state.step - 1 })}>←</button><button aria-label={t('demo.next')} disabled={state.step === 4} onClick={() => dispatch({ type: 'select', step: state.step + 1 })}>→</button></div></div>
  </section>;
}
