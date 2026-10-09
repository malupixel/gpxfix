import type { Metadata } from "next";
import { publicSiteUrl } from "@/lib/site-url";

export interface RouteShareData {
  publicId: string;
  name: string;
  description: string | null;
  distanceMeters: number;
  elevationGainMeters: number | null;
  versionNumber: number;
  imagePath: string;
}

export function routeMetadata(route: RouteShareData, locale: string, historical = false): Metadata {
  const origin = publicSiteUrl();
  const url = new URL(`/route/${encodeURIComponent(route.publicId)}${historical ? `/v/${route.versionNumber}` : ""}`, origin).href;
  const distance = `${(route.distanceMeters / 1000).toFixed(1)} km`;
  const elevation = route.elevationGainMeters === null ? "" : ` · ↑ ${Math.round(route.elevationGainMeters)} m`;
  const description = `${distance}${elevation}${route.description ? ` — ${route.description.replace(/\s+/g, " ").slice(0, 160)}` : locale === "pl" ? " — Zobacz trasę na TweakMyRoute" : " — Explore this route on TweakMyRoute"}`;
  const image = { url: new URL(route.imagePath, origin).href, width: 1200, height: 630, type: "image/png", alt: route.name };
  return {
    title: `${route.name}${historical ? ` — v${route.versionNumber}` : ""} | TweakMyRoute`, description,
    alternates: { canonical: url },
    openGraph: { title: route.name, description, url, type: "website", siteName: "TweakMyRoute", images: [image] },
    twitter: { card: "summary_large_image", title: route.name, description, images: [image] },
  };
}
