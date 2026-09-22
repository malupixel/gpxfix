"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiHealth } from "./api";
import { useTranslation } from "react-i18next";

export function HealthStatus() {
  const { data, isPending, isError } = useQuery({ queryKey: ["api-health"], queryFn: getApiHealth });
  const { t } = useTranslation(); const apiStatus = isPending ? t("health.checking") : isError ? t("health.unavailable") : data?.status === "ok" ? "OK" : t("health.unknown");

  return (
    <dl className="mt-8 space-y-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-8"><dt>{t("health.frontend")}</dt><dd className="font-semibold text-emerald-700">OK</dd></div>
      <div className="flex justify-between gap-8"><dt>{t("health.api")}</dt><dd className="font-semibold">{apiStatus}</dd></div>
    </dl>
  );
}
