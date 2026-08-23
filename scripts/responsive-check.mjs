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

await loadEnvFiles();
const outDir = path.join(root, "test-artifacts", "responsive");
const baseUrl = process.env.RESPONSIVE_URL ?? "http://localhost:3000";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const onlineRoomStorageKey = "punktlandung-online-room-v1";
const qaPanoramaPath = path.join(root, "public", "og-punktlandung.jpg");
const defaultConcurrency = 2;
const viewportProfiles = {
  quick: ["phone-small", "phone-landscape", "laptop"],
  full: null
};
const blockedThirdPartyHosts = [
  "pagead2.googlesyndication.com",
  "googleads.g.doubleclick.net",
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "fundingchoicesmessages.google.com"
];

const viewports = [
  { name: "phone-small", width: 360, height: 800, category: "mobile" },
  { name: "phone-large", width: 430, height: 932, category: "mobile" },
  { name: "phone-landscape", width: 932, height: 430, category: "mobile" },
  { name: "laptop", width: 1366, height: 768, category: "desktop" },
  { name: "monitor", width: 1920, height: 1080, category: "desktop" },
  { name: "tv-4k", width: 3840, height: 2160, category: "desktop" }
];

const hostPlayer = {
  id: "local_host",
  name: "Maximilian Müller",
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
  name: "Alexandra Wagner",
  color: "#818cf8",
  score: 4211,
  connected: true,
  isHost: false,
  team: "pulse",
  status: "active",
  cosmetic: "none",
  localOnly: true
};

const finalTablePlayers = [hostPlayer, guestPlayer, ...Array.from({ length: 8 }, (_, index) => ({
  id: `local_${index + 3}`,
  name: `QA Spieler ${index + 3}`,
  color: ["#fb7185", "#fbbf24", "#38bdf8", "#c084fc", "#fb923c", "#2dd4bf", "#a3e635", "#f472b6"][index],
  score: 3900 - index * 310,
  connected: true,
  isHost: false,
  team: index % 2 === 0 ? "aurora" : "pulse",
  status: "active",
  cosmetic: "none",
  localOnly: true
}))];

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
  category: "capitals",
  shortDescription: "Das Brandenburger Tor ist ein frühklassizistisches Triumphtor in Berlin. Es wurde zwischen 1788 und 1791 errichtet."
};

const cambodiaFlagLocation = {
  ...sampleLocation,
  id: "cambodia-flag",
  title: "Flagge von Kambodscha",
  countryCode: "KH",
  countryName: "Kambodscha",
  continent: "Asia",
  lat: 12.5657,
  lng: 104.991,
  category: "flags",
  shortDescription: "Die Flagge Kambodschas zeigt den Tempel Angkor Wat zwischen zwei blauen Streifen."
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
      distanceKm: 12.5,
      points: 4894,
      badge: "Nahe dran",
      eliminated: false,
      guess: { playerId: "local_host", lat: 52.52, lng: 13.4, createdAt: Date.now() - 5000 },
      countryCorrect: false
    },
    {
      playerId: "local_2",
      distanceKm: 126.3,
      points: 4211,
      badge: "Nahe dran",
      eliminated: false,
      guess: { playerId: "local_2", lat: 52.5, lng: 13.2, createdAt: Date.now() - 4000 },
      countryCorrect: false
    }
  ],
  crewGuess: null,
  crewDistanceKm: null,
  duel: [
    { team: "aurora", averageDistanceKm: 12.5, hp: 20000 },
    { team: "pulse", averageDistanceKm: 126.3, hp: 18800 }
  ],
  completedAt: Date.now(),
  roundStartedAt: Date.now() - 45000
};

const finalTableSummary = {
  ...summary,
  results: finalTablePlayers.map((player, index) => ({
    playerId: player.id,
    distanceKm: 12.5 + index * 38,
    points: player.score,
    badge: "Nahe dran",
    eliminated: false,
    guess: {
      playerId: player.id,
      lat: 52.52 + index * 0.01,
      lng: 13.4 + index * 0.01,
      createdAt: Date.now() - 5000 + index * 50,
      responseTimeMs: 12000 + index * 900
    },
    countryCorrect: false
  }))
};

function roomState(status, overrides = {}) {
  const finished = status === "finished";
  const baseRoom = {
    code: "LOKAL",
    kind: "solo",
    hostId: "local_host",
    hostParticipation: "host_player",
    hostPlayerName: "QA Host",
    status,
    settings: { ...settings, rounds: finished ? 1 : settings.rounds, localPlayerCount: finished ? 10 : settings.localPlayerCount },
    players: finished ? finalTablePlayers : [hostPlayer, guestPlayer],
    currentRound: 1,
    location: status === "guessing" ? sampleLocation : null,
    guesses: status === "guessing" ? [] : (finished ? finalTableSummary : summary).results.map((item) => item.guess).filter(Boolean),
    timedOutPlayerIds: [],
    roundEndsAt: status === "guessing" ? Date.now() + 60000 : null,
    roundStartedAt: status === "guessing" ? Date.now() - 10000 : null,
    summaries: status === "guessing" ? [] : [finished ? finalTableSummary : summary],
    emojiEvents: [],
    adGateUntil: null
  };

  return {
    ...baseRoom,
    ...overrides,
    settings: { ...baseRoom.settings, ...(overrides.settings ?? {}) }
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
    expectedText: "Passe deine Partie an",
    expectedRoom: { kind: "solo", localMode: "solo" },
    note: "echter URL-Pfad"
  },
  {
    name: "solo-modus-gespeicherte-einstellungen",
    access: "route-stored-settings",
    path: "/solo-modus",
    expectedText: "10 Runden",
    note: "SSR-Hydration mit von den Standardwerten abweichenden gespeicherten Einstellungen"
  },
  {
    name: "party-modus",
    access: "route",
    path: "/party-modus",
    resetSession: true,
    expectedText: "Passt eure Partie an",
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
    expectedText: "Alle bereit?",
    expectedOnlineRoom: { kind: "online", code: "ABC123" },
    note: "echter URL-Pfad mit QA-Online-Raum"
  },
  { name: "spielen", access: "state", path: "/spielen", status: "guessing", readySelector: ".punktlandung-game-shell", readyImageSelector: ".punktlandung-panorama-viewport img", note: "echter URL-Pfad mit QA-Session" },
  { name: "bild-laden", access: "state", path: "/spielen", status: "guessing", forceImageLoader: true, readySelector: ".punktlandung-image-loader", note: "erster Bildladezustand mit synchronem Suchscheinwerfer und zwei beleuchteten Ellipsensegmenten" },
  {
    name: "tipp-zu-aufloesung",
    access: "state-submit",
    path: "/spielen",
    status: "guessing",
    stateOverrides: { players: [hostPlayer], guesses: [], summaries: [] },
    expectedPath: "/aufloesung",
    expectedText: "AUFLÖSUNG",
    readySelector: ".punktlandung-results-grid",
    note: "echte Pin-Abgabe wechselt ohne leeren Zwischenframe und ohne Seiten-Remount zur Auflösung"
  },
  {
    name: "zeitablauf",
    access: "state",
    path: "/spielen",
    status: "guessing",
    stateOverrides: {
      roundEndsAt: Date.now() - 1000,
      timedOutPlayerIds: ["local_host", "local_2"]
    },
    expectedText: "AUFLÖSUNG",
    readySelector: ".punktlandung-results-grid",
    note: "abgelaufene Runde wechselt automatisch und ohne weitere Eingabe zur Auflösung"
  },
  { name: "aufloesung", access: "state", path: "/aufloesung", status: "results", readySelector: ".punktlandung-results-grid", note: "echter URL-Pfad mit QA-Session" },
  {
    name: "aufloesung-zielinfo",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      players: [hostPlayer],
      guesses: [summary.results[0].guess],
      summaries: [{ ...summary, results: [summary.results[0]] }]
    },
    clickSelector: ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-pin-actual):visible",
    expectedText: summary.location.shortDescription,
    readySelector: ".punktlandung-location-info-popup",
    note: "Ergebniszustand plus Klick auf den echten Zielpin und eingepasste Ortsinfo"
  },
  {
    name: "aufloesung-zielinfo-oben",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      players: [hostPlayer],
      guesses: [{ ...summary.results[0].guess, lat: 52.49 }],
      summaries: [{
        ...summary,
        results: [{
          ...summary.results[0],
          guess: { ...summary.results[0].guess, lat: 52.49 }
        }]
      }]
    },
    clickSelector: ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-pin-actual):visible",
    expectedText: summary.location.shortDescription,
    readySelector: ".punktlandung-location-info-popup",
    note: "Zielpin oberhalb des Spielerpins; Ortsinfo öffnet außerhalb der Ergebnisgrafik nach oben"
  },
  {
    name: "aufloesung-zielinfo-nord-sued",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      settings: { category: "flags" },
      players: [hostPlayer],
      guesses: [{ ...summary.results[0].guess, lat: -1.2654, lng: 116.8312 }],
      summaries: [{
        ...summary,
        location: cambodiaFlagLocation,
        results: [{
          ...summary.results[0],
          distanceKm: 2255,
          guess: { ...summary.results[0].guess, lat: -1.2654, lng: 116.8312 }
        }]
      }]
    },
    clickSelector: ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-pin-actual):visible",
    hoverSelector: ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-label-actual):visible",
    expectedHoverText: "Zusatzinformationen anzeigen",
    expectTooltipOutside: true,
    expectedText: cambodiaFlagLocation.shortDescription,
    readySelector: ".punktlandung-location-info-popup",
    note: "Realer Fernfall Kambodscha zu Indonesien; nördliches Ziel öffnet die Ortsinfo oberhalb"
  },
  {
    name: "aufloesung-zielinfo-unten",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      players: [hostPlayer],
      guesses: [{ ...summary.results[0].guess, lat: 53.4 }],
      summaries: [{
        ...summary,
        results: [{
          ...summary.results[0],
          guess: { ...summary.results[0].guess, lat: 53.4 }
        }]
      }]
    },
    clickSelector: ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-pin-actual):visible",
    hoverSelector: ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-label-actual):visible",
    expectedHoverText: "Zusatzinformationen anzeigen",
    expectTooltipOutside: true,
    expectedText: summary.location.shortDescription,
    readySelector: ".punktlandung-location-info-popup",
    note: "Südliches Ziel; Aktionshinweis und Ortsinfo öffnen außerhalb der Ergebnisgrafik nach unten"
  },
  {
    name: "letzte-runde",
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      currentRound: settings.rounds,
      summaries: [{ ...summary, roundNumber: settings.rounds }]
    },
    expectedText: `RUNDE ${settings.rounds} VON ${settings.rounds}`,
    readySelector: ".punktlandung-results-grid",
    note: "Ergebniszustand der letzten Runde mit erreichbarer Abschlussaktion"
  },
  { name: "nochmal-ansehen", access: "state-click", path: "/aufloesung", status: "results", buttonText: "Bild nochmal ansehen", readySelector: ".punktlandung-image-replay", readyImageSelector: ".punktlandung-panorama-viewport img", note: "Ergebniszustand plus Klick auf Bild nochmal ansehen" },
  { name: "endergebnis-gast", access: "state-click", path: "/endergebnis", status: "finished", buttonText: "Endstand ansehen", readySelector: ".punktlandung-final-standings-grid", note: "fertige QA-Session mit sichtbarem Anmelde- und Speicherangebot" },
  { name: "endergebnis", access: "state-click", path: "/endergebnis", status: "finished", buttonText: "Endstand ansehen", dismissButtonText: "Nicht speichern", readySelector: ".punktlandung-final-standings-grid", note: "fertige QA-Session plus Klick auf Endstand ansehen" },
  { name: "infos", access: "route", path: "/infos", note: "echter URL-Pfad" },
  { name: "hilfe", access: "route", path: "/faq", expectedText: "Häufige Fragen zu Punktlandung", note: "öffentliche Hilfe-Übersicht" },
  { name: "hilfe-spielablauf", access: "route", path: "/faq/spielablauf", expectedText: "So läuft eine Partie ab", note: "öffentliche Hilfe-Unterseite" },
  { name: "hilfe-punkte", access: "route", path: "/faq/punkte", expectedText: "So werden Punkte berechnet", note: "öffentliche Hilfe-Unterseite" },
  { name: "hilfe-konten", access: "route", path: "/faq/konten", expectedText: "Spielen mit oder ohne Konto", note: "öffentliche Hilfe-Unterseite" },
  { name: "hilfe-rankings", access: "route", path: "/faq/rankings", expectedText: "Persönlicher Verlauf und Rankings", note: "öffentliche Hilfe-Unterseite" },
  { name: "feedback", access: "route", path: "/feedback", expectedText: "Feedback", note: "öffentliches Feedback-Formular" },
  { name: "so-funktioniert", access: "route", path: "/so-funktioniert-punktlandung", expectedText: "Wie funktioniert Punktlandung?", note: "zitierbare Methodikseite" },
  { name: "partyspiel-geografie", access: "route", path: "/partyspiel-geografie", expectedText: "Punktlandung als Geografie-Partyspiel", note: "öffentliche Partyspiel-Unterseite" },
  { name: "ortskatalog", access: "route", path: "/ortskatalog", expectedText: "Welche Orte und Aufgaben gibt es bei Punktlandung?", note: "datenbasierte Katalogseite" },
  { name: "community", access: "route", path: "/community", expectedText: "Ideen für Punktlandung", note: "öffentlicher Community- und Roadmap-Bereich" },
  { name: "community-eigene", access: "route", path: "/community/meine-vorschlaege", expectedText: "Meine Vorschläge", note: "persönliche Community-Vorschlagsliste" },
  { name: "rankings", access: "route", path: "/rankings", expectedText: "Rankings", note: "öffentliche Ranking-Übersicht" },
  { name: "anmelden", access: "route", path: "/anmelden", expectedText: "Spielstände mitnehmen", note: "öffentliche Anmeldung" },
  { name: "konto-gast", access: "route", path: "/konto", expectedText: "Spielstände mitnehmen", note: "geschützter Kontobereich leitet Gäste zur Anmeldung" },
  { name: "konto-verlauf-gast", access: "route", path: "/konto/verlauf", expectedText: "Spielstände mitnehmen", note: "geschützter Spielverlauf leitet Gäste zur Anmeldung" },
  { name: "konto-einstellungen-gast", access: "route", path: "/konto/einstellungen", expectedText: "Spielstände mitnehmen", note: "geschützte Kontoeinstellungen leiten Gäste zur Anmeldung" },
  { name: "admin-gast", access: "route", path: "/admin", expectedText: "Spielstände mitnehmen", note: "geschützter Adminbereich leitet Gäste zur Anmeldung" },
  { name: "impressum", access: "route", path: "/impressum", note: "echter URL-Pfad" },
  { name: "datenschutz", access: "route", path: "/datenschutz", note: "echter URL-Pfad" },
  { name: "lizenzen", access: "route", path: "/lizenzen", note: "echter URL-Pfad" }
];

const documentTargetNames = new Set([
  "infos",
  "hilfe",
  "hilfe-spielablauf",
  "hilfe-punkte",
  "hilfe-konten",
  "hilfe-rankings",
  "feedback",
  "so-funktioniert",
  "partyspiel-geografie",
  "ortskatalog",
  "community",
  "community-eigene",
  "rankings",
  "anmelden",
  "konto-gast",
  "konto-verlauf-gast",
  "konto-einstellungen-gast",
  "admin-gast",
  "impressum",
  "datenschutz",
  "lizenzen"
]);

for (const target of targets) {
  target.layoutPolicy = documentTargetNames.has(target.name) ? "document-scroll" : "mobile-scroll-only";
}

function requiresViewportFit(target, viewport) {
  return target.layoutPolicy === "mobile-scroll-only" && viewport.category !== "mobile";
}

function parseArgs(argv) {
  const args = { page: null, viewport: null, profile: "full", concurrency: defaultConcurrency, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    if (arg.startsWith("--page=")) args.page = arg.slice("--page=".length).trim();
    if (arg.startsWith("--viewport=")) args.viewport = arg.slice("--viewport=".length).trim();
    if (arg.startsWith("--profile=")) args.profile = arg.slice("--profile=".length).trim();
    if (arg.startsWith("--concurrency=")) {
      const value = Number(arg.slice("--concurrency=".length).trim());
      if (Number.isInteger(value) && value > 0 && value <= viewports.length) args.concurrency = value;
    }
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
  await page.waitForFunction(
    () => Boolean(document.body?.children.length),
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(450);
}

async function navigatePage(page, url, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await waitForApp(page);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await page.waitForTimeout(500 * attempt);
    }
  }

  throw lastError;
}

async function resetStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem("punktlandung-active-session-v1");
    localStorage.removeItem("punktlandung-ranked-active-game-v1");
    localStorage.removeItem("punktlandung-ranked-dismissed-game-v1");
    localStorage.setItem("punktlandung-name", "Responsive QA");
    sessionStorage.removeItem("punktlandung-reset-session-v1");
    sessionStorage.removeItem("punktlandung-resume-setup-v1");
    sessionStorage.removeItem("punktlandung-visible-resume-setup-v1");
    sessionStorage.removeItem("punktlandung-direct-start");
    sessionStorage.removeItem("punktlandung-ranked-direct-start-v1");
  });
}

async function gotoFresh(page, url) {
  return navigatePage(page, url);
}

async function loadState(page, status, targetPath = "/", stateOverrides = {}) {
  await gotoFresh(page, targetUrl("/"));
  await page.evaluate((nextRoom) => {
    localStorage.removeItem("punktlandung-ranked-active-game-v1");
    localStorage.removeItem("punktlandung-ranked-dismissed-game-v1");
    sessionStorage.removeItem("punktlandung-reset-session-v1");
    sessionStorage.removeItem("punktlandung-resume-setup-v1");
    sessionStorage.removeItem("punktlandung-visible-resume-setup-v1");
    sessionStorage.removeItem("punktlandung-direct-start");
    sessionStorage.removeItem("punktlandung-ranked-direct-start-v1");
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
  }, roomState(status, stateOverrides));
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
          text.includes("Alle bereit?") &&
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
  await roleMatch.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  if (await roleMatch.isVisible().catch(() => false)) {
    await roleMatch.click({ timeout: 5000 });
    return;
  }

  const textMatch = page.locator("button, [role='button'], a").filter({ hasText: new RegExp(escaped, "i") }).first();
  await textMatch.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await textMatch.isVisible().catch(() => false)) {
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
  if (target.access === "route-stored-settings") {
    await gotoFresh(page, targetUrl("/"));
    await resetStorage(page);
    await page.evaluate(() => {
      localStorage.setItem("punktlandung-setup-settings-v3", JSON.stringify({
        timeLimitSec: 30,
        rounds: 10,
        noMove: false,
        noPan: false,
        noZoom: false,
        category: "mixed",
        difficulty: "medium"
      }));
    });
    return gotoFresh(page, targetUrl(target.path));
  }

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

  if (target.access === "state" || target.access === "state-click" || target.access === "state-submit") {
    await loadState(page, target.status, target.path, target.stateOverrides);
    if (target.access === "state-submit") {
      const game = page.locator(".punktlandung-game-shell");
      await game.waitFor({ state: "visible", timeout: 15000 });
      const timer = page.locator(".punktlandung-game-stat-value-time");
      await timer.waitFor({ state: "visible", timeout: 15000 });
      const startedAt = Date.now();
      while (!/^\d+s$/.test((await timer.innerText()).trim())) {
        if (Date.now() - startedAt > 30000) throw new Error("Die QA-Runde wurde nicht rechtzeitig zur Tippabgabe freigegeben.");
        await page.waitForTimeout(100);
      }
      const openMap = page.getByRole("button", { name: "Pin setzen" });
      if (await openMap.isVisible().catch(() => false) && await openMap.isEnabled().catch(() => false)) await openMap.click();
      const map = page.locator(".punktlandung-guess-map-panel .leaflet-container:visible").first();
      await map.waitFor({ state: "visible", timeout: 15000 });
      const box = await map.boundingBox();
      if (!box) throw new Error("Die Tippkarte besitzt keine sichtbare Größe.");
      await map.click({ position: { x: Math.round(box.width * 0.53), y: Math.round(box.height * 0.47) } });
      const submit = page.getByRole("button", { name: /Pin abgeben|Tipp abgeben|Tipp bestätigen/ }).first();
      await submit.waitFor({ state: "visible", timeout: 10000 });
      await page.evaluate(() => {
        window.__punktlandungTransitionProbe = { active: true, blankFrames: 0, frames: 0, paths: [window.location.pathname], states: [] };
        const sample = () => {
          const probe = window.__punktlandungTransitionProbe;
          if (!probe?.active) return;
          probe.frames += 1;
          const path = window.location.pathname;
          if (probe.paths.at(-1) !== path) probe.paths.push(path);
          const gameVisible = Boolean(document.querySelector(".punktlandung-game-shell"));
          const resultsVisible = Boolean(document.querySelector(".punktlandung-results-grid"));
          const state = `${path}|${gameVisible ? "game" : resultsVisible ? "results" : document.querySelector("main")?.className || "empty"}`;
          if (probe.states.at(-1) !== state) probe.states.push(state);
          if (!gameVisible && !resultsVisible) {
            probe.blankFrames += 1;
          }
          window.requestAnimationFrame(sample);
        };
        window.requestAnimationFrame(sample);
      });
      await submit.click();
      await page.locator(".punktlandung-results-grid").waitFor({ state: "visible", timeout: 15000 });
      await page.waitForURL((url) => url.pathname === "/aufloesung", { timeout: 15000 });
      await page.waitForTimeout(350);
      await page.evaluate(() => {
        if (window.__punktlandungTransitionProbe) window.__punktlandungTransitionProbe.active = false;
      });
    }
    if (target.access === "state-click") {
      if (target.hoverSelector) {
        const hoverTarget = page.locator(target.hoverSelector).first();
        await hoverTarget.waitFor({ state: "visible", timeout: 15000 });
        const nativeTitle = await hoverTarget.getAttribute("title");
        if (nativeTitle) throw new Error(`Nativer Browser-Tooltip ist noch vorhanden: ${nativeTitle}`);
        await hoverTarget.hover({ timeout: 5000 });
        const actionTooltip = page.locator(".punktlandung-map-action-tooltip:visible").first();
        await actionTooltip.waitFor({ state: "visible", timeout: 5000 });
        if (target.expectedHoverText && !(await actionTooltip.innerText()).includes(target.expectedHoverText)) {
          throw new Error(`Kartenhinweis enthält nicht den erwarteten Text: ${target.expectedHoverText}`);
        }
        const tooltipStyle = await actionTooltip.evaluate((element) => {
          const style = window.getComputedStyle(element);
          return { borderRadius: parseFloat(style.borderRadius), backgroundColor: style.backgroundColor };
        });
        if (tooltipStyle.borderRadius < 6 || tooltipStyle.backgroundColor === "rgba(0, 0, 0, 0)") {
          throw new Error(`Kartenhinweis verwendet nicht den Punktlandung-Stil: ${JSON.stringify(tooltipStyle)}`);
        }
        if (target.expectTooltipOutside) {
          const placement = await page.evaluate(() => {
            const map = document.querySelector(".punktlandung-results-map");
            const actual = map?.querySelector(".punktlandung-map-pin-actual")?.getBoundingClientRect();
            const player = map?.querySelector(".punktlandung-map-pin-player")?.getBoundingClientRect();
            const tooltip = map?.querySelector(".punktlandung-map-action-tooltip")?.getBoundingClientRect();
            if (!actual || !player || !tooltip) return null;
            const actualAbovePlayer = (actual.top + actual.bottom) / 2 < (player.top + player.bottom) / 2;
            return {
              actualAbovePlayer,
              outside: actualAbovePlayer ? tooltip.bottom <= actual.top + 2 : tooltip.top >= actual.bottom - 2,
              actual: { top: actual.top, bottom: actual.bottom },
              tooltip: { top: tooltip.top, bottom: tooltip.bottom }
            };
          });
          if (!placement?.outside) {
            throw new Error(`Kartenhinweis liegt nicht auf der freien Außenseite: ${JSON.stringify(placement)}`);
          }
        }
      }
      if (target.clickSelector) {
        const clickTarget = page.locator(target.clickSelector).first();
        await clickTarget.waitFor({ state: "visible", timeout: 15000 });
        await clickTarget.click({ timeout: 5000 });
      } else {
        await clickButtonByVisibleText(page, target.buttonText);
      }
      await page.waitForTimeout(target.clickSelector ? 1200 : 700);
      if (target.hoverSelector && await page.locator(".punktlandung-map-action-tooltip:visible").count()) {
        throw new Error("Kartenhinweis bleibt trotz bereits geöffneter Zusatzinformation sichtbar.");
      }
      if (target.dismissButtonText) {
        await clickButtonByVisibleText(page, target.dismissButtonText);
        await page.waitForTimeout(250);
      }
    }
    return null;
  }

  if (target.access === "online-room-state") {
    await loadOnlineWaitingRoom(page);
    return null;
  }

  throw new Error(`Unsupported target access: ${target.access}`);
}

async function collectLayoutMetrics(page, readySelector = null) {
  return page.evaluate((selector) => {
    const doc = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let roomState = null;
    let onlineRoomState = null;
    const transitionProbe = window.__punktlandungTransitionProbe ?? null;
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

    const textClippingCandidates = [...document.querySelectorAll("h1, h2, h3, h4, p, label, legend, th, td, button, a")]
      .filter(visible)
      .map((el) => {
        const style = window.getComputedStyle(el);
        const clippedX = el.scrollWidth > el.clientWidth + 2 && ["hidden", "clip"].includes(style.overflowX);
        const clippedY = el.scrollHeight > el.clientHeight + 2 && ["hidden", "clip"].includes(style.overflowY);
        return {
          tag: el.tagName.toLowerCase(),
          label: el.textContent?.replace(/\s+/g, " ").trim().slice(0, 100) || el.getAttribute("aria-label") || "",
          clippedX,
          clippedY,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight
        };
      })
      .filter((item) => item.label && (item.clippedX || item.clippedY))
      .slice(0, 10);

    const smallTouchTargets = [...document.querySelectorAll("button, [role='button'][aria-label], input, select, textarea")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          label: el.getAttribute("aria-label") || el.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) || "",
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((item) => item.width < 40 || item.height < 40)
      .slice(0, 10);

    const readyElement = selector ? document.querySelector(selector) : null;
    const readyRect = readyElement?.getBoundingClientRect() ?? null;
    const homeMapPreview = document.querySelector(".punktlandung-home-map-preview");
    const homeMapBase = homeMapPreview
      ? [...homeMapPreview.querySelectorAll(".punktlandung-home-map-base")].find((element) => getComputedStyle(element).display !== "none") ?? null
      : null;
    const homeMapRect = homeMapPreview?.getBoundingClientRect() ?? null;
    const homeMapLabels = homeMapPreview
      ? [...homeMapPreview.querySelectorAll(".punktlandung-map-label")]
          .filter(visible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom)
            };
          })
      : [];
    const homeMapVisuals = homeMapPreview
      ? [...homeMapPreview.querySelectorAll(".punktlandung-map-label, .punktlandung-map-pin, .punktlandung-pin-ellipse-icon svg, .punktlandung-home-map-static-pin, .punktlandung-home-map-static-ellipse")]
          .filter(visible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          })
      : [];
    const resultMap = document.querySelector(".punktlandung-results-map");
    const resultMapRect = resultMap?.getBoundingClientRect() ?? null;
    const firstVisibleRect = (selector) => {
      const element = resultMap ? [...resultMap.querySelectorAll(selector)].find(visible) : null;
      return element?.getBoundingClientRect() ?? null;
    };
    const popupRect = firstVisibleRect(".punktlandung-location-info-popup");
    const actualPinRect = firstVisibleRect(".punktlandung-map-pin-actual");
    const playerPinRect = firstVisibleRect(".punktlandung-map-pin-player");
    const actualLabelRect = firstVisibleRect(".punktlandung-map-label-actual");
    const playerLabelRect = firstVisibleRect(".punktlandung-map-label-player");
    const resultInfoVisuals = [popupRect, actualPinRect, playerPinRect, actualLabelRect, playerLabelRect].filter(Boolean);
    const actualAbovePlayer = actualPinRect && playerPinRect
      ? (actualPinRect.top + actualPinRect.bottom) / 2 < (playerPinRect.top + playerPinRect.bottom) / 2
      : null;

    return {
      title: document.title,
      pathname: window.location.pathname,
      viewportWidth,
      viewportHeight,
      documentWidth: doc.scrollWidth,
      documentHeight: doc.scrollHeight,
      bodyWidth: body?.scrollWidth ?? 0,
      bodyHeight: body?.scrollHeight ?? 0,
      horizontalOverflow: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0) > viewportWidth + 2,
      verticalOverflow: Math.max(doc.scrollHeight, body?.scrollHeight ?? 0) > viewportHeight + 2,
      bodyTextLength: (body?.innerText ?? "").trim().length,
      bodyText: (body?.innerText ?? "").replace(/\s+/g, " ").trim(),
      roomState,
      onlineRoomState,
      transitionProbe,
      visibleElementCount: visibleElements.length,
      overflowingElements,
      textClippingCandidates,
      smallTouchTargets,
      homeMapPreview: homeMapPreview ? {
        renderMode: homeMapPreview.getAttribute("data-render-mode"),
        liveCanvasMounted: Boolean(homeMapPreview.querySelector(".maplibregl-canvas")),
        baseVisible: homeMapBase ? getComputedStyle(homeMapBase).visibility !== "hidden" && Number(getComputedStyle(homeMapBase).opacity) > 0.01 : false,
        baseImageLoaded: Boolean(homeMapBase?.querySelector("img")?.complete && homeMapBase.querySelector("img")?.naturalWidth),
        labels: homeMapLabels,
        labelsInside: Boolean(homeMapRect) && homeMapLabels.length >= 2 && homeMapLabels.every((label) =>
          label.left >= homeMapRect.left + 8 &&
          label.right <= homeMapRect.right - 8 &&
          label.top >= homeMapRect.top + 8 &&
          label.bottom <= homeMapRect.bottom - 8
        ),
        visualsInside: Boolean(homeMapRect) && homeMapVisuals.length >= 6 && homeMapVisuals.every((visual) =>
          visual.left >= homeMapRect.left + 12 &&
          visual.right <= homeMapRect.right - 12 &&
          visual.top >= homeMapRect.top + 12 &&
          visual.bottom <= homeMapRect.bottom - 12
        )
      } : null,
      resultPopupSafety: popupRect && resultMapRect ? {
        visualCount: resultInfoVisuals.length,
        bounds: {
          map: { left: resultMapRect.left, top: resultMapRect.top, right: resultMapRect.right, bottom: resultMapRect.bottom },
          popup: { left: popupRect.left, top: popupRect.top, right: popupRect.right, bottom: popupRect.bottom },
          actualPin: actualPinRect ? { left: actualPinRect.left, top: actualPinRect.top, right: actualPinRect.right, bottom: actualPinRect.bottom } : null,
          playerPin: playerPinRect ? { left: playerPinRect.left, top: playerPinRect.top, right: playerPinRect.right, bottom: playerPinRect.bottom } : null,
          actualLabel: actualLabelRect ? { left: actualLabelRect.left, top: actualLabelRect.top, right: actualLabelRect.right, bottom: actualLabelRect.bottom } : null,
          playerLabel: playerLabelRect ? { left: playerLabelRect.left, top: playerLabelRect.top, right: playerLabelRect.right, bottom: playerLabelRect.bottom } : null
        },
        allInside: resultInfoVisuals.every((rect) =>
          rect.left >= resultMapRect.left + 3 &&
          rect.right <= resultMapRect.right - 3 &&
          rect.top >= resultMapRect.top + 3 &&
          rect.bottom <= resultMapRect.bottom - 3
        ),
        directionCorrect: actualAbovePlayer === null || !actualLabelRect
          ? false
          : actualAbovePlayer
            ? popupRect.bottom <= Math.min(actualPinRect.top, actualLabelRect.top) + 8
            : popupRect.top >= Math.max(actualPinRect.bottom, actualLabelRect.bottom) - 8
      } : null,
      fontStatus: document.fonts?.status ?? "unsupported",
      readyElementFullyVisible: readyRect
        ? readyRect.top >= -2 && readyRect.left >= -2 && readyRect.right <= viewportWidth + 2 && readyRect.bottom <= viewportHeight + 2
        : null,
      applicationError: (body?.innerText ?? "").includes("Application error")
    };
  }, readySelector);
}

async function collectLayoutMetricsStable(page, readySelector = null, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await collectLayoutMetrics(page, readySelector);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const navigationRace = /Execution context was destroyed|because of a navigation|Cannot find context/i.test(message);
      if (!navigationRace || attempt === attempts) throw error;
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  throw lastError;
}

function normalizeConsoleMessages(messages) {
  const unique = [...new Set(messages)];
  const ignored = [];
  const relevant = [];

  for (const message of unique) {
    const compact = message.replace(/\s+/g, " ").trim();
    if (
      /A tree hydrated but some attributes of the server rendered HTML/i.test(compact) ||
      /ERR_BLOCKED_BY_CLIENT/i.test(compact) ||
      /WebSocket connection to ['"]ws:\/\/(?:localhost|127\.0\.0\.1):3001\/['"] failed/i.test(compact) ||
      /googletagmanager\.com\/gtag\/js.*preloaded.*not used/i.test(compact) ||
      /\[Punktlandung map\].*Failed to fetch/i.test(compact) ||
      /Unable to load glyph range.*openfreemap\.org/i.test(compact) ||
      /Image "circle-11" could not be loaded.*map\.addImage/i.test(compact) ||
      /^error:\s*Event$/i.test(compact)
    ) {
      ignored.push(compact.slice(0, 500));
    } else {
      relevant.push(compact.slice(0, 1000));
    }
  }

  return { relevant, ignored };
}

async function blockResponsiveThirdParties(context, target) {
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    let parsedUrl = null;
    let hostname = "";
    try {
      parsedUrl = new URL(requestUrl);
      hostname = parsedUrl.hostname;
    } catch {
      hostname = "";
    }

    const isGameplayImage = parsedUrl?.pathname === "/api/image" || hostname.endsWith("wikimedia.org");
    if (target.forceImageLoader && isGameplayImage) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }

    if (parsedUrl?.pathname === "/api/image") {
      await route.fulfill({ path: qaPanoramaPath, contentType: "image/jpeg" });
      return;
    }

    // Local production QA intentionally runs without the separate WebSocket
    // process. A report-only CSP event is expected there and must not flood
    // the report endpoint until its rate limit masks real layout results.
    if (parsedUrl?.pathname === "/api/security/csp-report") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (blockedThirdPartyHosts.some((blockedHost) => hostname === blockedHost || hostname.endsWith(`.${blockedHost}`))) {
      await route.abort("blockedbyclient");
      return;
    }

    await route.continue();
  });
}

async function runTargetViewport(browser, target, viewport) {
  const startedAt = Date.now();
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "de-DE",
    colorScheme: "dark"
  });
  await blockResponsiveThirdParties(context, target);
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });

  let screenshot = path.join(outDir, `${target.name}-${viewport.name}.png`);
  const problems = [];
  const warnings = [];
  let responseStatus = null;
  let homeMapStability = null;
  let mapScrollStability = null;

  try {
    const response = await openTarget(page, target);
    responseStatus = response?.status() ?? null;
    if (responseStatus === 404) problems.push(`Route meldet 404: ${target.path}`);

    if (target.readySelector) {
      await page.locator(target.readySelector).first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForFunction(
        (selector) => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = window.getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        },
        target.readySelector,
        { timeout: 15000 }
      );
      await page.waitForTimeout(250);
    }

    if (target.readyImageSelector) {
      await page.waitForFunction(
        (selector) =>
          [...document.querySelectorAll(selector)].some(
            (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
          ),
        target.readyImageSelector,
        { timeout: 15000 }
      );
      await page.waitForTimeout(150);
    }

    if (target.name === "bild-laden") {
      const animationMetrics = await page.evaluate(() => {
        const readAnimation = (selector) => {
          const element = document.querySelector(selector);
          const animation = element?.getAnimations()[0];
          const effect = animation?.effect;
          const timing = effect?.getComputedTiming();
          return element && animation && effect ? {
            animationName: getComputedStyle(element).animationName,
            duration: timing?.duration ?? null,
            progress: timing?.progress ?? null,
            pathLength: element.getAttribute("pathLength"),
            keyframes: effect.getKeyframes().map((frame) => ({
              offset: frame.offset,
              strokeDashoffset: frame.strokeDashoffset ?? null,
              transform: frame.transform ?? null
            }))
          } : null;
        };
        return {
          beam: readAnimation(".punktlandung-loader-beam-orbit"),
          outer: readAnimation(".punktlandung-loader-ellipse-highlight-outer"),
          inner: readAnimation(".punktlandung-loader-ellipse-highlight-inner")
        };
      });
      const animations = [animationMetrics.beam, animationMetrics.outer, animationMetrics.inner];
      const progresses = animations.map((animation) => Number(animation?.progress ?? Number.NaN));
      const phaseSpread = Math.max(...progresses) - Math.min(...progresses);
      const ellipseKeyframeIsHistorical = [animationMetrics.outer, animationMetrics.inner].every((animation) => (
        animation?.animationName === "punktlandung-loader-ellipse-dash" &&
        animation.duration === 3200 &&
        animation.pathLength === "100" &&
        animation.keyframes.at(-1)?.strokeDashoffset === "105.5px"
      ));
      const beamRotatesCounterClockwise = (
        animationMetrics.beam?.animationName === "punktlandung-loader-beam-orbit" &&
        animationMetrics.beam.duration === 3200 &&
        animationMetrics.beam.keyframes.at(-1)?.transform?.includes("rotate(-360deg)")
      );
      if (!ellipseKeyframeIsHistorical || !beamRotatesCounterClockwise || !Number.isFinite(phaseSpread) || phaseSpread > 0.04) {
        problems.push(`Loader-Animation ist nicht synchron (${JSON.stringify({ phaseSpread, animationMetrics })}).`);
      }
      await page.screenshot({ path: path.join(outDir, `${target.name}-${viewport.name}-phase-a.png`), fullPage: true });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, `${target.name}-${viewport.name}-phase-b.png`), fullPage: true });
    }

    if (target.expectedText) {
      await page
        .getByText(target.expectedText, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .catch(() => {});
    }

    if (target.expectedRoom) {
      await page
        .waitForFunction(
          (expectedRoom) => {
            try {
              const rawSession = window.localStorage.getItem("punktlandung-active-session-v1");
              const room = rawSession ? JSON.parse(rawSession)?.room : null;
              return Boolean(
                room &&
                  Object.entries(expectedRoom).every(([key, value]) => {
                    const actual = key === "localMode" ? room.settings?.localMode : room[key];
                    return actual === value;
                  })
              );
            } catch {
              return false;
            }
          },
          target.expectedRoom,
          { timeout: 5000 }
        )
        .catch(() => {});
    }

    await page.waitForFunction(
      () => (document.body?.innerText ?? "").trim().length > 0,
      null,
      { timeout: 10000 }
    );

    if (target.name === "aufloesung") {
      const targetPin = page.locator(
        ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-pin-actual):visible"
      ).first();
      await targetPin.waitFor({ state: "visible", timeout: 10000 });
      await targetPin.click();
      const infoPopup = page.locator(".punktlandung-location-info-popup").first();
      await infoPopup.waitFor({ state: "visible", timeout: 5000 });
      // Opening a Leaflet popup can auto-pan the map with a short animation.
      // Measure only after that movement has settled, otherwise the check
      // intermittently captures the popup between its old and final position.
      await page.waitForTimeout(450);
      const popupPlacement = await infoPopup.evaluate((popup) => {
        const visiblePopup = popup.querySelector(".leaflet-popup-content-wrapper") ?? popup;
        const popupRect = visiblePopup.getBoundingClientRect();
        const mapRect = popup.closest(".leaflet-container")?.getBoundingClientRect();
        return mapRect ? {
          left: popupRect.left - mapRect.left,
          top: popupRect.top - mapRect.top,
          right: mapRect.right - popupRect.right,
          bottom: mapRect.bottom - popupRect.bottom
        } : null;
      });
      if (!popupPlacement || Object.values(popupPlacement).some((distance) => distance < -1)) {
        problems.push(`Zielinfo-Popover liegt außerhalb der Karte${popupPlacement ? ` (${JSON.stringify(popupPlacement)})` : ""}.`);
      }
    }

    if (target.name === "home") {
      await page.locator(".punktlandung-home-map-preview").waitFor({ state: "visible", timeout: 15000 });
      const homeMapIsLive = await page.locator(".punktlandung-home-map-preview").getAttribute("data-render-mode") === "live-map";
      if (homeMapIsLive) {
        await page.locator(".punktlandung-home-map-preview .maplibregl-canvas").waitFor({ state: "attached", timeout: 20000 });
        await page.locator(".punktlandung-home-map-preview .punktlandung-map-label").first().waitFor({ state: "visible", timeout: 20000 });
      }
      await page.locator(".punktlandung-home-map-preview.is-map-ready").waitFor({ state: "visible", timeout: 20000 });
      const readStableVisuals = () => page.evaluate(() =>
        [...document.querySelectorAll(".punktlandung-home-map-preview .punktlandung-map-label, .punktlandung-home-map-preview .punktlandung-home-map-static-pin:not(.is-actual), .punktlandung-home-map-preview .punktlandung-home-map-static-ellipse")]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          })
      );
      const firstVisuals = await readStableVisuals();
      await page.waitForTimeout(700);
      const secondVisuals = await readStableVisuals();
      const deltas = firstVisuals.flatMap((first, index) => {
        const second = secondVisuals[index];
        return second ? [
          Math.abs(first.left - second.left),
          Math.abs(first.right - second.right),
          Math.abs(first.top - second.top),
          Math.abs(first.bottom - second.bottom)
        ] : [Number.POSITIVE_INFINITY];
      });
      homeMapStability = {
        visualCount: secondVisuals.length,
        maxMovementPx: deltas.length ? Math.max(...deltas) : 0
      };
      const intendedMotion = await page.evaluate(() => {
        const connector = [...document.querySelectorAll(".punktlandung-home-map-static-connector line")]
          .find((element) => getComputedStyle(element).display !== "none");
        const targetPin = document.querySelector(".punktlandung-home-map-static-pin.is-actual");
        const liveMap = document.querySelector(".punktlandung-home-map-preview[data-render-mode='live-map']");
        return liveMap
          ? { connectorAnimation: "live-map", targetPinAnimation: "live-map" }
          : {
              connectorAnimation: connector ? getComputedStyle(connector).animationName : "none",
              targetPinAnimation: targetPin ? getComputedStyle(targetPin).animationName : "none"
            };
      });
      homeMapStability.intendedMotion = intendedMotion;
    }

    if (target.name === "spielen" || target.name === "nochmal-ansehen") {
      const mapPanel = page.locator(".punktlandung-guess-map-panel").first();
      await mapPanel.waitFor({ state: "visible", timeout: 10000 });
      await page.waitForTimeout(400);
      const beforeScroll = await mapPanel.boundingBox();
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await page.waitForTimeout(250);
      const afterScroll = await mapPanel.boundingBox();
      const scrollPosition = await page.evaluate(() => window.scrollY);
      const maxMovement = beforeScroll && afterScroll
        ? Math.max(
            Math.abs(beforeScroll.x - afterScroll.x),
            Math.abs(beforeScroll.y - afterScroll.y),
            Math.abs(beforeScroll.width - afterScroll.width),
            Math.abs(beforeScroll.height - afterScroll.height)
          )
        : Number.POSITIVE_INFINITY;
      mapScrollStability = { scrollPosition, maxMovementPx: maxMovement };
      if (maxMovement > 1) {
        problems.push(`Die Spielkarte bewegt sich beim Dokument-Scroll (scrollY ${scrollPosition}px, maximale Verschiebung ${maxMovement.toFixed(1)}px).`);
      }
    }

    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    }).catch(() => {});
    const metrics = await collectLayoutMetricsStable(page, target.readySelector ?? null);
    if (homeMapStability) metrics.homeMapStability = homeMapStability;
    if (mapScrollStability) metrics.mapScrollStability = mapScrollStability;
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
    if (target.name === "home" && (!metrics.homeMapPreview
      || metrics.homeMapPreview.renderMode !== "static-overlay"
      || metrics.homeMapPreview.liveCanvasMounted
      || !metrics.homeMapPreview.baseVisible
      || !metrics.homeMapPreview.baseImageLoaded)) {
      problems.push("Die Startseiten-Vorschau verwendet nicht ausschließlich die fertig geladene statische Kartenbasis.");
    }
    if (target.name === "home" && metrics.homeMapPreview && !metrics.homeMapPreview.labelsInside) {
      problems.push("Die Kartenlabels liegen nicht vollständig mit Randabstand innerhalb der Vorschau.");
    }
    if (target.name === "home" && metrics.homeMapPreview && metrics.homeMapPreview.renderMode === "static-overlay" && !metrics.homeMapPreview.visualsInside) {
      problems.push("Pins, Ellipsen oder Labels verletzen die Safe Area der Startseitenkarte.");
    }
    if (target.name === "home" && (!metrics.homeMapStability || metrics.homeMapStability.visualCount < 2 || metrics.homeMapStability.maxMovementPx > 1)) {
      problems.push("Die statischen Karten-Overlays bewegen sich außerhalb der vorgesehenen Linien- und Zielpin-Animation.");
    }
    if (target.name === "home" && metrics.homeMapStability && (
      metrics.homeMapStability.intendedMotion?.connectorAnimation === "none"
      || metrics.homeMapStability.intendedMotion?.targetPinAnimation === "none"
    )) {
      problems.push("Die vorgesehene Linien- oder Zielpin-Animation ist nicht aktiv.");
    }

    if (target.name === "nochmal-ansehen") {
      const topActionHeights = await page.locator(".punktlandung-replay-top-actions > button:visible").evaluateAll(
        (buttons) => buttons.map((button) => button.getBoundingClientRect().height)
      );
      if (topActionHeights.length >= 2 && Math.max(...topActionHeights) - Math.min(...topActionHeights) > 1) {
        problems.push(`Replay-Buttons sind nicht gleich hoch (${topActionHeights.map((height) => height.toFixed(1)).join(" / ")} px).`);
      }
    }
    if (target.expectedPath && metrics.pathname !== target.expectedPath) {
      problems.push(`Erwarteter Pfad fehlt: ${metrics.pathname} statt ${target.expectedPath}.`);
    }
    if (target.name === "tipp-zu-aufloesung" && (
      !metrics.transitionProbe ||
      metrics.transitionProbe.blankFrames !== 0 ||
      !metrics.transitionProbe.paths.includes("/aufloesung")
    )) {
      problems.push(`Der Wechsel zur Auflösung enthielt ${metrics.transitionProbe?.blankFrames ?? "unbekannt viele"} leere Zwischenframes.`);
    }
    if (target.name.startsWith("aufloesung-zielinfo") && (
      !metrics.resultPopupSafety ||
      metrics.resultPopupSafety.visualCount < 5 ||
      !metrics.resultPopupSafety.allInside ||
      !metrics.resultPopupSafety.directionCorrect
    )) {
      problems.push("Zielinfo, beide Pins und beide Labels liegen nicht vollständig und richtungsrichtig innerhalb der Auflösungskarte.");
    }
    if (requiresViewportFit(target, viewport) && metrics.verticalOverflow) {
      problems.push(`Unerlaubtes Desktop-Scrollen: Dokument ${metrics.documentHeight}px bei Viewport ${metrics.viewportHeight}px.`);
    }
    if (requiresViewportFit(target, viewport) && metrics.readyElementFullyVisible === false) {
      problems.push(`Die zentrale Ansicht ${target.readySelector} liegt nicht vollstaendig im Viewport.`);
    }
    if (metrics.fontStatus !== "loaded" && metrics.fontStatus !== "unsupported") {
      warnings.push(`Webfonts sind noch nicht vollstaendig geladen: ${metrics.fontStatus}.`);
    }
    for (const item of metrics.textClippingCandidates.slice(0, 3)) {
      warnings.push(`Moegliche Textkuerzung in <${item.tag}>: "${item.label}".`);
    }
    if (viewport.category === "mobile") {
      for (const item of metrics.smallTouchTargets.slice(0, 3)) {
        warnings.push(`Kleine Touch-Flaeche ${item.width}x${item.height}px: "${item.label || item.tag}".`);
      }
    }

    screenshot = await saveViewportScreenshot(page, screenshot);

    const normalizedConsole = normalizeConsoleMessages(consoleErrors);
    for (const responseError of [...new Set(httpErrors)]) problems.push(`HTTP-Fehler: ${responseError}`);
    for (const consoleError of normalizedConsole.relevant) problems.push(`Browserfehler: ${consoleError}`);
    return {
      target: target.name,
      viewport: viewport.name,
      status: problems.length ? "failed" : "passed",
      durationMs: Date.now() - startedAt,
      responseStatus,
      screenshot,
      metrics,
      problems,
      warnings,
      httpErrors: [...new Set(httpErrors)],
      consoleErrors: normalizedConsole.relevant,
      ignoredConsoleErrors: normalizedConsole.ignored
    };
  } catch (error) {
    try {
      screenshot = await saveViewportScreenshot(page, screenshot);
    } catch {
      // Keep the original test failure visible even when the artifact cannot be written.
    }
    const normalizedConsole = normalizeConsoleMessages(consoleErrors);
    return {
      target: target.name,
      viewport: viewport.name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      responseStatus,
      screenshot,
      metrics: null,
      problems: [error instanceof Error ? error.message : String(error)],
      warnings,
      httpErrors: [...new Set(httpErrors)],
      consoleErrors: normalizedConsole.relevant,
      ignoredConsoleErrors: normalizedConsole.ignored
    };
  } finally {
    await context.close();
  }
}

function renderReport({ selectedTargets, skippedTargets, results }) {
  const lines = [];
  const generatedAt = new Date().toISOString();
  const failed = results.filter((result) => result.status === "failed");
  const ignoredConsoleCount = results.reduce((sum, result) => sum + (result.ignoredConsoleErrors?.length ?? 0), 0);
  const relevantConsoleCount = results.reduce((sum, result) => sum + (result.consoleErrors?.length ?? 0), 0);
  const httpErrorCount = results.reduce((sum, result) => sum + (result.httpErrors?.length ?? 0), 0);
  const warningCount = results.reduce((sum, result) => sum + (result.warnings?.length ?? 0), 0);
  const totalDurationMs = results.reduce((sum, result) => sum + (result.durationMs ?? 0), 0);
  lines.push("# Responsive QA Report");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Base URL: ${baseUrl}`);
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Checks: ${results.length - failed.length}/${results.length} bestanden`);
  lines.push(`- Fehler: ${failed.length}`);
  lines.push(`- Hinweise zur manuellen Pruefung: ${warningCount}`);
  lines.push(`- Addierte Check-Laufzeit: ${(totalDurationMs / 1000).toFixed(1)} s`);
  lines.push(`- Relevante Konsolenmeldungen: ${relevantConsoleCount}`);
  lines.push(`- HTTP-Antworten ab Status 400: ${httpErrorCount}`);
  lines.push(`- Ausgeblendete bekannte QA-Konsolenmeldungen: ${ignoredConsoleCount}`);
  lines.push("");
  lines.push("## Targets");
  lines.push("");
  for (const target of selectedTargets) {
    lines.push(`- ${target.name}: ${target.access}, ${target.layoutPolicy} (${target.note})`);
  }
  for (const target of skippedTargets) {
    lines.push(`- ${target.name}: TODO/SKIPPED (${target.note})`);
  }
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push("| Target | Viewport | Status | Dauer | Screenshot | Notes |");
  lines.push("| --- | --- | --- | ---: | --- | --- |");
  for (const result of results) {
    const fileName = path.basename(result.screenshot);
    const notes = [...result.problems, ...(result.warnings ?? []).slice(0, 3)]
      .map((note) => note.slice(0, 240))
      .join("<br>")
      .replace(/\|/g, "\\|") || "ok";
    lines.push(`| ${result.target} | ${result.viewport} | ${result.status} | ${((result.durationMs ?? 0) / 1000).toFixed(1)} s | ${fileName} | ${notes} |`);
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

async function cleanPreviousArtifacts(selectedTargets, selectedViewports) {
  await removeIfExists(path.join(outDir, "report.md"));
  await removeIfExists(path.join(outDir, "report.json"));

  for (const target of selectedTargets) {
    for (const viewport of selectedViewports) {
      await removeIfExists(path.join(outDir, `${target.name}-${viewport.name}.png`));
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const availableNames = targets.map((target) => target.name);

console.log(`Responsive QA Base URL: ${baseUrl}`);
console.log(`Verfuegbare Seitennamen: ${availableNames.join(", ")}`);
console.log(`Verfuegbare Viewports: ${viewports.map((viewport) => viewport.name).join(", ")}`);
console.log(`Verfuegbare Profile: ${Object.keys(viewportProfiles).join(", ")}`);
console.log("Einzelseite: npm run check:responsive -- --page=home");
console.log("Einzelviewport: npm run check:responsive -- --viewport=laptop");
console.log("Schnellprofil: npm run check:responsive -- --profile=quick");

if (args.help) {
  process.exit(0);
}

if (args.page && !availableNames.includes(args.page)) {
  console.error(`Unbekannte Seite: ${args.page}`);
  console.error(`Verfuegbar: ${availableNames.join(", ")}`);
  process.exit(1);
}

const availableViewportNames = viewports.map((viewport) => viewport.name);
if (args.viewport && !availableViewportNames.includes(args.viewport)) {
  console.error(`Unbekannter Viewport: ${args.viewport}`);
  console.error(`Verfuegbar: ${availableViewportNames.join(", ")}`);
  process.exit(1);
}

if (!Object.hasOwn(viewportProfiles, args.profile)) {
  console.error(`Unbekanntes Profil: ${args.profile}`);
  console.error(`Verfuegbar: ${Object.keys(viewportProfiles).join(", ")}`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

const selected = args.page ? targets.filter((target) => target.name === args.page) : targets;
const selectedTargets = selected.filter((target) => target.access !== "todo");
const skippedTargets = selected.filter((target) => target.access === "todo");
const profileViewportNames = viewportProfiles[args.profile];
const selectedViewports = args.viewport
  ? viewports.filter((viewport) => viewport.name === args.viewport)
  : profileViewportNames
    ? viewports.filter((viewport) => profileViewportNames.includes(viewport.name))
    : viewports;
await cleanPreviousArtifacts(selected, selectedViewports);

for (const target of skippedTargets) {
  console.log(`TODO/uebersprungen: ${target.name} - ${target.note}`);
}

const browser = await launchBrowser();
const jobs = selectedTargets.flatMap((target) => selectedViewports.map((viewport) => ({ target, viewport })));
const results = new Array(jobs.length);
let nextJobIndex = 0;

try {
  const runWorker = async () => {
    while (nextJobIndex < jobs.length) {
      const jobIndex = nextJobIndex;
      nextJobIndex += 1;
      const { target, viewport } = jobs[jobIndex];
      console.log(`Pruefe ${target.name} @ ${viewport.name} (${viewport.width}x${viewport.height}) ...`);
      const result = await runTargetViewport(browser, target, viewport);
      results[jobIndex] = result;
      console.log(`  ${result.status === "passed" ? "ok" : "FEHLER"} in ${(result.durationMs / 1000).toFixed(1)} s`);
      for (const problem of result.problems) console.log(`  - ${problem}`);
    }
  };

  const workerCount = Math.min(args.concurrency, jobs.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  for (let jobIndex = 0; jobIndex < results.length; jobIndex += 1) {
    if (results[jobIndex]?.status !== "failed") continue;
    const { target, viewport } = jobs[jobIndex];
    console.log(`Wiederhole ${target.name} @ ${viewport.name} nach erstem Fehler ...`);
    const result = await runTargetViewport(browser, target, viewport);
    results[jobIndex] = result;
    console.log(`  ${result.status === "passed" ? "ok" : "FEHLER"} in ${(result.durationMs / 1000).toFixed(1)} s`);
    for (const problem of result.problems) console.log(`  - ${problem}`);
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outDir, "report.md");
const writtenReportPath = await writeTextArtifact(reportPath, renderReport({ selectedTargets, skippedTargets, results }));
const reportJsonPath = path.join(outDir, "report.json");
const writtenReportJsonPath = await writeTextArtifact(
  reportJsonPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, selectedTargets, selectedViewports, results }, null, 2)}\n`
);

const failed = results.filter((result) => result.status === "failed");
console.log("");
console.log(`Screenshots: ${outDir}`);
console.log(`Report: ${writtenReportPath}`);
console.log(`JSON-Details: ${writtenReportJsonPath}`);
console.log(`Ergebnis: ${results.length - failed.length}/${results.length} Checks ok, ${failed.length} Fehler, ${skippedTargets.length} TODO/uebersprungen.`);

if (failed.length > 0) {
  console.log("Fehlerhafte Checks:");
  for (const result of failed) {
    console.log(`- ${result.target} @ ${result.viewport}: ${result.problems.join("; ")}`);
  }
  process.exit(1);
}
