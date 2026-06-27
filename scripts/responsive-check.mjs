import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const equalsIndex = normalized.indexOf("=");
  if (equalsIndex === -1) return null;

  const key = normalized.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = normalized.slice(equalsIndex + 1).trim();
  const quote = value[0];
  if ((quote === `"` || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }

  return { key, value };
}

async function loadEnvFiles() {
  const loaded = new Map();
  const protectedKeys = new Set(Object.keys(process.env));

  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(root, fileName);
    let contents = "";
    try {
      contents = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`Konnte ${fileName} nicht lesen: ${error.message}`);
      }
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed || protectedKeys.has(parsed.key)) continue;
      process.env[parsed.key] = parsed.value;
      loaded.set(parsed.key, fileName);
    }
  }

  return loaded;
}

const loadedEnvSources = await loadEnvFiles();
const outDir = path.join(root, "test-artifacts", "responsive");
const baseUrl = process.env.RESPONSIVE_URL ?? "http://localhost:3000";
const accessPasswordKey = process.env.RESPONSIVE_ACCESS_PASSWORD?.trim()
  ? "RESPONSIVE_ACCESS_PASSWORD"
  : process.env.APP_ACCESS_PASSWORD?.trim()
    ? "APP_ACCESS_PASSWORD"
    : null;
const accessPassword = accessPasswordKey ? process.env[accessPasswordKey] ?? "" : "";
const accessPasswordSource = accessPasswordKey
  ? loadedEnvSources.get(accessPasswordKey) ?? "Umgebungsvariable"
  : null;
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const onlineRoomStorageKey = "punktlandung-online-room-v1";

const viewports = [
  { name: "phone-small", width: 360, height: 800 },
  { name: "phone-large", width: 430, height: 932 },
  { name: "phone-landscape", width: 932, height: 430 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "monitor", width: 1920, height: 1080 },
  { name: "tv-4k", width: 3840, height: 2160 }
];

const hostPlayer = {
  id: "local_host",
  name: "QA Host",
  color: "#34d399",
  score: 4894,
  connected: true,
  isHost: true,
  team: "aurora",
  status: "active",
  cosmetic: "none",
  localOnly: false
};

const guestPlayer = {
  id: "local_2",
  name: "QA Gast",
  color: "#818cf8",
  score: 4211,
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

const settings = {
  mode: "classic",
  localMode: "solo",
  localPlayerCount: 1,
  timeLimitSec: 60,
  rounds: 3,
  noMove: false,
  noPan: false,
  noZoom: false,
  mapPackId: "world-party",
  category: "capitals"
};

const summary = {
  roundNumber: 1,
  location: sampleLocation,
  results: [
    {
      playerId: "local_host",
      distanceKm: 0.5,
      points: 4894,
      badge: "Punktlandung",
      eliminated: false,
      guess: { playerId: "local_host", lat: 52.52, lng: 13.4, createdAt: Date.now() - 5000 },
      countryCorrect: true
    },
    {
      playerId: "local_2",
      distanceKm: 126.3,
      points: 4211,
      badge: "Nahe dran",
      eliminated: false,
      guess: { playerId: "local_2", lat: 52.5, lng: 13.2, createdAt: Date.now() - 4000 },
      countryCorrect: true
    }
  ],
  crewGuess: null,
  crewDistanceKm: null,
  duel: [
    { team: "aurora", averageDistanceKm: 0.5, hp: 20000 },
    { team: "pulse", averageDistanceKm: 126.3, hp: 18800 }
  ],
  completedAt: Date.now(),
  roundStartedAt: Date.now() - 45000
};

function roomState(status) {
  const finished = status === "finished";
  return {
    code: "LOKAL",
    kind: "solo",
    hostId: "local_host",
    hostParticipation: "host_player",
    hostPlayerName: "QA Host",
    status,
    settings: { ...settings, rounds: finished ? 1 : settings.rounds },
    players: [
      hostPlayer,
      guestPlayer
    ],
    currentRound: 1,
    location: status === "guessing" ? sampleLocation : null,
    guesses: status === "guessing" ? [] : summary.results.map((item) => item.guess).filter(Boolean),
    timedOutPlayerIds: [],
    roundEndsAt: status === "guessing" ? Date.now() + 60000 : null,
    roundStartedAt: status === "guessing" ? Date.now() - 10000 : null,
    summaries: status === "guessing" ? [] : [summary],
    emojiEvents: [],
    adGateUntil: null
  };
}

function onlineWaitingRoomState() {
  return {
    code: "ABC123",
    kind: "online",
    hostId: "local_host",
    hostParticipation: "host_player",
    hostPlayerName: "QA Host",
    status: "lobby",
    settings,
    players: [
      {
        ...hostPlayer,
        id: "local_host",
        name: "QA Host",
        isHost: true
      }
    ],
    currentRound: 0,
    location: null,
    guesses: [],
    timedOutPlayerIds: [],
    roundEndsAt: null,
    roundStartedAt: null,
    summaries: [],
    emojiEvents: [],
    adGateUntil: null
  };
}

const targets = [
  { name: "home", access: "route", path: "/", resetSession: true, note: "echter URL-Pfad" },
  {
    name: "solo-modus",
    access: "route",
    path: "/solo-modus",
    resetSession: true,
    expectedText: "Was willst du erraten?",
    expectedRoom: { kind: "solo", localMode: "solo" },
    note: "echter URL-Pfad"
  },
  {
    name: "party-modus",
    access: "route",
    path: "/party-modus",
    resetSession: true,
    expectedText: "Was wollt ihr erraten?",
    expectedRoom: { kind: "solo", localMode: "couch" },
    note: "echter URL-Pfad"
  },
  {
    name: "online-modus",
    access: "route",
    path: "/online-modus",
    resetSession: true,
    expectedText: "Gemeinsam im virtuellen Raum",
    expectedRoom: { kind: "online" },
    note: "echter URL-Pfad"
  },
  {
    name: "warteraum",
    access: "online-room-state",
    path: "/warteraum",
    expectedText: "QR-Code scannen und beitreten",
    expectedOnlineRoom: { kind: "online", code: "ABC123" },
    note: "echter URL-Pfad mit QA-Online-Raum"
  },
  { name: "spielen", access: "state", path: "/spielen", status: "guessing", note: "echter URL-Pfad mit QA-Session" },
  { name: "aufloesung", access: "state", path: "/aufloesung", status: "results", note: "echter URL-Pfad mit QA-Session" },
  { name: "nochmal-ansehen", access: "state-click", status: "results", buttonText: "Bild nochmal ansehen", note: "Ergebniszustand plus Klick auf Bild nochmal ansehen" },
  { name: "endergebnis", access: "state", path: "/endergebnis", status: "finished", note: "echter URL-Pfad mit QA-Session" },
  { name: "infos", access: "route", path: "/infos", note: "echter URL-Pfad" },
  { name: "impressum", access: "route", path: "/impressum", note: "echter URL-Pfad" },
  { name: "datenschutz", access: "route", path: "/datenschutz", note: "echter URL-Pfad" },
  { name: "lizenzen", access: "route", path: "/lizenzen", note: "echter URL-Pfad" }
];

function parseArgs(argv) {
  const args = { page: null, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    if (arg.startsWith("--page=")) args.page = arg.slice("--page=".length).trim();
  }
  return args;
}

function targetUrl(targetPath = "/") {
  return new URL(targetPath, baseUrl).toString();
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  } catch {
    return chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }
}

async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.waitForTimeout(600);
}

function isAccessGateUrl(page) {
  return new URL(page.url()).pathname === "/zugang";
}

async function unlockAccessGate(page, originalUrl) {
  if (!isAccessGateUrl(page) || !accessPassword.trim()) return false;

  await page.locator("input[name='password']").fill(accessPassword);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.locator("button[type='submit']").click()
  ]);
  await waitForApp(page);

  if (isAccessGateUrl(page)) {
    return false;
  }

  await page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForApp(page);
  return !isAccessGateUrl(page);
}

async function resetStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem("punktlandung-active-session-v1");
    localStorage.setItem("punktlandung-name", "Responsive QA");
  });
}

async function gotoFresh(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForApp(page);
  await unlockAccessGate(page, url);
  return response;
}

async function loadState(page, status, targetPath = "/") {
  await gotoFresh(page, targetUrl("/"));
  await page.evaluate((nextRoom) => {
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
    localStorage.setItem("punktlandung-name", "Responsive QA");
  }, roomState(status));
  const url = new URL(targetUrl(targetPath));
  url.searchParams.set("responsive", `${status}-${Date.now()}`);
  await gotoFresh(page, url.toString());
}

async function loadOnlineWaitingRoom(page) {
  await gotoFresh(page, targetUrl("/"));
  await seedOnlineWaitingRoom(page);
  const url = new URL(targetUrl("/warteraum"));
  url.searchParams.set("responsive", `warteraum-${Date.now()}`);
  await gotoFresh(page, url.toString());
  await ensureOnlineWaitingRoom(page);
}

async function seedOnlineWaitingRoom(page) {
  await page.evaluate(({ storageKey, room }) => {
    localStorage.removeItem("punktlandung-active-session-v1");
    sessionStorage.setItem(storageKey, JSON.stringify(room));
    localStorage.setItem("punktlandung-name", "Responsive QA");
  }, { storageKey: onlineRoomStorageKey, room: onlineWaitingRoomState() });
}

async function ensureOnlineWaitingRoom(page) {
  const waitForWaitingRoom = () =>
    page.waitForFunction(
      ({ storageKey }) => {
        const text = document.body?.innerText ?? "";
        let storedRoom = null;
        try {
          const raw = window.sessionStorage.getItem(storageKey);
          storedRoom = raw ? JSON.parse(raw) : null;
        } catch {
          storedRoom = null;
        }

        return (
          text.includes("QR-Code scannen und beitreten") &&
          storedRoom?.kind === "online" &&
          storedRoom?.code === "ABC123" &&
          storedRoom?.status === "lobby"
        );
      },
      { storageKey: onlineRoomStorageKey },
      { timeout: 5000 }
    );

  try {
    await waitForWaitingRoom();
    return;
  } catch {
    await seedOnlineWaitingRoom(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForApp(page);
    await waitForWaitingRoom();
  }
}

async function clickButtonByVisibleText(page, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const roleMatch = page.getByRole("button", { name: new RegExp(escaped, "i") }).first();
  if (await roleMatch.isVisible({ timeout: 1500 }).catch(() => false)) {
    await roleMatch.click({ timeout: 5000 });
    return;
  }

  const textMatch = page.locator("button, [role='button'], a").filter({ hasText: new RegExp(escaped, "i") }).first();
  if (await textMatch.isVisible({ timeout: 5000 }).catch(() => false)) {
    await textMatch.click({ timeout: 5000 });
    return;
  }

  const labels = await page
    .locator("button, [role='button'], a")
    .evaluateAll((items) =>
      items
        .map((item) => item.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    );
  throw new Error(`Klickziel nicht gefunden: "${text}". Sichtbare Kandidaten: ${labels.join(" | ")}`);
}

async function openTarget(page, target) {
  if (target.access === "route") {
    const response = await gotoFresh(page, targetUrl(target.path));
    if (target.resetSession) {
      await resetStorage(page);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForApp(page);
    }
    return response;
  }

  if (target.access === "click") {
    const response = await gotoFresh(page, targetUrl(target.path));
    await resetStorage(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForApp(page);
    await clickButtonByVisibleText(page, target.buttonText);
    await page.waitForTimeout(700);
    return response;
  }

  if (target.access === "state" || target.access === "state-click") {
    await loadState(page, target.status, target.path);
    if (target.access === "state-click") {
      await clickButtonByVisibleText(page, target.buttonText);
      await page.waitForTimeout(700);
    }
    return null;
  }

  if (target.access === "online-room-state") {
    await loadOnlineWaitingRoom(page);
    return null;
  }

  throw new Error(`Unsupported target access: ${target.access}`);
}

async function collectLayoutMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let roomState = null;
    let onlineRoomState = null;
    try {
      const rawSession = window.localStorage.getItem("punktlandung-active-session-v1");
      const storedSession = rawSession ? JSON.parse(rawSession) : null;
      if (storedSession?.room) {
        roomState = {
          kind: storedSession.room.kind ?? null,
          status: storedSession.room.status ?? null,
          localMode: storedSession.room.settings?.localMode ?? null,
          players: Array.isArray(storedSession.room.players) ? storedSession.room.players.length : null
        };
      }
    } catch {
      roomState = null;
    }
    try {
      const rawOnlineRoom = window.sessionStorage.getItem("punktlandung-online-room-v1");
      const storedOnlineRoom = rawOnlineRoom ? JSON.parse(rawOnlineRoom) : null;
      if (storedOnlineRoom) {
        onlineRoomState = {
          code: storedOnlineRoom.code ?? null,
          kind: storedOnlineRoom.kind ?? null,
          status: storedOnlineRoom.status ?? null,
          players: Array.isArray(storedOnlineRoom.players) ? storedOnlineRoom.players.length : null
        };
      }
    } catch {
      onlineRoomState = null;
    }
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const visibleElements = [...document.querySelectorAll("body *")].filter(visible);
    const overflowingElements = visibleElements
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label =
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ||
          el.tagName.toLowerCase();
        return {
          tag: el.tagName.toLowerCase(),
          label,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.left < -2 || item.right > viewportWidth + 2)
      .slice(0, 10);

    return {
      title: document.title,
      pathname: window.location.pathname,
      accessGate: window.location.pathname === "/zugang" || /Freischalten/.test(body?.innerText ?? ""),
      viewportWidth,
      viewportHeight,
      documentWidth: doc.scrollWidth,
      bodyWidth: body?.scrollWidth ?? 0,
      horizontalOverflow: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0) > viewportWidth + 2,
      bodyTextLength: (body?.innerText ?? "").trim().length,
      bodyText: (body?.innerText ?? "").replace(/\s+/g, " ").trim(),
      roomState,
      onlineRoomState,
      visibleElementCount: visibleElements.length,
      overflowingElements,
      applicationError: (body?.innerText ?? "").includes("Application error")
    };
  });
}

async function runTargetViewport(browser, target, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "de-DE",
    colorScheme: "dark"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  let screenshot = path.join(outDir, `${target.name}-${viewport.name}.png`);
  const problems = [];
  let responseStatus = null;

  try {
    const response = await openTarget(page, target);
    responseStatus = response?.status() ?? null;
    if (responseStatus === 404) problems.push(`Route meldet 404: ${target.path}`);

    const metrics = await collectLayoutMetrics(page);
    if (metrics.accessGate) {
      problems.push(
        accessPassword.trim()
          ? "Die Ansicht bleibt trotz Zugangspasswort auf dem Zugangsgate."
          : "Die Ansicht zeigt das Zugangsgate. Setze RESPONSIVE_ACCESS_PASSWORD oder APP_ACCESS_PASSWORD fuer geschuetzte Checks."
      );
    }
    if (metrics.applicationError) problems.push("Die Ansicht zeigt einen Application error.");
    if (metrics.bodyTextLength === 0 || metrics.visibleElementCount === 0) problems.push("Der Body hat keinen sichtbaren Inhalt.");
    if (target.expectedText && !metrics.bodyText.includes(target.expectedText)) {
      problems.push(`Erwarteter Ansichtstext fehlt: "${target.expectedText}".`);
    }
    if (target.expectedRoom) {
      if (!metrics.roomState) {
        problems.push("Erwarteter Spielzustand fehlt im Browser-State.");
      } else {
        for (const [key, value] of Object.entries(target.expectedRoom)) {
          if (metrics.roomState[key] !== value) {
            problems.push(`Erwarteter Spielzustand passt nicht: ${key}=${metrics.roomState[key] ?? "null"} statt ${value}.`);
          }
        }
      }
    }
    if (target.expectedOnlineRoom) {
      if (!metrics.onlineRoomState) {
        problems.push("Erwarteter Online-Raum-State fehlt im Browser-State.");
      } else {
        for (const [key, value] of Object.entries(target.expectedOnlineRoom)) {
          if (metrics.onlineRoomState[key] !== value) {
            problems.push(`Erwarteter Online-Raum-State passt nicht: ${key}=${metrics.onlineRoomState[key] ?? "null"} statt ${value}.`);
          }
        }
      }
    }
    if (metrics.horizontalOverflow) {
      problems.push(`Horizontaler Overflow: Dokument ${metrics.documentWidth}px bei Viewport ${metrics.viewportWidth}px.`);
    }

    screenshot = await saveViewportScreenshot(page, screenshot);

    return {
      target: target.name,
      viewport: viewport.name,
      status: problems.length ? "failed" : "passed",
      responseStatus,
      screenshot,
      metrics,
      problems,
      consoleErrors: [...new Set(consoleErrors)]
    };
  } catch (error) {
    try {
      screenshot = await saveViewportScreenshot(page, screenshot);
    } catch {
      // Keep the original test failure visible even when the artifact cannot be written.
    }
    return {
      target: target.name,
      viewport: viewport.name,
      status: "failed",
      responseStatus,
      screenshot,
      metrics: null,
      problems: [error instanceof Error ? error.message : String(error)],
      consoleErrors: [...new Set(consoleErrors)]
    };
  } finally {
    await context.close();
  }
}

function renderReport({ selectedTargets, skippedTargets, results }) {
  const lines = [];
  const generatedAt = new Date().toISOString();
  lines.push("# Responsive QA Report");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Base URL: ${baseUrl}`);
  lines.push(
    accessPasswordKey
      ? `Access gate: unlocked with ${accessPasswordKey} from ${accessPasswordSource}`
      : "Access gate: no password found; protected views fail with a gate message"
  );
  lines.push("");
  lines.push("## Targets");
  lines.push("");
  for (const target of selectedTargets) {
    lines.push(`- ${target.name}: ${target.access} (${target.note})`);
  }
  for (const target of skippedTargets) {
    lines.push(`- ${target.name}: TODO/SKIPPED (${target.note})`);
  }
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push("| Target | Viewport | Status | Screenshot | Notes |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const result of results) {
    const fileName = path.basename(result.screenshot);
    const notes = [...result.problems, ...result.consoleErrors.slice(0, 3)].join("<br>").replace(/\|/g, "\\|") || "ok";
    lines.push(`| ${result.target} | ${result.viewport} | ${result.status} | ${fileName} | ${notes} |`);
  }
  if (skippedTargets.length) {
    lines.push("");
    lines.push("## TODO / Skipped");
    lines.push("");
    for (const target of skippedTargets) {
      lines.push(`- ${target.name}: ${target.note}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function removeIfExists(filePath) {
  await fs.rm(filePath, { force: true }).catch(() => {});
}

function fallbackArtifactPath(filePath) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}-${Date.now()}${parsed.ext}`);
}

function isLockedArtifactError(error) {
  return error?.code === "EPERM" || error?.code === "EACCES";
}

async function saveViewportScreenshot(page, filePath) {
  try {
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
  } catch (error) {
    if (!isLockedArtifactError(error)) throw error;
    const fallbackPath = fallbackArtifactPath(filePath);
    await page.screenshot({ path: fallbackPath, fullPage: false });
    console.warn(`  - Screenshot-Datei war gesperrt, Ersatz gespeichert: ${path.basename(fallbackPath)}`);
    return fallbackPath;
  }
}

async function writeTextArtifact(filePath, contents) {
  try {
    await fs.writeFile(filePath, contents, "utf8");
    return filePath;
  } catch (error) {
    if (!isLockedArtifactError(error)) throw error;
    const fallbackPath = fallbackArtifactPath(filePath);
    await fs.writeFile(fallbackPath, contents, "utf8");
    console.warn(`Report-Datei war gesperrt, Ersatz gespeichert: ${path.basename(fallbackPath)}`);
    return fallbackPath;
  }
}

async function cleanPreviousArtifacts(selectedTargets) {
  await removeIfExists(path.join(outDir, "report.md"));
  await removeIfExists(path.join(outDir, "report.json"));

  for (const target of selectedTargets) {
    for (const viewport of viewports) {
      await removeIfExists(path.join(outDir, `${target.name}-${viewport.name}.png`));
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const availableNames = targets.map((target) => target.name);

console.log(`Responsive QA Base URL: ${baseUrl}`);
if (accessPassword.trim()) {
  console.log(`Zugangsgate: Passwort wird aus ${accessPasswordKey} (${accessPasswordSource}) verwendet.`);
} else {
  console.log("Zugangsgate: kein Passwort gefunden.");
  console.log("Setze RESPONSIVE_ACCESS_PASSWORD oder APP_ACCESS_PASSWORD in .env.local, .env oder als Umgebungsvariable.");
  console.log("Geschuetzte Ansichten melden sonst das Zugangsgate als Fehler.");
}
console.log(`Verfuegbare Seitennamen: ${availableNames.join(", ")}`);
console.log("Einzelseite: npm run check:responsive -- --page=home");

if (args.help) {
  process.exit(0);
}

if (args.page && !availableNames.includes(args.page)) {
  console.error(`Unbekannte Seite: ${args.page}`);
  console.error(`Verfuegbar: ${availableNames.join(", ")}`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

const selected = args.page ? targets.filter((target) => target.name === args.page) : targets;
const selectedTargets = selected.filter((target) => target.access !== "todo");
const skippedTargets = selected.filter((target) => target.access === "todo");
await cleanPreviousArtifacts(selected);

for (const target of skippedTargets) {
  console.log(`TODO/uebersprungen: ${target.name} - ${target.note}`);
}

const browser = await launchBrowser();
const results = [];

try {
  for (const target of selectedTargets) {
    for (const viewport of viewports) {
      process.stdout.write(`Pruefe ${target.name} @ ${viewport.name} (${viewport.width}x${viewport.height}) ... `);
      const result = await runTargetViewport(browser, target, viewport);
      results.push(result);
      console.log(result.status === "passed" ? "ok" : "FEHLER");
      for (const problem of result.problems) console.log(`  - ${problem}`);
    }
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outDir, "report.md");
const writtenReportPath = await writeTextArtifact(reportPath, renderReport({ selectedTargets, skippedTargets, results }));

const failed = results.filter((result) => result.status === "failed");
console.log("");
console.log(`Screenshots: ${outDir}`);
console.log(`Report: ${writtenReportPath}`);
console.log(`Ergebnis: ${results.length - failed.length}/${results.length} Checks ok, ${failed.length} Fehler, ${skippedTargets.length} TODO/uebersprungen.`);

if (failed.length > 0) {
  console.log("Fehlerhafte Checks:");
  for (const result of failed) {
    console.log(`- ${result.target} @ ${result.viewport}: ${result.problems.join("; ")}`);
  }
  process.exit(1);
}
