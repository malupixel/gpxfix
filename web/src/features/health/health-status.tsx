"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiHealth } from "./api";

export function HealthStatus() {
  const { data, isPending, isError } = useQuery({ queryKey: ["api-health"], queryFn: getApiHealth });
  const apiStatus = isPending ? "Checking…" : isError ? "Unavailable" : data?.status === "ok" ? "OK" : "Unknown";

  return (
    <dl className="mt-8 space-y-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-8"><dt>Frontend</dt><dd className="font-semibold text-emerald-700">OK</dd></div>
      <div className="flex justify-between gap-8"><dt>API</dt><dd className="font-semibold">{apiStatus}</dd></div>
    </dl>
  );
}
