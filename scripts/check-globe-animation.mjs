import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseUrl = process.env.GLOBE_ANIMATION_URL ?? "http://127.0.0.1:3014";
const outDir = path.join(root, "test-artifacts", "globe-animation");
const profiles = [
  { name: "phone-small", width: 360, height: 800, deviceScaleFactor: 2 },
  { name: "phone-landscape", width: 932, height: 430, deviceScaleFactor: 2 },
  { name: "laptop", width: 1366, height: 768, deviceScaleFactor: 1 },
  { name: "monitor", width: 1920, height: 1080, deviceScaleFactor: 1 }
];
const cases = [
  { name: "normal-sequence", profiles: profiles.map((profile) => profile.name) },
  { name: "webgl-failure", profiles: profiles.map((profile) => profile.name) },
  { name: "reduced-motion", profiles: profiles.map((profile) => profile.name), reducedMotion: "reduce" },
  { name: "slow-tiles", profiles: ["laptop"] },
  { name: "terrain-failure", profiles: ["laptop"] }
];
const requestedCases = new Set((process.env.GLOBE_ANIMATION_CASE ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const requestedProfiles = new Set((process.env.GLOBE_ANIMATION_PROFILE ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const selectedCases = requestedCases.size ? cases.filter((testCase) => requestedCases.has(testCase.name)) : cases;
const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function readFinalState(page) {
  return page.evaluate(() => {
    const preview = document.querySelector(".punktlandung-home-map-preview");
    const sequence = preview?.querySelector("[data-result-reveal-phase]");
    const target = preview?.querySelector("[data-result-marker-kind='target']");
    const targetPin = target?.querySelector("svg[class*='markerPin']");
    const route = preview?.querySelector("[data-result-route='connection']");
    const routeOverlay = route?.closest("svg[data-settled]");
    const frame = preview?.querySelector("[data-terrain-exaggeration]");
    const labels = preview?.querySelectorAll("[data-result-marker-kind][data-visible='true'][data-label-visible='true'] [data-marker-label]");
    return {
      renderMode: preview?.getAttribute("data-render-mode") ?? null,
      animationComplete: preview?.getAttribute("data-animation-complete") === "true",
      phase: sequence?.getAttribute("data-result-reveal-phase") ?? null,
      composition: sequence?.getAttribute("data-result-composition") ?? null,
      markerCount: preview?.querySelectorAll("[data-result-marker-kind][data-visible='true']").length ?? 0,
      labelCount: labels?.length ?? 0,
      targetLanding: target?.getAttribute("data-landing") === "true",
      targetOccludedOpacity: target ? Number(getComputedStyle(target).opacity) : null,
      targetAnimation: targetPin ? getComputedStyle(targetPin).animationName : "none",
      routePresent: Boolean(route?.getAttribute("d")),
      routeSettled: routeOverlay?.getAttribute("data-settled") === "true",
      routeAnimation: route ? getComputedStyle(route).animationName : "none",
      terrain: Number(frame?.getAttribute("data-terrain-exaggeration") ?? "0"),
      revealTiming: frame ? {
        landingDurationMs: Number(frame.getAttribute("data-target-landing-duration-ms") ?? "0"),
        targetLabelDelayMs: Number(frame.getAttribute("data-target-label-delay-ms") ?? "0")
      } : null,
      canvasMounted: Boolean(preview?.querySelector(".maplibregl-canvas")),
      fallbackVisible: Boolean(preview?.querySelector("[data-home-map-fallback='true']"))
    };
  });
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const testCase of selectedCases) {
    for (const profile of profiles.filter((candidate) => testCase.profiles.includes(candidate.name) && (!requestedProfiles.size || requestedProfiles.has(candidate.name)))) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.deviceScaleFactor,
        locale: "de-DE",
        colorScheme: "dark",
        reducedMotion: testCase.reducedMotion
      });
      let delayedRequests = 0;
      let abortedTerrainRequests = 0;
      if (testCase.name === "slow-tiles") {
        await context.route("**/*", async (route) => {
          if (/tiles\.openfreemap\.org|tiles\.mapterhorn\.com/.test(route.request().url())) {
            delayedRequests += 1;
            await wait(700);
          }
          await route.continue();
        });
      } else if (testCase.name === "terrain-failure") {
        await context.route(/tiles\.mapterhorn\.com/, async (route) => {
          abortedTerrainRequests += 1;
          await route.abort("failed");
        });
      }

      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.addInitScript(() => {
        window.__punktlandungRevealPhases = [];
        window.__punktlandungLandingSamples = [];
        let previous = null;
        const sample = () => {
          const phase = document.querySelector("[data-result-reveal-phase]")?.getAttribute("data-result-reveal-phase") ?? null;
          if (phase && phase !== previous) {
            const target = document.querySelector("[data-result-marker-kind='target']");
            window.__punktlandungRevealPhases.push({
              phase,
              at: performance.now(),
              targetVisible: target?.getAttribute("data-visible") === "true",
              targetLanding: target?.getAttribute("data-landing") === "true",
              targetLabelVisible: target?.getAttribute("data-label-visible") === "true"
            });
            previous = phase;
          }
          const target = document.querySelector("[data-result-marker-kind='target'][data-landing='true']");
          const pin = target?.querySelector("svg[class*='markerPin']");
          if (target && pin) {
            const targetRect = target.getBoundingClientRect();
            const pinRect = pin.getBoundingClientRect();
            window.__punktlandungLandingSamples.push({
              at: performance.now(),
              offsetY: pinRect.top - targetRect.top
            });
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      if (testCase.name === "webgl-failure") {
        await page.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
            if (typeof type === "string" && type.toLowerCase().startsWith("webgl")) return null;
            return original.call(this, type, ...args);
          };
        });
      }

      const pageUrl = new URL("/", baseUrl);
      await page.goto(pageUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      const preview = page.locator(".punktlandung-home-map-preview");
      await preview.waitFor({ state: "visible", timeout: 20_000 });
      const screenshots = [];

      if (testCase.name === "webgl-failure") {
        await page.waitForFunction(() => {
          const preview = document.querySelector(".punktlandung-home-map-preview");
          return preview?.getAttribute("data-render-mode") === "static-overlay"
            && Boolean(preview.querySelector("[data-home-map-fallback='true']"));
        }, null, { timeout: 20_000 });
      } else if (testCase.name === "normal-sequence") {
        await page.waitForFunction(() => document.querySelector("[data-result-reveal-phase]")?.getAttribute("data-result-reveal-phase") === "landing", null, { timeout: 30_000 });
        if (profile.name === "phone-small") {
          for (const [suffix, delay] of [["landing-rise", 650], ["landing-rebound", 900], ["landing-settle", 1_700]]) {
            await page.waitForTimeout(delay);
            const phasePath = path.join(outDir, `${testCase.name}-${profile.name}-${suffix}.png`);
            await preview.screenshot({ path: phasePath });
            screenshots.push(phasePath);
          }
        }
        await page.waitForFunction(() => (window.__punktlandungRevealPhases ?? []).some((entry) => entry.phase === "labels"), null, { timeout: 10_000 });
        const labelsPath = path.join(outDir, `${testCase.name}-${profile.name}-labels.png`);
        await preview.screenshot({ path: labelsPath });
        screenshots.push(labelsPath);
        await page.waitForFunction(() => (window.__punktlandungRevealPhases ?? []).some((entry) => entry.phase === "landed"), null, { timeout: 30_000 });
        const landedPath = path.join(outDir, `${testCase.name}-${profile.name}-landed.png`);
        await preview.screenshot({ path: landedPath });
        screenshots.push(landedPath);
        await page.locator(".punktlandung-home-map-preview[data-animation-complete='true']").waitFor({ state: "visible", timeout: 40_000 });
      } else {
        await page.locator(".punktlandung-home-map-preview[data-animation-complete='true']").waitFor({ state: "visible", timeout: 40_000 });
      }

      const screenshotPath = path.join(outDir, `${testCase.name}-${profile.name}.png`);
      await preview.screenshot({ path: screenshotPath });
      screenshots.push(screenshotPath);
      const finalState = await readFinalState(page);
      const phaseTrace = await page.evaluate(() => window.__punktlandungRevealPhases ?? []);
      const landingSamples = await page.evaluate(() => window.__punktlandungLandingSamples ?? []);
      const landingOffsets = landingSamples.map((sample) => sample.offsetY);
      const landingRangePx = landingOffsets.length ? Math.max(...landingOffsets) - Math.min(...landingOffsets) : 0;
      const landingDirections = [];
      for (let index = 1; index < landingOffsets.length; index += 1) {
        const delta = landingOffsets[index] - landingOffsets[index - 1];
        if (Math.abs(delta) < 0.08) continue;
        const direction = Math.sign(delta);
        if (landingDirections.at(-1) !== direction) landingDirections.push(direction);
      }
      const landingDirectionChanges = Math.max(0, landingDirections.length - 1);
      const landingMotionPassed = landingSamples.length >= 30 && landingRangePx >= 20 && landingDirectionChanges >= 4;
      const phaseNames = phaseTrace.map((entry) => entry.phase);
      const normalSequencePassed = ["prepared", "route", "landing", "labels", "landed", "settled"]
        .every((phase, index, expected) => phaseNames.indexOf(phase) > (index === 0 ? -1 : phaseNames.indexOf(expected[index - 1])));
      const phaseEntry = (phase) => phaseTrace.find((entry) => entry.phase === phase);
      const landingEntry = phaseEntry("landing");
      const landedEntry = phaseEntry("landed");
      const labelsEntry = phaseEntry("labels");
      const revealOrderPassed = testCase.name !== "normal-sequence" || Boolean(
        landingEntry?.targetVisible
        && landingEntry?.targetLanding
        && !landingEntry?.targetLabelVisible
        && landedEntry?.targetVisible
        && !landedEntry?.targetLanding
        && landedEntry?.targetLabelVisible
        && labelsEntry?.targetVisible
        && labelsEntry?.targetLanding
        && labelsEntry?.targetLabelVisible
        && landedEntry.at - landingEntry.at >= (finalState.revealTiming?.landingDurationMs ?? Number.POSITIVE_INFINITY) - 120
        && labelsEntry.at - landingEntry.at >= (finalState.revealTiming?.targetLabelDelayMs ?? Number.POSITIVE_INFINITY) - 80
        && labelsEntry.at - landingEntry.at <= (finalState.revealTiming?.targetLabelDelayMs ?? 0) + 180
      );
      const expectedPhase = testCase.name === "reduced-motion" ? "reduced-settled" : "settled";
      const passed = testCase.name === "webgl-failure"
        ? finalState.renderMode === "static-overlay" && finalState.fallbackVisible && !finalState.canvasMounted && pageErrors.length === 0
        : finalState.renderMode === "animated-live"
          && finalState.animationComplete
          && finalState.phase === expectedPhase
          && finalState.composition === "ready"
          && finalState.markerCount === 2
          && finalState.labelCount === 2
          && !finalState.targetLanding
          && (testCase.name === "reduced-motion" ? finalState.targetAnimation === "none" : finalState.targetAnimation !== "none")
          && finalState.routePresent
          && finalState.routeSettled
          && (testCase.name === "reduced-motion" ? finalState.routeAnimation === "none" : finalState.routeAnimation !== "none")
          && (testCase.name === "terrain-failure" ? finalState.terrain === 0 && abortedTerrainRequests > 0 : finalState.terrain === 1)
          && (testCase.name === "slow-tiles" ? delayedRequests > 0 : true)
          && (testCase.name !== "normal-sequence" || (normalSequencePassed && revealOrderPassed && landingMotionPassed))
          && pageErrors.length === 0;

      await context.close();

      results.push({
        case: testCase.name,
        profile: profile.name,
        viewport: `${profile.width}x${profile.height}`,
        deviceScaleFactor: profile.deviceScaleFactor,
        passed,
        delayedRequests,
        abortedTerrainRequests,
        consoleErrorCount: consoleErrors.length,
        consoleErrorSamples: consoleErrors.slice(0, 3),
        pageErrors,
        phaseTrace,
        revealOrder: {
          passed: testCase.name === "normal-sequence" ? revealOrderPassed : null,
          landingToLandedMs: landingEntry && landedEntry ? landedEntry.at - landingEntry.at : null,
          landingToLabelsMs: landingEntry && labelsEntry ? labelsEntry.at - landingEntry.at : null,
          contract: finalState.revealTiming
        },
        landingMotion: {
          sampleCount: landingSamples.length,
          rangePx: landingRangePx,
          directionChanges: landingDirectionChanges,
          passed: testCase.name === "normal-sequence" ? landingMotionPassed : null
        },
        finalState,
        screenshots
      });
      console.log(`${testCase.name} @ ${profile.name}: ${passed ? "PASS" : "FAIL"} ${JSON.stringify({ delayedRequests, abortedTerrainRequests, consoleErrorCount: consoleErrors.length, pageErrorCount: pageErrors.length, phaseNames, landingMotion: { sampleCount: landingSamples.length, rangePx: landingRangePx, directionChanges: landingDirectionChanges }, finalState })}`);
    }
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outDir, "report.json");
await fs.writeFile(reportPath, `${JSON.stringify({ baseUrl, results }, null, 2)}\n`, "utf8");
if (results.some((result) => !result.passed)) process.exitCode = 1;
