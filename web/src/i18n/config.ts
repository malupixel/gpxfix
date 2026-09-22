export const supportedLocales = ["pl", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export const fallbackLocale: Locale = "pl";
export const localeCookieName = "route_community_locale";
export function localeCookie(locale: Locale): string { return `${localeCookieName}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`; }

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

export function resolveLocale(savedLocale?: string | null, browserLanguages?: string | null): Locale {
  if (isLocale(savedLocale)) return savedLocale;
  try {
    if (!browserLanguages) return fallbackLocale;
    const languages = browserLanguages.split(",").map((part) => part.trim().split(";")[0]).filter(Boolean);
    if (!languages.length) return fallbackLocale;
    return languages.some((language) => language.toLowerCase().startsWith("pl")) ? "pl" : "en";
  } catch { return fallbackLocale; }
}
