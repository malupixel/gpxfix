"use client";

import { useState } from "react";

type Props = { elevationGainMeters: number | null };

export function ElevationProfile({ elevationGainMeters }: Props) {
  const [showSuggestions, setShowSuggestions] = useState(true);
  return <section className="route-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4"><h2 className="text-lg font-bold">Elevation profile</h2>{elevationGainMeters !== null && <span className="text-xs font-semibold text-slate-600">↗ {Math.round(elevationGainMeters)} m total gain</span>}</div>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"><button type="button" role="switch" aria-checked={showSuggestions} onClick={() => setShowSuggestions((value) => !value)} className={`relative h-5 w-9 rounded-full transition ${showSuggestions ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${showSuggestions ? "left-[18px]" : "left-0.5"}`} /></button>Show suggestions</label>
    </div>
    <div className="mt-4 grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-emerald-50/40 px-6 text-center">
      <div><p className="text-sm font-semibold text-slate-700">Elevation profile is not available for this route yet</p><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">The API currently provides total elevation gain, but not the per-point elevation samples needed to draw an accurate chart.</p></div>
    </div>
  </section>;
}
