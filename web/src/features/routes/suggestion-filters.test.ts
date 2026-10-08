import assert from "node:assert/strict";
import test from "node:test";
import { filterSuggestions } from "./suggestion-filters";
import type { RouteSuggestion } from "@/types/route";

const items = [
  { publicId: "pending", type: "NOTE", moderationStatus: "PENDING", integrationStatus: "NOT_APPLICABLE" },
  { publicId: "published", type: "PROBLEM", moderationStatus: "PUBLISHED", integrationStatus: "NOT_APPLICABLE" },
  { publicId: "merged", type: "DETOUR", moderationStatus: "PUBLISHED", integrationStatus: "MERGED" },
  { publicId: "rejected", type: "NOTE", moderationStatus: "REJECTED", integrationStatus: "NOT_APPLICABLE" },
] as RouteSuggestion[];
const ids = (owner: boolean, status: Parameters<typeof filterSuggestions>[2], type: Parameters<typeof filterSuggestions>[3] = null) => filterSuggestions(items, owner, status, type).map(item => item.publicId);
test("suggestion filters separate published from merged and combine status with type", () => {
  assert.deepEqual(ids(true, "ALL"), ["pending", "published", "merged", "rejected"]);
  assert.deepEqual(ids(true, "PUBLISHED"), ["published"]);
  assert.deepEqual(ids(true, "MERGED"), ["merged"]);
  assert.deepEqual(ids(true, "PENDING"), ["pending"]);
  assert.deepEqual(ids(true, "REJECTED"), ["rejected"]);
  assert.deepEqual(ids(true, "ALL", "NOTE"), ["pending", "rejected"]);
  assert.deepEqual(ids(true, "MERGED", "NOTE"), []);
});
test("public suggestion filters never show private subjects even in archived lists", () => {
  assert.deepEqual(ids(false, "ALL"), ["published", "merged"]);
  assert.deepEqual(ids(false, "PENDING"), []);
  assert.deepEqual(ids(false, "REJECTED"), []);
  assert.deepEqual(ids(false, "MERGED"), ["merged"]);
});
