import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const root = process.cwd();
const baseUrl = process.env.HOME_HANDOFF_URL ?? "http://127.0.0.1:3014";
const outDir = path.join(root, "test-artifacts", "home-map-handoff");
const profiles = [
  { name: "phone-small", width: 360, height: 800, deviceScaleFactor: 2 },
  { name: "user-phone", width: 386, height: 770, deviceScaleFactor: 2 },
  { name: "phone-large", width: 430, height: 932, deviceScaleFactor: 2 },
  { name: "phone-landscape", width: 932, height: 430, deviceScaleFactor: 2 },
  { name: "laptop", width: 1366, height: 768, deviceScaleFactor: 1 },
  { name: "laptop-dpr-1-5", width: 1366, height: 768, deviceScaleFactor: 1.5 },
  { name: "laptop-hidpi", width: 1366, height: 768, deviceScaleFactor: 2 },
  { name: "user-laptop-dpr-1-5", width: 1440, height: 733, deviceScaleFactor: 1.5 },
  { name: "user-laptop", width: 1440, height: 733, deviceScaleFactor: 2 },
  { name: "monitor-short", width: 1920, height: 977, deviceScaleFactor: 1 },
  { name: "monitor-short-dpr-1-5", width: 1920, height: 977, deviceScaleFactor: 1.5 },
  { name: "monitor", width: 1920, height: 1080, deviceScaleFactor: 1 },
  { name: "monitor-dpr-1-5", width: 1920, height: 1080, deviceScaleFactor: 1.5 },
  { name: "monitor-hidpi", width: 1920, height: 1080, deviceScaleFactor: 2 }
];
const requestedProfiles = new Set((process.env.HOME_HANDOFF_PROFILE ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean));
const selectedProfiles = requestedProfiles.size
  ? profiles.filter((profile) => requestedProfiles.has(profile.name))
  : profiles;
if (!selectedProfiles.length) throw new Error(`Unknown HOME_HANDOFF_PROFILE: ${[...requestedProfiles].join(",")}`);

async function compareImages(first, second, diffPath) {
  const left = await sharp(first).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(second).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (left.info.width !== right.info.width || left.info.height !== right.info.height || left.info.channels !== right.info.channels) {
    throw new Error("Poster and paused live frame dimensions differ");
  }

  let totalDifference = 0;
  let changedPixels = 0;
  const channels = left.info.channels;
  const diff = Buffer.alloc(left.data.length);
  for (let offset = 0; offset < left.data.length; offset += channels) {
    let pixelDifference = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const difference = Math.abs(left.data[offset + channel] - right.data[offset + channel]);
      totalDifference += difference;
      pixelDifference = Math.max(pixelDifference, difference);
      diff[offset + channel] = difference;
    }
    if (pixelDifference > 24) changedPixels += 1;
  }
  await sharp(diff, { raw: left.info }).png().toFile(diffPath);
  const pixelCount = left.info.width * left.info.height;
  const comparisonWidth = Math.max(1, Math.round(left.info.width / 2));
  const perceptualLeft = await sharp(first).removeAlpha().resize({ width: comparisonWidth }).blur(1).raw().toBuffer({ resolveWithObject: true });
  const perceptualRight = await sharp(second).removeAlpha().resize({ width: comparisonWidth }).blur(1).raw().toBuffer({ resolveWithObject: true });
  let perceptualDifference = 0;
  let perceptualChangedPixels = 0;
  for (let offset = 0; offset < perceptualLeft.data.length; offset += perceptualLeft.info.channels) {
    let pixelDifference = 0;
    for (let channel = 0; channel < perceptualLeft.info.channels; channel += 1) {
      const difference = Math.abs(perceptualLeft.data[offset + channel] - perceptualRight.data[offset + channel]);
      perceptualDifference += difference;
      pixelDifference = Math.max(pixelDifference, difference);
    }
    if (pixelDifference > 16) perceptualChangedPixels += 1;
  }
  const perceptualPixelCount = perceptualLeft.info.width * perceptualLeft.info.height;
  // Compare one level below CSS resolution and blur sub-pixel rasterization.
  // This stays sensitive to camera/geometry shifts while ignoring harmless
  // WebGL-versus-WebP antialiasing differences on HiDPI displays.
  const structuralWidth = Math.max(1, Math.round(left.info.width / 4));
  const structuralLeft = await sharp(first).removeAlpha().resize({ width: structuralWidth }).blur(1.5).raw().toBuffer({ resolveWithObject: true });
  const structuralRight = await sharp(second).removeAlpha().resize({ width: structuralWidth }).blur(1.5).raw().toBuffer({ resolveWithObject: true });
  let structuralDifference = 0;
  let structuralChangedPixels = 0;
  for (let offset = 0; offset < structuralLeft.data.length; offset += structuralLeft.info.channels) {
    let pixelDifference = 0;
    for (let channel = 0; channel < structuralLeft.info.channels; channel += 1) {
      const difference = Math.abs(structuralLeft.data[offset + channel] - structuralRight.data[offset + channel]);
      structuralDifference += difference;
      pixelDifference = Math.max(pixelDifference, difference);
    }
    if (pixelDifference > 10) structuralChangedPixels += 1;
  }
  const structuralPixelCount = structuralLeft.info.width * structuralLeft.info.height;
  return {
    meanChannelDifference: totalDifference / (pixelCount * channels),
    changedPixelRatio: changedPixels / pixelCount,
    perceptualMeanDifference: perceptualDifference / (perceptualPixelCount * perceptualLeft.info.channels),
    perceptualChangedPixelRatio: perceptualChangedPixels / perceptualPixelCount,
    structuralMeanDifference: structuralDifference / (structuralPixelCount * structuralLeft.info.channels),
    structuralChangedPixelRatio: structuralChangedPixels / structuralPixelCount
  };
}

function firstTime(samples, predicate) {
  return samples.find((sample) => predicate(sample))?.time ?? null;
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const profile of selectedProfiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.deviceScaleFactor,
      locale: "de-DE",
      colorScheme: "dark"
    });
    await context.route(/google|doubleclick|googlesyndication|google-analytics|googletagmanager/, (route) => route.abort());
    const page = await context.newPage();
    await page.addInitScript(() => {
      const canvasIds = new WeakMap();
      let nextCanvasId = 1;
      window.__homeMapHandoffSamples = [];
      const sample = () => {
        const preview = document.querySelector(".punktlandung-home-map-preview");
        const poster = document.querySelector(".punktlandung-home-map-poster-wide");
        const frame = preview?.querySelector("[data-surface-ready]");
        const canvas = preview?.querySelector(".maplibregl-canvas");
        let canvasId = null;
        if (canvas) {
          if (!canvasIds.has(canvas)) canvasIds.set(canvas, nextCanvasId++);
          canvasId = canvasIds.get(canvas);
        }
        const style = poster ? getComputedStyle(poster) : null;
        window.__homeMapHandoffSamples.push({
          time: performance.now(),
          renderMode: preview?.getAttribute("data-render-mode") ?? null,
          surfaceReady: frame?.getAttribute("data-surface-ready") === "true",
          animationStarted: preview?.getAttribute("data-animation-started") === "true",
          posterOpacity: style ? Number(style.opacity) : null,
          posterVisibility: style?.visibility ?? null,
          zoom: frame ? Number(frame.getAttribute("data-current-zoom")) : null,
          lng: frame ? Number(frame.getAttribute("data-current-lng")) : null,
          lat: frame ? Number(frame.getAttribute("data-current-lat")) : null,
          bearing: frame ? Number(frame.getAttribute("data-current-bearing")) : null,
          pitch: frame ? Number(frame.getAttribute("data-current-pitch")) : null,
          terrain: frame ? Number(frame.getAttribute("data-terrain-exaggeration")) : null,
          canvasId
        });
        if (window.__homeMapHandoffSamples.length > 2_000) window.__homeMapHandoffSamples.shift();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "commit" });
    const preview = page.locator(".punktlandung-home-map-preview");
    const poster = page.locator(".punktlandung-home-map-poster-wide");
    await preview.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForFunction(() => {
      const element = document.querySelector(".punktlandung-home-map-poster-wide");
      const image = element ? getComputedStyle(element).backgroundImage : "none";
      return image !== "none";
    });
    await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
    const posterPath = path.join(outDir, `${profile.name}-initial-poster.png`);
    const initialPosterState = await poster.evaluate((element) => {
      const style = getComputedStyle(element);
      const preview = element.closest(".punktlandung-home-map-preview");
      return {
        opacity: Number(style.opacity),
        visibility: style.visibility,
        surfaceReady: preview?.querySelector("[data-surface-ready]")?.getAttribute("data-surface-ready") === "true",
        animationStarted: preview?.getAttribute("data-animation-started") === "true",
        crossfadeStarted: element.classList.contains("is-ready")
      };
    });
    const posterBuffer = await preview.screenshot({ path: posterPath });
    const posterSelection = await poster.evaluate((element) => {
      const candidates = [...getComputedStyle(element).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)]
        .map((match) => new URL(match[1], location.href).pathname);
      const loadedResources = performance.getEntriesByType("resource")
        .map((entry) => new URL(entry.name, location.href).pathname);
      return {
        candidates,
        selected: [...loadedResources].reverse().find((resource) => candidates.includes(resource)) ?? candidates.at(-1) ?? ""
      };
    });
    const selectedPoster = posterSelection.selected;
    const previewSize = await preview.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const posterMetadata = await sharp(path.join(root, "public", selectedPoster.replace(/^\//, ""))).metadata();
    const densityPassed = Number(posterMetadata.width) >= Math.floor(previewSize.width * profile.deviceScaleFactor) - 2
      && Number(posterMetadata.height) >= Math.floor(previewSize.height * profile.deviceScaleFactor) - 2;
    const expectedDensitySuffix = profile.deviceScaleFactor === 1 ? ".webp" : `-${profile.deviceScaleFactor}x.webp`;
    const sourceDensityPassed = selectedPoster.endsWith(expectedDensitySuffix);
    const initialPosterPassed = initialPosterState.opacity === 1
      && initialPosterState.visibility === "visible"
      && !initialPosterState.animationStarted
      && !initialPosterState.crossfadeStarted;
    const posterLayout = await page.locator(".punktlandung-home-map-pictures").getAttribute("data-poster-layout");

    await preview.locator("[data-surface-ready='true']").waitFor({ state: "attached", timeout: 60_000 });
    await page.waitForFunction(() => {
      const preview = document.querySelector(".punktlandung-home-map-preview");
      const poster = document.querySelector(".punktlandung-home-map-poster-wide");
      return preview?.getAttribute("data-animation-started") === "false"
        && poster
        && getComputedStyle(poster).visibility === "hidden";
    }, null, { timeout: 5_000 });

    const pausedPath = path.join(outDir, `${profile.name}-paused-live.png`);
    const pausedBuffer = await preview.screenshot({ path: pausedPath });
    const pausedState = await page.evaluate(() => {
      const preview = document.querySelector(".punktlandung-home-map-preview");
      const frame = preview?.querySelector("[data-surface-ready]");
      const relativeRect = (selector) => {
        const root = preview?.getBoundingClientRect();
        const element = preview?.querySelector(selector)?.getBoundingClientRect();
        if (!root || !element) return null;
        return {
          x: Math.round((element.left - root.left) * 10) / 10,
          y: Math.round((element.top - root.top) * 10) / 10,
          width: Math.round(element.width * 10) / 10,
          height: Math.round(element.height * 10) / 10
        };
      };
      return {
        animationStarted: preview?.getAttribute("data-animation-started") === "true",
        zoom: Number(frame?.getAttribute("data-current-zoom")),
        lng: Number(frame?.getAttribute("data-current-lng")),
        lat: Number(frame?.getAttribute("data-current-lat")),
        bearing: Number(frame?.getAttribute("data-current-bearing")),
        pitch: Number(frame?.getAttribute("data-current-pitch")),
        terrain: Number(frame?.getAttribute("data-terrain-exaggeration")),
        playerPin: relativeRect("[data-result-marker-kind='guess'] span[aria-hidden='true'] svg:first-of-type"),
        playerEllipse: relativeRect("[data-result-marker-kind='guess'] span[aria-hidden='true'] svg:nth-of-type(2)"),
        playerLabel: relativeRect("[data-result-marker-kind='guess'] [data-marker-label]")
      };
    });

    await page.waitForFunction(() => document.querySelector(".punktlandung-home-map-preview")?.getAttribute("data-animation-started") === "true", null, { timeout: 5_000 });
    await page.waitForFunction(() => {
      const samples = window.__homeMapHandoffSamples ?? [];
      const initial = samples.find((sample) => sample.surfaceReady && !sample.animationStarted && sample.zoom !== null);
      return Boolean(initial && samples.some((sample) => sample.animationStarted && (
        Math.abs(sample.zoom - initial.zoom) > 0.01
        || Math.abs(sample.lng - initial.lng) > 0.00001
        || Math.abs(sample.lat - initial.lat) > 0.00001
        || Math.abs(sample.bearing - initial.bearing) > 0.05
        || Math.abs(sample.pitch - initial.pitch) > 0.05
      )));
    }, null, { timeout: 2_000 });
    const movingPath = path.join(outDir, `${profile.name}-first-motion.png`);
    await preview.screenshot({ path: movingPath });
    await page.waitForTimeout(180);

    const samples = await page.evaluate(() => window.__homeMapHandoffSamples);
    const surfaceReadyAt = firstTime(samples, (sample) => sample.surfaceReady);
    const posterHiddenAt = firstTime(samples, (sample) => sample.posterVisibility === "hidden");
    const animationStartedAt = firstTime(samples, (sample) => sample.animationStarted);
    const initialCamera = samples.find((sample) => sample.surfaceReady && !sample.animationStarted && sample.zoom !== null);
    const firstMovementSample = initialCamera
      ? samples.find((sample) => sample.animationStarted && (
          Math.abs(sample.zoom - initialCamera.zoom) > 0.01
          || Math.abs(sample.lng - initialCamera.lng) > 0.00001
          || Math.abs(sample.lat - initialCamera.lat) > 0.00001
          || Math.abs(sample.bearing - initialCamera.bearing) > 0.05
          || Math.abs(sample.pitch - initialCamera.pitch) > 0.05
        )) ?? null
      : null;
    const movementAt = firstMovementSample?.time ?? null;
    const firstMovementDelta = initialCamera && firstMovementSample ? {
      zoom: Math.abs(firstMovementSample.zoom - initialCamera.zoom),
      lng: Math.abs(firstMovementSample.lng - initialCamera.lng),
      lat: Math.abs(firstMovementSample.lat - initialCamera.lat),
      bearing: Math.abs(firstMovementSample.bearing - initialCamera.bearing),
      pitch: Math.abs(firstMovementSample.pitch - initialCamera.pitch)
    } : null;
    const surfaceCanvasId = samples.find((sample) => sample.surfaceReady && sample.canvasId)?.canvasId ?? null;
    const canvasIdsAfterSurface = [...new Set(samples
      .filter((sample) => surfaceReadyAt !== null && sample.time >= surfaceReadyAt)
      .map((sample) => sample.canvasId)
      .filter(Boolean))];
    const hiddenToAnimationMs = posterHiddenAt === null || animationStartedAt === null ? null : animationStartedAt - posterHiddenAt;
    const animationToMovementMs = animationStartedAt === null || movementAt === null ? null : movementAt - animationStartedAt;
    const diffPath = path.join(outDir, `${profile.name}-poster-vs-paused-diff.png`);
    const comparison = await compareImages(posterBuffer, pausedBuffer, diffPath);
    const sequencePassed = surfaceReadyAt !== null
      && posterHiddenAt !== null
      && animationStartedAt !== null
      && movementAt !== null
      && surfaceReadyAt <= posterHiddenAt
      && posterHiddenAt < animationStartedAt
      && animationStartedAt <= movementAt
      && hiddenToAnimationMs >= 500
      && animationToMovementMs >= 120;
    const visualPassed = comparison.perceptualMeanDifference <= 3.5
      && comparison.perceptualChangedPixelRatio <= 0.07
      && comparison.structuralMeanDifference <= 1.5
      && comparison.structuralChangedPixelRatio <= 0.015
      && densityPassed
      && sourceDensityPassed
      && initialPosterPassed;
    const stableCanvasPassed = surfaceCanvasId !== null
      && canvasIdsAfterSurface.length === 1
      && canvasIdsAfterSurface[0] === surfaceCanvasId;
    const pausedCameraSamples = samples.filter((sample) => sample.surfaceReady && !sample.animationStarted && sample.canvasId === surfaceCanvasId);
    const cameraReference = pausedCameraSamples[0];
    const cameraStableBeforeAnimation = Boolean(cameraReference && pausedCameraSamples.every((sample) => (
      Math.abs(sample.zoom - cameraReference.zoom) <= 0.01
      && Math.abs(sample.lng - cameraReference.lng) <= 0.00001
      && Math.abs(sample.lat - cameraReference.lat) <= 0.00001
      && Math.abs(sample.bearing - cameraReference.bearing) <= 0.01
      && Math.abs(sample.pitch - cameraReference.pitch) <= 0.01
    )));
    const cameraPassed = pausedState.animationStarted === false
      && [pausedState.zoom, pausedState.lng, pausedState.lat, pausedState.bearing, pausedState.pitch].every(Number.isFinite)
      && pausedState.terrain === 1
      && cameraStableBeforeAnimation;
    const geometryPassed = [pausedState.playerPin, pausedState.playerEllipse, pausedState.playerLabel]
      .every((rect) => rect && rect.width > 0 && rect.height > 0);
    const motionContinuityPassed = Boolean(firstMovementDelta
      && firstMovementDelta.zoom <= 0.15
      && firstMovementDelta.lng <= 0.004
      && firstMovementDelta.lat <= 0.004
      && firstMovementDelta.bearing <= 1
      && firstMovementDelta.pitch <= 1.5);
    const passed = sequencePassed && visualPassed && stableCanvasPassed && cameraPassed && geometryPassed && motionContinuityPassed && posterLayout === "wide";
    results.push({
      ...profile,
      passed,
      sequencePassed,
      visualPassed,
      densityPassed,
      sourceDensityPassed,
      initialPosterPassed,
      stableCanvasPassed,
      cameraPassed,
      cameraStableBeforeAnimation,
      geometryPassed,
      motionContinuityPassed,
      firstMovementDelta,
      selectedPoster,
      posterCandidates: posterSelection.candidates,
      posterPixels: { width: posterMetadata.width, height: posterMetadata.height },
      previewCssPixels: previewSize,
      posterLayout,
      initialPosterState,
      surfaceReadyAt,
      posterHiddenAt,
      animationStartedAt,
      movementAt,
      hiddenToAnimationMs,
      animationToMovementMs,
      surfaceCanvasId,
      canvasIdsAfterSurface,
      pausedState,
      ...comparison,
      screenshots: { posterPath, pausedPath, movingPath, diffPath }
    });
    console.log(`${profile.name}: structural mean ${comparison.structuralMeanDifference.toFixed(2)}, changed ${(comparison.structuralChangedPixelRatio * 100).toFixed(2)}%; perceptual ${comparison.perceptualMeanDifference.toFixed(2)} / ${(comparison.perceptualChangedPixelRatio * 100).toFixed(2)}%; density ${densityPassed ? "PASS" : "FAIL"}; crossfade hold ${hiddenToAnimationMs?.toFixed(0) ?? "n/a"}ms, motion hold ${animationToMovementMs?.toFixed(0) ?? "n/a"}ms, surface canvases ${canvasIdsAfterSurface.join(",")} -> ${passed ? "PASS" : "FAIL"}`);
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(outDir, "report.json"), `${JSON.stringify({ baseUrl, route: "/", results }, null, 2)}\n`, "utf8");
if (results.some((result) => !result.passed)) process.exitCode = 1;
