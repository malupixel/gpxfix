"use client";
import { useTranslation } from "react-i18next";

export function SiteFooter() {
  const { t } = useTranslation();
  return <footer className="px-4 py-3 text-center text-xs text-slate-500"><a href="/data-licenses" className="underline">{t("licenses.footer")}</a></footer>;
}
