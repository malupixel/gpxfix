import assert from "node:assert/strict";
import test from "node:test";
import { activityLink } from "./route-activity";
import { GpxExportDialog, gpxExportPath } from "./gpx-export";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { resources } from "@/i18n/resources";
import type { RouteData } from "@/types/route";
import { routeVersionPath } from "./route-links";
import type { RouteActivity } from "./api";

const event: RouteActivity = { id: "event", type: "COMMENT_CREATED", occurredAt: "2026-10-08T10:00:00Z", versionNumber: 2,
  suggestionPublicId: "suggestion", commentPublicId: "comment", actorKind: "CONTRIBUTOR", actorName: "Author", metadata: {} };

test("activity links retain the affected version and target the related public suggestion and comment", () => {
  assert.equal(activityLink("route", event), "/route/route/v/2?suggestion=suggestion#comment-comment");
  assert.equal(activityLink("route", { ...event, suggestionPublicId: null, commentPublicId: null }), "/route/route/v/2");
  assert.equal(activityLink("route", { ...event, versionNumber: null, suggestionPublicId: null, commentPublicId: null }), null);
  assert.equal(activityLink("route", { ...event, suggestionPublicId: "a&b" }), "/route/route/v/2?suggestion=a%26b#comment-comment");
});

test("export links distinguish latest and historical geometry and encode filename and elevation choices", () => {
  assert.equal(gpxExportPath("route", null, true), "/api/routes/route/gpx?elevation=true");
  assert.equal(gpxExportPath("route", 2, false), "/api/routes/route/versions/2/gpx?elevation=false");
  const path = gpxExportPath("route", 2, true, "Białołęka & GPX");
  const url = new URL(path, "https://example.test");
  assert.equal(url.pathname, "/api/routes/route/versions/2/gpx");
  assert.equal(url.searchParams.get("filename"), "Białołęka & GPX");
  assert.equal(url.searchParams.get("elevation"), "true");
  assert.equal(routeVersionPath("route", 2), "/route/route/v/2");
  assert.ok(!path.includes("manage="));
});

const exportRoute: RouteData = {
  publicId: "route", name: "Route", description: null, originalFilename: "route.gpx",
  distanceMeters: 1000, elevationGainMeters: null,
  geometry: { type: "LineString", coordinates: [[21, 52], [21.01, 52.01]] }, elevationProfile: [],
  createdAt: "2026-10-08T10:00:00Z", updatedAt: "2026-10-08T10:00:00Z",
  versionCreatedAt: "2026-10-08T10:00:00Z", currentVersion: 3, viewedVersion: 2,
  isCurrentVersion: false, versionCount: 3, creationSource: "INITIAL_UPLOAD",
  suggestionsEnabled: true, originalAvailable: true,
};

async function exportDialogMarkup(route: RouteData, initialVersion?: number) {
  const client = new QueryClient();
  const i18n = createInstance();
  await i18n.init({ resources, lng: "pl", initAsync: false });
  client.setQueryData(["route-versions", route.publicId, route.branchId, route.currentVersion],
    [3, 2, 1].map(versionNumber => ({ versionNumber })));
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(I18nextProvider, { i18n },
        createElement(GpxExportDialog, { route, initialVersion, onClose() {} }))));
  } finally { client.clear(); }
}

test("GPX export defaults to viewed v2 even when the latest route is v3", async () => {
  const markup = await exportDialogMarkup(exportRoute);
  assert.match(markup, /<option value="2" selected="">v2<\/option>/);
  assert.doesNotMatch(markup, /<option value="" selected="">/);
});

test("GPX export pins the currently displayed latest version and respects a history entry override", async () => {
  assert.match(await exportDialogMarkup({ ...exportRoute, viewedVersion: 3, isCurrentVersion: true }),
    /<option value="3" selected="">v3<\/option>/);
  assert.match(await exportDialogMarkup(exportRoute, 1), /<option value="1" selected="">v1<\/option>/);
});
