import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResultCameraPlan,
  distanceBetweenCoordinatesKm,
  MAX_GREAT_CIRCLE_DISTANCE_KM,
  RESULT_MAP_MIN_ZOOM,
  TARGET_ONLY_END_DISTANCE_KM,
  usesTargetOnlyEndComposition,
  routeLineCoordinates,
  withResultCameraEndFrame
} from "../lib/globeResultCamera";

test("result camera keeps exact antipodes finite and drawable", () => {
  const guess: [number, number] = [0, 0];
  const target: [number, number] = [180, 0];
  const plan = buildResultCameraPlan(guess, target, { compactViewport: true });
  const route = routeLineCoordinates(guess, target);

  assert.equal(plan.distanceClass, "long");
  assert.ok(Math.abs(plan.distanceKm - Math.PI * 6_371.0088) < 0.01);
  assert.ok(plan.keyframes.every((frame) => [frame.center[0], frame.center[1], frame.zoom, frame.bearing, frame.pitch].every(Number.isFinite)));
  assert.ok(route.length > 20);
  assert.ok(route.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude)));
  assert.equal(plan.targetOnlyEndComposition, true);
  assert.deepEqual(plan.keyframes.at(-1)!.center, target);
});

test("target-only end composition switches exactly at eighty percent of the maximum great-circle distance", () => {
  assert.ok(Math.abs(MAX_GREAT_CIRCLE_DISTANCE_KM - Math.PI * 6_371.0088) < 1e-9);
  assert.ok(Math.abs(TARGET_ONLY_END_DISTANCE_KM - MAX_GREAT_CIRCLE_DISTANCE_KM * 0.8) < 1e-9);
  const below = buildResultCameraPlan([0, 0], [143.9, 0]);
  const above = buildResultCameraPlan([0, 0], [144.1, 0]);
  assert.equal(below.targetOnlyEndComposition, false);
  assert.equal(below.guessHideProgress, null);
  assert.equal(above.targetOnlyEndComposition, true);
  assert.equal(above.guessHideProgress, 0.88);
  assert.deepEqual(above.keyframes[0].center, [0, 0]);
  assert.deepEqual(above.keyframes.at(-1)!.center, [144.1, 0]);
});

test("target-only transition is stable immediately below, at and above the established threshold", () => {
  assert.equal(usesTargetOnlyEndComposition(TARGET_ONLY_END_DISTANCE_KM - 0.001), false);
  assert.equal(usesTargetOnlyEndComposition(TARGET_ONLY_END_DISTANCE_KM), true);
  assert.equal(usesTargetOnlyEndComposition(TARGET_ONLY_END_DISTANCE_KM + 0.001), true);
});

test("extreme target-only result keeps its target camera while the route tail remains drawable", () => {
  const guess: [number, number] = [11.3, 40];
  const ruapehu: [number, number] = [175.56861, -39.28167];
  const plan = buildResultCameraPlan(guess, ruapehu, { compactViewport: true });
  const end = plan.keyframes.at(-1)!;

  assert.ok(plan.distanceKm > 18_650 && plan.distanceKm < 18_690);
  assert.equal(plan.targetOnlyEndComposition, true);
  assert.equal(plan.guessHideProgress, 0.88);
  assert.deepEqual(end.center, ruapehu);
  assert.equal(end.pitch, 38);
  assert.ok(end.zoom >= 3.7);
});

test("compact result plans reveal the line immediately and the target before the final approach", () => {
  const plan = buildResultCameraPlan([13.405, 52.52], [139.6917, 35.6895], { compactViewport: true });

  assert.equal(plan.revealProgress, 0);
  assert.ok(plan.targetRevealProgress <= 0.48);
  assert.ok(plan.keyframes.at(-1)!.zoom > 0.3);
  assert.ok(distanceBetweenCoordinatesKm([13.405, 52.52], [139.6917, 35.6895]) > 8_000);
});

test("long result plans keep the globe large and reduce pullback for nearer intercontinental results", () => {
  const fiveThousandKm = buildResultCameraPlan([-3, 40], [-34.9, -8.05]);
  const fourteenThousandKm = buildResultCameraPlan([12.5, 41.9], [-73.8, -42.5]);

  assert.equal(fiveThousandKm.distanceClass, "long");
  assert.equal(fourteenThousandKm.distanceClass, "long");
  assert.ok(fiveThousandKm.keyframes.at(-1)!.zoom > fourteenThousandKm.keyframes.at(-1)!.zoom);
  assert.ok(Math.min(...fiveThousandKm.keyframes.map((frame) => frame.zoom)) > 2.3);
  assert.ok(Math.min(...fourteenThousandKm.keyframes.map((frame) => frame.zoom)) > RESULT_MAP_MIN_ZOOM);
  assert.ok(fourteenThousandKm.keyframes.at(-1)!.pitch < 14);
});

test("15,000 km plans flatten and pull back without location-specific exceptions", () => {
  const plan = buildResultCameraPlan([45, 0], [-180, 0]);
  const end = plan.keyframes.at(-1)!;

  assert.equal(plan.distanceClass, "long");
  assert.ok(plan.distanceKm > 14_900 && plan.distanceKm < 15_100);
  assert.ok(end.zoom <= 1.4, `expected extreme end zoom <= 1.4, received ${end.zoom}`);
  assert.equal(end.pitch, 0);
  assert.ok(Math.abs(Math.abs(end.center[0]) - 112.5) < 0.01);
});

test("long-distance camera geometry changes continuously around the antimeridian", () => {
  const west = buildResultCameraPlan([45, 0], [-179, 0]).keyframes.at(-1)!;
  const east = buildResultCameraPlan([45, 0], [179, 0]).keyframes.at(-1)!;

  assert.ok(Math.abs(west.zoom - east.zoom) < 0.1);
  assert.ok(Math.abs(west.pitch - east.pitch) < 2);
  assert.ok(west.center.every(Number.isFinite));
  assert.ok(east.center.every(Number.isFinite));
});

test("short result plans retain a close city view for very near pins", () => {
  const twoKm = buildResultCameraPlan([13.3501, 52.5147], [13.3777, 52.5163]);
  const sixtyKm = buildResultCameraPlan([10.8978, 48.3705], [11.5761, 48.1372]);

  assert.equal(twoKm.distanceClass, "short");
  assert.equal(sixtyKm.distanceClass, "short");
  assert.ok(twoKm.keyframes.at(-1)!.zoom > sixtyKm.keyframes.at(-1)!.zoom + 2);
  assert.ok(twoKm.keyframes.at(-1)!.zoom >= 12.2);
  assert.ok(twoKm.keyframes.at(-1)!.zoom - Math.min(...twoKm.keyframes.map((frame) => frame.zoom)) <= 0.4);
});

test("compact near results keep their distance-aware framing", () => {
  const regular = buildResultCameraPlan([13.3501, 52.5147], [13.3777, 52.5163]);
  const compact = buildResultCameraPlan([13.3501, 52.5147], [13.3777, 52.5163], { compactViewport: true });

  assert.ok(compact.keyframes.at(-1)!.zoom >= 11.9);
  assert.ok(Math.abs(regular.keyframes.at(-1)!.zoom - compact.keyframes.at(-1)!.zoom - 0.3) < 0.001);
});

test("result orientation chooses the viewing side from both geographic diagonal axes", () => {
  const northWestToSouthEast = buildResultCameraPlan([113.2, 36.4], [118.8, 32.1]);
  const southWestToNorthEast = buildResultCameraPlan([113.2, 32.1], [118.8, 36.4]);
  const reversedNorthWestToSouthEast = buildResultCameraPlan([118.8, 32.1], [113.2, 36.4]);
  const reversedSouthWestToNorthEast = buildResultCameraPlan([118.8, 36.4], [113.2, 32.1]);

  assert.equal(northWestToSouthEast.keyframes.at(-1)!.bearing, 22);
  assert.equal(reversedNorthWestToSouthEast.keyframes.at(-1)!.bearing, 22);
  assert.equal(southWestToNorthEast.keyframes.at(-1)!.bearing, -22);
  assert.equal(reversedSouthWestToNorthEast.keyframes.at(-1)!.bearing, -22);
});

test("desktop home preview tightens only the short end composition", () => {
  const guess: [number, number] = [13.3501, 52.5147];
  const target: [number, number] = [13.3777, 52.5163];
  const production = buildResultCameraPlan(guess, target);
  const home = buildResultCameraPlan(guess, target, { homePreviewDesktop: true });

  assert.deepEqual(home.keyframes[0], production.keyframes[0]);
  assert.ok(home.keyframes[1].zoom > production.keyframes[1].zoom);
  assert.ok(Math.abs(home.keyframes.at(-1)!.zoom - production.keyframes.at(-1)!.zoom - 0.28) < 0.001);
  assert.equal(home.durationMs, production.durationMs);
});

test("result orientation preserves both diagonal rules across the antimeridian", () => {
  const northWestToSouthEast = buildResultCameraPlan([179, 14], [-178, 10]);
  const southWestToNorthEast = buildResultCameraPlan([179, 10], [-178, 14]);

  assert.equal(northWestToSouthEast.keyframes.at(-1)!.bearing, 22);
  assert.equal(southWestToNorthEast.keyframes.at(-1)!.bearing, -22);
  assert.ok(northWestToSouthEast.keyframes.at(-1)!.center.every(Number.isFinite));
  assert.ok(southWestToNorthEast.keyframes.at(-1)!.center.every(Number.isFinite));
});

test("axis-aligned and nearly coincident result orientations remain deterministic", () => {
  assert.equal(buildResultCameraPlan([12, 48], [12, 49]).keyframes.at(-1)!.bearing, 22);
  assert.equal(buildResultCameraPlan([12, 48], [13, 48]).keyframes.at(-1)!.bearing, -22);
  assert.equal(buildResultCameraPlan([12, 48], [12 + 1e-8, 48 - 1e-8]).keyframes.at(-1)!.bearing, 22);
});

test("prepared safe-area camera replaces only the final result frame", () => {
  const plan = buildResultCameraPlan([12.4964, 41.9028], [15.9819, 45.815], { compactViewport: true });
  const firstFrame = plan.keyframes[0];
  const transitFrame = plan.keyframes[1];
  const prepared = withResultCameraEndFrame(plan, {
    center: [14.2, 43.9],
    zoom: 5.12,
    bearing: 4,
    pitch: 42
  });

  assert.deepEqual(prepared.keyframes[0], firstFrame);
  assert.deepEqual(prepared.keyframes[1], transitFrame);
  assert.deepEqual(prepared.keyframes.at(-1), {
    at: 1,
    center: [14.2, 43.9],
    zoom: 5.12,
    bearing: 4,
    pitch: 42
  });
  assert.notEqual(prepared, plan);
});

test("compact long results keep the globe large before layout-driven safe-area correction", () => {
  const angola = buildResultCameraPlan([45.32, 2.04], [13.23444, -8.83833], { compactViewport: true });

  assert.equal(angola.distanceClass, "long");
  assert.ok(angola.keyframes.at(-1)!.zoom >= 2.69);
  assert.ok(Math.min(...angola.keyframes.map((frame) => frame.zoom)) >= 2.3);
});

test("result camera plans stay above the interactive globe zoom floor", () => {
  const cases: Array<[[number, number], [number, number]]> = [
    [[10.8978, 48.3705], [11.5761, 48.1372]],
    [[6.9603, 50.9375], [11.5761, 48.1372]],
    [[13.405, 52.52], [139.6917, 35.6895]],
    [[-70.6693, -33.4489], [121.4737, 31.2304]]
  ];

  for (const [guess, target] of cases) {
    const plan = buildResultCameraPlan(guess, target, { compactViewport: true });
    assert.ok(Math.min(...plan.keyframes.map((frame) => frame.zoom)) >= RESULT_MAP_MIN_ZOOM);
  }
});
