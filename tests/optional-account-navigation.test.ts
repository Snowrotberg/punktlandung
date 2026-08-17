import assert from "node:assert/strict";
import test from "node:test";
import { loadOptionalAccountNavigation } from "../lib/optionalAccountNavigation";

test("optional account navigation cannot crash a public page", async () => {
  const errors: unknown[] = [];
  const state = await loadOptionalAccountNavigation({
    enabled: true,
    loadContext: async () => { throw new Error("identity backend rejected the principal"); },
    loadDisplayName: async () => "unused",
    onError: (error) => errors.push(error)
  });

  assert.deepEqual(state, { enabled: true, authenticated: false, displayName: null });
  assert.equal(errors.length, 1);
});

test("optional account navigation preserves a valid signed-in profile", async () => {
  const state = await loadOptionalAccountNavigation({
    enabled: true,
    loadContext: async () => ({ accountId: "account_valid" }),
    loadDisplayName: async () => "Tim"
  });

  assert.deepEqual(state, { enabled: true, authenticated: true, displayName: "Tim" });
});
