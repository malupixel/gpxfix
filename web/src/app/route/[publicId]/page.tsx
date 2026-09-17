import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteMap } from "@/components/map/route-map";
import { getRoute } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
type Props={params:Promise<{publicId:string}>};
async function load(publicId:string){try{return await getRoute(publicId);}catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {publicId}=await params;const route=await load(publicId);const km=(route.distanceMeters/1000).toFixed(1);return {title:`${route.name} | Route Community`,description:route.description||`${km} km cycling route shared on Route Community.`};}
export default async function RoutePage({params}:Props){const {publicId}=await params;const route=await load(publicId);return <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
  <header className="mb-6"><Link href="/" className="text-sm font-medium text-emerald-700">Route Community</Link><h1 className="mt-3 text-3xl font-bold">{route.name}</h1>{route.description&&<p className="mt-3 max-w-3xl text-slate-600">{route.description}</p>}
    <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm"><div><dt className="text-slate-500">Distance</dt><dd className="font-semibold">{(route.distanceMeters/1000).toFixed(1)} km</dd></div>{route.elevationGainMeters!==null&&<div><dt className="text-slate-500">Elevation gain</dt><dd className="font-semibold">{Math.round(route.elevationGainMeters)} m</dd></div>}<div><dt className="text-slate-500">Shared</dt><dd className="font-semibold">{new Intl.DateTimeFormat("en",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(route.createdAt))}</dd></div></dl>
  </header><RouteMap geometry={route.geometry}/>
</main>;}
