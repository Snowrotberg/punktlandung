import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const runtimePlaywright = pathToFileURL(
  "C:/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/index.mjs"
).href;
const { chromium } = await import(runtimePlaywright);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(root, "test-artifacts", "mobile-qa", runId);
const baseUrl = "http://localhost:3000";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const devices = [
  { name: "iphone-17", label: "iPhone 17", width: 402, height: 874, dpr: 3 },
  { name: "pixel-10", label: "Google Pixel 10", width: 412, height: 923, dpr: 2.625 },
  { name: "fairphone-gen-6", label: "Fairphone Gen. 6", width: 372, height: 828, dpr: 3 },
  { name: "galaxy-s26", label: "Samsung Galaxy S26", width: 360, height: 780, dpr: 3 }
];

const networkProfiles = {
  "Fast 4G": { offline: false, latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  "Slow 3G": { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 }
};

await fs.mkdir(outDir, { recursive: true });

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function shot(page, device, state, orientation) {
  const file = path.join(outDir, `${device.name}-${orientation}-${slug(state)}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function collectMetrics(page, device, state, orientation, screenshot) {
  const data = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    const text = document.body?.innerText ?? "";
    const interactives = [...document.querySelectorAll("button, a, input, select, textarea, [role='button'], .leaflet-control-zoom a")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.tagName).trim();
        return {
          label: label.slice(0, 80),
          tag: el.tagName.toLowerCase(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });
    const smallTargets = interactives.filter((item) => item.width < 44 || item.height < 44);
    const textNodes = [...document.querySelectorAll("h1,h2,h3,p,span,button,label,input")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const value = el.tagName === "INPUT" ? el.value || el.getAttribute("placeholder") || "" : el.innerText || el.textContent || "";
        return {
          text: value.trim().replace(/\s+/g, " ").slice(0, 120),
          tag: el.tagName.toLowerCase(),
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: style.lineHeight,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          clippedX: el.scrollWidth > el.clientWidth + 2,
          clippedY: el.scrollHeight > el.clientHeight + 2
        };
      })
      .filter((item) => item.text);
    const clippedText = textNodes.filter((item) => item.clippedX || item.clippedY);
    const tinyText = textNodes.filter((item) => item.fontSize < 11);
    const buttons = interactives.filter((item) => item.tag === "button" || item.tag === "a");
    const closePairs = [];
    for (let i = 0; i < buttons.length; i += 1) {
      for (let j = i + 1; j < buttons.length; j += 1) {
        const a = buttons[i];
        const b = buttons[j];
        const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
        const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
        if (gapX < 8 && gapY < 8) closePairs.push([a.label, b.label, gapX, gapY]);
      }
    }
    const leaflets = [...document.querySelectorAll(".leaflet-container")].filter(visible).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    return {
      viewport: { width: vw, height: vh, dpr: window.devicePixelRatio },
      pageOverflowX: Math.max(0, doc.scrollWidth - vw),
      pageOverflowY: Math.max(0, doc.scrollHeight - vh),
      bodyTextSample: text.slice(0, 300),
      mojibake: /Ã|Â|â[^\s]?/.test(text),
      mojibakeSnippets: [...new Set((text.match(/.{0,20}(?:Ã|Â|â[^\s]?).{0,35}/g) ?? []).slice(0, 8))],
      smallTargets,
      clippedText: clippedText.slice(0, 20),
      tinyText: tinyText.slice(0, 20),
      closePairs: closePairs.slice(0, 20),
      leafletCount: leaflets.length,
      leaflets
    };
  });
  return { device: device.label, state, orientation, screenshot, ...data };
}

async function waitReady(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 });
  await page.waitForTimeout(900);
}

async function waitAppReady(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? "";
      return text.length > 0 && !text.includes("Application error");
    },
    null,
    { timeout: 30000 }
  );
}

async function gotoWithRetry(page, url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000, ...options });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(700 + attempt * 500);
    }
  }
  throw lastError;
}

async function clearAndOpen(page) {
  await gotoWithRetry(page, baseUrl, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.removeItem("punktlandung-active-session-v1");
    localStorage.setItem("punktlandung-name", "Mobile QA");
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(900);
}

async function setOrientation(page, device, orientation) {
  const width = orientation === "portrait" ? device.width : device.height;
  const height = orientation === "portrait" ? device.height : device.width;
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(350);
}

async function measureState(page, device, state, orientation, records) {
  const screenshot = await shot(page, device, state, orientation);
  records.push(await collectMetrics(page, device, state, orientation, screenshot));
}

async function clickUnique(page, selectorOrRole, name) {
  const loc = name ? page.getByRole(selectorOrRole, { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }) : page.locator(selectorOrRole);
  const count = await loc.count();
  if (count < 1) {
    if (name && selectorOrRole === "button") {
      const clicked = await page.evaluate((target) => {
        const buttons = [...document.querySelectorAll("button")];
        const normalize = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();
        const button = buttons.find((item) => {
          const rect = item.getBoundingClientRect();
          const style = getComputedStyle(item);
          return normalize(item.textContent ?? "").includes(normalize(target)) && style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
        });
        button?.click();
        return Boolean(button);
      }, name);
      if (clicked) {
        return;
      }
    }
    const labels = await page
      .locator("button")
      .evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()).filter(Boolean));
    throw new Error(`Expected one target for ${name ?? selectorOrRole}, found ${count}. Visible buttons: ${labels.join(" | ")}`);
  }
  await loc.first().click();
}

async function tapMapCenter(page) {
  const map = page.locator(".leaflet-container").first();
  await map.waitFor({ state: "visible", timeout: 10000 });
  const box = await map.boundingBox();
  if (!box) return false;
  await page.touchscreen.tap(box.x + box.width * 0.52, box.y + box.height * 0.48);
  await page.waitForTimeout(450);
  return true;
}

async function ensureMapOpen(page) {
  if (await page.locator(".leaflet-container").first().isVisible().catch(() => false)) return;

  const openButton = page.getByRole("button", { name: /^Karte öffnen$/i }).first();
  if (await openButton.isVisible().catch(() => false)) {
    await openButton.click();
    return;
  }

  const openPanel = page.locator("section").filter({ hasText: /Karte öffnen/i }).first();
  if (await openPanel.isVisible().catch(() => false)) {
    await openPanel.click();
    return;
  }

  await clickUnique(page, "button", "Karte öffnen");
}

async function ensureGuessPlaced(page, consoleMessages) {
  const submit = page.getByRole("button", { name: "Abgeben" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await submit.isEnabled().catch(() => false)) return true;
    await tapMapCenter(page);
  }
  consoleMessages.push("qa: Abgeben blieb deaktiviert, obwohl die Karte angetippt wurde.");
  return false;
}

async function runDevice(browser, device) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: true,
    hasTouch: true,
    locale: "de-DE",
    colorScheme: "dark"
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const records = [];
  const consoleMessages = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (error) => consoleMessages.push(`pageerror: ${error.message}`));

  await setOrientation(page, device, "portrait");
  await clearAndOpen(page);
  await measureState(page, device, "Start", "portrait", records);

  await page.locator("input").fill("Mobile QA Tester");
  await page.locator("input").focus();
  await page.setViewportSize({ width: device.width, height: Math.round(device.height * 0.58) });
  await page.waitForTimeout(350);
  await measureState(page, device, "Start with keyboard-height", "portrait", records);
  await setOrientation(page, device, "portrait");

  await setOrientation(page, device, "landscape");
  await measureState(page, device, "Start", "landscape", records);
  await setOrientation(page, device, "portrait");

  await clickUnique(page, "button", "Solo-Modus");
  await page.waitForTimeout(700);
  await measureState(page, device, "Lobby", "portrait", records);
  await setOrientation(page, device, "landscape");
  await measureState(page, device, "Lobby", "landscape", records);
  await setOrientation(page, device, "portrait");

  await clickUnique(page, "button", "Starten");
  await page.waitForTimeout(1500);
  await measureState(page, device, "Game closed map", "portrait", records);
  await setOrientation(page, device, "landscape");
  await measureState(page, device, "Game closed map", "landscape", records);
  await setOrientation(page, device, "portrait");

  await ensureMapOpen(page);
  await page.waitForTimeout(900);
  await measureState(page, device, "Game open map", "portrait", records);

  const map = page.locator(".leaflet-container");
  await map.waitFor({ state: "visible", timeout: 10000 });
  const mapBox = await map.boundingBox();
  if (mapBox) {
    await page.touchscreen.tap(mapBox.x + mapBox.width * 0.52, mapBox.y + mapBox.height * 0.48);
    await page.waitForTimeout(400);
    await client.send("Input.synthesizeScrollGesture", {
      x: Math.round(mapBox.x + mapBox.width / 2),
      y: Math.round(mapBox.y + mapBox.height / 2),
      xDistance: -140,
      yDistance: 0,
      speed: 900,
      gestureSourceType: "touch"
    }).catch((error) => consoleMessages.push(`cdp-scroll: ${error.message}`));
    await client.send("Input.synthesizePinchGesture", {
      x: Math.round(mapBox.x + mapBox.width / 2),
      y: Math.round(mapBox.y + mapBox.height / 2),
      scaleFactor: 1.35,
      relativeSpeed: 650,
      gestureSourceType: "touch"
    }).catch((error) => consoleMessages.push(`cdp-pinch: ${error.message}`));
    await page.waitForTimeout(500);
  }
  await measureState(page, device, "Game map after touch gestures", "portrait", records);
  await ensureGuessPlaced(page, consoleMessages);

  await clickUnique(page, "button", "Maximieren");
  await page.waitForTimeout(700);
  await measureState(page, device, "Game full map", "portrait", records);
  await setOrientation(page, device, "landscape");
  await measureState(page, device, "Game full map", "landscape", records);

  await setOrientation(page, device, "portrait");
  await ensureGuessPlaced(page, consoleMessages);
  await clickUnique(page, "button", "Abgeben");
  await page.waitForTimeout(1800);
  await measureState(page, device, "Results", "portrait", records);
  await setOrientation(page, device, "landscape");
  await measureState(page, device, "Results", "landscape", records);

  const perf = {};
  await page.addInitScript(() => {
    localStorage.removeItem("punktlandung-active-session-v1");
    localStorage.setItem("punktlandung-name", "Mobile QA");
  });
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await gotoWithRetry(page, baseUrl, { timeout: 30000 });
  await waitAppReady(page);

  for (const [profileName, profile] of Object.entries(networkProfiles)) {
    await client.send("Network.emulateNetworkConditions", profile);
    const start = Date.now();
    await gotoWithRetry(page, baseUrl, { timeout: 30000 });
    await waitAppReady(page);
    perf[profileName] = { domContentLoadedMs: Date.now() - start };
  }
  await client.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  await context.close();
  return { device: device.label, records, consoleMessages: [...new Set(consoleMessages)], performance: perf };
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
});

const results = [];
for (const device of devices) {
  results.push(await runDevice(browser, device));
}
await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  devices,
  results
};
await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ outDir, report: path.join(outDir, "report.json") }, null, 2));
