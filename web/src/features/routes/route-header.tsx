"use client";

import Link from "next/link";
import { useState } from "react";

import type { RouteData } from "@/types/route";
import { formatRouteDate } from "./route-format";
import { publicRoutePath, publicRouteUrl } from "./route-links";

type Props = { route: RouteData; isOwner: boolean };

export function RouteHeader({ route, isOwner }: Props) {
  const [copied, setCopied] = useState(false);
  const routePath = publicRoutePath(route.publicId);

  async function copyRouteUrl() {
    const url = publicRouteUrl(route.publicId, window.location.origin);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <header className="mb-6">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
        <Link href="/">Route Community</Link><span className="text-slate-400">›</span><span>View route</span>
      </nav>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{route.name}</h1>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Open for suggestions</span>
            {isOwner && <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Owner mode</span>}
          </div>
          {route.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{route.description}</p>}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Metric icon="↔" label="Distance" value={`${(route.distanceMeters / 1000).toFixed(1)} km`} />
            {route.elevationGainMeters !== null && <Metric icon="△" label="Elevation gain" value={`${Math.round(route.elevationGainMeters)} m`} />}
            <Metric icon="□" label="Shared" value={formatRouteDate(route.createdAt)} />
          </dl>
        </div>
        <div className="w-full shrink-0 sm:w-auto lg:w-80">
          <div className="flex gap-2 sm:justify-end">
            <button disabled title="More route actions are coming soon" className="route-button flex-1 disabled:cursor-not-allowed disabled:opacity-65">•••&nbsp;&nbsp; More</button>
            <button onClick={copyRouteUrl} className="route-button flex-1 border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800">⌯&nbsp;&nbsp; Share route</button>
          </div>
          <div className="mt-2 flex items-center rounded-lg border border-slate-200 bg-white p-1 pl-3 shadow-sm">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{routePath}</span>
            <button onClick={copyRouteUrl} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">{copied ? "Copied!" : "Copy"}</button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="grid grid-cols-[24px_auto] items-center gap-x-2"><span className="row-span-2 grid size-6 place-items-center rounded-full border border-slate-300 text-xs text-slate-600">{icon}</span><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{value}</dd></div>;
}
