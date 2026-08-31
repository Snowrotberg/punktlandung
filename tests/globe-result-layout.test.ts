import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  expandResultRect,
  RESULT_LABEL_VISUAL_GAP_PX,
  RESULT_MAP_CONTROL_LABELS,
  RESULT_ROUTE_DASH_GAP_PX,
  RESULT_ROUTE_DASH_LENGTH_PX,
  resultLabelHorizontalPlacement,
  resultLabelPairVerticalPlacement,
  resultMarkerCollisionOffsets,
  resultFitAdjustment,
  resultSafeRect,
  trimProjectedRoute,
  unionResultRects,
  usesCenteredResultInfoOverlay,
  shouldRestoreResultTriggerFocus
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

test("result routes use the same endpoint clearance as the shared dash gap", () => {
  assert.equal(RESULT_LABEL_VISUAL_GAP_PX, 10);
  assert.equal(RESULT_ROUTE_DASH_LENGTH_PX, 6);
  assert.equal(RESULT_ROUTE_DASH_GAP_PX, 9);
  const route = trimProjectedRoute([{ x: 0, y: 0 }, { x: 100, y: 0 }], 20 + RESULT_ROUTE_DASH_GAP_PX, 30 + RESULT_ROUTE_DASH_GAP_PX);
  assert.ok(Math.abs(route[0].x - 29) < 1e-9);
  assert.ok(Math.abs(route.at(-1)!.x - 61) < 1e-9);
});

test("flowing result routes keep fixed endpoint dashes outside the animated dash phase", async () => {
  const [globe, leaflet, primitivesCss, globals] = await Promise.all([
    readFile(new URL("../components/GlobeMapLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/LeafletMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ResultMapPrimitives.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(globe, /routeEndpointRef[\s\S]*?RESULT_ROUTE_DASH_LENGTH_PX[\s\S]*?className=\{styles\.routeEndpoints\}/);
  assert.match(leaflet, /punktlandung-result-connector-endpoint/);
  assert.match(primitivesCss, /@keyframes routeFlow\s*\{\s*to\s*\{\s*stroke-dashoffset:\s*-15;/);
  assert.match(globals, /@keyframes punktlandung-result-connector-flow\s*\{\s*to\s*\{\s*stroke-dashoffset:\s*-15;/);
  assert.match(primitivesCss, /\.routeShadow\s*\{[^}]*rgba\(2, 6, 23, 0\.08\)[^}]*stroke-width:\s*1\.8/);
  assert.match(globe, /!targetOnlyEndComposition\s*\?\s*\[routeLineRef\.current\]/);
});

test("target landing decays into the shared idle hop while reduced motion stays still", async () => {
  const source = await readFile(new URL("../components/ResultMapPrimitives.module.css", import.meta.url), "utf8");
  assert.match(source, /\.target \.pin\s*\{[\s\S]*?animation:\s*targetIdle 1650ms/);
  assert.match(source, /@keyframes targetLanding\s*\{[\s\S]*?26%[\s\S]*?-1\.15rem[\s\S]*?49%[\s\S]*?-0\.68rem[\s\S]*?68%[\s\S]*?-0\.38rem[\s\S]*?83%[\s\S]*?-0\.2rem[\s\S]*?94%[\s\S]*?-0\.09rem/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.target \.pin,[\s\S]*?animation:\s*none;/);
});

test("result labels prefer a shared centred visual gap before collision fallback", async () => {
  const [globeCss, leaflet] = await Promise.all([
    readFile(new URL("../components/GlobeMapLab.module.css", import.meta.url), "utf8"),
    readFile(new URL("../components/LeafletMap.tsx", import.meta.url), "utf8")
  ]);
  assert.equal(RESULT_LABEL_VISUAL_GAP_PX, 10);
  assert.match(globeCss, /--result-label-above-offset:[\s\S]*?--result-label-below-offset:[\s\S]*?translateX\(-50%\)/);
  assert.match(leaflet, /candidates\.unshift\(\{\s*dx:\s*0,[\s\S]*?RESULT_LABEL_VISUAL_GAP_PX/);
  assert.match(leaflet, /actual:\s*\{[\s\S]*?offset:\s*\[\s*0,[\s\S]*?player:\s*\{[\s\S]*?offset:\s*\[0,/);
});

test("the visually northern pin owns the upper label independent of player and target roles", () => {
  const northwestPlayer = resultLabelPairVerticalPlacement(
    { x: 80, y: 60 },
    { x: 250, y: 190 },
    [10, 54],
    [14, 50]
  );
  const northwestTarget = resultLabelPairVerticalPlacement(
    { x: 250, y: 190 },
    { x: 80, y: 60 },
    [14, 50],
    [10, 54]
  );

  assert.deepEqual(northwestPlayer, { first: "above", second: "below" });
  assert.deepEqual(northwestTarget, { first: "below", second: "above" });
});

test("both screen diagonals and almost equal projected heights remain stable", () => {
  assert.deepEqual(
    resultLabelPairVerticalPlacement({ x: 70, y: 200 }, { x: 260, y: 70 }, [8, 47], [16, 53]),
    { first: "below", second: "above" }
  );
  assert.deepEqual(
    resultLabelPairVerticalPlacement({ x: 70, y: 100 }, { x: 260, y: 100.4 }, [179.8, 12.0001], [-179.7, 12]),
    { first: "above", second: "below" }
  );
});

test("target focus is restored only for keyboard-driven information dialogs", () => {
  assert.equal(shouldRestoreResultTriggerFocus("keyboard"), true);
  assert.equal(shouldRestoreResultTriggerFocus("pointer"), false);
});

test("horizontal result labels choose the anchor with the least safe-area overflow", () => {
  const safe = resultSafeRect(300, 240);

  assert.equal(resultLabelHorizontalPlacement(104, 170, safe), "center");
  assert.equal(resultLabelHorizontalPlacement(8, 170, safe), "right");
  assert.equal(resultLabelHorizontalPlacement(270, 170, safe), "left");
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
