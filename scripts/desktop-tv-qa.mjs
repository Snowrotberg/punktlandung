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
const outDir = path.join(root, "test-artifacts", "desktop-tv", runId);
const baseUrl = process.env.PUNKT_BASE_URL ?? "http://localhost:3000";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const viewports = [
  { name: "desktop-16x9", label: "16:9", width: 1920, height: 1080, dpr: 1 },
  { name: "tv-4k", label: "4K", width: 3840, height: 2160, dpr: 1 }
];

const hostPlayer = {
  id: "local_host",
  name: "TV QA",
  color: "#34d399",
  score: 0,
  connected: true,
  isHost: true,
  team: "aurora",
  status: "active",
  cosmetic: "none",
  localOnly: false
};

const guestPlayer = {
  id: "local_2",
  name: "Spieler 2",
  color: "#818cf8",
  score: 0,
  connected: true,
  isHost: false,
  team: "pulse",
  status: "active",
  cosmetic: "none",
  localOnly: true
};

const sampleLocation = {
  id: "berlin-brandenburg-gate",
  title: "Brandenburger Tor, Berlin",
  countryCode: "DE",
  countryName: "Deutschland",
  continent: "Europe",
  lat: 52.5163,
  lng: 13.3777,
  panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Brandenburger_Tor_abends.jpg",
  panoramaUrls: [
    "https://commons.wikimedia.org/wiki/Special:FilePath/Brandenburger_Tor_abends.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/a/a6/Brandenburger_Tor_abends.jpg"
  ],
  attribution: "Wikimedia Commons",
  source: "wikimedia",
  category: "capitals"
};

await fs.mkdir(outDir, { recursive: true });

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function shot(page, viewport, state) {
  const file = path.join(outDir, `${viewport.name}-${slug(state)}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function setupStart(page) {
  await page.goto(`${baseUrl}?qa=reset-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => {
    localStorage.removeItem("punktlandung-active-session-v1");
    localStorage.setItem("punktlandung-name", "TV QA");
  });
  await page.goto(`${baseUrl}?qa=start-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
}

async function loadRoom(page, room) {
  await page.evaluate((nextRoom) => {
    window.history.replaceState(null, "");
    localStorage.setItem(
      "punktlandung-active-session-v1",
      JSON.stringify({
        savedAt: Date.now(),
        room: nextRoom,
        recentLocationIds: [],
        locationQueue: [],
        queueCategory: null,
        lastLocationId: nextRoom.location?.id ?? nextRoom.summaries?.at?.(-1)?.location?.id ?? null
      })
    );
  }, room);
  await page.goto(`${baseUrl}?qa=${room.status}-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    locale: "de-DE",
    colorScheme: "dark"
  });
  const page = await context.newPage();

  await setupStart(page);
  const files = [];

  files.push(await shot(page, viewport, "start"));

  await loadRoom(page, {
    code: "LOKAL",
    kind: "solo",
    hostId: "local_host",
    status: "lobby",
    settings: {
      mode: "classic",
      localMode: "solo",
      localPlayerCount: 1,
      timeLimitSec: 60,
      rounds: 15,
      noMove: false,
      noPan: false,
      noZoom: false,
      mapPackId: "world-party",
      category: "mixed"
    },
    players: [hostPlayer],
    currentRound: 0,
    location: null,
    guesses: [],
    roundEndsAt: null,
    summaries: [],
    emojiEvents: [],
    adGateUntil: null
  });
  files.push(await shot(page, viewport, "lobby"));

  await loadRoom(page, {
    code: "LOKAL",
    kind: "solo",
    hostId: "local_host",
    status: "guessing",
    settings: {
      mode: "classic",
      localMode: "solo",
      localPlayerCount: 1,
      timeLimitSec: 60,
      rounds: 15,
      noMove: false,
      noPan: false,
      noZoom: false,
      mapPackId: "world-party",
      category: "capitals"
    },
    players: [hostPlayer],
    currentRound: 1,
    location: sampleLocation,
    guesses: [],
    roundEndsAt: Date.now() + 60000,
    summaries: [],
    emojiEvents: [],
    adGateUntil: null
  });
  files.push(await shot(page, viewport, "game-closed"));

  await page.locator('section[class*="z-50"]').click({ position: { x: 30, y: 30 }, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  files.push(await shot(page, viewport, "game-open"));

  await loadRoom(page, {
    code: "LOKAL",
    kind: "solo",
    hostId: "local_host",
    status: "results",
    settings: {
      mode: "classic",
      localMode: "solo",
      localPlayerCount: 1,
      timeLimitSec: 60,
      rounds: 15,
      noMove: false,
      noPan: false,
      noZoom: false,
      mapPackId: "world-party",
      category: "capitals"
    },
    players: [
      { ...hostPlayer, score: 4894 },
      { ...guestPlayer, score: 4211 }
    ],
    currentRound: 1,
    location: null,
    guesses: [
      { playerId: "local_host", lat: 52.52, lng: 13.4, createdAt: Date.now() - 5000 },
      { playerId: "local_2", lat: 52.5, lng: 13.2, createdAt: Date.now() - 4000 }
    ],
    roundEndsAt: null,
    summaries: [
      {
        roundNumber: 1,
        location: sampleLocation,
        results: [
          { playerId: "local_host", distanceKm: 0.5, points: 4894, badge: "Punktlandung", eliminated: false, guess: { playerId: "local_host", lat: 52.52, lng: 13.4, createdAt: Date.now() - 5000 }, countryCorrect: true },
          { playerId: "local_2", distanceKm: 126.3, points: 4211, badge: "Nahe dran", eliminated: false, guess: { playerId: "local_2", lat: 52.5, lng: 13.2, createdAt: Date.now() - 4000 }, countryCorrect: true }
        ],
        crewGuess: null,
        crewDistanceKm: null,
        duel: [
          { team: "aurora", averageDistanceKm: 0, hp: 20000 },
          { team: "pulse", averageDistanceKm: 0, hp: 20000 }
        ],
        completedAt: Date.now()
      }
    ],
    emojiEvents: [],
    adGateUntil: null
  });
  files.push(await shot(page, viewport, "results"));

  await context.close();
  return files;
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
});

const files = [];
for (const viewport of viewports) {
  files.push(...(await runViewport(browser, viewport)));
}

await browser.close();
await fs.writeFile(path.join(outDir, "index.json"), JSON.stringify({ outDir, files }, null, 2), "utf8");
console.log(JSON.stringify({ outDir }, null, 2));
