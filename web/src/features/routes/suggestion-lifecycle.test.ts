import assert from "node:assert/strict";
import test from "node:test";
import type { RouteSuggestion } from "@/types/route";
import { activeSuggestionsForVersion, canModerateSuggestion } from "./suggestion-lifecycle";

const suggestion = (overrides: Partial<RouteSuggestion>) => ({ publicId: "suggestion", baseVersionNumber: 6, moderationStatus: "PUBLISHED", integrationStatus: "NOT_MERGED", ...overrides }) as RouteSuggestion;

test("map overlays contain only active published suggestions from the viewed version", () => {
  const active = suggestion({ publicId: "active" });
  const suggestions = [active, suggestion({ baseVersionNumber: 5 }), suggestion({ moderationStatus: "PENDING" }), suggestion({ moderationStatus: "REJECTED" }), suggestion({ integrationStatus: "MERGED" })];
  assert.deepEqual(activeSuggestionsForVersion(suggestions, 6), [active]);
  assert.deepEqual(activeSuggestionsForVersion(suggestions, 7), []);
  assert.equal(activeSuggestionsForVersion(suggestions, 5).length, 1);
});

test("owners can review pending overlays only on their base version", () => {
  const published = suggestion({ publicId: "published" });
  const pending = suggestion({ publicId: "pending", moderationStatus: "PENDING" });
  const earlier = suggestion({ publicId: "earlier", baseVersionNumber: 5, moderationStatus: "PENDING" });
  const suggestions = [published, pending, earlier, suggestion({ moderationStatus: "REJECTED" }), suggestion({ integrationStatus: "MERGED" })];

  assert.deepEqual(activeSuggestionsForVersion(suggestions, 6, true), [published, pending]);
  assert.deepEqual(activeSuggestionsForVersion(suggestions, 5, true), [earlier]);
  assert.deepEqual(activeSuggestionsForVersion(suggestions, 6, false), [published]);
  assert.deepEqual(activeSuggestionsForVersion(suggestions, 5, false), []);
});

test("owner moderation controls exclude merged and rejected suggestions", () => {
  assert.equal(canModerateSuggestion(suggestion({ moderationStatus: "PENDING" })), true);
  assert.equal(canModerateSuggestion(suggestion({})), true);
  assert.equal(canModerateSuggestion(suggestion({ moderationStatus: "REJECTED" })), false);
  assert.equal(canModerateSuggestion(suggestion({ integrationStatus: "MERGED" })), false);
});
