import assert from "node:assert/strict";
import test from "node:test";
import { managementRouteUrl, publicRoutePath, publicRouteUrl, routeVersionPath } from "./route-links";

test("management URL contains the secret while public sharing never does", () => {
  const management = managementRouteUrl("abc123", "very-secret", "https://routes.example");
  assert.equal(management, "https://routes.example/route/abc123?manage=very-secret");
  assert.equal(publicRouteUrl("abc123", "https://routes.example/route/abc123?manage=leak"), "https://routes.example/route/abc123");
  assert.equal(publicRoutePath("abc123"), "/route/abc123");
  assert.equal(routeVersionPath("abc123", 7), "/route/abc123/v/7");
  assert.equal(routeVersionPath("abc123?manage=leak", 7).includes("manage="), false);
});

test("route identifiers are encoded in generated links", () => {
  assert.equal(publicRoutePath("a/b"), "/route/a%2Fb");
});
