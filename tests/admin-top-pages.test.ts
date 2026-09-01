import assert from "node:assert/strict";
import test from "node:test";
import { isInternalAdminPath, selectAdminTopPages } from "../lib/adminTopPages";

test("top pages exclude the admin route and every admin subroute", () => {
  const stats = new Map([
    ["/admin", { views: 90, durationMs: 9_000 }],
    ["/admin/vorschau", { views: 80, durationMs: 8_000 }],
    ["/rankings", { views: 7, durationMs: 700 }],
    ["/", { views: 12, durationMs: 1_200 }]
  ]);

  assert.equal(isInternalAdminPath("/admin"), true);
  assert.equal(isInternalAdminPath("/admin/vorschau"), true);
  assert.equal(isInternalAdminPath("/administration"), false);
  assert.deepEqual(selectAdminTopPages(stats), [
    ["/", { views: 12, durationMs: 1_200 }],
    ["/rankings", { views: 7, durationMs: 700 }]
  ]);
  assert.equal([...stats.values()].reduce((sum, value) => sum + value.views, 0), 189);
});

test("top pages apply their limit only after internal paths are removed", () => {
  const stats = new Map([
    ["/admin", { views: 100, durationMs: 0 }],
    ["/eins", { views: 4, durationMs: 0 }],
    ["/zwei", { views: 3, durationMs: 0 }],
    ["/drei", { views: 2, durationMs: 0 }]
  ]);
  assert.deepEqual(selectAdminTopPages(stats, 2).map(([path]) => path), ["/eins", "/zwei"]);
});
