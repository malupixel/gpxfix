import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Providers } from "@/components/providers";
import { cookies, headers } from "next/headers";
import { localeCookieName, resolveLocale } from "@/i18n/config";
import { getServerTranslation } from "@/i18n/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { publicSiteUrl } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslation();
  return { metadataBase: publicSiteUrl(), icons: { icon: { url: "/favicon.png", type: "image/png" } }, title: t("landing.title"), description: t("metadata.description") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value, headerStore.get("accept-language"));
  return (
    <html lang={locale}>
      <body><Providers initialLocale={locale}><SiteHeader />{children}<SiteFooter /></Providers></body>
    </html>
  );
}
