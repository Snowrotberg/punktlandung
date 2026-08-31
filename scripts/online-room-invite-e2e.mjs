import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3011";
const artifactDir = path.resolve(process.env.ARTIFACT_DIR ?? "artifacts/a4-online-invite");

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const contexts = [];
const browserErrors = [];

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|third-party cookie/i.test(message.text())) {
      browserErrors.push(`${label} console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(`${label} page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "failed";
    if (/google-analytics\.com|googletagmanager\.com/.test(request.url()) || failure === "net::ERR_ABORTED") return;
    browserErrors.push(`${label} network: ${request.url()} ${failure}`);
  });
}

async function contextFor(viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  contexts.push(context);
  return context;
}

async function joinDialog(page, name) {
  await page.getByRole("heading", { name: "Raum beitreten" }).waitFor();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Beitreten" }).click();
  await page.getByRole("heading", { name: "Warteraum" }).waitFor();
}

try {
  const hostContext = await contextFor();
  const host = await hostContext.newPage();
  watch(host, "host");
  await host.goto(`${baseUrl}/online-modus`, { waitUntil: "domcontentloaded" });
  await host.getByRole("heading", { name: "Passt eure Partie an" }).waitFor();
  await host.getByLabel("Raum beitreten").waitFor();
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await host.getByRole("heading", { name: "Warteraum" }).waitFor();
  const roomCode = (await host.locator('[class*="roomCode"] strong').innerText()).trim();
  assert.match(roomCode, /^[A-HJ-NP-Z2-9]{6}$/);

  await host.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ url }) => { window.sessionStorage.setItem("e2e-shared-url", String(url)); }
    });
  });
  await host.getByRole("button", { name: "Einladung teilen" }).click();
  const sharedUrl = await host.evaluate(() => window.sessionStorage.getItem("e2e-shared-url") ?? "");
  assert.equal(sharedUrl, `${baseUrl}/online-modus?room=${roomCode}`);
  await host.screenshot({ path: path.join(artifactDir, "01-host-warteraum-laptop.png"), fullPage: true, caret: "initial" });

  const legacyContext = await contextFor({ width: 390, height: 844 });
  const legacyGuest = await legacyContext.newPage();
  watch(legacyGuest, "legacy-guest");
  await legacyGuest.goto(`${baseUrl}/?room=${roomCode}`, { waitUntil: "domcontentloaded" });
  await legacyGuest.waitForURL(`${baseUrl}/online-modus?room=${roomCode}`);
  await legacyGuest.screenshot({ path: path.join(artifactDir, "02-legacy-link-join-phone.png"), fullPage: true, caret: "initial" });
  await joinDialog(legacyGuest, "Legacy Gast");
  await host.getByText("Legacy Gast", { exact: true }).waitFor();

  const manualContext = await contextFor({ width: 430, height: 932 });
  const manualGuest = await manualContext.newPage();
  watch(manualGuest, "manual-guest");
  await manualGuest.goto(`${baseUrl}/online-modus`, { waitUntil: "domcontentloaded" });
  const roomCodeInput = manualGuest.getByLabel("Raum beitreten");
  await roomCodeInput.pressSequentially(roomCode);
  await manualGuest.locator('form[class*="joinCodeForm"]').getByRole("button", { name: "Beitreten" }).click();
  await joinDialog(manualGuest, "Code Gast");
  await host.getByText("Code Gast", { exact: true }).waitFor();

  const invalidContext = await contextFor({ width: 932, height: 430 });
  const invalid = await invalidContext.newPage();
  watch(invalid, "invalid-code");
  await invalid.goto(`${baseUrl}/online-modus`, { waitUntil: "domcontentloaded" });
  const invalidInput = invalid.getByLabel("Raum beitreten");
  await invalidInput.pressSequentially("ABC");
  await invalid.locator('form[class*="joinCodeForm"]').getByRole("button", { name: "Beitreten" }).click();
  assert.equal(await invalidInput.evaluate((input) => input.validity.tooShort), true);
  await invalid.getByText("6 Zeichen · ohne Leerzeichen").waitFor();
  await invalid.screenshot({ path: path.join(artifactDir, "03-short-code-landscape.png"), fullPage: true, caret: "initial" });

  await invalidInput.fill("");
  await invalidInput.pressSequentially("ABCDEFG");
  assert.equal(await invalidInput.inputValue(), "ABCDEF");
  await invalid.locator('form[class*="joinCodeForm"]').getByRole("button", { name: "Beitreten" }).click();
  await invalid.getByRole("heading", { name: "Raum beitreten" }).waitFor();
  await invalid.getByLabel("Name").fill("Ohne Raum");
  await invalid.getByRole("button", { name: "Beitreten" }).click();
  await invalid.getByText("Diesen Raum gibt es nicht mehr.").waitFor();

  for (const { name, viewport } of [
    { name: "phone-small", viewport: { width: 360, height: 800 } },
    { name: "phone-large", viewport: { width: 430, height: 932 } },
    { name: "phone-landscape", viewport: { width: 932, height: 430 } },
    { name: "laptop", viewport: { width: 1366, height: 768 } }
  ]) {
    const context = await contextFor(viewport);
    const page = await context.newPage();
    watch(page, name);
    await page.goto(`${baseUrl}/online-modus`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Raum beitreten").waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} has ${overflow}px horizontal overflow`);
    await page.screenshot({ path: path.join(artifactDir, `setup-${name}.png`), fullPage: true, caret: "initial" });
  }

  assert.deepEqual(browserErrors, []);
  console.log(JSON.stringify({ roomCode, sharedUrl, guests: 2, viewports: 4, browserErrors: 0, artifactDir }, null, 2));
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
