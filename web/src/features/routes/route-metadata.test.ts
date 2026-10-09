import assert from "node:assert/strict";
import test from "node:test";
import { routeMetadata, type RouteShareData } from "./route-metadata";

const route: RouteShareData = { publicId: "public123", name: "Mazury", description: "Lake loop", distanceMeters: 42123, elevationGainMeters: 234, versionNumber: 2, imagePath: "/api/routes/public123/versions/2/preview/abc.png" };
test("production metadata contains absolute public URLs, metrics and social cards", () => {
  const data = routeMetadata(route, "en");
  assert.equal(data.alternates?.canonical, "https://tweakmyroute.com/route/public123");
  assert.equal(data.description, "42.1 km · ↑ 234 m — Lake loop");
  assert.equal(data.openGraph?.title, "Mazury");
  assert.equal(data.openGraph?.url, data.alternates?.canonical);
  assert.deepEqual(data.openGraph?.images, [{ url: "https://tweakmyroute.com" + route.imagePath, width: 1200, height: 630, type: "image/png", alt: "Mazury" }]);
  assert.equal((data.twitter as { card: string }).card, "summary_large_image");
});
test("historical URL points at its version and missing elevations still describe the route", () => {
  const data = routeMetadata({ ...route, description: null, elevationGainMeters: null }, "pl", true);
  assert.equal(data.alternates?.canonical, "https://tweakmyroute.com/route/public123/v/2");
  assert.equal(data.description, "42.1 km — Zobacz trasę na TweakMyRoute");
});
test("SITE_URL is independent of internal API and rejects private URL credentials", () => {
  const previous = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "https://routes.example.org";
    assert.equal(routeMetadata(route,"en").openGraph?.url, "https://routes.example.org/route/public123");
    process.env.SITE_URL = "https://owner:token@routes.example.org";
    assert.throws(() => routeMetadata(route,"en"));
  } finally { if(previous === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = previous; }
});
