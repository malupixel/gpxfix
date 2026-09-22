"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ElevationSample } from "@/types/route";
import { chartElevationSamples, elevationSummary, nearestElevationSample, type ValidElevationSample } from "./elevation-profile-data";

type Props = { samples: ElevationSample[]; onHighlight: (coordinate: [number, number] | null) => void };
const WIDTH = 1000, HEIGHT = 220, LEFT = 58, RIGHT = 18, TOP = 16, BOTTOM = 34;

export function ElevationProfile({ samples, onHighlight }: Props) {
  const { t } = useTranslation();
  const chartSamples = useMemo(() => chartElevationSamples(samples), [samples]);
  const summary = useMemo(() => elevationSummary(samples), [samples]);
  const [hovered, setHovered] = useState<ValidElevationSample | null>(null);

  if (!summary || chartSamples.length < 2) return <section className="route-card p-4"><h2 className="text-lg font-bold">{t("elevation.title")}</h2><div className="mt-4 grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50/90 px-6 text-center"><p className="text-sm font-semibold text-slate-600">{t("elevation.noData")}</p></div></section>;

  const maximumDistance = samples.at(-1)?.distanceMeters || chartSamples.at(-1)!.distanceMeters || 1;
  const elevationRange = Math.max(1, summary.maxMeters - summary.minMeters);
  const x = (distance: number) => LEFT + distance / maximumDistance * (WIDTH - LEFT - RIGHT);
  const y = (elevation: number) => TOP + (summary.maxMeters - elevation) / elevationRange * (HEIGHT - TOP - BOTTOM);
  const line = chartSamples.map((sample, index) => `${index ? "L" : "M"}${x(sample.distanceMeters).toFixed(1)},${y(sample.elevationMeters).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maximumDistance)},${HEIGHT - BOTTOM} L${LEFT},${HEIGHT - BOTTOM} Z`;

  function move(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = Math.max(LEFT, Math.min(WIDTH - RIGHT, (event.clientX - bounds.left) / bounds.width * WIDTH));
    const sample = nearestElevationSample(chartSamples, (chartX - LEFT) / (WIDTH - LEFT - RIGHT) * maximumDistance);
    setHovered(sample); onHighlight(sample ? [sample.longitude, sample.latitude] : null);
  }
  function leave() { setHovered(null); onHighlight(null); }

  return <section className="route-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{t("elevation.title")}</h2><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600"><span>{t("elevation.gain", { value: Math.round(summary.gainMeters) })}</span><span>{t("elevation.loss", { value: Math.round(summary.lossMeters) })}</span><span>{t("elevation.minimum", { value: Math.round(summary.minMeters) })}</span><span>{t("elevation.maximum", { value: Math.round(summary.maxMeters) })}</span></div></div>
    <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-[220px] w-full touch-none" role="img" aria-label={t("elevation.chartLabel")} onPointerMove={move} onPointerLeave={leave}>
        <defs><linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity="0.34"/><stop offset="1" stopColor="#10b981" stopOpacity="0.05"/></linearGradient></defs>
        {[0, .5, 1].map((fraction) => <line key={fraction} x1={LEFT} x2={WIDTH-RIGHT} y1={TOP + fraction*(HEIGHT-TOP-BOTTOM)} y2={TOP + fraction*(HEIGHT-TOP-BOTTOM)} stroke="#e2e8f0" strokeWidth="1" />)}
        <path d={area} fill="url(#elevation-fill)"/><path d={line} fill="none" stroke="#059669" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        <text x={LEFT-8} y={TOP+4} textAnchor="end" className="fill-slate-500 text-[12px]">{Math.round(summary.maxMeters)} m</text><text x={LEFT-8} y={HEIGHT-BOTTOM+4} textAnchor="end" className="fill-slate-500 text-[12px]">{Math.round(summary.minMeters)} m</text>
        {[0,.5,1].map((fraction) => <text key={fraction} x={LEFT+fraction*(WIDTH-LEFT-RIGHT)} y={HEIGHT-10} textAnchor={fraction===0?"start":fraction===1?"end":"middle"} className="fill-slate-500 text-[12px]">{(maximumDistance*fraction/1000).toFixed(fraction===0?0:1)} km</text>)}
        {hovered && <><line x1={x(hovered.distanceMeters)} x2={x(hovered.distanceMeters)} y1={TOP} y2={HEIGHT-BOTTOM} stroke="#0f172a" strokeDasharray="4 4"/><circle cx={x(hovered.distanceMeters)} cy={y(hovered.elevationMeters)} r="6" fill="#059669" stroke="white" strokeWidth="3"/></>}
      </svg>
      {hovered && <div className="pointer-events-none absolute top-3 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg" style={{ left: `${Math.max(8, Math.min(88, hovered.distanceMeters/maximumDistance*100))}%`, transform: "translateX(-50%)" }}><div>{(hovered.distanceMeters/1000).toFixed(1)} km</div><div>{Math.round(hovered.elevationMeters)} m</div></div>}
    </div>
  </section>;
}
