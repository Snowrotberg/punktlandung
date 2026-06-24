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
const outDir = path.join(root, "test-artifacts", "mobile-horizontal", runId);
const baseUrl = "http://localhost:3000";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const devices = [
  { name: "iphone-17", label: "iPhone 17", width: 402, height: 874, dpr: 3 },
  { name: "pixel-10", label: "Google Pixel 10", width: 412, height: 923, dpr: 2.625 },
  { name: "fairphone-gen-6", label: "Fairphone Gen. 6", width: 372, height: 828, dpr: 3 },
  { name: "galaxy-s26", label: "Samsung Galaxy S26", width: 360, height: 780, dpr: 3 }
];

await fs.mkdir(outDir, { recursive: true });

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function screenshot(page, device, state) {
  const file = path.join(outDir, `${device.name}-landscape-${slug(state)}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function setupSession(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("punktlandung-active-session-v1");
    localStorage.setItem("punktlandung-name", "Horizontal QA");
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(700);
}

async function clickCard(page, text) {
  const clicked = await page.evaluate((target) => {
    const normalize = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();
    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find((item) => {
      const rect = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      return (
        normalize(item.textContent ?? "").includes(normalize(target)) &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    button?.click();
    return Boolean(button);
  }, text);
  if (!clicked) throw new Error(`Could not find visible button with text ${text}`);
}

async function ensureMapOpen(page) {
  const openArea = page.locator("section.punktlandung-guess-map-panel").first();
  await openArea.click({ timeout: 10000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll("section")].some((section) => /Tipp setzen/i.test(section.textContent ?? "")),
    null,
    { timeout: 10000 }
  );
}

async function runDevice(browser, device) {
  const context = await browser.newContext({
    viewport: { width: device.height, height: device.width },
    deviceScaleFactor: device.dpr,
    isMobile: true,
    hasTouch: true,
    locale: "de-DE",
    colorScheme: "dark"
  });
  const page = await context.newPage();
  const records = [];

  await setupSession(page);
  records.push(await screenshot(page, device, "start"));

  await clickCard(page, "Solo-Modus");
  await page.waitForTimeout(900);
  records.push(await screenshot(page, device, "lobby"));

  await clickCard(page, "Starten");
  await page.waitForTimeout(1500);
  records.push(await screenshot(page, device, "game-closed-map"));

  await ensureMapOpen(page);
  await page.waitForTimeout(700);
  records.push(await screenshot(page, device, "game-open-map"));

  const map = page.locator(".leaflet-container").first();
  const box = await map.boundingBox();
  if (box) {
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(500);
  }

  const maximizeButton = page.locator("button").filter({ hasText: /^(Maximieren|Minimieren)$/i }).first();
  if (await maximizeButton.isVisible().catch(() => false)) {
    await maximizeButton.click();
    await page.waitForTimeout(700);
  }
  records.push(await screenshot(page, device, "game-full-map"));

  const submitButton = page.getByRole("button", { name: /^ABGEBEN$/i }).first();
  if (await submitButton.isEnabled().catch(() => false)) {
    await submitButton.click();
    await page.waitForTimeout(1600);
    records.push(await screenshot(page, device, "results"));
  }

  await context.close();
  return records;
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
});

const files = [];
for (const device of devices) {
  files.push(...(await runDevice(browser, device)));
}

await browser.close();
await fs.writeFile(path.join(outDir, "index.json"), JSON.stringify({ outDir, files }, null, 2), "utf8");
console.log(JSON.stringify({ outDir }, null, 2));
