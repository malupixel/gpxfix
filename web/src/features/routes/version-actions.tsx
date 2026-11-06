"use client";
import { useId, useRef, useState, type ReactNode } from "react";

/** Native popover stays in the dialog DOM/focus scope, but paints in the top layer. */
export function VersionActions({ label, children }: { label: string; children: ReactNode }) {
  const id = useId(), button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  function toggle() {
    if (!menu.current || !button.current) return;
    if (menu.current.matches(":popover-open")) { menu.current.hidePopover(); return; }
    const box = button.current.getBoundingClientRect();
    menu.current.style.left = `${Math.max(8, Math.min(box.right - 296, window.innerWidth - 304))}px`;
    menu.current.style.top = `${Math.max(8, Math.min(box.bottom + 4, window.innerHeight - 310))}px`;
    menu.current.showPopover(); menu.current.querySelector<HTMLButtonElement>("button")?.focus();
  }
  return <><button ref={button} type="button" className="route-button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={toggle}>⋯</button>
    <div id={id} ref={menu} popover="auto" role="menu" aria-label={label} onToggle={e => setOpen(e.newState === "open")} className="fixed m-0 max-h-[calc(100dvh-1rem)] w-[min(18.5rem,calc(100vw-1rem))] overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl"
      onClick={event => { if ((event.target as HTMLElement).closest("button")) { menu.current?.hidePopover(); button.current?.focus(); } }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); menu.current?.hidePopover(); button.current?.focus(); }
        const controls = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const index = controls.indexOf(document.activeElement as HTMLButtonElement);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          controls[event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : (index + (event.key === "ArrowDown" ? 1 : controls.length - 1)) % controls.length]?.focus();
        }
      }}>{children}</div></>;
}
