"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { CreateRouteResponse, RouteData, RouteVersionSummary } from "@/types/route";
import { RouteDialog } from "./route-dialog";
import { copyRouteVersion, createRouteBranch, labelRouteVersion } from "./api";
import { managementRouteUrl, publicRoutePath, publicRouteUrl } from "./route-links";

export type VersionAction = "branch" | "copy" | "label";
export function VersionCreateDialog({ route, version, action, onClose }: { route: RouteData; version: RouteVersionSummary; action: VersionAction; onClose: () => void }) {
  const { t } = useTranslation(), router = useRouter();
  const [name, setName] = useState(action === "label" ? version.label ?? "" : "");
  const [description, setDescription] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [created, setCreated] = useState<CreateRouteResponse | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(false);
    try {
      if (action === "branch") {
        const branch = await createRouteBranch(route.publicId, version.versionNumber, name.trim(), description.trim() || null);
        router.push(publicRoutePath(route.publicId, branch.publicId)); router.refresh(); onClose();
      } else if (action === "copy") setCreated(await copyRouteVersion(route.publicId, version.versionNumber, name.trim(), description.trim() || null));
      else { await labelRouteVersion(route.publicId, version.versionNumber, name.trim()); router.refresh(); onClose(); }
    } catch { setError(true); } finally { setBusy(false); }
  }
  const owner = created ? managementRouteUrl(created.publicId, created.managementToken, window.location.origin) : "";
  return <RouteDialog title={t(`branches.${action}`)} onClose={onClose} busy={busy}>
    {created ? <div className="space-y-4"><p>{t("branches.created")}</p>
      <label className="block text-sm font-semibold">{t("branches.publicLink")}<input readOnly className="mt-1 w-full rounded border p-3" value={publicRouteUrl(created.publicId, window.location.origin)} onFocus={e => e.currentTarget.select()} /></label>
      <label className="block text-sm font-semibold">{t("branches.ownerLink")}<input readOnly className="mt-1 w-full rounded border p-3" value={owner} onFocus={e => e.currentTarget.select()} /></label>
      <a className="route-button block text-center" href={`${owner}&edit=1`}>{t("branches.openEdit")}</a>
    </div> : <form onSubmit={event => void submit(event)} className="space-y-4">
      <p className="text-sm text-slate-600">{t("branches.fromVersion", { version: version.versionNumber })}</p>
      <label className="block text-sm font-semibold">{t(action === "label" ? "branches.optionalName" : "branches.name")}<input required={action !== "label"} maxLength={action === "copy" ? 200 : 80} value={name} onChange={e => setName(e.target.value)} disabled={busy} className="mt-1 w-full rounded border p-3" /></label>
      {action !== "label" && <label className="block text-sm font-semibold">{t("branches.description")}<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} disabled={busy} className="mt-1 w-full rounded border p-3" /></label>}
      {error && <p role="alert" className="text-red-700">{t("branches.failed")}</p>}
      <button disabled={busy || (action !== "label" && !name.trim())} className="route-button w-full bg-emerald-700 text-white">{t(busy ? "branches.saving" : "branches.save")}</button>
    </form>}
  </RouteDialog>;
}
