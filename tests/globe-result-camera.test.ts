import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResultCameraPlan,
  distanceBetweenCoordinatesKm,
  RESULT_MAP_MIN_ZOOM,
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
  assert.ok(Math.min(...fourteenThousandKm.keyframes.map((frame) => frame.zoom)) > 1.8);
  assert.ok(fourteenThousandKm.keyframes.at(-1)!.pitch <= 31);
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

test("result orientation tilts against the east-west relation instead of stacking pins", () => {
  const targetNorthWest = buildResultCameraPlan([1.45, 45.15], [0.34, 46.58]);
  const targetNorthEast = buildResultCameraPlan([-1.45, 45.15], [-0.34, 46.58]);

  assert.ok(targetNorthWest.keyframes.at(-1)!.bearing > 0);
  assert.ok(targetNorthEast.keyframes.at(-1)!.bearing < 0);
  assert.ok(Math.abs(targetNorthWest.keyframes.at(-1)!.bearing) <= 24);
  assert.ok(Math.abs(targetNorthEast.keyframes.at(-1)!.bearing) <= 24);
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
