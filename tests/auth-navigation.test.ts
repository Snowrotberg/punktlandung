import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthOrigin, safeAuthReturnPath, webAuthCallbackUrl } from "../lib/authNavigation";

test("auth return keeps valid same-origin paths", () => {
  assert.equal(safeAuthReturnPath("/endergebnis?game=abc#save"), "/endergebnis?game=abc#save");
  assert.equal(safeAuthReturnPath("%2Fprofil%3Ftab%3Dspiele"), "/profil?tab=spiele");
});

test("auth return rejects external, protocol-relative and backslash redirects", () => {
  assert.equal(safeAuthReturnPath("https://evil.test"), "/");
  assert.equal(safeAuthReturnPath("//evil.test/path"), "/");
  assert.equal(safeAuthReturnPath("/\\evil.test"), "/");
  assert.equal(safeAuthReturnPath("%E0%A4%A"), "/");
});

test("web callback uses one provider-neutral route", () => {
  assert.equal(
    webAuthCallbackUrl("https://punktlandung.app", "/endergebnis?game=abc"),
    "https://punktlandung.app/auth/callback?returnTo=%2Fendergebnis%3Fgame%3Dabc"
  );
});

test("auth origin keeps local and production callbacks separate", () => {
  assert.equal(safeAuthOrigin("http://localhost:3000", "https://punktlandung.app"), "http://localhost:3000");
  assert.equal(safeAuthOrigin("https://www.punktlandung.app", "https://punktlandung.app"), "https://www.punktlandung.app");
  assert.equal(safeAuthOrigin("https://evil.test", "https://punktlandung.app"), "https://punktlandung.app");
});
