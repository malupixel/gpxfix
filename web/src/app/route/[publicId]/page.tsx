import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRoute } from "@/features/routes/api";
import { RouteHeader } from "@/features/routes/route-header";
import { RoutePageContent } from "@/features/routes/route-page-content";
import { ApiError } from "@/lib/api-client";

type Props = { params: Promise<{ publicId: string }> };

async function load(publicId: string) {
  try { return await getRoute(publicId); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const route = await load(publicId);
  return { title: `${route.name} | Route Community`, description: route.description || `${(route.distanceMeters / 1000).toFixed(1)} km cycling route shared on Route Community.` };
}

export default async function RoutePage({ params }: Props) {
  const { publicId } = await params;
  const route = await load(publicId);

  return <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-6 lg:py-8"><div className="mx-auto max-w-[1450px]">
    <RouteHeader route={route} />
    <RoutePageContent route={route} />
  </div></main>;
}
