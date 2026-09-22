"use client";
import { UploadForm } from "@/features/routes/upload-form";
import { useTranslation } from "react-i18next";
export default function Home() {
  const { t } = useTranslation();
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
    <h1 className="text-4xl font-bold tracking-tight">{t("landing.title")}</h1>
    <p className="mt-4 text-lg text-slate-600">{t("landing.subtitle")}</p>
    <UploadForm />
  </main>;
}
