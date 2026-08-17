import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.HOME_POSTER_URL ?? "http://localhost:3000";
const profiles = [
  { name: "phone-small", width: 360, height: 800 },
  { name: "phone-large", width: 430, height: 932 },
  { name: "phone-landscape", width: 932, height: 430 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "monitor-short", width: 1920, height: 977 },
  { name: "monitor", width: 1920, height: 1080 },
  { name: "tv-4k", width: 3840, height: 2160 }
];
const requestedProfile = process.env.HOME_POSTER_PROFILE;
const baseOnly = process.env.HOME_POSTER_BASE_ONLY === "1";
const layoutMode = baseOnly ? "wide" : process.env.HOME_POSTER_LAYOUT === "ads" ? "ads" : "wide";
const selectedProfiles = requestedProfile
  ? profiles.filter((profile) => profile.name === requestedProfile)
  : profiles;
if (!selectedProfiles.length) throw new Error(`Unknown HOME_POSTER_PROFILE: ${requestedProfile}`);

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const launchOptions = {
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
};
let browser;
try {
  browser = await chromium.launch({ ...launchOptions, channel: "chrome" });
} catch {
  browser = await chromium.launch({ ...launchOptions, executablePath: chromePath });
}

try {
  for (const profile of selectedProfiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: 1,
      locale: "de-DE",
      colorScheme: "dark"
    });
    await context.route(/google|doubleclick|googlesyndication|google-analytics|googletagmanager/, (route) => route.abort());
    const page = await context.newPage();
    const renderUrl = new URL("/", baseUrl);
    renderUrl.searchParams.set("renderHomeMapSource", "1");
    await page.goto(renderUrl.toString(), { waitUntil: "domcontentloaded" });
    if (layoutMode === "ads" && profile.width >= 1280) {
      await page.addStyleTag({
        content: `
          main > div { grid-template-columns: clamp(9rem, 12vw, 30rem) minmax(0, 1fr) clamp(9rem, 12vw, 30rem) !important; }
          main > div > aside { position: relative !important; inset: auto !important; width: auto !important; }
        `
      });
    }
    await page.locator(".punktlandung-home-map-preview").waitFor({ state: "visible", timeout: 20_000 });
    await page.locator(".punktlandung-home-map-poster-wide.is-ready").waitFor({ state: "attached", timeout: 20_000 });
    await page.waitForFunction(() => {
      const poster = document.querySelector(".punktlandung-home-map-poster-wide.is-ready");
      const canvas = document.querySelector(".punktlandung-home-map-preview .maplibregl-canvas");
      return poster && canvas && getComputedStyle(poster).opacity === "0";
    }, null, { timeout: 20_000 });
    const expectedPosterPath = `/home-map-preview-${profile.name}.webp`;
    const selectedPosterPath = await page.locator(".punktlandung-home-map-poster-wide").evaluate((poster) => {
      const match = getComputedStyle(poster).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      return match ? new URL(match[1], window.location.href).pathname : "";
    });
    if (layoutMode === "wide" && selectedPosterPath !== expectedPosterPath) {
      throw new Error(`${profile.name} selected ${selectedPosterPath} instead of ${expectedPosterPath}`);
    }
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });
    await page.waitForTimeout(1_500);
    const overlayGeometry = await page.evaluate(() => {
      const preview = document.querySelector(".punktlandung-home-map-preview")?.getBoundingClientRect();
      if (!preview) return null;
      const relativeRect = (selector) => {
        const element = document.querySelector(`.punktlandung-home-map-preview ${selector}`);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: (rect.left - preview.left) / preview.width,
          top: (rect.top - preview.top) / preview.height,
          width: rect.width / preview.width,
          height: rect.height / preview.height
        };
      };
      return {
        playerPin: relativeRect(".punktlandung-map-pin-player"),
        actualPin: relativeRect(".punktlandung-map-pin-actual")
      };
    });
    await page.addStyleTag({
      content: `
        .punktlandung-home-map-poster { display: none !important; }
        .punktlandung-home-map-preview * { animation-play-state: paused !important; }
        ${baseOnly ? `
          .punktlandung-home-map-preview .leaflet-overlay-pane,
          .punktlandung-home-map-preview .leaflet-marker-pane,
          .punktlandung-home-map-preview .leaflet-tooltip-pane,
          .punktlandung-home-map-preview .punktlandung-home-map-mobile-labels {
            display: none !important;
          }
        ` : ""}
      `
    });
    if (!baseOnly) {
      await page.locator(".punktlandung-result-connector").evaluate((path) => {
        path.setAttribute("stroke-dashoffset", "0");
      });
    }

    const preview = page.locator(".punktlandung-home-map-preview");
    const box = await preview.boundingBox();
    if (!box) throw new Error(`Home map preview missing for ${profile.name}`);
    const png = await preview.screenshot({ type: "png", animations: "disabled" });
    const output = `public/home-map-${baseOnly ? "base" : "preview"}-${profile.name}${layoutMode === "ads" ? "-with-ads" : ""}.webp`;
    await sharp(png).webp({ quality: 92, effort: 6 }).toFile(output);
    const alignment = await page.evaluate(() => {
      const map = document.querySelector(".punktlandung-home-map-preview")?.getBoundingClientRect();
      const action = document.querySelector("a[href^='/solo-modus/direct']")?.getBoundingClientRect();
      return map && action ? Math.round((map.bottom - action.bottom) * 10) / 10 : null;
    });
    console.log(`${profile.name}: ${Math.round(box.width)}x${Math.round(box.height)} -> ${output}${alignment === null ? "" : ` (map/action bottom delta ${alignment}px)`}`);
    if (baseOnly) console.log(`${profile.name} overlay: ${JSON.stringify(overlayGeometry)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
