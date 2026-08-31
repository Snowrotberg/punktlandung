import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("productive guess map uses the shared half-step mobile overview", async () => {
  const source = await readFile(new URL("../components/LeafletMap.tsx", import.meta.url), "utf8");
  assert.match(source, /GUESS_OVERVIEW_ZOOM\s*=\s*1\.5/);
  assert.match(source, /GUESS_ZOOM_STEP\s*=\s*0\.5/);
  assert.match(source, /zoomSnap=\{isGuessMap \? GUESS_ZOOM_STEP : 1\}/);
  assert.match(source, /zoomDelta=\{isGuessMap \? GUESS_ZOOM_STEP : 1\}/);
});

test("public map test route reuses GuessMap and stays noindex", async () => {
  const [page, client, responsive] = await Promise.all([
    readFile(new URL("../app/karte/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/MapTestClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/responsive-check.mjs", import.meta.url), "utf8")
  ]);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /<GuessMap/);
  assert.match(client, /Karte zurücksetzen/);
  assert.match(client, /onBaseMapReady=\{\(\) => setBaseMapReady\(true\)\}/);
  assert.match(client, /data-map-ready=\{baseMapReady\}/);
  assert.match(responsive, /\.punktlandung-map-test-map\[data-map-ready='true'\] \.leaflet-container/);
  assert.doesNotMatch(client, /new\s+Leaflet|MapContainer/);
});

test("coarse map controls suppress visible tooltips without losing accessible labels", async () => {
  const [tooltip, globe, globals, game, results] = await Promise.all([
    readFile(new URL("../components/UnifiedTooltipLayer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/GlobeMapLab.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/GameView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ResultsView.tsx", import.meta.url), "utf8")
  ]);
  assert.match(tooltip, /isCoarseMapControl/);
  assert.match(globe, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?display:\s*none !important/);
  assert.doesNotMatch(globals, /@media \(hover: none\), \(pointer: coarse\)\s*\{\s*\.punktlandung-unified-tooltip/);
  assert.match(game, /aria-label=\{fullMap \? "Karte verkleinern" : "Karte maximieren"\}/);
  assert.match(results, /aria-label=\{replayMapFull \? "Karte verkleinern" : "Karte maximieren"\}/);
});

test("no-guess result keeps the production globe target-only contract and labelled ranking metrics", async () => {
  const [results, globe] = await Promise.all([
    readFile(new URL("../components/ResultsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/GlobeMapLab.tsx", import.meta.url), "utf8")
  ]);
  assert.match(results, /const targetOnly = !primaryResult\.guess/);
  assert.match(results, /targetOnly\s*\}/);
  assert.match(globe, /setMarkerVisibility\("guess", !targetOnly\)/);
  assert.match(results, /punktlandung-results-distance-primary/);
  assert.match(results, /<small>Punkte<\/small>/);
});

test("result handoff starts motion on the frame after the prepared surface becomes visible", async () => {
  const [game, readiness, globe] = await Promise.all([
    readFile(new URL("../components/GameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/resultReadiness.client.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/GlobeMapLab.tsx", import.meta.url), "utf8")
  ]);
  assert.match(game, /prepareResultExperience/);
  assert.match(readiness, /prewarmGlobeResultMap/);
  assert.match(readiness, /fetch\(punktlandungMapStyleUrl\("globe"\), \{ cache: "force-cache" \}\)/);
  assert.match(globe, /container\.dataset\.resultSurfaceReady = "true"/);
  assert.match(globe, /window\.requestAnimationFrame\(\(\) => void runResultJourneyRef\.current\(\)\)/);
  assert.match(globe, /dataset\.resultMotionStarted = "true"/);
  assert.match(globe, /punktlandung-result-visible-to-motion/);
});

test("shared target information keeps a 44px hit area around a compact visual close control", async () => {
  const [home, leaflet, responsive] = await Promise.all([
    readFile(new URL("../components/HomeMapPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/LeafletMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/responsive-check.mjs", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(home, /targetInfoIndicator="\?"/);
  assert.match(leaflet, /punktlandung-map-label-info/);
  assert.match(leaflet, /labelPopupGap = 10/);
  assert.match(responsive, /targetInfoCloseControl/);
  assert.match(responsive, /hitWidth < 44/);
  assert.match(responsive, /visualWidth < 30/);
  assert.match(responsive, /visualWidth > 33/);
});
