import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRouteVersion } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { OwnershipGate } from "@/features/routes/ownership-gate";
type Props={params:Promise<{publicId:string;versionNumber:string}>};
async function load(publicId:string,value:string){const version=Number(value);if(!Number.isInteger(version)||version<1)notFound();try{return await getRouteVersion(publicId,version);}catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}}
export async function generateMetadata({params}:Props):Promise<Metadata>{const{publicId,versionNumber}=await params;const route=await load(publicId,versionNumber);return{title:`${route.name} — v${route.viewedVersion} | Route Community`};}
export default async function HistoricalRoutePage({params}:Props){const{publicId,versionNumber}=await params;const route=await load(publicId,versionNumber);return <main className="min-h-screen bg-transparent px-3 py-6 sm:px-6 lg:py-8"><div className="mx-auto max-w-[1450px]"><OwnershipGate route={route}/></div></main>;}
