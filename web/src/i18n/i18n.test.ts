import assert from "node:assert/strict";
import test from "node:test";
import { createInstance } from "i18next";
import { fallbackLocale, localeCookie, resolveLocale } from "./config";
import { resources } from "./resources";

test("locale detection follows saved choice, browser language and Polish fallback", () => {
  assert.equal(resolveLocale(null, "pl-PL,pl;q=0.9,en;q=0.8"), "pl");
  assert.equal(resolveLocale(null, "de-DE,de;q=0.9"), "en");
  assert.equal(resolveLocale(null, null), "pl");
  assert.equal(resolveLocale("en", "pl-PL"), "en");
  assert.equal(resolveLocale("pl", "en-US"), "pl");
  assert.equal(fallbackLocale, "pl");
  assert.match(localeCookie("en"), /^route_community_locale=en;.*Max-Age=31536000/);
});

test("Polish and English resources have the same complete key set", () => {
  const keys = (value: unknown, prefix = ""): string[] => Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? keys(child, path) : [path];
  });
  assert.deepEqual(keys(resources.pl.translation).sort(), keys(resources.en.translation).sort());
  for (const key of ["upload.submit", "route.suggestChanges", "ownerLink.warning", "suggestion.submit", "route.fullscreen"])
    assert.ok(keys(resources.pl.translation).includes(key), `missing important key ${key}`);
});

test("language switching changes copy without touching route edit state and missing keys fall back safely", async () => {
  const i18n = createInstance();
  await i18n.init({ resources, lng: "pl", fallbackLng: "pl", initAsync: false });
  const draft = { type: "detour", message: "keep me", waypoints: [[21, 52]] };
  assert.equal(i18n.t("route.viewRoute"), "Zobacz trasę");
  await i18n.changeLanguage("en");
  assert.equal(i18n.t("route.viewRoute"), "View route");
  assert.deepEqual(draft, { type: "detour", message: "keep me", waypoints: [[21, 52]] });
  await i18n.changeLanguage("fr");
  assert.equal(i18n.t("route.viewRoute"), "Zobacz trasę");
});
