import assert from "node:assert/strict";
import test from "node:test";
import { browserUuid } from "../lib/browserUuid";

test("browserUuid uses native randomUUID when available", () => {
  const expected = "11111111-2222-4333-8444-555555555555";
  assert.equal(browserUuid({ randomUUID: () => expected }), expected);
});

test("browserUuid creates an RFC 4122 v4 identifier without randomUUID", () => {
  const uuid = browserUuid({
    getRandomValues(array) {
      if (array instanceof Uint8Array) array.fill(0xab);
      return array;
    }
  });

  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(uuid, "abababab-abab-4bab-abab-abababababab");
});
