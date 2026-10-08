"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useTranslation();
  return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">{t("pages.errorTitle")}</h1><p className="mt-4 text-slate-600">{t("pages.errorHelp")}</p><div className="mt-6 flex gap-4"><button onClick={retry} className="route-button">{t("pages.retry")}</button><Link href="/" className="route-button">{t("pages.home")}</Link></div></main>;
}
