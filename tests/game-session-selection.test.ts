import assert from "node:assert/strict";
import test from "node:test";
import { preferLocalRequiredSession } from "../lib/gameSessionSelection";

test("authenticated result route waits for browser-local guest restoration", () => {
  assert.equal(preferLocalRequiredSession("finished", true, undefined), true);
});

test("finished browser-local guest game keeps priority after login", () => {
  assert.equal(preferLocalRequiredSession("finished", false, "finished"), true);
});

test("unmatched local state allows the ranked account session", () => {
  assert.equal(preferLocalRequiredSession("finished", false, "lobby"), false);
  assert.equal(preferLocalRequiredSession("results", false, "finished"), false);
});

test("normal setup routes do not force a browser-local result session", () => {
  assert.equal(preferLocalRequiredSession(undefined, true, "finished"), false);
});
