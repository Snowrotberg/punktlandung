import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAccountEmail, planAccountEmailChange } from "../lib/accountEmailChange";

test("account e-mail addresses are normalized", () => {
  assert.equal(normalizeAccountEmail("  Atlas@Example.COM "), "atlas@example.com");
});

test("an existing secure e-mail change is not restarted", () => {
  assert.equal(planAccountEmailChange({
    currentEmail: "old@example.com",
    pendingEmail: "new@example.com",
    requestedEmail: "NEW@example.com"
  }), "pending");
});

test("a genuinely new e-mail address starts a change", () => {
  assert.equal(planAccountEmailChange({
    currentEmail: "old@example.com",
    pendingEmail: null,
    requestedEmail: "new@example.com"
  }), "request");
});
