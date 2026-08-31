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
  const [page, client] = await Promise.all([
    readFile(new URL("../app/karte/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/MapTestClient.tsx", import.meta.url), "utf8")
  ]);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /<GuessMap/);
  assert.match(client, /Karte zurücksetzen/);
  assert.doesNotMatch(client, /new\s+Leaflet|MapContainer/);
});

test("coarse map controls suppress visible tooltips without losing accessible labels", async () => {
  const [tooltip, globe, game, results] = await Promise.all([
    readFile(new URL("../components/UnifiedTooltipLayer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/GlobeMapLab.module.css", import.meta.url), "utf8"),
    readFile(new URL("../components/GameView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ResultsView.tsx", import.meta.url), "utf8")
  ]);
  assert.match(tooltip, /isCoarseMapControl/);
  assert.match(globe, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?display:\s*none !important/);
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
  const [game, globe] = await Promise.all([
    readFile(new URL("../components/GameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/GlobeMapLab.tsx", import.meta.url), "utf8")
  ]);
  assert.match(game, /prewarmGlobeResultMap/);
  assert.match(game, /fetch\(punktlandungMapStyleUrl\("globe"\), \{ cache: "force-cache" \}\)/);
  assert.match(globe, /container\.dataset\.resultSurfaceReady = "true"/);
  assert.match(globe, /window\.requestAnimationFrame\(\(\) => void runResultJourneyRef\.current\(\)\)/);
  assert.match(globe, /dataset\.resultMotionStarted = "true"/);
  assert.match(globe, /punktlandung-result-visible-to-motion/);
});

test("shared target information keeps a compact visual close control and a readable info indicator", async () => {
  const [home, globeCss, leaflet, globals] = await Promise.all([
    readFile(new URL("../components/HomeMapPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/GlobeMapLab.module.css", import.meta.url), "utf8"),
    readFile(new URL("../components/LeafletMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(home, /targetInfoIndicator="\?"/);
  assert.match(leaflet, /punktlandung-map-label-info/);
  assert.match(leaflet, /labelPopupGap = 10/);
  assert.match(globeCss, /\.mobileInfoClose[\s\S]*?width:\s*2\.75rem[\s\S]*?\.mobileInfoClose span[\s\S]*?width:\s*2\.475rem/);
  assert.match(globals, /\.leaflet-popup-close-button[\s\S]*?width:\s*2\.75rem[\s\S]*?\.leaflet-popup-close-button::after[\s\S]*?width:\s*2\.025rem/);
});
