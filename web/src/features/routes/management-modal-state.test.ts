import assert from "node:assert/strict";
import test from "node:test";
import { managementModalCanContinue } from "./management-modal-state";

test("management modal cannot continue before the link is saved", () => {
  assert.equal(managementModalCanContinue(false, false, false), false);
  assert.equal(managementModalCanContinue(false, true, false), false);
});

test("successful clipboard copy or explicit fallback acknowledgement allows continuing", () => {
  assert.equal(managementModalCanContinue(true, false, false), true);
  assert.equal(managementModalCanContinue(false, true, true), true);
});
