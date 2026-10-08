import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRoute } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { OwnershipGate } from "@/features/routes/ownership-gate";
import { getServerTranslation } from "@/i18n/server";

type Props = { params: Promise<{ publicId: string }> };

async function load(publicId: string) {
  try { return await getRoute(publicId); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const route = await load(publicId);
  const t = await getServerTranslation();
  return { alternates: { canonical: `/route/${encodeURIComponent(publicId)}` }, title: `${route.name} | ${t("landing.title")}`, description: route.description || t("metadata.routeDescription", { distance: (route.distanceMeters / 1000).toFixed(1) }) };
}

export default async function RoutePage({ params }: Props) {
  const { publicId } = await params;
  const route = await load(publicId);

  return <main className="min-h-screen bg-transparent px-3 py-5 sm:px-6 lg:py-6"><div className="mx-auto max-w-[1600px]">
    <OwnershipGate route={route} />
  </div></main>;
}
