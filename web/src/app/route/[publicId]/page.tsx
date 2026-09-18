import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RouteMap } from "@/components/map/route-map";
import { getRoute } from "@/features/routes/api";
import { ElevationProfile } from "@/features/routes/elevation-profile";
import { RouteFeedbackSidebar, ShareRouteCard } from "@/features/routes/route-feedback";
import { RouteHeader } from "@/features/routes/route-header";
import { RouteInformation } from "@/features/routes/route-information";
import { CommunityMarkerLegend, RouteMapToolbar } from "@/features/routes/route-map-toolbar";
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
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><RouteMapToolbar /><RouteMap geometry={route.geometry} /><CommunityMarkerLegend /></section>
        <ElevationProfile elevationGainMeters={route.elevationGainMeters} />
        <RouteInformation route={route} />
      </div>
      <div className="space-y-4 xl:sticky xl:top-4"><ShareRouteCard /><RouteFeedbackSidebar /></div>
    </div>
  </div></main>;
}
