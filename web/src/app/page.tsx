"use client";
import { UploadForm } from "@/features/routes/upload-form";
import { useTranslation } from "react-i18next";
import Link from "next/link";
export default function Home() {
  const { t } = useTranslation();
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
    <h1 className="text-4xl font-bold tracking-tight">{t("landing.title")}</h1>
    <p className="mt-4 text-lg text-slate-600">{t("landing.subtitle")}</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t("landing.uploadTitle")}</h2><p className="mt-2 text-sm text-slate-600">{t("landing.uploadHelp")}</p><div className="mt-4"><UploadForm compact/></div></section><section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t("landing.drawTitle")}</h2><p className="mt-2 flex-1 text-sm text-slate-600">{t("landing.drawHelp")}</p><Link href="/draw" className="mt-4 rounded bg-emerald-700 px-5 py-2.5 text-center font-semibold text-white">{t("landing.drawTitle")}</Link></section></div>
  </main>;
}
