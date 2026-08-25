import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResultCameraPlan,
  distanceBetweenCoordinatesKm,
  routeLineCoordinates
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
