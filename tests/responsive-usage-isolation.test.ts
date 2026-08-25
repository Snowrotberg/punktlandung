import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("responsive QA fulfills usage telemetry locally instead of recording fixture traffic", () => {
  const source = readFileSync(new URL("../scripts/responsive-check.mjs", import.meta.url), "utf8");
  const usageInterception = source.match(
    /parsedUrl\?\.pathname === "\/api\/usage"[\s\S]{0,300}?route\.fulfill\([\s\S]{0,200}?return;/
  );

  assert.ok(usageInterception, "responsive-check.mjs must intercept /api/usage and return before route.continue()");
  assert.match(usageInterception[0], /status:\s*200/);
  assert.match(usageInterception[0], /"ok":true/);
  assert.match(source, /context\.addInitScript\([\s\S]{0,600}?parsedUrl\.pathname === "\/api\/usage"/);
});
