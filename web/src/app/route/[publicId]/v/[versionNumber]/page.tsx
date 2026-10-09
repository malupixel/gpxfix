import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRouteVersion } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { OwnershipGate } from "@/features/routes/ownership-gate";
import { cookies, headers } from "next/headers";
import { localeCookieName, resolveLocale } from "@/i18n/config";
import { apiClient } from "@/lib/api-client";
import { routeMetadata, type RouteShareData } from "@/features/routes/route-metadata";
type Props={params:Promise<{publicId:string;versionNumber:string}>};
async function load(publicId:string,value:string){const version=Number(value);if(!Number.isInteger(version)||version<1)notFound();try{return await getRouteVersion(publicId,version);}catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId, versionNumber } = await params;
  const version = Number(versionNumber);
  if (!Number.isInteger(version) || version < 1) notFound();
  let share: RouteShareData;
  try { share = await apiClient<RouteShareData>(`/api/routes/${encodeURIComponent(publicId)}/versions/${version}/share`, { cache: "no-store" }); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value, headerStore.get("accept-language"));
  return routeMetadata(share, locale, true);
}
export default async function HistoricalRoutePage({params}:Props){const{publicId,versionNumber}=await params;const route=await load(publicId,versionNumber);return <main className="min-h-screen bg-transparent px-3 py-5 sm:px-6 lg:py-6"><div className="mx-auto max-w-[1600px]"><OwnershipGate route={route}/></div></main>;}
