"use client";

import { createInstance } from "i18next";
import { I18nextProvider, useTranslation } from "react-i18next";
import { useState } from "react";
import { localeCookie, supportedLocales, type Locale } from "./config";
import { resources } from "./resources";

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [instance] = useState(() => {
    const i18n = createInstance();
    void i18n.init({ resources, lng: initialLocale, fallbackLng: "pl", supportedLngs: supportedLocales, interpolation: { escapeValue: false }, initAsync: false });
    return i18n;
  });
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const selected = i18n.resolvedLanguage as Locale;
  async function choose(locale: Locale) {
    // Browser-owned persistence and document metadata are intentionally updated by this user event.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = localeCookie(locale);
    document.documentElement.setAttribute("lang", locale);
    await i18n.changeLanguage(locale);
  }
  return <div className="fixed right-3 top-3 z-[10000] flex rounded-lg border border-slate-200 bg-white/95 p-1 text-xs font-bold shadow-sm backdrop-blur" role="group" aria-label={t("common.language")}>
    {supportedLocales.map((locale) => <button key={locale} type="button" aria-pressed={selected === locale} onClick={() => void choose(locale)} className={`rounded px-2 py-1.5 ${selected === locale ? "bg-emerald-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{locale.toUpperCase()}</button>)}
  </div>;
}
