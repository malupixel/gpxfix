"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function RouteDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const { t } = useTranslation(); const titleId = useId(); const panel = useRef<HTMLElement>(null);
  const current = useRef({ onClose, busy });
  useEffect(() => { current.current = { onClose, busy }; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      const popover = panel.current?.querySelector<HTMLElement>(":popover-open");
      if (event.key === "Escape" && popover) {
        event.preventDefault(); event.stopImmediatePropagation(); popover.hidePopover();
        panel.current?.querySelector<HTMLButtonElement>(`[aria-controls="${CSS.escape(popover.id)}"]`)?.focus();
        return;
      }
      if (event.key === "Escape" && !panel.current?.querySelector(":popover-open") && !current.current.busy) current.current.onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[10020] grid place-items-center bg-slate-950/50 p-4" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-4"><h2 id={titleId} className="text-xl font-bold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label={t("common.cancel")} className="route-button">×</button></header>{children}
    </section>
  </div>;
}
