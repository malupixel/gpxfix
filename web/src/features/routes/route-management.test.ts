import assert from "node:assert/strict";
import test from "node:test";
import { activityLink } from "./route-activity";
import { gpxExportPath } from "./gpx-export";
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
