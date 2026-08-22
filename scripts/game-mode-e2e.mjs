import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import WebSocket from "ws";

const root = process.cwd();
const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const wsUrl = process.env.E2E_WS_URL ?? "ws://127.0.0.1:3001";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outputDir = path.join(root, "test-artifacts", "game-mode-e2e");
const requestedMode = process.argv.find((value) => value.startsWith("--mode="))?.split("=")[1] ?? "all";
const requestedViewport = process.argv.find((value) => value.startsWith("--viewport="))?.split("=")[1] ?? "all";

const viewportProfiles = {
  laptop: { width: 1366, height: 768 },
  "phone-small": { width: 360, height: 800, isMobile: true, hasTouch: true }
};

const modes = requestedMode === "all" ? ["solo", "party", "online"] : [requestedMode];
const viewports = requestedViewport === "all" ? Object.entries(viewportProfiles) : [[requestedViewport, viewportProfiles[requestedViewport]]];

if (modes.some((mode) => !["solo", "party", "online"].includes(mode))) throw new Error(`Unbekannter Modus: ${requestedMode}`);
if (viewports.some(([, viewport]) => !viewport)) throw new Error(`Unbekannter Viewport: ${requestedViewport}`);

await fs.mkdir(outputDir, { recursive: true });

const reportPath = path.join(outputDir, "report.json");
let previousReport = [];
try {
  previousReport = JSON.parse(await fs.readFile(reportPath, "utf8"));
} catch {
  // The first run intentionally starts with an empty report.
}
const selectedRuns = new Set(viewports.flatMap(([viewportName]) => modes.map((mode) => `${mode}:${viewportName}`)));

function waitForSocketMessage(socket, predicate, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("WebSocket-Antwort hat das Zeitlimit überschritten."));
    }, timeoutMs);
    const onMessage = (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

async function connectGuest(roomCode, playerName) {
  const socket = new WebSocket(wsUrl, { origin: baseUrl });
  const helloPromise = waitForSocketMessage(socket, (message) => message.type === "hello");
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  await helloPromise;
  const joinedPromise = waitForSocketMessage(socket, (message) => message.type === "room_state" && message.state?.code === roomCode);
  socket.send(JSON.stringify({ type: "join_room", code: roomCode, playerName }));
  const joined = await joinedPromise;
  const guest = { socket, playerId: joined.state.players.find((player) => player.name === playerName)?.id, latestState: joined.state };
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === "room_state") guest.latestState = message.state;
    } catch {
      // Invalid payloads are asserted separately by the WebSocket hardening suite.
    }
  });
  return guest;
}

async function waitForRoomState(socket, predicate, timeoutMs = 30_000) {
  return waitForSocketMessage(socket, (message) => message.type === "room_state" && predicate(message.state), timeoutMs);
}

async function waitForLatestRoomState(guest, predicate, timeoutMs = 45_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate(guest.latestState)) return guest.latestState;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Online-Raum blieb bei Status ${guest.latestState?.status ?? "unbekannt"}, Runde ${guest.latestState?.currentRound ?? "?"}, ${guest.latestState?.guesses?.length ?? 0}/${guest.latestState?.players?.length ?? 0} Tipps.`);
}

async function selectSetup(page, mode) {
  const heading = page.getByRole("heading", { name: mode === "solo" ? "Passe deine Partie an" : "Passt eure Partie an" });
  await heading.waitFor({ state: "visible", timeout: 30_000 });
  const settings = page.getByRole("region", { name: "Spieleinstellungen" });
  if (mode === "party") {
    await settings.getByRole("button", { name: "10", exact: true }).first().click();
  }
  const roundsLabel = settings.locator("label", { hasText: /^Runden$/ });
  await roundsLabel.locator("..").getByRole("button", { name: "10", exact: true }).click();
  const timeLabel = settings.locator("label", { hasText: /^Zeit pro Runde$/ });
  await timeLabel.locator("..").getByRole("button", { name: "60 s", exact: true }).click();
  await page.getByRole("button", { name: "Spiel starten" }).click();
}

async function waitForGame(page, round) {
  await page.locator(".punktlandung-game-shell").waitFor({ state: "visible", timeout: 45_000 });
  await page.locator(".punktlandung-game-stat-value-round", { hasText: `${round}/10` }).waitFor({ state: "visible", timeout: 45_000 });
  const pinButton = page.getByRole("button", { name: "Pin setzen" });
  await pinButton.waitFor({ state: "visible", timeout: 45_000 });
  const timeValue = page.locator(".punktlandung-game-stat-value-time");
  const startedAt = Date.now();
  while (true) {
    const skip = page.getByRole("button", { name: "Anderen Ort nehmen" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(250);
      continue;
    }
    const timeText = (await timeValue.innerText()).trim();
    // On touch layouts the map is already open and "Pin setzen" remains
    // disabled until the user touches the map. A running numeric timer is the
    // authoritative signal that the prompt image is ready on every viewport.
    if (/^\d+s$/.test(timeText)) return;
    if (Date.now() - startedAt > 45_000) throw new Error("Die Tippabgabe wurde nach dem Bildladen nicht freigeschaltet.");
    await page.waitForTimeout(100);
  }
}

async function submitVisibleGuess(page, playerIndex = null, round = null) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const primary = page.getByRole("button", { name: "Pin setzen" });
    if (await primary.isVisible() && await primary.isEnabled()) await primary.click();
    if (playerIndex !== null) {
      const playerBadge = page.locator(".punktlandung-map-player-badge").nth(playerIndex);
      await playerBadge.waitFor({ state: "visible", timeout: 10_000 });
      await playerBadge.click();
    }
    const map = page.locator(".punktlandung-guess-map-panel .leaflet-container:visible");
    await map.waitFor({ state: "visible", timeout: 15_000 });
    const box = await map.boundingBox();
    if (!box) throw new Error("Tippkarte besitzt keine sichtbare Größe.");
    await map.click({ position: { x: Math.round(box.width * 0.53), y: Math.round(box.height * 0.47) } });
    const submit = page.getByRole("button", { name: /Pin abgeben|Tipp abgeben|Tipp bestätigen/ });
    await submit.waitFor({ state: "visible", timeout: 10_000 });
    if (await submit.isEnabled()) {
      await submit.click();
      await page.waitForTimeout(80);
      return;
    }
    const closeMap = page.locator(".punktlandung-map-close-button");
    if (await closeMap.isVisible().catch(() => false)) await closeMap.click();
    const skip = page.getByRole("button", { name: "Anderen Ort nehmen" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      if (round !== null) await waitForGame(page, round);
      continue;
    }
    await page.waitForTimeout(250);
  }
  throw new Error("Die Tippabgabe blieb nach mehreren Bildwechseln deaktiviert.");
}

async function completeLocalGame(page, playerCount) {
  for (let round = 1; round <= 10; round += 1) {
    await waitForGame(page, round);
    for (let player = 1; player <= playerCount; player += 1) {
      await submitVisibleGuess(page, playerCount > 1 ? player - 1 : null, round);
    }
    await page.getByRole("heading", { name: "Rundenrang" }).waitFor({ state: "visible", timeout: 30_000 });
    const roundText = await page.locator("text=/AUFLÖSUNG.*RUNDE/i").first().textContent().catch(() => "");
    if (round < 10) {
      await page.getByRole("button", { name: "Nächste Runde" }).click();
    } else {
      await page.getByRole("button", { name: "Endstand ansehen" }).click();
    }
    console.log(`    Runde ${round}/10 abgeschlossen${roundText ? ` (${roundText.trim()})` : ""}`);
  }
}

async function roomCodeFromPage(page) {
  const code = page.locator('[class*="roomCode"] code, [class*="roomCode"] strong').first();
  await code.waitFor({ state: "visible", timeout: 20_000 });
  return (await code.innerText()).trim();
}

async function completeOnlineGame(page) {
  const openRoom = page.getByRole("button", { name: "Online-Raum öffnen" });
  if (await openRoom.isVisible().catch(() => false)) await openRoom.click();
  const roomCode = await roomCodeFromPage(page);
  const guests = [];
  try {
    for (let index = 2; index <= 10; index += 1) {
      guests.push(await connectGuest(roomCode, `E2E Spieler ${index}`));
    }
    await page.getByText("10/10").waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    await page.getByRole("button", { name: "Starten" }).click();

    for (let round = 1; round <= 10; round += 1) {
      await waitForGame(page, round);
      await submitVisibleGuess(page, null, round);
      for (const guest of guests) {
        guest.socket.send(JSON.stringify({ type: "submit_guess", guess: { lat: 48.1 + round / 100, lng: 11.5 + round / 100 } }));
      }
      await waitForLatestRoomState(guests[0], (state) => (state.status === "results" || state.status === "finished") && state.currentRound === round);
      await page.getByRole("heading", { name: "Rundenrang" }).waitFor({ state: "visible", timeout: 30_000 });
      if (round < 10) {
        await page.getByRole("button", { name: /Nächste Runde|Bereit/ }).click();
        for (const guest of guests) guest.socket.send(JSON.stringify({ type: "ready_next_round" }));
      } else {
        await page.getByRole("button", { name: "Endstand ansehen" }).click();
      }
      console.log(`    Online-Runde ${round}/10 mit 10 Spielern abgeschlossen`);
    }
  } finally {
    for (const guest of guests) guest.socket.close();
  }
}

async function assertFinalState(page, mode, viewportName) {
  await page.getByRole("heading", { name: "Finaltabelle" }).waitFor({ state: "visible", timeout: 30_000 });
  const expectedPlayers = mode === "solo" ? 1 : 10;
  const rows = page.locator(".punktlandung-final-table-list > .punktlandung-final-player-row");
  const rowCount = await rows.count();
  if (rowCount !== expectedPlayers) throw new Error(`Finaltabelle enthält ${rowCount} statt ${expectedPlayers} Spieler.`);
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  if (layout.scrollWidth > layout.clientWidth + 1) throw new Error(`Horizontaler Overflow: ${layout.scrollWidth}px > ${layout.clientWidth}px.`);
  await page.screenshot({ path: path.join(outputDir, `${mode}-${viewportName}-endstand.png`), fullPage: true });
  return { rowCount, layout };
}

const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ["--disable-dev-shm-usage"] });
const report = previousReport.filter((entry) => !selectedRuns.has(`${entry.mode}:${entry.viewport}`));
try {
  for (const [viewportName, viewport] of viewports) {
    for (const mode of modes) {
      console.log(`\n${mode.toUpperCase()} · ${viewportName}`);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: Boolean(viewport.isMobile),
        hasTouch: Boolean(viewport.hasTouch),
        locale: "de-DE",
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error" && !/favicon|third-party cookie/i.test(message.text())) errors.push(`console: ${message.text()}`);
      });
      try {
        const setupPath = mode === "solo" ? "solo-modus" : mode === "party" ? "party-modus" : "online-modus";
        await page.goto(`${baseUrl}/${setupPath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await selectSetup(page, mode);
        if (mode === "online") await completeOnlineGame(page);
        else await completeLocalGame(page, mode === "party" ? 10 : 1);
        const finalState = await assertFinalState(page, mode, viewportName);
        if (errors.length) throw new Error(errors.join("\n"));
        await fs.rm(path.join(outputDir, `${mode}-${viewportName}-failure.png`), { force: true });
        report.push({ mode, viewport: viewportName, status: "passed", ...finalState });
        console.log(`  ✓ ${mode} auf ${viewportName}: vollständiger Ablauf bestanden`);
      } catch (error) {
        await page.screenshot({ path: path.join(outputDir, `${mode}-${viewportName}-failure.png`), fullPage: true }).catch(() => {});
        report.push({ mode, viewport: viewportName, status: "failed", error: error instanceof Error ? error.message : String(error), errors });
        console.error(`  ✗ ${mode} auf ${viewportName}: ${error instanceof Error ? error.message : error}`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  report.sort((left, right) => `${left.mode}:${left.viewport}`.localeCompare(`${right.mode}:${right.viewport}`));
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
}

if (report.some((entry) => entry.status === "failed")) process.exitCode = 1;
