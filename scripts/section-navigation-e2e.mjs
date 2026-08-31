import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3011";
const artifactDir = path.resolve(process.env.ARTIFACT_DIR ?? "artifacts/a4-section-navigation");
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];

async function inspectViewport(name, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|third-party cookie/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "failed";
    if (/google-analytics\.com|googletagmanager\.com/.test(request.url()) || failure === "net::ERR_ABORTED") return;
    errors.push(`network: ${request.url()} ${failure}`);
  });

  await page.goto(`${baseUrl}/faq`, { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Hilfe Bereiche" });
  const target = nav.getByRole("link", { name: "Rankings" });
  await target.scrollIntoViewIfNeeded();

  const before = await target.boundingBox();
  assert.ok(before);
  await target.focus();
  const focused = await target.boundingBox();
  assert.ok(focused);
  assert.deepEqual(
    { width: focused.width, height: focused.height, y: focused.y },
    { width: before.width, height: before.height, y: before.y },
    `${name}: keyboard focus changed chip geometry`
  );
  const focusStyles = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { transform: style.transform, outlineOffset: style.outlineOffset };
  });
  assert.equal(focusStyles.transform, "none");
  assert.equal(focusStyles.outlineOffset, "-3px");

  await page.mouse.move(focused.x + focused.width / 2, focused.y + focused.height / 2);
  await page.mouse.down();
  const pressed = await target.boundingBox();
  assert.ok(pressed);
  assert.deepEqual(
    { width: pressed.width, height: pressed.height, y: pressed.y },
    { width: focused.width, height: focused.height, y: focused.y },
    `${name}: pressed chip changed geometry`
  );
  await page.screenshot({ path: path.join(artifactDir, `${name}-pressed.png`), fullPage: true, caret: "initial" });
  await page.mouse.up();
  await page.waitForURL(`${baseUrl}/faq/rankings`);
  await page.waitForTimeout(500);

  const active = page.getByRole("navigation", { name: "Hilfe Bereiche" }).getByRole("link", { name: "Rankings" });
  const activeBox = await active.boundingBox();
  const navBox = await page.getByRole("navigation", { name: "Hilfe Bereiche" }).boundingBox();
  assert.ok(activeBox && navBox);
  assert.ok(activeBox.y >= navBox.y, `${name}: active top border is clipped`);
  assert.ok(activeBox.y + activeBox.height <= navBox.y + navBox.height, `${name}: active bottom border is clipped`);
  assert.ok(activeBox.x >= navBox.x - 1 && activeBox.x + activeBox.width <= navBox.x + navBox.width + 1, `${name}: active tab is not accessible after auto-centering`);

  await page.goBack({ waitUntil: "domcontentloaded" });
  const hydratedActive = page.getByRole("navigation", { name: "Hilfe Bereiche" }).getByRole("link", { name: "Übersicht" });
  await hydratedActive.waitFor();
  assert.equal(await hydratedActive.getAttribute("aria-current"), "page");

  await page.goto(`${baseUrl}/rankings`, { waitUntil: "domcontentloaded" });
  const accountNav = page.getByRole("navigation", { name: "Spielerkonto Bereiche" });
  const rankingActive = accountNav.getByRole("link", { name: "Rankings" });
  await rankingActive.waitFor();
  await rankingActive.scrollIntoViewIfNeeded();
  const rankingBox = await rankingActive.boundingBox();
  const accountNavBox = await accountNav.boundingBox();
  assert.ok(rankingBox && accountNavBox);
  assert.ok(rankingBox.y >= accountNavBox.y && rankingBox.y + rankingBox.height <= accountNavBox.y + accountNavBox.height);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${name}: ${overflow}px horizontal document overflow`);
  await page.screenshot({ path: path.join(artifactDir, `${name}-account-active.png`), fullPage: true, caret: "initial" });

  assert.deepEqual(errors, [], `${name}: browser errors`);
  results.push({ name, viewport, focusStyles, overflow, activeHeight: activeBox.height, pressedHeight: pressed.height });
  await context.close();
}

try {
  await inspectViewport("phone-small", { width: 360, height: 800 });
  await inspectViewport("phone-large", { width: 430, height: 932 });
  await inspectViewport("android-medium", { width: 393, height: 873 });
  console.log(JSON.stringify({ results, artifactDir }, null, 2));
} finally {
  await browser.close();
}
