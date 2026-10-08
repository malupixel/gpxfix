import { createInstance } from "i18next";
import { cookies, headers } from "next/headers";
import { localeCookieName, resolveLocale } from "./config";
import { resources } from "./resources";

export async function getServerTranslation() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value, headerStore.get("accept-language"));
  const instance = createInstance();
  await instance.init({ resources, lng: locale, fallbackLng: "pl", interpolation: { escapeValue: false }, initAsync: false });
  return instance.getFixedT(locale);
}
