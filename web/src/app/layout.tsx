import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Providers } from "@/components/providers";
import { cookies, headers } from "next/headers";
import { localeCookieName, resolveLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Route Community",
  description: "Społecznościowe udostępnianie i ulepszanie tras GPX",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value, headerStore.get("accept-language"));
  return (
    <html lang={locale}>
      <body><Providers initialLocale={locale}>{children}<footer className="px-4 py-3 text-center text-xs text-slate-500"><a href="/data-licenses" className="underline">Data licences · Copernicus DEM</a></footer></Providers></body>
    </html>
  );
}
