"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">{t("pages.notFoundTitle")}</h1><p className="mt-4 text-slate-600">{t("pages.notFoundHelp")}</p><Link href="/" className="mt-6 inline-block font-bold text-emerald-700">{t("pages.home")}</Link></main>;
}
