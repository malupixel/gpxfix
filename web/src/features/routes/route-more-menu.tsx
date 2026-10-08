"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RouteData } from "@/types/route";
import { RouteManagementDialog, type ManagementAction } from "./route-management-dialogs";

export function RouteMoreMenu({ route, isOwner, onHistory, onCopy }: { route: RouteData; isOwner: boolean; onHistory: () => void; onCopy: () => void }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false), [action, setAction] = useState<ManagementAction | null>(null); const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const manage = (value: ManagementAction) => { root.current?.querySelector<HTMLButtonElement>("button")?.focus(); setAction(value); setOpen(false); };
  function details() { setOpen(false); const element = document.getElementById("route-details"); if (!element) { window.dispatchEvent(new Event("route-show-information")); return; } element.scrollIntoView({ behavior: "smooth", block: "center" }); element?.focus({ preventScroll: true }); }
  return <div ref={root} className="relative"><button aria-expanded={open} aria-controls={`route-actions-${route.publicId}`} onClick={() => setOpen(value => !value)} className="route-button w-full">••• {t("route.more")}</button>
    {open && <div id={`route-actions-${route.publicId}`} role="group" aria-label={t("route.more")} className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-h-[70dvh] overflow-y-auto rounded-xl border bg-white p-2 text-sm shadow-xl">
      <button onClick={() => { root.current?.querySelector<HTMLButtonElement>("button")?.focus(); setOpen(false); onHistory(); }} className="route-menu-action">{t("versions.history")}</button>
      <button onClick={() => { setOpen(false); onCopy(); }} className="route-menu-action">{t("management.copyVersion")}</button>
      <button onClick={details} className="route-menu-action">{t("route.details")}</button>
      {isOwner && <div className="mt-2 border-t pt-2"><p className="px-3 py-1 text-xs font-bold text-slate-500">{t("management.title")}</p>
        <button onClick={() => manage("information")} className="route-menu-action">{t("management.editInformation")}</button>
        <button onClick={() => manage("ownerLink")} className="route-menu-action">{t("ownerAccess.copy")}</button>
        <button onClick={() => manage("suggestions")} className="route-menu-action">{t("management.suggestions")}</button>
        <button onClick={() => manage("delete")} className="route-menu-action text-red-700">{t("management.delete")}</button>
      </div>}
    </div>}
    {isOwner && action && <RouteManagementDialog route={route} action={action} onClose={() => setAction(null)} />}
  </div>;
}
