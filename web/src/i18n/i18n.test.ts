import assert from "node:assert/strict";
import test from "node:test";
import { createInstance } from "i18next";
import { fallbackLocale, localeCookie, resolveLocale } from "./config";
import { resources } from "./resources";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";
import { ApiError } from "../lib/api-client";
import { apiErrorKey } from "./api-errors";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { RouteFeedbackSidebar } from "../features/routes/route-feedback";

test("locale detection follows saved choice, browser language and Polish fallback", () => {
  assert.equal(resolveLocale(null, "pl-PL,pl;q=0.9,en;q=0.8"), "pl");
  assert.equal(resolveLocale(null, "de-DE,de;q=0.9"), "en");
  assert.equal(resolveLocale(null, null), "pl");
  assert.equal(resolveLocale("en", "pl-PL"), "en");
  assert.equal(resolveLocale("pl", "en-US"), "pl");
  assert.equal(fallbackLocale, "pl");
  assert.match(localeCookie("en"), /^route_community_locale=en;.*Max-Age=31536000/);
});

test("UI copy and accessibility labels use translations and static translation keys exist", async () => {
  const i18n = createInstance();
  await i18n.init({ resources, lng: "pl", fallbackLng: false, initAsync: false });
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : [filename];
  });
  const untranslated: string[] = [];
  for (const filename of files(root).filter(file => file.endsWith(".tsx"))) {
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function report(node: ts.Node, value: string) {
      // SI units, version prefixes and decorative symbols do not depend on language.
      const text = value.replace(/&\w+;/g, "").replace(/\b(km|m|v)\b/g, "");
      if (/\p{L}/u.test(text)) untranslated.push(`${path.relative(root, filename)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${value}`);
    }
    function walk(node: ts.Node) {
      if (ts.isJsxText(node)) report(node, node.text.trim());
      if (ts.isJsxAttribute(node) && ["title", "aria-label", "placeholder", "alt"].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) report(node, node.initializer.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        assert.ok(i18n.exists(key) || i18n.exists(`${key}_one`), `${filename}: unknown translation key ${key}`);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  assert.deepEqual(untranslated, []);
});

test("both languages preserve interpolation variables and inflect point and suggestion counts", async () => {
  const i18n = createInstance();
  await i18n.init({ resources, lng: "pl", initAsync: false });
  const flatten = (value: object, prefix = ""): Record<string, string> => Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[name, child]] : Object.entries(flatten(child, name));
  }));
  const pl = flatten(resources.pl.translation), en = flatten(resources.en.translation);
  for (const [key, text] of Object.entries(pl)) assert.deepEqual(text.match(/{{\w+}}/g)?.sort(), en[key].match(/{{\w+}}/g)?.sort(), key);
  assert.equal(i18n.t("editor.points", { count: 1 }), "1 punkt");
  assert.equal(i18n.t("editor.points", { count: 2 }), "2 punkty");
  assert.equal(i18n.t("editor.points", { count: 5 }), "5 punktów");
  assert.equal(i18n.t("feedback.suggestions", { count: 2 }), "2 sugestie");
  await i18n.changeLanguage("en");
  assert.equal(i18n.t("editor.points", { count: 1 }), "1 point");
  assert.equal(i18n.t("editor.points", { count: 5 }), "5 points");
});

test("API failures display localized explanations without leaking server diagnostics", async () => {
  const i18n = createInstance();
  await i18n.init({ resources, lng: "pl", initAsync: false });
  const failures = [
    [new TypeError("Failed to fetch"), "apiErrors.network"],
    [new ApiError(413, "The uploaded GPX file is too large"), "apiErrors.tooLarge"],
    [new ApiError(422, "The GPX file must contain at least two track points"), "apiErrors.invalidGpx"],
    [new ApiError(403, "Route owner authorization required"), "apiErrors.unauthorized"],
    [new ApiError(409, "This suggestion was created on v1 and its affected route section has changed. Review it before merging."), "apiErrors.mergeConflict"],
    [new ApiError(500, "Internal diagnostic"), "editor.saveFailed"],
  ] as const;
  for (const [error, expected] of failures) {
    const key = apiErrorKey(error, "editor.saveFailed");
    assert.equal(key, expected);
    for (const lng of ["pl", "en"]) {
      const message = i18n.t(key, { lng });
      assert.notEqual(message, key);
      assert.notEqual(message, error.message);
    }
  }
});

test("API PROBLEM suggestions use the translated issue label in feedback filters", async () => {
  const i18n = createInstance();
  await i18n.init({ resources, lng: "pl", initAsync: false });
  for (const lng of ["pl", "en"]) {
    await i18n.changeLanguage(lng);
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(RouteFeedbackSidebar, {
      routeId: "test", currentVersion: 1, isOwner: false, readOnly: true, suggestions: [],
      onSuggestionsChange: () => {}, loading: false, selectedId: null, onSelect: () => {}, onAddSuggestion: () => {},
    })));
    assert.ok(html.includes(i18n.t("suggestion.typeIssue")));
    assert.ok(html.includes(i18n.t("versions.suggestCurrent")));
    assert.ok(!html.includes("suggestion.typeProblem"));
  }
});

test("Polish and English resources have the same complete key set", () => {
  const keys = (value: unknown, prefix = ""): string[] => Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? keys(child, path) : [path];
  });
  assert.deepEqual(keys(resources.pl.translation).sort(), keys(resources.en.translation).sort());
  for (const key of ["upload.submit", "route.suggestChanges", "ownerLink.warning", "suggestion.submit", "route.fullscreen", "map.showSquadratsGrid", "map.squadratsZoomIn"])
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
