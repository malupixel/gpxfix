"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { RouteData } from "@/types/route";
import { formatRouteDate } from "./route-format";
import { managementRouteUrl, publicRoutePath, publicRouteUrl } from "./route-links";
import { getOwnerAccessToken } from "./api";
import { useTranslation } from "react-i18next";

type Props = { route: RouteData; isOwner: boolean };

export function RouteHeader({ route, isOwner }: Props) {
  const [copied, setCopied] = useState(false);
  const { t, i18n } = useTranslation();
  const routePath = publicRoutePath(route.publicId);

  async function copyRouteUrl() {
    const url = publicRouteUrl(route.publicId, window.location.origin);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <header className="mb-6">
      <nav aria-label={t("route.breadcrumb")} className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
        <Link href="/">Route Community</Link><span className="text-slate-400">›</span><span>{t("route.viewRoute")}</span>
      </nav>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{route.name}</h1>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{t("route.openSuggestions")}</span>
            {isOwner && <OwnerAccess publicId={route.publicId} />}
          </div>
          {route.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{route.description}</p>}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Metric icon="↔" label={t("route.distance")} value={`${(route.distanceMeters / 1000).toFixed(1)} km`} />
            {route.elevationGainMeters !== null && <Metric icon="△" label={t("route.elevationGain")} value={`${Math.round(route.elevationGainMeters)} m`} />}
            <Metric icon="□" label={t("route.shared")} value={formatRouteDate(route.createdAt, i18n.language)} />
          </dl>
        </div>
        <div className="w-full shrink-0 sm:w-auto lg:w-80">
          <div className="flex gap-2 sm:justify-end">
            <button disabled title={t("route.moreSoon")} className="route-button flex-1 disabled:cursor-not-allowed disabled:opacity-65">•••&nbsp;&nbsp; {t("route.more")}</button>
            <button onClick={copyRouteUrl} className="route-button flex-1 border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800">⌯&nbsp;&nbsp; {t("route.share")}</button>
          </div>
          <div className="mt-2 flex items-center rounded-lg border border-slate-200 bg-white p-1 pl-3 shadow-sm">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{routePath}</span>
            <button onClick={copyRouteUrl} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">{copied ? t("common.copied") : t("common.copy")}</button>
          </div>
        </div>
      </div>
    </header>
  );
}

function OwnerAccess({ publicId }: { publicId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) { if (!panel.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || url) return;
    setError(false);
    try {
      const { token } = await getOwnerAccessToken(publicId);
      setUrl(managementRouteUrl(publicId, token, window.location.origin));
    } catch { setError(true); }
  }

  async function copyOwnerUrl() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setError(true); }
  }

  return <div ref={panel} className="relative">
    <button type="button" onClick={toggle} aria-expanded={open} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">
      🔑 {t("route.ownerMode")} <span aria-hidden="true">▾</span>
    </button>
    {open && <section role="dialog" aria-label={t("ownerAccess.title")} className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-amber-200 bg-white p-4 shadow-xl">
      <h2 className="font-bold text-slate-950">🔑 {t("ownerAccess.title")}</h2>
      <p className="mt-2 text-sm leading-5 text-slate-600">{t("ownerAccess.explanation")}</p>
      {url && <><label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-amber-900" htmlFor="owner-access-url">{t("ownerAccess.label")}</label>
        <input id="owner-access-url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-700" />
        <button type="button" onClick={copyOwnerUrl} className="mt-3 w-full rounded-lg border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">{copied ? t("common.copied") : t("ownerAccess.copy")}</button></>}
      {!url && !error && <p className="mt-4 text-sm text-slate-500">{t("ownerAccess.loading")}</p>}
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{t("ownerAccess.failed")}</p>}
    </section>}
  </div>;
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="grid grid-cols-[24px_auto] items-center gap-x-2"><span className="row-span-2 grid size-6 place-items-center rounded-full border border-slate-300 text-xs text-slate-600">{icon}</span><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{value}</dd></div>;
}
