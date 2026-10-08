"use client";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { RouteData } from "@/types/route";
import { apiErrorKey } from "@/i18n/api-errors";
import { deleteRoute, getOwnerAccessToken, updateRouteInformation, updateSuggestionsSettings } from "./api";
import { managementRouteUrl } from "./route-links";
import { RouteDialog } from "./route-dialog";

export type ManagementAction = "information" | "ownerLink" | "suggestions" | "delete";
export function RouteManagementDialog({ route, action, onClose }: { route: RouteData; action: ManagementAction; onClose: () => void }) {
  if (action === "information") return <InformationDialog route={route} onClose={onClose} />;
  if (action === "ownerLink") return <PrivateLinkDialog route={route} onClose={onClose} />;
  if (action === "suggestions") return <SettingsDialog route={route} onClose={onClose} />;
  return <DeleteDialog route={route} onClose={onClose} />;
}
function useManagement(route: RouteData) {
  const queryClient = useQueryClient(); const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false);
  async function run(operation: () => Promise<unknown>) {
    setBusy(true); setError(null); setSaved(false);
    try { await operation(); await queryClient.invalidateQueries({ queryKey: ["route-activity", route.publicId] }); router.refresh(); setSaved(true); return true; }
    catch (caught) { setError(apiErrorKey(caught, "management.failed")); return false; }
    finally { setBusy(false); }
  }
  return { busy, error, saved, run };
}
function Result({ error, saved }: { error: string | null; saved: boolean }) {
  const { t } = useTranslation();
  return <>{error && <p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p>}{saved && <p role="status" className="mt-3 text-sm text-emerald-700">{t("management.saved")}</p>}</>;
}
function InformationDialog({ route, onClose }: { route: RouteData; onClose: () => void }) {
  const { t } = useTranslation(); const status = useManagement(route);
  const [name, setName] = useState(route.name), [description, setDescription] = useState(route.description ?? "");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(route.updatedAt);
  async function submit(event: FormEvent) { event.preventDefault(); await status.run(async () => { const updated = await updateRouteInformation(route.publicId, { name: name.trim(), description: description.trim() || null, expectedUpdatedAt }); setExpectedUpdatedAt(updated.updatedAt); }); }
  return <RouteDialog title={t("management.editInformation")} onClose={onClose} busy={status.busy}><form onSubmit={event => void submit(event)}>
    <label className="block text-sm font-bold">{t("upload.routeName")}<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} disabled={status.busy} className="mt-1 w-full rounded-lg border p-3" /></label>
    <label className="mt-4 block text-sm font-bold">{t("common.description")} {t("common.optional")}<textarea maxLength={10000} rows={5} value={description} onChange={event => setDescription(event.target.value)} disabled={status.busy} className="mt-1 w-full rounded-lg border p-3" /></label>
    <p className="mt-2 text-xs text-slate-600">{t("management.sharedMetadata")}</p><Result error={status.error} saved={status.saved} />
    <button disabled={status.busy || !name.trim()} className="route-button mt-4 w-full bg-emerald-700 text-white">{t(status.busy ? "editor.saving" : "management.saveInformation")}</button>
  </form></RouteDialog>;
}
function SettingsDialog({ route, onClose }: { route: RouteData; onClose: () => void }) {
  const { t } = useTranslation(); const status = useManagement(route); const [enabled, setEnabled] = useState(route.suggestionsEnabled);
  return <RouteDialog title={t("management.suggestions")} onClose={onClose} busy={status.busy}><label className="flex gap-3 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={status.busy} />{t("management.acceptSuggestions")}</label><p className="mt-3 text-sm text-slate-600">{t("management.suggestionsHelp")}</p><Result error={status.error} saved={status.saved} /><button disabled={status.busy} onClick={() => void status.run(() => updateSuggestionsSettings(route.publicId, enabled))} className="route-button mt-4 w-full">{t(status.busy ? "editor.saving" : "management.saveSettings")}</button></RouteDialog>;
}
function PrivateLinkDialog({ route, onClose }: { route: RouteData; onClose: () => void }) {
  const { t } = useTranslation(); const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [copied, setCopied] = useState(false);
  async function copy() { setBusy(true); setError(null); try { const { token } = await getOwnerAccessToken(route.publicId); const link = managementRouteUrl(route.publicId, token, location.origin); setUrl(link); try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("ownerLink.copyFailed"); } } catch (caught) { setError(apiErrorKey(caught, "ownerAccess.failed")); } finally { setBusy(false); } }
  return <RouteDialog title={t("ownerAccess.title")} onClose={onClose} busy={busy}><p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("ownerLink.private")}</p><p className="mt-3 text-sm">{t("ownerLink.warning")}</p>{url && <label className="mt-4 block text-sm font-bold">{t("ownerAccess.label")}<input readOnly value={url} onFocus={event => event.target.select()} className="mt-1 w-full rounded-lg border p-3 text-xs" /></label>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p>}<button onClick={() => void copy()} disabled={busy} className="route-button mt-4 w-full">{t(busy ? "ownerAccess.loading" : copied ? "common.copied" : "ownerAccess.copy")}</button></RouteDialog>;
}
function DeleteDialog({ route, onClose }: { route: RouteData; onClose: () => void }) {
  const { t } = useTranslation(); const status = useManagement(route); const router = useRouter(); const [confirmation, setConfirmation] = useState("");
  async function remove() { if (await status.run(() => deleteRoute(route.publicId, confirmation))) { onClose(); router.push("/"); } }
  return <RouteDialog title={t("management.delete")} onClose={onClose} busy={status.busy}><p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{t("management.deleteHelp")}</p><label className="mt-4 block text-sm font-bold">{t("management.confirmName", { name: route.name })}<input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={status.busy} autoComplete="off" className="mt-1 w-full rounded-lg border p-3" /></label><Result error={status.error} saved={false} /><button disabled={status.busy || confirmation !== route.name} onClick={() => void remove()} className="route-button mt-4 w-full bg-red-700 text-white">{t(status.busy ? "management.deleting" : "management.deleteConfirm")}</button></RouteDialog>;
}
