"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/i18n/provider";

export function SiteHeader() {
  const { t } = useTranslation();
  return <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-2 sm:px-6">
      <Link href="/" aria-label={t("routeUi.home")} className="block min-w-0 w-[240px] sm:w-[330px]">
        <Image src="/logo.png" width={2172} height={724} alt={t("landing.title")} priority sizes="(max-width: 639px) 240px, 330px" className="block h-auto w-full object-contain" />
      </Link>
      <LanguageSwitcher />
    </div>
  </header>;
}
