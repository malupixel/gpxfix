import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRouteVersion } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { OwnershipGate } from "@/features/routes/ownership-gate";
import { getServerTranslation } from "@/i18n/server";
type Props={params:Promise<{publicId:string;versionNumber:string}>};
async function load(publicId:string,value:string){const version=Number(value);if(!Number.isInteger(version)||version<1)notFound();try{return await getRouteVersion(publicId,version);}catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}}
export async function generateMetadata({params}:Props):Promise<Metadata>{const{publicId,versionNumber}=await params;const route=await load(publicId,versionNumber);const t=await getServerTranslation();return{alternates:{canonical:`/route/${encodeURIComponent(publicId)}/v/${route.viewedVersion}`},title:`${route.name} — v${route.viewedVersion} | ${t("landing.title")}`,description:route.description||t("metadata.routeDescription",{distance:(route.distanceMeters/1000).toFixed(1)})};}
export default async function HistoricalRoutePage({params}:Props){const{publicId,versionNumber}=await params;const route=await load(publicId,versionNumber);return <main className="min-h-screen bg-transparent px-3 py-5 sm:px-6 lg:py-6"><div className="mx-auto max-w-[1600px]"><OwnershipGate route={route}/></div></main>;}
