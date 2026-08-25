import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResultCameraPlan,
  distanceBetweenCoordinatesKm,
  routeLineCoordinates
} from "../lib/globeResultCamera";

function planForDistance(distanceKm: number, compactViewport = false) {
  return buildResultCameraPlan([0, 0], [distanceKm / 111.195, 0], { compactViewport });
}

test("result camera continuously separates 100 m, 2 km, 10 km, 100 km and 1000 km", () => {
  const distances = [0.1, 2, 10, 100, 1_000];
  const plans = distances.map((distance) => planForDistance(distance));
  const finalZooms = plans.map((plan) => plan.keyframes.at(-1)!.zoom);

  plans.forEach((plan, index) => {
    assert.ok(Math.abs(plan.distanceKm - distances[index]) < 0.01);
    if (index === 0) return;
    assert.ok(finalZooms[index] < finalZooms[index - 1], `${distances[index]} km must end farther out than ${distances[index - 1]} km`);
    assert.ok(plan.durationMs > plans[index - 1].durationMs, `${distances[index]} km must take longer than ${distances[index - 1]} km`);
  });

  assert.deepEqual(plans.map((plan) => plan.distanceClass), ["short", "short", "short", "medium", "medium"]);
  assert.ok(finalZooms[0] >= 15);
  assert.ok(finalZooms[1] >= 12);
  assert.ok(finalZooms[4] <= 5.2);
});

test("near and medium plans use one gentle pullback and settle back into the result", () => {
  for (const distance of [0.1, 2, 10, 100, 1_000]) {
    const plan = planForDistance(distance);
    const [start, transit, end] = plan.keyframes;

    assert.equal(plan.keyframes.length, 3);
    assert.ok(transit.zoom < start.zoom, `${distance} km transit must pull back from the guess`);
    assert.ok(transit.zoom < end.zoom, `${distance} km end must settle closer than transit`);
    assert.equal(plan.revealProgress, 0);
    assert.ok(plan.targetLabelRevealProgress > plan.targetRevealProgress);
  }
});

test("compact result movement is shorter and less rotationally intense", () => {
  const desktop = planForDistance(100);
  const compact = planForDistance(100, true);

  assert.ok(compact.durationMs < desktop.durationMs);
  assert.ok(Math.abs(compact.keyframes.at(-1)!.bearing) < Math.abs(desktop.keyframes.at(-1)!.bearing));
  assert.ok(compact.targetLabelRevealProgress > compact.targetRevealProgress);
});

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

test("compact near-antipodal results level the final globe so both pins stay visible", () => {
  const guess: [number, number] = [151.2093, -33.8688];
  const target: [number, number] = [13.405, 52.52];
  const plan = buildResultCameraPlan(guess, target, { compactViewport: true });
  const end = plan.keyframes.at(-1)!;
  const quarterCircumferenceKm = Math.PI * 6_371.0088 / 2;

  assert.ok(plan.distanceKm > 15_000);
  assert.ok(distanceBetweenCoordinatesKm(end.center, guess) < quarterCircumferenceKm);
  assert.ok(distanceBetweenCoordinatesKm(end.center, target) < quarterCircumferenceKm);
  assert.ok(end.pitch <= 10);
});
