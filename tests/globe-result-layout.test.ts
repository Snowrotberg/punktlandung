import test from "node:test";
import assert from "node:assert/strict";
import {
  expandResultRect,
  RESULT_MAP_CONTROL_LABELS,
  resultMarkerCollisionOffsets,
  resultFitAdjustment,
  resultSafeRect,
  trimProjectedRoute,
  unionResultRects,
  usesCenteredResultInfoOverlay
} from "../lib/globeResultLayout";

test("expandResultRect reserves asymmetric animation space", () => {
  assert.deepEqual(
    expandResultRect({ left: 20, top: 30, right: 60, bottom: 70 }, { left: 8, top: 6, right: 9, bottom: 4 }),
    { left: 12, top: 24, right: 69, bottom: 74 }
  );
});

test("projected result routes are trimmed along their path without reversed endpoint segments", () => {
  const route = Array.from({ length: 11 }, (_, index) => ({ x: index, y: 0 }));
  const trimmed = trimProjectedRoute(route, 3.5, 2.25);

  assert.deepEqual(trimmed[0], { x: 3.5, y: 0 });
  assert.deepEqual(trimmed.at(-1), { x: 7.75, y: 0 });
  assert.ok(trimmed.every((point, index) => index === 0 || point.x > trimmed[index - 1].x));
});

test("route trimming omits a connector when two ellipse gaps consume the complete route", () => {
  assert.deepEqual(trimProjectedRoute([{ x: 0, y: 0 }, { x: 8, y: 0 }], 5, 4), []);
});

test("nearby result markers separate symmetrically while distant markers keep their coordinates", () => {
  const close = resultMarkerCollisionOffsets({ x: 100, y: 100 }, { x: 100, y: 100 });
  const distant = resultMarkerCollisionOffsets({ x: 10, y: 10 }, { x: 110, y: 10 });

  assert.equal(close.active, true);
  assert.equal(Math.hypot(close.target.x - close.guess.x, close.target.y - close.guess.y), 76);
  assert.deepEqual(distant, { guess: { x: 0, y: 0 }, target: { x: 0, y: 0 }, active: false });
});

test("safe-area fitting zooms only when visual bounds cannot fit and otherwise returns a pan correction", () => {
  const safe = resultSafeRect(360, 300);
  const oversized = resultFitAdjustment({ left: 0, top: 0, right: 340, bottom: 280 }, safe);
  const shifted = resultFitAdjustment({ left: 2, top: 40, right: 240, bottom: 260 }, safe);

  assert.ok(oversized.zoomDelta < 0);
  assert.equal(oversized.shiftX, 0);
  assert.equal(shifted.zoomDelta, 0);
  assert.equal(shifted.shiftX, 18);
});

test("visual unions include labels, pins, ellipses and the route", () => {
  assert.deepEqual(unionResultRects([
    { left: 20, top: 40, right: 80, bottom: 100 },
    { left: 8, top: 55, right: 140, bottom: 160 }
  ]), { left: 8, top: 40, right: 140, bottom: 160 });
});

test("phone portrait and phone landscape use the centered target-information overlay", () => {
  assert.equal(usesCenteredResultInfoOverlay(360, 800), true);
  assert.equal(usesCenteredResultInfoOverlay(430, 932), true);
  assert.equal(usesCenteredResultInfoOverlay(932, 430), true);
  assert.equal(usesCenteredResultInfoOverlay(1366, 768), false);
});

test("all MapLibre result controls expose German labels", () => {
  assert.deepEqual(Object.values(RESULT_MAP_CONTROL_LABELS), [
    "Karte vergrößern",
    "Karte verkleinern",
    "Nach Norden ausrichten",
    "Gedrehte Ansicht wiederherstellen"
  ]);
  assert.ok(Object.values(RESULT_MAP_CONTROL_LABELS).every((label) => !/zoom|drag|click|north/i.test(label)));
});
