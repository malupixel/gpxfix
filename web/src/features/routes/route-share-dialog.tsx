"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RouteData } from "@/types/route";
import { RouteDialog } from "./route-dialog";
import { publicRoutePath, routeVersionPath } from "./route-links";

export function RouteShareDialog({ route, onClose }: { route: RouteData; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false), [error, setError] = useState(false);
  const path = routeVersionPath(route.publicId, route.viewedVersion);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
  const latest = typeof window === "undefined" ? publicRoutePath(route.publicId) : new URL(publicRoutePath(route.publicId), window.location.origin).toString();
  async function copy(value: string) {
    setError(false);
    try { await navigator.clipboard.writeText(value); setCopied(true); } catch { setError(true); }
  }
  return <RouteDialog title={t("route.share")} onClose={onClose}>
    <p className="text-sm leading-6 text-slate-600">{t("feedback.shareText")}</p>
    <label className="mt-5 block text-sm font-semibold">{t("routeUi.versionLink", { version: route.viewedVersion })}<input readOnly value={url} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>
    <button onClick={() => void copy(url)} className="route-button mt-3 w-full bg-emerald-700 text-white">{copied ? t("common.copied") : t("common.copy")}</button>
    <button onClick={() => void copy(latest)} className="route-button mt-2 w-full">{t("routeUi.copyLatest")}</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{t("management.copyFailed")}</p>}
    {copied && <p role="status" className="mt-3 text-sm text-emerald-800">{t("common.copied")}</p>}
  </RouteDialog>;
}
