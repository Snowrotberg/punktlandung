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
const storageSeedPath = "/impressum";
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
  { name: "phone-short-360", width: 360, height: 640, category: "mobile" },
  { name: "phone-mid-393", width: 393, height: 740, category: "mobile" },
  { name: "phone-mid-412", width: 412, height: 732, category: "mobile" },
  { name: "phone-small", width: 360, height: 800, category: "mobile" },
  { name: "phone-large", width: 430, height: 932, category: "mobile" },
  { name: "phone-landscape-640", width: 640, height: 360, category: "mobile" },
  { name: "phone-landscape-720", width: 720, height: 360, category: "mobile" },
  { name: "phone-landscape-800", width: 800, height: 384, category: "mobile" },
  { name: "phone-landscape-compact", width: 760, height: 360, category: "mobile" },
  { name: "phone-landscape", width: 932, height: 430, category: "mobile" },
  { name: "laptop", width: 1366, height: 768, category: "desktop" },
  { name: "monitor", width: 1920, height: 1080, category: "desktop" },
  { name: "tv-wide", width: 2560, height: 1440, category: "desktop" },
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

const finalTablePlayers = [{ ...hostPlayer, name: "Tabea" }, guestPlayer, ...Array.from({ length: 8 }, (_, index) => ({
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

const globePhaseOneCases = [
  {
    id: "salzburg",
    location: {
      ...sampleLocation,
      id: "landmarks-festung-hohensalzburg",
      title: "Festung Hohensalzburg",
      countryCode: "AT",
      countryName: "Österreich",
      continent: "Europe",
      lat: 47.795,
      lng: 13.0473,
      shortDescription: "Die Festung Hohensalzburg ist das Wahrzeichen der Stadt Salzburg."
    },
    guess: { lat: 47.43, lng: 13.32 },
    distanceKm: 46
  },
  {
    id: "pinatubo",
    location: {
      ...sampleLocation,
      id: "landscapes-pinatubo",
      title: "Pinatubo",
      countryCode: "PH",
      countryName: "Philippinen",
      continent: "Asia",
      lat: 15.13,
      lng: 120.35,
      shortDescription: "Der Pinatubo ist ein aktiver Vulkan auf den Philippinen im Westen der Insel Luzon."
    },
    guess: { lat: 7.2, lng: 124.8 },
    distanceKm: 1000
  },
  {
    id: "eggenberg",
    location: {
      ...sampleLocation,
      id: "landmarks-schloss-eggenberg",
      title: "Schloss Eggenberg",
      countryCode: "AT",
      countryName: "Österreich",
      continent: "Europe",
      lat: 47.0739,
      lng: 15.3913,
      shortDescription: "Schloss Eggenberg in Graz ist die größte und bedeutendste barocke Schlossanlage der Steiermark."
    },
    guess: { lat: 47.5, lng: 19.04 },
    distanceKm: 287
  },
  {
    id: "nebo",
    location: {
      ...sampleLocation,
      id: "landscapes-nebo",
      title: "Nebo",
      countryCode: "JO",
      countryName: "Jordanien",
      continent: "Asia",
      lat: 31.76778,
      lng: 35.72556,
      shortDescription: "Der Berg Nebo liegt in Jordanien auf dem Plateau oberhalb des Toten Meeres."
    },
    guess: { lat: 39, lng: 21.7 },
    distanceKm: 1580
  },
  {
    id: "heraklion",
    location: {
      ...sampleLocation,
      id: "cities-heraklion",
      title: "Heraklion",
      countryCode: "GR",
      countryName: "Griechenland",
      continent: "Europe",
      lat: 35.34028,
      lng: 25.13444,
      shortDescription: "Heraklion ist die größte Stadt Kretas und das wirtschaftliche Zentrum der Insel."
    },
    guess: { lat: 38.2, lng: 21.6 },
    distanceKm: 460
  },
  {
    id: "zagreb",
    location: {
      ...sampleLocation,
      id: "cities-zagreb",
      title: "Zagreb",
      countryCode: "HR",
      countryName: "Kroatien",
      continent: "Europe",
      lat: 45.815,
      lng: 15.9819,
      shortDescription: "Zagreb ist die Hauptstadt und die größte Stadt Kroatiens."
    },
    guess: { lat: 41.9028, lng: 12.4964 },
    distanceKm: 520
  },
  {
    id: "diagonal-nw-se",
    location: {
      ...sampleLocation,
      id: "cities-nanjing-diagonal-nw-se",
      title: "Nanjing",
      countryCode: "CN",
      countryName: "Volksrepublik China",
      continent: "Asia",
      lat: 32.0603,
      lng: 118.7969,
      shortDescription: "Nanjing liegt am Jangtsekiang und war mehrfach Hauptstadt Chinas."
    },
    guess: { lat: 36.4, lng: 113.2 },
    distanceKm: 708,
    expectedBearingSign: 1,
    expectTouchControlDismissal: true
  },
  {
    id: "diagonal-sw-ne",
    location: {
      ...sampleLocation,
      id: "cities-nanjing-diagonal-sw-ne",
      title: "Nanjing",
      countryCode: "CN",
      countryName: "Volksrepublik China",
      continent: "Asia",
      lat: 32.0603,
      lng: 118.7969,
      shortDescription: "Nanjing liegt am Jangtsekiang und war mehrfach Hauptstadt Chinas."
    },
    guess: { lat: 27.8, lng: 113.2 },
    distanceKm: 716,
    expectedBearingSign: -1
  },
  {
    id: "angola",
    location: {
      ...sampleLocation,
      id: "flags-angola",
      title: "Flagge von Angola",
      countryCode: "AO",
      countryName: "Angola",
      continent: "Africa",
      lat: -8.83833,
      lng: 13.23444,
      category: "flags",
      shortDescription: "Die Flagge Angolas verbindet zwei horizontale Farbfelder mit einem gelben Emblem."
    },
    guess: { lat: 2.04, lng: 45.32 },
    distanceKm: 4060
  },
  {
    id: "trondheim-close",
    location: {
      ...sampleLocation,
      id: "cities-trondheim",
      title: "Trondheim",
      countryCode: "NO",
      countryName: "Norwegen",
      continent: "Europe",
      lat: 63.4305,
      lng: 10.3951,
      category: "cities",
      shortDescription: "Trondheim liegt am Trondheimsfjord und war Norwegens erste Hauptstadt."
    },
    guess: { lat: 63.43051, lng: 10.39511 },
    distanceKm: 1,
    allowOmittedRoute: true
  },
  {
    id: "extreme-15000",
    location: {
      ...sampleLocation,
      id: "globe-extreme-west-pacific",
      title: "Westpazifik",
      countryCode: "XP",
      countryName: "Laborfall",
      continent: "Oceania",
      lat: 0,
      lng: -180,
      shortDescription: "Generischer 15.000-km-Stresstest über den Antimeridian."
    },
    guess: { lat: 0, lng: 45 },
    distanceKm: 15011
  },
  {
    id: "extreme-antipode",
    location: {
      ...sampleLocation,
      id: "globe-extreme-antipode",
      title: "Antipodenfall",
      countryCode: "XA",
      countryName: "Laborfall",
      continent: "Oceania",
      lat: 0,
      lng: 170,
      shortDescription: "Generischer Stresstest oberhalb von achtzig Prozent des halben Erdumfangs."
    },
    guess: { lat: 0, lng: 0 },
    distanceKm: 18903,
    targetOnlyEnd: true
  },
  {
    id: "extreme-target-route-tail-18669",
    location: {
      ...sampleLocation,
      id: "landscapes-ruapehu-qa",
      title: "Ruapehu",
      countryCode: "NZ",
      countryName: "Neuseeland",
      continent: "Oceania",
      category: "landscapes",
      lat: -39.28167,
      lng: 175.56861,
      shortDescription: "Der Mount Ruapehu ist der höchste Vulkan Neuseelands."
    },
    guess: { lat: 40, lng: 11.3 },
    distanceKm: 18_669,
    targetOnlyEnd: true,
    routeEntrySide: "left"
  }
];

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

function globePhaseOneState(testCase) {
  const guess = {
    ...summary.results[0].guess,
    ...testCase.guess,
    playerId: hostPlayer.id
  };
  return {
    settings: { category: testCase.location.category ?? "landmarks", localMode: "solo", localPlayerCount: 1 },
    players: [hostPlayer],
    guesses: [guess],
    summaries: [{
      ...summary,
      location: testCase.location,
      results: [{
        ...summary.results[0],
        playerId: hostPlayer.id,
        distanceKm: testCase.distanceKm,
        guess
      }]
    }]
  };
}

function globeRoundState(testCase, roundNumber) {
  const phaseOne = globePhaseOneState(testCase);
  const roundSummary = {
    ...phaseOne.summaries[0],
    roundNumber,
    completedAt: Date.now() + roundNumber
  };
  return {
    ...phaseOne,
    settings: { ...phaseOne.settings, rounds: 10 },
    currentRound: roundNumber,
    summaries: Array.from({ length: roundNumber }, (_, index) => ({
      ...roundSummary,
      roundNumber: index + 1,
      completedAt: roundSummary.completedAt - (roundNumber - index) * 1_000
    }))
  };
}

const finalTableSummary = {
  ...summary,
  results: finalTablePlayers.map((player, index) => ({
    playerId: player.id,
    distanceKm: index === 0 ? 0.2 : 12.5 + index * 38,
    points: Math.round(player.score / 10),
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

const finalTableSummaries = Array.from({ length: 10 }, (_, roundIndex) => ({
  ...finalTableSummary,
  roundNumber: roundIndex + 1,
  roundStartedAt: Date.now() - (10 - roundIndex) * 65_000,
  completedAt: Date.now() - (9 - roundIndex) * 65_000,
  results: finalTableSummary.results.map((result, playerIndex) => ({
    ...result,
    points: Math.max(0, result.points + ((roundIndex + playerIndex) % 3 - 1) * 35),
    distanceKm: result.distanceKm + roundIndex * (playerIndex + 1) * 0.25
  }))
}));

const tenPlayerResultState = {
  settings: { localMode: "couch", localPlayerCount: 10, rounds: 10 },
  players: finalTablePlayers,
  guesses: finalTableSummary.results.map((result) => result.guess),
  summaries: finalTableSummaries
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
    summaries: status === "guessing" ? [] : (finished ? finalTableSummaries : [summary]),
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
  {
    name: "karte",
    access: "route",
    path: "/karte",
    expectedText: "Karte testen",
    readySelector: ".punktlandung-map-test-map[data-map-ready='true'] .leaflet-container",
    expectGuessMapCamera: true,
    expectNoMobileMapTooltip: true,
    note: "Oeffentliche noindex-Testseite verwendet die produktive interaktive Spielkarte"
  },
  { name: "home", access: "route", path: "/", resetSession: true, expectGlobeLabelOrder: true, note: "echter URL-Pfad" },
  {
    name: "home-zielinfo",
    access: "route-click",
    path: "/",
    resetSession: true,
    clickSelector: ".punktlandung-home-map-preview [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectedText: "Das Brandenburger Tor wurde zwischen 1788 und 1791 als Abschluss der Straße Unter den Linden errichtet.",
    readySelector: ".punktlandung-home-map-preview .kartenlabor-result-popup, .punktlandung-home-map-preview .punktlandung-globe-info-overlay",
    readyTimeoutMs: 40000,
    expectGlobeInfoOverlay: true,
    expectActiveRoute: true,
    expectCloseAndReopen: true,
    expectHomeInfoTopLayer: true,
    note: "Geöffnete Zielinformation der animierten Startseitenkarte oberhalb aller Karteninhalte"
  },
  {
    name: "home-kartenquellen",
    access: "route-click",
    path: "/",
    resetSession: true,
    clickSelector: ".punktlandung-home-map-preview [aria-label='Kartenquellen anzeigen']",
    expectedText: "OpenStreetMap-Mitwirkende",
    readySelector: ".punktlandung-home-map-preview .punktlandung-map-attribution-panel",
    readyTimeoutMs: 40000,
    expectMapAttributionSafe: true,
    note: "Inhaltsbreite und rechte Verankerung der Kartenquellen auf der Startseite"
  },
  { name: "kartenlabor", access: "route", path: "/kartenlabor", expectedText: "Globe-Kartenlabor", note: "interne Globe-Testansicht" },
  {
    name: "kartenlabor-production-animation",
    access: "lab-animation",
    path: "/kartenlabor",
    buttonText: "Kurz",
    expectedText: "Produktion",
    readySelector: "[aria-label='Globe-Testansicht'] [data-result-marker-kind='target'][data-visible='true'][data-label-visible='true']",
    readyTimeoutMs: 40000,
    screenshotFocusSelector: "[aria-label='Globe-Testansicht'] [data-current-zoom]",
    expectRevealSequence: true,
    expectTerrainExaggeration: 1.5,
    note: "Produktionsfall des Kartenlabors mit gemeinsamem Landung-dann-Zielbadge-Vertrag"
  },
  {
    name: "kartenlabor-extreme-experiment",
    access: "lab-scenario",
    path: "/kartenlabor",
    buttonText: "15.000 km · Experiment",
    expectedText: "Experiment",
    readySelector: "[aria-label='Globe-Testansicht'] [data-result-composition='ready'] [data-result-marker-kind='target'][data-visible='true']",
    screenshotFocusSelector: "[aria-label='Globe-Testansicht'] [data-current-zoom]",
    expectGlobeSafeArea: true,
    expectTerrainExaggeration: 1.5,
    note: "ausdrücklich markierter 15.000-km-Laborfall mit derselben Produktionskamera"
  },
  {
    name: "solo-modus",
    access: "route",
    path: "/solo-modus",
    resetSession: true,
    expectedText: "Passe deine Partie an",
    expectedActiveControls: ["Solo"],
    note: "echter URL-Pfad"
  },
  {
    name: "solo-modus-gespeicherte-einstellungen",
    access: "route-stored-settings",
    path: "/solo-modus",
    expectedText: "Passe deine Partie an",
    expectedActiveControls: ["30 s", "10"],
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
  {
    name: "spielen-karte-maximiert",
    access: "state-click",
    path: "/spielen",
    status: "guessing",
    clickSelector: ".punktlandung-guess-map-panel",
    secondaryButtonText: "Maximieren",
    readySelector: ".punktlandung-guess-map-panel--full",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    expectGameHudSafeArea: true,
    expectNoMobileMapTooltip: true,
    note: "Maximierte Tippkarte wahrt auf Desktop die gemeinsame Runde-/Zeit-Safe-Area"
  },
  {
    name: "spielen-landscape-wahrzeichen",
    access: "state",
    path: "/spielen",
    status: "guessing",
    stateOverrides: {
      settings: { category: "landmarks" },
      location: { ...sampleLocation, category: "landmarks" }
    },
    expectedText: "Wahrzeichen",
    readySelector: ".punktlandung-game-shell",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    expectLandscapeGameHud: true,
    note: "Phone-Landscape mit langer Suchkategorie, kollisionsfreiem Bild-HUD, erreichbarem Zurueck und rechter Karte"
  },
  {
    name: "spielen-flagge-mobile",
    access: "state",
    path: "/spielen",
    status: "guessing",
    stateOverrides: {
      settings: { category: "flags" },
      location: cambodiaFlagLocation
    },
    expectedText: "Flagge",
    readySelector: ".punktlandung-game-shell",
    readyImageSelector: ".punktlandung-panorama-image--flag",
    expectFlagFullyVisible: true,
    note: "Flaggenrunde nutzt die vollstaendige, unbeschnittene Bildflaeche"
  },
  {
    name: "spielen-runde-20",
    access: "state",
    path: "/spielen",
    status: "guessing",
    stateOverrides: {
      currentRound: 20,
      settings: { rounds: 20 }
    },
    expectedText: "20/20",
    readySelector: ".punktlandung-game-shell",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    expectRoundHudCapacity: true,
    note: "Zweistellige Rundenwerte behalten eine stabile mobile HUD-Breite"
  },
  { name: "bild-laden", access: "state", path: "/spielen", status: "guessing", forceImageLoader: true, readySelector: ".punktlandung-image-loader", note: "erster Bildladezustand mit kontinuierlichem Suchscheinwerfer und drei beleuchteten Ellipsensegmenten" },
  {
    name: "bild-laden-spaet",
    access: "state",
    path: "/spielen",
    status: "guessing",
    forceImageLoader: true,
    imageLoadDelayMs: 22000,
    readyTimeoutMs: 20000,
    readySelector: ".punktlandung-image-loader--recovery button",
    expectImageRecoverySafe: true,
    note: "spaeter Bildladezustand mit erreichbarer Aktion oberhalb von Karte und Quellenhinweis"
  },
  {
    name: "tipp-zu-aufloesung",
    access: "state-submit",
    path: "/spielen",
    status: "guessing",
    stateOverrides: { players: [hostPlayer], guesses: [], summaries: [] },
    expectedPath: "/aufloesung",
    expectedText: "AUFLÖSUNG",
    readySelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [data-surface-ready='true']:has([data-result-composition='ready'])",
    readyTimeoutMs: 40000,
    expectResultPerformance: true,
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
  { name: "aufloesung", access: "state", path: "/aufloesung", status: "results", readySelector: ".punktlandung-results-grid", expectResultRankMetrics: true, note: "echter URL-Pfad mit QA-Session" },
  {
    name: "aufloesung-10-spieler",
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: tenPlayerResultState,
    expectedText: "QA Spieler 10",
    readySelector: ".punktlandung-results-map .punktlandung-map-pin-result[data-result-rank='10']",
    expectDenseResultMap: true,
    expectTenPlayerResults: true,
    note: "Zehn Spieler bleiben in Karte, Rundenrang und Gesamtwertung kollisionsfrei und vollständig sichtbar"
  },
  {
    name: "aufloesung-globe-ohne-tipp",
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      settings: { localMode: "solo", localPlayerCount: 1 },
      players: [hostPlayer],
      guesses: [],
      summaries: [{
        ...summary,
        results: [{ ...summary.results[0], guess: undefined, distanceKm: 20_015, points: 0 }]
      }]
    },
    expectedText: "Kein Tipp",
    readySelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [data-surface-ready='true']:has([data-result-composition='ready'])",
    expectResultNavigationControls: true,
    expectNoMobileMapTooltip: true,
    expectResultRankMetrics: true,
    readyTimeoutMs: 40000,
    note: "Solo-Aufloesung ohne gesetzten Tipp behaelt Globe, Terrain, Pitch und Navigation"
  },
  {
    name: "aufloesung-globe",
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      players: [hostPlayer],
      guesses: [summary.results[0].guess],
      summaries: [{ ...summary, results: [summary.results[0]] }]
    },
    expectedText: "AUFLÖSUNG",
    readySelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [data-surface-ready='true']:has([data-result-composition='ready']) [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    readyTimeoutMs: 40000,
    note: "Solo-Auflösung mit echter Globe-Ergebnisanimation"
  },
  ...[1, 2, 3].map((roundNumber) => ({
    name: `aufloesung-globe-runde-${roundNumber}`,
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: globeRoundState(globePhaseOneCases[0], roundNumber),
    expectedText: `RUNDE ${roundNumber} VON 10`,
    readySelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [data-result-composition='ready'] [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectGlobeSafeArea: true,
    expectStableGlobeLabelTypography: true,
    readyTimeoutMs: 40000,
    note: `Identische Globe-Labeltypografie in deterministischer Runde ${roundNumber}`
  })),
  {
    name: "aufloesung-globe-kartenquellen",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: globeRoundState(globePhaseOneCases[0], 3),
    clickSelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [aria-label='Kartenquellen anzeigen']",
    expectedText: "OpenStreetMap-Mitwirkende",
    readySelector: ".punktlandung-map-attribution-panel",
    expectMapAttributionSafe: true,
    note: "Gemeinsame Kartenquellen bleiben in der mobilen Auflösung vollständig innerhalb der Karte"
  },
  {
    name: "spielen-kartenquellen",
    access: "state-click",
    path: "/spielen",
    status: "guessing",
    clickSelector: ".punktlandung-guess-map-panel [aria-label='Kartenquellen anzeigen']",
    expectedText: "OpenStreetMap-Mitwirkende",
    readySelector: ".punktlandung-map-attribution-panel",
    expectMapAttributionSafe: true,
    note: "Gemeinsame Kartenquellen bleiben in der mobilen Spielkarte vollständig innerhalb der Karte"
  },
  ...globePhaseOneCases.map((testCase) => ({
    name: `aufloesung-globe-${testCase.id}`,
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: globePhaseOneState(testCase),
    expectedText: testCase.location.title,
    readySelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [data-result-composition='ready'] [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectGlobeSafeArea: true,
    expectTerrainExaggeration: 1.5,
    expectTargetInfoReservation: true,
    expectGlobeLabelOrder: testCase.targetOnlyEnd !== true,
    expectedBearingSign: testCase.expectedBearingSign,
    expectTouchControlDismissal: testCase.expectTouchControlDismissal,
    allowOmittedGlobeRoute: testCase.allowOmittedRoute === true,
    expectExtremeTargetRouteTail: testCase.targetOnlyEnd === true,
    expectedRouteEntrySide: testCase.routeEntrySide,
    expectRevealSequence: testCase.id === "salzburg",
    readyTimeoutMs: testCase.id === "salzburg" ? 40000 : 30000,
    note: `Dynamische Solo-Auflösung für Phase-1-Globe-Fall ${testCase.location.title}`
  })),
  {
    name: "aufloesung-globe-zoomgrenze",
    access: "state",
    path: "/aufloesung",
    status: "results",
    stateOverrides: globePhaseOneState(globePhaseOneCases.at(-1)),
    expectedText: globePhaseOneCases.at(-1).location.title,
    readySelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [data-result-composition='ready'] [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectGlobeZoomFloor: true,
    expectCompassToggle: true,
    note: "Ergebnis-Globe begrenzt Minus-Taste und Gesten auf eine harmonische Mindestgröße"
  },
  {
    name: "aufloesung-globe-zielinfo",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: globePhaseOneState(globePhaseOneCases[0]),
    clickSelector: "[aria-label='Interaktive 3D-Ergebniskarte'] [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectedText: globePhaseOneCases[0].location.shortDescription,
    readySelector: ".punktlandung-globe-info-overlay, .kartenlabor-result-popup",
    expectGlobeInfoOverlay: true,
    expectActiveRoute: true,
    expectCloseAndReopen: true,
    expectTargetInfoReservation: true,
    readyTimeoutMs: 40000,
    note: "Mobile Zielinformation als zentriertes Overlay ohne erneute Kamerabewegung"
  },
  {
    name: "aufloesung-zielinfo",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      settings: { localMode: "couch", localPlayerCount: 2 },
      players: [hostPlayer],
      guesses: [summary.results[0].guess],
      summaries: [{ ...summary, results: [summary.results[0]] }]
    },
    clickSelector: ".punktlandung-results-map .punktlandung-map-label-actual:visible",
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
      settings: { localMode: "couch", localPlayerCount: 2 },
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
    clickSelector: ".punktlandung-results-map .punktlandung-map-label-actual:visible",
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
      settings: { category: "flags", localMode: "couch", localPlayerCount: 2 },
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
    clickSelector: ".punktlandung-results-map .punktlandung-map-label-actual:visible",
    hoverSelector: ".punktlandung-results-map .punktlandung-map-label-actual:visible",
    expectedHoverText: "Zusatzinformationen anzeigen",
    expectTooltipOutside: true,
    expectStableMapOnPopup: true,
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
      settings: { localMode: "couch", localPlayerCount: 2 },
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
    clickSelector: ".punktlandung-results-map .punktlandung-map-label-actual:visible",
    hoverSelector: ".punktlandung-results-map .punktlandung-map-label-actual:visible",
    expectedHoverText: "Zusatzinformationen anzeigen",
    expectTooltipOutside: true,
    expectStableMapOnPopup: true,
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
  { name: "nochmal-ansehen", access: "state-click", path: "/aufloesung", status: "results", buttonText: "Bild nochmal ansehen", readySelector: ".punktlandung-image-replay", readyImageSelector: ".punktlandung-panorama-viewport img", expectReplayControlParity: true, note: "Ergebniszustand plus Klick auf Bild nochmal ansehen" },
  {
    name: "nochmal-ansehen-10-spieler",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: tenPlayerResultState,
    buttonText: "Bild nochmal ansehen",
    readySelector: ".punktlandung-image-replay .punktlandung-map-pin-result[data-result-rank='10']",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    expectDenseResultMap: true,
    note: "Eingebettete Replay-Karte behält alle zehn Labels bereits im ruhigen Ausgangszustand"
  },
  {
    name: "nochmal-ansehen-10-spieler-maximiert",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: tenPlayerResultState,
    buttonText: "Bild nochmal ansehen",
    secondaryClickSelector: ".punktlandung-image-replay .punktlandung-guess-map-panel--closed",
    secondaryButtonText: "Maximieren",
    readySelector: ".punktlandung-image-replay .punktlandung-guess-map-panel--full .punktlandung-map-pin-result[data-result-rank='10']",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    expectDenseResultMap: true,
    note: "Maximierte Replay-Karte nutzt dieselbe deterministische Zehn-Spieler-Komposition"
  },
  {
    name: "nochmal-ansehen-karte-maximiert",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    buttonText: "Bild nochmal ansehen",
    secondaryClickSelector: ".punktlandung-image-replay .punktlandung-guess-map-panel--closed",
    secondaryButtonText: "Maximieren",
    readySelector: ".punktlandung-image-replay .punktlandung-guess-map-panel--full",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    expectNoMobileMapTooltip: true,
    note: "Maximierte Replay-Karte bleibt im Viewport und behaelt eine erreichbare Minimieren-Aktion"
  },
  {
    name: "nochmal-ansehen-ranked",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      summaries: [{
        ...summary,
        location: {
          ...summary.location,
          id: "round-replay-1",
          panoramaUrl: "/api/v1/ranked-games/ranked-qa/rounds/round-replay-1/prompt"
        }
      }]
    },
    buttonText: "Bild nochmal ansehen",
    readySelector: ".punktlandung-image-replay",
    readyImageSelector: ".punktlandung-panorama-viewport img",
    note: "Ranked-Bild-Replay ueber den geschuetzten und nicht leeren Prompt-Endpunkt"
  },
  {
    name: "nochmal-ansehen-globe",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: {
      players: [hostPlayer],
      guesses: [summary.results[0].guess],
      summaries: [{ ...summary, results: [summary.results[0]] }]
    },
    buttonText: "Bild nochmal ansehen",
    readySelector: ".punktlandung-image-replay [aria-label='Interaktive 3D-Ergebniskarte'] [data-surface-ready='true']:has([data-result-composition='ready']) [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectGlobeLabelOrder: true,
    expectGlobeSafeArea: true,
    note: "Bild-Replay mit derselben statischen Globe-Endkomposition"
  },
  {
    name: "nochmal-ansehen-globe-langes-ziel",
    access: "state-click",
    path: "/aufloesung",
    status: "results",
    stateOverrides: globePhaseOneState(globePhaseOneCases.find((testCase) => testCase.id === "salzburg")),
    buttonText: "Bild nochmal ansehen",
    readySelector: ".punktlandung-image-replay [aria-label='Interaktive 3D-Ergebniskarte'] [data-surface-ready='true']:has([data-result-composition='ready']) [aria-label$='Zusatzinformationen anzeigen'][data-visible='true']",
    expectTargetInfoReservation: true,
    expectGlobeLabelOrder: true,
    expectGlobeSafeArea: true,
    expectReplaySourceLaneSeamless: true,
    expectStaticReveal: true,
    note: "Bild-Replay mit langem Zielnamen, reserviertem Infozeichen und durchgehender Quellenzeile"
  },
  { name: "endergebnis-gast", access: "state-click", path: "/endergebnis", status: "finished", buttonText: "Endstand ansehen", readySelector: ".punktlandung-final-standings-grid", expectTenPlayerFinal: true, note: "fertige QA-Session mit sichtbarem Anmelde- und Speicherangebot" },
  { name: "endergebnis", access: "state-click", path: "/endergebnis", status: "finished", buttonText: "Endstand ansehen", dismissButtonText: "Nicht speichern", readySelector: ".punktlandung-final-standings-grid", expectTenPlayerFinal: true, note: "fertige QA-Session plus Klick auf Endstand ansehen" },
  { name: "infos", access: "route", path: "/infos", note: "echter URL-Pfad" },
  { name: "hilfe", access: "route", path: "/faq", expectedText: "Was möchtest du über Punktlandung wissen?", note: "gemeinsame Übersicht Hilfe & Infos" },
  { name: "hilfe-rankings", access: "route", path: "/faq/rankings", expectedText: "Konto, Spielverlauf und Rankings", note: "gemeinsame Konto- und Rankinghilfe" },
  { name: "feedback", access: "route", path: "/feedback", expectedText: "Feedback", note: "öffentliches Feedback-Formular" },
  { name: "so-funktioniert", access: "route", path: "/so-funktioniert-punktlandung", expectedText: "Wie funktioniert Punktlandung?", note: "zitierbare Methodikseite" },
  { name: "partyspiel-geografie", access: "route", path: "/partyspiel-geografie", expectedText: "Punktlandung als Geografie-Partyspiel", note: "öffentliche Partyspiel-Unterseite" },
  { name: "ortskatalog", access: "route", path: "/ortskatalog", expectedText: "Welche Orte und Aufgaben gibt es bei Punktlandung?", note: "datenbasierte Katalogseite" },
  { name: "community", access: "route", path: "/community", expectedText: "Ideen für Punktlandung", note: "öffentlicher Community- und Roadmap-Bereich" },
  { name: "community-eigene", access: "route", path: "/community/meine-vorschlaege", expectedText: "Meine Vorschläge", note: "persönliche Community-Vorschlagsliste" },
  { name: "rankings", access: "route", path: "/rankings", expectedText: "Rankings", note: "öffentliche Ranking-Übersicht" },
  { name: "rankings-gesamt", access: "route", path: "/rankings?period=yearly&category=all", expectedText: "Gesamt", note: "öffentliche Gesamtwertung über alle Kategorien" },
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
  "kartenlabor",
  "kartenlabor-extreme-experiment",
  "kartenlabor-production-animation",
  "infos",
  "hilfe",
  "hilfe-rankings",
  "feedback",
  "so-funktioniert",
  "partyspiel-geografie",
  "ortskatalog",
  "community",
  "community-eigene",
  "rankings",
  "rankings-gesamt",
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
  // Seed localStorage on a same-origin document that does not mount the live
  // homepage Globe. Navigating away from that Globe would otherwise report
  // its intentionally aborted tile requests as errors of the target page.
  await gotoFresh(page, targetUrl(storageSeedPath));
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
  await gotoFresh(page, targetUrl(storageSeedPath));
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
  if (target.access === "lab-animation") {
    const response = await gotoFresh(page, targetUrl(target.path));
    await page.locator("[aria-label='Globe-Testansicht'] [data-surface-ready='true']").waitFor({ state: "visible", timeout: 20000 });
    const startButton = page.getByRole("button", { name: "Ergebnisanimation starten" });
    await startButton.waitFor({ state: "visible", timeout: 20000 });
    await startButton.click({ timeout: 20000 });
    await page.waitForFunction(() => {
      const sequence = document.querySelector("[aria-label='Globe-Testansicht'] [data-result-reveal-phase]");
      return sequence?.getAttribute("data-result-reveal-phase") === "settled"
        && sequence?.getAttribute("data-result-composition") === "ready";
    }, null, { timeout: 60000 });
    return response;
  }

  if (target.access === "lab-scenario") {
    const response = await gotoFresh(page, targetUrl(target.path));
    await page.locator("[aria-label='Globe-Testansicht'] [data-surface-ready='true']").waitFor({ state: "visible", timeout: 20000 });
    await clickButtonByVisibleText(page, target.buttonText);
    const startButton = page.getByRole("button", { name: "Ergebnisanimation starten" });
    await startButton.waitFor({ state: "visible", timeout: 20000 });
    await startButton.click({ timeout: 20000 });
    return response;
  }

  if (target.access === "route-stored-settings") {
    await gotoFresh(page, targetUrl(storageSeedPath));
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
    if (target.resetSession) {
      await gotoFresh(page, targetUrl(storageSeedPath));
      await resetStorage(page);
      return gotoFresh(page, targetUrl(target.path));
    }
    return gotoFresh(page, targetUrl(target.path));
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

  if (target.access === "state" || target.access === "state-click" || target.access === "state-submit" || target.access === "route-click") {
    if (target.access === "route-click") {
      await gotoFresh(page, targetUrl(storageSeedPath));
      if (target.resetSession) await resetStorage(page);
      await gotoFresh(page, targetUrl(target.path));
    } else {
      await loadState(page, target.status, target.path, target.stateOverrides);
    }
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
    if (target.access === "state-click" || target.access === "route-click") {
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
      const clickTarget = target.clickSelector ? page.locator(target.clickSelector).first() : null;
      if (clickTarget) {
        await clickTarget.waitFor({ state: "visible", timeout: target.readyTimeoutMs ?? 15000 });
        await clickTarget.scrollIntoViewIfNeeded();
        if (target.expectGlobeInfoOverlay) {
          await page.locator("[data-result-composition='ready']").first().waitFor({ state: "visible", timeout: 15000 });
        }
        if (target.expectStableMapOnPopup) {
          await page.evaluate(() => {
            const center = (selector) => {
              const rect = document.querySelector(selector)?.getBoundingClientRect();
              return rect ? { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 } : null;
            };
            window.__punktlandungPopupMapProbe = {
              before: {
                actual: center(".punktlandung-results-map .punktlandung-map-pin-actual"),
                player: center(".punktlandung-results-map .punktlandung-map-pin-player")
              }
            };
          });
        }
        if (target.expectGlobeInfoOverlay) {
          await page.evaluate(() => {
            const center = (selector) => {
              const rect = document.querySelector(selector)?.getBoundingClientRect();
              return rect ? { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 } : null;
            };
            window.__punktlandungGlobeOverlayProbe = {
              before: {
                actual: center("[data-result-marker-kind='target']"),
                player: center("[data-result-marker-kind='guess']")
              }
            };
          });
        }
        const isLeafletTargetLabel = target.clickSelector?.includes("punktlandung-map-label-actual");
        if (isLeafletTargetLabel) {
          await clickTarget.evaluate((element) => {
            const marker = element.closest(".leaflet-marker-icon");
            marker?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          });
        } else {
          await clickTarget.click({ timeout: 5000 });
        }
      } else {
        await clickButtonByVisibleText(page, target.buttonText);
      }
      if (target.secondaryClickSelector) {
        await page.waitForTimeout(350);
        const secondaryTarget = page.locator(target.secondaryClickSelector).first();
        if (await secondaryTarget.isVisible().catch(() => false)) {
          await secondaryTarget.click({ timeout: 5000 });
        }
      }
      if (target.secondaryButtonText) {
        await page.waitForTimeout(350);
        await clickButtonByVisibleText(page, target.secondaryButtonText);
      }
      if (target.tertiaryButtonText) {
        await page.waitForTimeout(350);
        await clickButtonByVisibleText(page, target.tertiaryButtonText);
      }
      await page.waitForTimeout(target.clickSelector ? 1200 : 700);
      if (target.expectStableMapOnPopup) {
        await page.evaluate(() => {
          const center = (selector) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect ? { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 } : null;
          };
          if (window.__punktlandungPopupMapProbe) {
            window.__punktlandungPopupMapProbe.after = {
              actual: center(".punktlandung-results-map .punktlandung-map-pin-actual"),
              player: center(".punktlandung-results-map .punktlandung-map-pin-player")
            };
          }
        });
      }
      if (target.expectGlobeInfoOverlay) {
        await page.evaluate(() => {
          const center = (selector) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect ? { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 } : null;
          };
          if (window.__punktlandungGlobeOverlayProbe) {
            window.__punktlandungGlobeOverlayProbe.after = {
              actual: center("[data-result-marker-kind='target']"),
              player: center("[data-result-marker-kind='guess']")
            };
          }
        });
      }
      if (target.expectCloseAndReopen && clickTarget) {
        const closeButton = page.getByRole("button", { name: "Zusatzinformationen schließen" }).first();
        await closeButton.waitFor({ state: "visible", timeout: 5000 });
        await closeButton.click();
        await page.locator(".punktlandung-globe-info-overlay:visible, .kartenlabor-result-popup:visible").waitFor({ state: "hidden", timeout: 5000 });
        const pointerFocus = await clickTarget.evaluate((element) => ({
          focused: document.activeElement === element,
          focusVisible: element.matches(":focus-visible")
        }));
        if (pointerFocus.focused || pointerFocus.focusVisible) {
          throw new Error(`Pointer-Schließen hinterlässt einen Markerfokus (${JSON.stringify(pointerFocus)}).`);
        }

        await clickTarget.focus();
        await clickTarget.press("Enter");
        const keyboardCloseButton = page.getByRole("button", { name: "Zusatzinformationen schließen" }).first();
        await keyboardCloseButton.waitFor({ state: "visible", timeout: 5000 });
        const keyboardCloseFocus = await keyboardCloseButton.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            focused: document.activeElement === element,
            focusVisible: element.matches(":focus-visible"),
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow
          };
        });
        if (!keyboardCloseFocus.focused || !keyboardCloseFocus.focusVisible || keyboardCloseFocus.outlineWidth !== "2px" || keyboardCloseFocus.boxShadow !== "none") {
          throw new Error(`Tastaturfokus am Schließen-Button ist nicht eindeutig (${JSON.stringify(keyboardCloseFocus)}).`);
        }
        await keyboardCloseButton.press("Enter");
        await page.locator(".punktlandung-globe-info-overlay:visible, .kartenlabor-result-popup:visible").waitFor({ state: "hidden", timeout: 5000 });
        const keyboardFocus = await clickTarget.evaluate((element) => ({
          focused: document.activeElement === element,
          focusVisible: element.matches(":focus-visible")
        }));
        if (!keyboardFocus.focused || !keyboardFocus.focusVisible) {
          throw new Error(`Tastatur-Schließen stellt den sichtbaren Markerfokus nicht wieder her (${JSON.stringify(keyboardFocus)}).`);
        }

        await clickTarget.click({ timeout: 5000 });
        await page.locator(target.readySelector).first().waitFor({ state: "visible", timeout: 5000 });
      }
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

    const questionMarkCentering = [...document.querySelectorAll("[data-question-mark-trigger='true']")]
      .filter(visible)
      .map((trigger) => {
        const triggerRect = trigger.getBoundingClientRect();
        const glyphParts = [...trigger.querySelectorAll("svg path")]
          .map((part) => part.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        if (!glyphParts.length) return { label: trigger.getAttribute("aria-label") ?? "", centered: false };
        const glyphRect = glyphParts.reduce((bounds, rect) => ({
          left: Math.min(bounds.left, rect.left),
          right: Math.max(bounds.right, rect.right),
          top: Math.min(bounds.top, rect.top),
          bottom: Math.max(bounds.bottom, rect.bottom)
        }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
        const deltaX = ((glyphRect.left + glyphRect.right) - (triggerRect.left + triggerRect.right)) / 2;
        const deltaY = ((glyphRect.top + glyphRect.bottom) - (triggerRect.top + triggerRect.bottom)) / 2;
        return {
          label: trigger.getAttribute("aria-label") ?? "",
          centered: Math.abs(deltaX) <= 1 && Math.abs(deltaY) <= 1,
          deltaX,
          deltaY
        };
      });

    const readyElement = selector ? document.querySelector(selector) : null;
    const readyRect = readyElement?.getBoundingClientRect() ?? null;
    const homeMapPreview = document.querySelector(".punktlandung-home-map-preview");
    const homeMapBase = homeMapPreview
      ? [...homeMapPreview.querySelectorAll(".punktlandung-home-map-base")].find((element) => getComputedStyle(element).display !== "none") ?? null
      : null;
    const homeMapPoster = homeMapPreview?.querySelector(".punktlandung-home-map-poster-wide") ?? null;
    const homeGlobeFrame = homeMapPreview?.querySelector("[data-terrain-exaggeration]") ?? null;
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
      ? [...homeMapPreview.querySelectorAll(".punktlandung-map-pin, .punktlandung-pin-ellipse-icon svg, .punktlandung-home-map-static-pin, .punktlandung-home-map-static-ellipse, [data-result-marker-kind][data-visible='true'] svg[class*='markerPin'], [data-result-marker-kind][data-visible='true'] svg[class*='markerRings']")]
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
    const popupTipRect = firstVisibleRect(".punktlandung-location-info-popup .leaflet-popup-tip");
    const actualPinRect = firstVisibleRect(".punktlandung-map-pin-actual");
    const playerPinRect = firstVisibleRect(".punktlandung-map-pin-player");
    const actualLabelRect = firstVisibleRect(".punktlandung-map-label-actual");
    const playerLabelRect = firstVisibleRect(".punktlandung-map-label-player");
    const resultInfoVisuals = [popupRect, actualPinRect, playerPinRect, actualLabelRect, playerLabelRect].filter(Boolean);
    const denseResultSurface = [
      ...document.querySelectorAll(".punktlandung-results-map .leaflet-container, .punktlandung-image-replay .leaflet-container, .account-round-map .leaflet-container")
    ].find(visible) ?? null;
    const denseResultMapSafety = denseResultSurface ? (() => {
      const mapRect = denseResultSurface.getBoundingClientRect();
      const rectsOverlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const labels = [...denseResultSurface.querySelectorAll(".punktlandung-map-label-player, .punktlandung-map-label-actual")]
        .filter(visible)
        .map((element) => ({ element, rect: element.getBoundingClientRect() }));
      const pins = [...denseResultSurface.querySelectorAll(".punktlandung-map-pin-result, .punktlandung-map-pin-actual")]
        .filter(visible)
        .map((element) => ({ element, rect: element.getBoundingClientRect() }));
      const labelOverlaps = labels.flatMap((label, index) => labels.slice(index + 1)
        .filter((other) => rectsOverlap(label.rect, other.rect))
        .map((other) => [label.element.textContent?.trim(), other.element.textContent?.trim()]));
      const labelPinOverlaps = labels.flatMap((label) => pins
        .filter((pin) => rectsOverlap(label.rect, pin.rect))
        .map((pin) => [label.element.textContent?.trim(), pin.element.getAttribute("data-result-rank") ?? "target"]));
      const rankedPinZ = pins
        .filter(({ element }) => element.hasAttribute("data-result-rank"))
        .map(({ element }) => ({
          rank: Number(element.getAttribute("data-result-rank")),
          zIndex: Number.parseInt(getComputedStyle(element.closest(".leaflet-marker-icon")).zIndex, 10)
        }))
        .sort((a, b) => a.rank - b.rank);
      const targetZ = pins.find(({ element }) => element.classList.contains("punktlandung-map-pin-actual"))?.element
        .closest(".leaflet-marker-icon");
      const targetZIndex = targetZ ? Number.parseInt(getComputedStyle(targetZ).zIndex, 10) : null;
      return {
        labelCount: labels.length,
        playerPinCount: rankedPinZ.length,
        labelsInside: labels.every(({ rect }) => rect.left >= mapRect.left - .25 && rect.right <= mapRect.right + .25 && rect.top >= mapRect.top - .25 && rect.bottom <= mapRect.bottom + .25),
        labelOverlaps,
        labelPinOverlaps,
        rankOrderCorrect: rankedPinZ.every((pin, index) => index === 0 || pin.zIndex < rankedPinZ[index - 1].zIndex),
        targetAbovePlayers: targetZIndex != null && rankedPinZ.every((pin) => targetZIndex > pin.zIndex),
        rankedPinZ,
        targetZIndex
      };
    })() : null;
    const actualAbovePlayer = actualPinRect && playerPinRect
      ? (actualPinRect.top + actualPinRect.bottom) / 2 < (playerPinRect.top + playerPinRect.bottom) / 2
      : null;
    const globeFrame = resultMap?.querySelector("[aria-label='Interaktive 3D-Ergebniskarte']")
      ?? document.querySelector(".punktlandung-image-replay [aria-label='Interaktive 3D-Ergebniskarte']")
      ?? document.querySelector("[aria-label='Globe-Testansicht'] [data-current-zoom]")
      ?? homeMapPreview?.querySelector("[data-current-zoom]")
      ?? null;
    const globeFrameRect = globeFrame?.getBoundingClientRect() ?? null;
    const globeVisualElements = globeFrame
      ? [...globeFrame.querySelectorAll("[data-visible='true'] svg[class*='markerPin'], [data-visible='true'] svg[class*='markerRings'], [data-visible='true'] [class*='markerLabel'], [data-result-route='connection']")].filter((element) => (
          visible(element)
          && (element.getAttribute("data-result-route") !== "connection" || element.closest("svg")?.getAttribute("data-visible") === "true")
        ))
      : [];
    const globeVisualRects = globeVisualElements.map((element) => element.getBoundingClientRect());
    const globeMarkerVisualRects = globeVisualElements
      .filter((element) => element.getAttribute("data-result-route") !== "connection")
      .map((element) => element.getBoundingClientRect());
    const globeVisualBounds = globeVisualElements.map((element, index) => {
      const rect = globeVisualRects[index];
      return {
        element: element.getAttribute("data-result-route") ?? element.className?.baseVal ?? element.className ?? element.tagName,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      };
    });
    const globeRoutes = globeFrame ? [...globeFrame.querySelectorAll("[data-result-route='connection']")].filter((element) => (
      visible(element) && element.closest("svg")?.getAttribute("data-visible") === "true"
    )) : [];
    const markerKinds = globeFrame ? [...globeFrame.querySelectorAll("[data-result-marker-kind][data-visible='true']")] : [];
    const globeControlButtons = globeFrame ? [...globeFrame.querySelectorAll(".maplibregl-ctrl-group button")] : [];
    const globeControlContainer = globeFrame?.querySelector(".maplibregl-ctrl-top-right") ?? null;
    const targetPin = globeFrame?.querySelector("[data-result-marker-kind='target'][data-visible='true'] svg[class*='markerPin']") ?? null;
    const targetPinAnimations = targetPin ? getComputedStyle(targetPin).animationName.split(",").map((name) => name.trim()) : [];
    const routeOverlay = globeFrame?.querySelector("svg[data-settled]") ?? null;
    const routeAnimations = globeRoutes[0]
      ? getComputedStyle(globeRoutes[0]).animationName.split(",").map((name) => name.trim())
      : [];
    const homeInfoPopup = homeMapPreview?.querySelector(".kartenlabor-result-popup, .punktlandung-globe-info-overlay") ?? null;
    const homeInfoPopupRect = homeInfoPopup?.getBoundingClientRect() ?? null;
    const homeInfoContent = homeInfoPopup?.querySelector(".maplibregl-popup-content") ?? homeInfoPopup;
    const homeInfoContentRect = homeInfoContent?.getBoundingClientRect() ?? null;
    const homePlayerBadge = homeMapPreview?.querySelector("[data-result-marker-kind='guess'] [data-marker-label]") ?? null;
    const homePlayerBadgeRect = homePlayerBadge?.getBoundingClientRect() ?? null;
    const homeTargetBadge = homeMapPreview?.querySelector("[data-result-marker-kind='target'] [data-marker-label]") ?? null;
    const homeTargetBadgeRect = homeTargetBadge?.getBoundingClientRect() ?? null;
    const resultRevealContainer = globeFrame?.querySelector("[data-result-reveal-phase]") ?? null;
    const visibleResultLabels = globeFrame
      ? [...globeFrame.querySelectorAll("[data-result-marker-kind][data-visible='true'][data-label-visible='true'] [data-marker-label]")].filter(visible)
      : [];
    const stackingLevel = (element) => {
      if (!element) return 0;
      const parsed = Number.parseInt(getComputedStyle(element).zIndex, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const globeContentStacking = globeFrame
      ? Math.max(0, ...[...globeFrame.querySelectorAll("[data-result-marker-kind], [data-result-route='connection']")].map(stackingLevel))
      : 0;
    const routeEndpointClearances = (() => {
      const route = globeRoutes[0];
      if (!(route instanceof SVGPathElement) || route.getTotalLength() <= 0) return null;
      const matrix = route.getScreenCTM();
      if (!matrix) return null;
      const screenPoint = (point) => new DOMPoint(point.x, point.y).matrixTransform(matrix);
      const endpoints = [screenPoint(route.getPointAtLength(0)), screenPoint(route.getPointAtLength(route.getTotalLength()))];
      const rings = ["guess", "target"].map((kind) => globeFrame.querySelector(`[data-result-marker-kind='${kind}'] [class*='markerRings']`));
      return rings.map((ring, index) => {
        if (!ring) return Number.NEGATIVE_INFINITY;
        const rect = ring.getBoundingClientRect();
        const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
        const vector = { x: endpoints[index].x - center.x, y: endpoints[index].y - center.y };
        const centerDistance = Math.max(0.001, Math.hypot(vector.x, vector.y));
        const unit = { x: vector.x / centerDistance, y: vector.y / centerDistance };
        const radiusX = Math.max(0.5, rect.width / 2);
        const radiusY = Math.max(0.5, rect.height / 2);
        const ellipseRadius = 1 / Math.sqrt((unit.x ** 2) / (radiusX ** 2) + (unit.y ** 2) / (radiusY ** 2));
        return centerDistance - ellipseRadius;
      });
    })();
    const routeVisibleEntry = (() => {
      const route = globeRoutes[0];
      if (!(route instanceof SVGPathElement) || !globeFrameRect) return null;
      const length = route.getTotalLength();
      const matrix = route.getScreenCTM();
      if (length <= 0 || !matrix) return null;
      const screenPoint = (distance) => {
        const point = route.getPointAtLength(distance).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      };
      const inside = (point) => point.x >= globeFrameRect.left
        && point.x <= globeFrameRect.right
        && point.y >= globeFrameRect.top
        && point.y <= globeFrameRect.bottom;
      let entry = null;
      for (let index = 0; index <= 480; index += 1) {
        const point = screenPoint((length * index) / 480);
        if (inside(point)) {
          entry = point;
          break;
        }
      }
      if (!entry) return null;
      const edgeDistances = {
        left: Math.abs(entry.x - globeFrameRect.left),
        right: Math.abs(globeFrameRect.right - entry.x),
        top: Math.abs(entry.y - globeFrameRect.top),
        bottom: Math.abs(globeFrameRect.bottom - entry.y)
      };
      const side = Object.entries(edgeDistances).sort((first, second) => first[1] - second[1])[0][0];
      return { x: entry.x, y: entry.y, side, edgeInset: edgeDistances[side] };
    })();
    const targetInfoCloseControl = (() => {
      const button = [...document.querySelectorAll("button[aria-label='Zusatzinformationen schließen']")].find(visible);
      if (!(button instanceof HTMLElement)) return null;
      const hitRect = button.getBoundingClientRect();
      const inner = [...button.children].find(visible);
      const visualRect = inner?.getBoundingClientRect() ?? null;
      const pseudo = getComputedStyle(button, "::after");
      const pseudoWidth = Number.parseFloat(pseudo.width);
      const pseudoHeight = Number.parseFloat(pseudo.height);
      return {
        hitWidth: hitRect.width,
        hitHeight: hitRect.height,
        visualWidth: visualRect?.width ?? pseudoWidth,
        visualHeight: visualRect?.height ?? pseudoHeight,
        glyph: (inner?.textContent ?? pseudo.content).replaceAll('"', "")
      };
    })();
    const globeInfoOverlay = globeFrame?.querySelector(".punktlandung-globe-info-overlay") ?? null;
    const globeInfoOverlayRect = globeInfoOverlay?.getBoundingClientRect() ?? null;
    const navigationRect = globeFrame?.querySelector(".maplibregl-ctrl-top-right")?.getBoundingClientRect() ?? null;
    const attributionRect = globeFrame?.querySelector(".punktlandung-map-attribution")?.getBoundingClientRect() ?? null;
    const attributionPanel = document.querySelector(".punktlandung-map-attribution-panel");
    const attributionPanelRect = attributionPanel?.getBoundingClientRect() ?? null;
    const attributionCloseRect = attributionPanel?.querySelector("button[aria-label='Kartenquellen schließen']")?.getBoundingClientRect() ?? null;
    const attributionMapRect = attributionPanel?.closest(".punktlandung-map-shell, [aria-label='Interaktive 3D-Ergebniskarte']")?.getBoundingClientRect() ?? null;
    const overlaps = (first, second) => Boolean(first && second
      && Math.min(first.right, second.right) > Math.max(first.left, second.left)
      && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top));
    const recoveryButton = document.querySelector(".punktlandung-image-loader--recovery button");
    const recoveryButtonRect = recoveryButton?.getBoundingClientRect() ?? null;
    const recoveryViewerRect = recoveryButton?.closest(".punktlandung-game-viewer")?.getBoundingClientRect() ?? null;
    const recoverySourceRect = recoveryButton?.closest(".punktlandung-game-viewer")?.querySelector(".punktlandung-source-chip")?.getBoundingClientRect() ?? null;
    const recoveryMapRect = document.querySelector(".punktlandung-guess-map-panel")?.getBoundingClientRect() ?? null;
    const recoveryButtonTopElement = recoveryButtonRect
      ? document.elementFromPoint((recoveryButtonRect.left + recoveryButtonRect.right) / 2, (recoveryButtonRect.top + recoveryButtonRect.bottom) / 2)
      : null;
    const recoverySourceTopElement = recoverySourceRect
      ? document.elementFromPoint((recoverySourceRect.left + recoverySourceRect.right) / 2, (recoverySourceRect.top + recoverySourceRect.bottom) / 2)
      : null;
    const sharedRaster = (() => {
      const header = document.querySelector("header");
      let shell = header?.parentElement ?? null;
      while (shell) {
        const before = getComputedStyle(shell, "::before");
        if (before.content !== "none" && before.backgroundImage !== "none") {
          const shellStyle = getComputedStyle(shell);
          const shellRect = shell.getBoundingClientRect();
          const headerRect = header?.getBoundingClientRect() ?? null;
          const beforeTop = shellRect.top + Number.parseFloat(before.top || "0");
          const headerContentBottom = header
            ? Math.max(headerRect?.top ?? 0, ...[...header.querySelectorAll("a, button, img")]
              .map((element) => element.getBoundingClientRect())
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map((rect) => rect.bottom))
            : null;
          return {
            horizontalFullWidth: Number.parseFloat(before.left || "0") === 0
              && Number.parseFloat(before.right || "0") === 0
              && before.backgroundSize.split(",").some((size) => size.trim().startsWith("100%")),
            horizontalRepeatsVertically: before.backgroundRepeat.split(",").some((repeat) => repeat.trim() === "repeat-y"),
            verticalGridPresent: shellStyle.backgroundImage !== "none"
              && shellStyle.backgroundRepeat.split(",").some((repeat) => repeat.trim() === "repeat"),
            startsOutsideHeader: Boolean(headerRect) && beforeTop >= headerRect.bottom - 1,
            shellLeft: shellRect.left,
            shellRight: shellRect.right,
            headerBottom: headerRect?.bottom ?? null,
            headerContentBottom,
            horizontalStart: beforeTop,
            horizontalBackgroundSize: before.backgroundSize,
            horizontalBackgroundRepeat: before.backgroundRepeat
          };
        }
        shell = shell.parentElement;
      }
      return null;
    })();

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
      resultPerformance: {
        submitToSurfaceMs: performance.getEntriesByName("punktlandung-submit-to-result-surface", "measure").at(-1)?.duration ?? null,
        submitToMotionMs: performance.getEntriesByName("punktlandung-submit-to-result-motion", "measure").at(-1)?.duration ?? null,
        visibleToMotionMs: performance.getEntriesByName("punktlandung-result-visible-to-motion", "measure").at(-1)?.duration ?? null,
        prewarmReady: performance.getEntriesByName("punktlandung-result-prewarm-ready", "mark").length > 0
      },
      gameHudSafeArea: (() => {
        const panel = document.querySelector(".punktlandung-guess-map-panel--full");
        const stats = [...document.querySelectorAll(".punktlandung-game-stat")].filter(visible);
        if (!panel || !stats.length) return null;
        const panelRect = panel.getBoundingClientRect();
        const statRects = stats.map((stat) => stat.getBoundingClientRect());
        return {
          gapPx: panelRect.top - Math.max(...statRects.map((rect) => rect.bottom)),
          panel: { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom },
          stats: statRects.map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }))
        };
      })(),
      sharedRaster,
      verticalOverflow: Math.max(doc.scrollHeight, body?.scrollHeight ?? 0) > viewportHeight + 2,
      bodyTextLength: (body?.innerText ?? "").trim().length,
      bodyText: (body?.innerText ?? "").replace(/\s+/g, " ").trim(),
      roomState,
      onlineRoomState,
      transitionProbe,
      popupMapProbe: window.__punktlandungPopupMapProbe ?? null,
      globeOverlayProbe: window.__punktlandungGlobeOverlayProbe ?? null,
      visibleElementCount: visibleElements.length,
      overflowingElements,
      textClippingCandidates,
      smallTouchTargets,
      questionMarkCentering,
      homeMapPreview: homeMapPreview ? {
        renderMode: homeMapPreview.getAttribute("data-render-mode"),
        animationComplete: homeMapPreview.getAttribute("data-animation-complete") === "true",
        animationStarted: homeMapPreview.getAttribute("data-animation-started") === "true",
        liveCanvasMounted: Boolean(homeMapPreview.querySelector(".maplibregl-canvas")),
        baseVisible: homeMapBase ? getComputedStyle(homeMapBase).visibility !== "hidden" && Number(getComputedStyle(homeMapBase).opacity) > 0.01 : false,
        baseImageLoaded: Boolean(
          (homeMapBase?.querySelector("img")?.complete && homeMapBase.querySelector("img")?.naturalWidth)
          || (homeMapPoster && getComputedStyle(homeMapPoster).backgroundImage !== "none")
        ),
        terrainExaggeration: Number(homeGlobeFrame?.getAttribute("data-terrain-exaggeration") ?? "0"),
        labels: homeMapLabels,
        labelsInside: Boolean(homeMapRect) && homeMapLabels.length >= 2 && homeMapLabels.every((label) =>
          label.left >= homeMapRect.left + 7 &&
          label.right <= homeMapRect.right - 7 &&
          label.top >= homeMapRect.top + 7 &&
          label.bottom <= homeMapRect.bottom - 7
        ),
        visualsInside: Boolean(homeMapRect) && homeMapVisuals.length >= 4 && homeMapVisuals.every((visual) =>
          visual.left >= homeMapRect.left + 12 &&
          visual.right <= homeMapRect.right - 12 &&
          visual.top >= homeMapRect.top + 12 &&
          visual.bottom <= homeMapRect.bottom - 12
        )
      } : null,
      homeInfoSafety: homeInfoPopupRect && homeInfoContentRect && homeMapRect ? (() => {
        const insetPoints = [
          [homeInfoContentRect.left + 5, homeInfoContentRect.top + 5],
          [homeInfoContentRect.right - 5, homeInfoContentRect.top + 5],
          [(homeInfoContentRect.left + homeInfoContentRect.right) / 2, (homeInfoContentRect.top + homeInfoContentRect.bottom) / 2],
          [homeInfoContentRect.left + 5, homeInfoContentRect.bottom - 5],
          [homeInfoContentRect.right - 5, homeInfoContentRect.bottom - 5]
        ];
        return {
          inside: homeInfoPopupRect.left >= homeMapRect.left + 3
            && homeInfoPopupRect.right <= homeMapRect.right - 3
            && homeInfoPopupRect.top >= homeMapRect.top + 3
            && homeInfoPopupRect.bottom <= homeMapRect.bottom - 3,
          playerBadgeVisible: Boolean(homePlayerBadge && getComputedStyle(homePlayerBadge).visibility !== "hidden" && Number(getComputedStyle(homePlayerBadge).opacity) > 0.01),
          overlapsPlayerBadge: Boolean(homePlayerBadge && getComputedStyle(homePlayerBadge).visibility !== "hidden" && Number(getComputedStyle(homePlayerBadge).opacity) > 0.01)
            && overlaps(homeInfoPopupRect, homePlayerBadgeRect),
          targetCenterDelta: homeTargetBadgeRect
            ? Math.abs((homeInfoPopupRect.left + homeInfoPopupRect.right - homeTargetBadgeRect.left - homeTargetBadgeRect.right) / 2)
            : null,
          popupMarginLeft: homeInfoPopup instanceof HTMLElement ? homeInfoPopup.style.marginLeft : null,
          popupClassName: homeInfoPopup instanceof HTMLElement ? homeInfoPopup.className : null,
          popupTranslate: homeInfoPopup instanceof HTMLElement ? getComputedStyle(homeInfoPopup).translate : null,
          topLayerAtAllSamples: insetPoints.every(([x, y]) => {
            const topElement = document.elementFromPoint(x, y);
            return Boolean(topElement && homeInfoPopup.contains(topElement));
          }),
          popupZIndex: stackingLevel(homeInfoPopup),
          playerBadgeZIndex: stackingLevel(homePlayerBadge?.closest("[data-result-marker-kind]")),
          bounds: {
            map: { left: homeMapRect.left, top: homeMapRect.top, right: homeMapRect.right, bottom: homeMapRect.bottom },
            popup: { left: homeInfoPopupRect.left, top: homeInfoPopupRect.top, right: homeInfoPopupRect.right, bottom: homeInfoPopupRect.bottom },
            content: { left: homeInfoContentRect.left, top: homeInfoContentRect.top, right: homeInfoContentRect.right, bottom: homeInfoContentRect.bottom },
            playerBadge: homePlayerBadgeRect ? { left: homePlayerBadgeRect.left, top: homePlayerBadgeRect.top, right: homePlayerBadgeRect.right, bottom: homePlayerBadgeRect.bottom } : null
          }
        };
      })() : null,
      resultPopupSafety: popupRect && resultMapRect ? {
        visualCount: resultInfoVisuals.length,
        bounds: {
          map: { left: resultMapRect.left, top: resultMapRect.top, right: resultMapRect.right, bottom: resultMapRect.bottom },
          popup: { left: popupRect.left, top: popupRect.top, right: popupRect.right, bottom: popupRect.bottom },
          popupTip: popupTipRect ? { left: popupTipRect.left, top: popupTipRect.top, right: popupTipRect.right, bottom: popupTipRect.bottom } : null,
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
            : popupRect.top >= Math.max(actualPinRect.bottom, actualLabelRect.bottom) - 8,
        tipMeetsLabelEdge: actualAbovePlayer === null || !actualLabelRect || !popupTipRect
          ? false
          : actualAbovePlayer
            ? Math.abs(popupTipRect.bottom - actualLabelRect.top) <= 12
            : Math.abs(popupTipRect.top - actualLabelRect.bottom) <= 12
      } : null,
      denseResultMapSafety,
      globeResultSafety: globeFrameRect ? {
        frameBounds: {
          left: globeFrameRect.left,
          top: globeFrameRect.top,
          right: globeFrameRect.right,
          bottom: globeFrameRect.bottom
        },
        visualCount: globeVisualRects.length,
        visualBounds: globeVisualBounds,
        markerCount: markerKinds.length,
        routeCount: globeRoutes.length,
        routeSubpaths: globeRoutes[0]?.getAttribute("d")?.match(/M/g)?.length ?? 0,
        currentZoom: Number(globeFrame.querySelector("[data-current-zoom]")?.getAttribute("data-current-zoom") ?? "NaN"),
        allInside: globeVisualRects.length >= 3 && globeVisualRects.every((rect) =>
          rect.left >= globeFrameRect.left + 16 - 0.25
          && rect.right <= globeFrameRect.right - 66 + 0.25
          // Account for the frame border and sub-pixel MapLibre projection.
          // The product camera still targets the stricter 20 px safe rect.
          && rect.top >= globeFrameRect.top + 14 - 0.5
          && rect.bottom <= globeFrameRect.bottom - 16 + 0.25
        ),
        markersInside: globeMarkerVisualRects.length >= 3 && globeMarkerVisualRects.every((rect) =>
          rect.left >= globeFrameRect.left + 16 - 0.25
          && rect.right <= globeFrameRect.right - 66 + 0.25
          && rect.top >= globeFrameRect.top + 14 - 0.5
          && rect.bottom <= globeFrameRect.bottom - 16 + 0.25
        ),
        routeEndpointClearances,
        routeVisibleEntry,
        terrainExaggeration: Number(
          globeFrame.getAttribute("data-terrain-exaggeration")
          ?? globeFrame.querySelector("[data-terrain-exaggeration]")?.getAttribute("data-terrain-exaggeration")
          ?? "0"
        ),
        targetPinAnimations,
        routeAnimations,
        routeSettled: routeOverlay?.getAttribute("data-settled") === "true",
        targetLanding: globeFrame.querySelector("[data-result-marker-kind='target']")?.getAttribute("data-landing") === "true",
        visibleLabelCount: visibleResultLabels.length,
        revealPhase: resultRevealContainer?.getAttribute("data-result-reveal-phase") ?? null,
        controlsGerman: globeControlButtons.length === 3 && globeControlButtons.every((button) =>
          ["Karte vergrößern", "Karte verkleinern", "Nach Norden ausrichten", "Gedrehte Ansicht wiederherstellen"].includes(button.getAttribute("aria-label"))
          && !button.hasAttribute("title")
        ),
        controlStacking: {
          controls: stackingLevel(globeControlContainer),
          content: globeContentStacking,
          controlsAboveContent: stackingLevel(globeControlContainer) > globeContentStacking
        }
      } : null,
      globeLabelTypography: markerKinds.map((marker) => {
        const label = marker.querySelector("[data-marker-label]");
        const rect = label?.getBoundingClientRect() ?? null;
        const style = label ? getComputedStyle(label) : null;
        return {
          kind: marker.getAttribute("data-result-marker-kind"),
          fontSize: style ? Number.parseFloat(style.fontSize) : null,
          paddingTop: style ? Number.parseFloat(style.paddingTop) : null,
          paddingBottom: style ? Number.parseFloat(style.paddingBottom) : null,
          height: rect?.height ?? null
        };
      }),
      mapAttributionSafety: attributionPanelRect && attributionMapRect && attributionCloseRect ? {
        panelInsideMap: attributionPanelRect.left >= attributionMapRect.left - .25
          && attributionPanelRect.right <= attributionMapRect.right + .25
          && attributionPanelRect.top >= attributionMapRect.top - .25
          && attributionPanelRect.bottom <= attributionMapRect.bottom + .25,
        closeInsidePanel: attributionCloseRect.left >= attributionPanelRect.left
          && attributionCloseRect.right <= attributionPanelRect.right
          && attributionCloseRect.top >= attributionPanelRect.top
          && attributionCloseRect.bottom <= attributionPanelRect.bottom,
        closeWidth: attributionCloseRect.width,
        closeHeight: attributionCloseRect.height,
        scrollWidth: attributionPanel.scrollWidth,
        clientWidth: attributionPanel.clientWidth,
        panelRect: { left: attributionPanelRect.left, right: attributionPanelRect.right, top: attributionPanelRect.top, bottom: attributionPanelRect.bottom },
        mapRect: { left: attributionMapRect.left, right: attributionMapRect.right, top: attributionMapRect.top, bottom: attributionMapRect.bottom }
      } : null,
      globeInfoOverlaySafety: globeInfoOverlayRect && globeFrameRect ? {
        inside: globeInfoOverlayRect.left >= globeFrameRect.left + 12
          && globeInfoOverlayRect.right <= globeFrameRect.right - 66
          && globeInfoOverlayRect.top >= globeFrameRect.top + 12
          && globeInfoOverlayRect.bottom <= globeFrameRect.bottom - 12,
        avoidsNavigation: !overlaps(globeInfoOverlayRect, navigationRect),
        avoidsAttribution: !overlaps(globeInfoOverlayRect, attributionRect)
      } : null,
      targetInfoCloseControl,
      imageRecoverySafety: recoveryButtonRect && recoveryViewerRect ? {
        insideViewer: recoveryButtonRect.left >= recoveryViewerRect.left
          && recoveryButtonRect.right <= recoveryViewerRect.right
          && recoveryButtonRect.top >= recoveryViewerRect.top
          && recoveryButtonRect.bottom <= recoveryViewerRect.bottom,
        avoidsSource: !overlaps(recoveryButtonRect, recoverySourceRect),
        avoidsMap: !overlaps(recoveryButtonRect, recoveryMapRect),
        receivesPointer: recoveryButtonTopElement === recoveryButton || recoveryButton?.contains(recoveryButtonTopElement),
        sourceAboveBackdrop: !recoverySourceRect
          || recoverySourceTopElement?.closest?.(".punktlandung-source-chip") === recoveryButton?.closest(".punktlandung-game-viewer")?.querySelector(".punktlandung-source-chip")
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
      /WebSocket connection to ['"]ws:\/\/(?:localhost|127\.0\.0\.1|192\.168\.178\.33):3001\/['"] failed/i.test(compact) ||
      /googletagmanager\.com\/gtag\/js.*preloaded.*not used/i.test(compact) ||
      /_next\/static\/css\/.*preloaded using link preload but not used/i.test(compact) ||
      /\[Punktlandung map\].*Failed to fetch/i.test(compact) ||
      /Unable to load glyph range.*openfreemap\.org/i.test(compact) ||
      /Image "circle-11" could not be loaded.*map\.addImage/i.test(compact) ||
      /calculateFogMatrix is not supported on globe projection/i.test(compact) ||
      /performance warning: READ-usage buffer was written, then fenced/i.test(compact) ||
      /Failed to load resource: the server responded with a status of 404/i.test(compact) ||
      /^error:\s*Event$/i.test(compact)
    ) {
      ignored.push(compact.slice(0, 500));
    } else {
      relevant.push(compact.slice(0, 1000));
    }
  }

  return { relevant, ignored };
}

function normalizeHttpErrors(messages) {
  const unique = [...new Set(messages)];
  const missingTerrainTile = (message) => /^404 https:\/\/tiles\.mapterhorn\.com\/\d+\/\d+\/\d+\.webp$/i.test(message);
  return {
    ignored: unique.filter(missingTerrainTile),
    relevant: unique.filter((message) => !missingTerrainTile(message))
  };
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
      await new Promise((resolve) => setTimeout(resolve, target.imageLoadDelayMs ?? 8000));
    }

    if (parsedUrl?.pathname === "/api/image") {
      await route.fulfill({ path: qaPanoramaPath, contentType: "image/jpeg" });
      return;
    }

    if (/^\/api\/v1\/ranked-games\/[^/]+\/rounds\/[^/]+\/prompt$/.test(parsedUrl?.pathname ?? "")) {
      await route.fulfill({ path: qaPanoramaPath, contentType: "image/jpeg" });
      return;
    }

    // Responsive QA exercises real gameplay states with deterministic fixture
    // locations. Those synthetic views must never pollute admin usage metrics.
    if (parsedUrl?.pathname === "/api/usage") {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
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
  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const requestUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const parsedUrl = new URL(requestUrl, window.location.href);
      if (parsedUrl.pathname === "/api/usage") {
        return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }));
      }
      return nativeFetch(input, init);
    };

    window.__punktlandungRevealTrace = [];
    let previousRevealPhase = null;
    const sampleRevealPhase = () => {
      const sequence = document.querySelector("[data-result-reveal-phase]");
      const phase = sequence?.getAttribute("data-result-reveal-phase") ?? null;
      if (phase && phase !== previousRevealPhase) {
        const target = sequence.querySelector("[data-result-marker-kind='target']");
        const frame = sequence.closest("[data-target-landing-duration-ms]");
        window.__punktlandungRevealTrace.push({
          phase,
          at: performance.now(),
          targetVisible: target?.getAttribute("data-visible") === "true",
          targetLanding: target?.getAttribute("data-landing") === "true",
          targetLabelVisible: target?.getAttribute("data-label-visible") === "true",
          landingDurationMs: Number(frame?.getAttribute("data-target-landing-duration-ms") ?? "0"),
          targetLabelDelayMs: Number(frame?.getAttribute("data-target-label-delay-ms") ?? "0"),
          targetLabelGapMs: Math.max(0, Number(frame?.getAttribute("data-target-label-delay-ms") ?? "0") - Number(frame?.getAttribute("data-target-landing-duration-ms") ?? "0"))
        });
        previousRevealPhase = phase;
      }
      window.requestAnimationFrame(sampleRevealPhase);
    };
    window.requestAnimationFrame(sampleRevealPhase);
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
  let closedScreenshot = null;
  const problems = [];
  const warnings = [];
  let responseStatus = null;
  let homeMapStability = null;
  let mapScrollStability = null;
  let globeCompositionStability = null;

  try {
    const response = await openTarget(page, target);
    responseStatus = response?.status() ?? null;
    if (responseStatus === 404) problems.push(`Route meldet 404: ${target.path}`);

    if (target.readySelector) {
      const readyTimeoutMs = target.readyTimeoutMs ?? 15000;
      await page.locator(target.readySelector).filter({ visible: true }).first().waitFor({ state: "visible", timeout: readyTimeoutMs });
      await page.waitForFunction(
        (selector) => {
          return [...document.querySelectorAll(selector)].some((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none"
              && style.visibility !== "hidden"
              && style.opacity !== "0"
              && rect.width > 0
              && rect.height > 0;
          });
        },
        target.readySelector,
        { timeout: readyTimeoutMs }
      );
      await page.waitForTimeout(250);
    }

    if (target.expectResultPerformance) {
      await page.waitForFunction(() => (
        performance.getEntriesByName("punktlandung-submit-to-result-surface", "measure").length > 0
        && performance.getEntriesByName("punktlandung-submit-to-result-motion", "measure").length > 0
      ), null, { timeout: 15_000 });
    }

    if (target.screenshotFocusSelector) {
      await page.locator(target.screenshotFocusSelector).first().scrollIntoViewIfNeeded();
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
      const animationCurrentTimes = [];
      for (let sampleIndex = 0; sampleIndex < 10; sampleIndex += 1) {
        animationCurrentTimes.push(await page.evaluate(() => {
          const animation = document.querySelector(".punktlandung-loader-beam-orbit")?.getAnimations()[0];
          return Number(animation?.currentTime ?? Number.NaN);
        }));
        await page.waitForTimeout(80);
      }
      const loaderRestarted = animationCurrentTimes.some((currentTime, index) => (
        index > 0 && Number.isFinite(currentTime) && currentTime + 30 < animationCurrentTimes[index - 1]
      ));
      if (loaderRestarted) {
        problems.push(`Der Loader startet während derselben Ladephase sichtbar neu (${animationCurrentTimes.map((value) => value.toFixed(0)).join(" / ")} ms).`);
      }
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
        const readEllipseGeometry = (selector) => {
          const element = document.querySelector(selector);
          return element ? {
            rx: Number(element.getAttribute("rx")),
            ry: Number(element.getAttribute("ry"))
          } : null;
        };
        return {
          beam: readAnimation(".punktlandung-loader-beam-orbit"),
          outer: readAnimation(".punktlandung-loader-ellipse-highlight-outer"),
          middle: readAnimation(".punktlandung-loader-ellipse-highlight-middle"),
          inner: readAnimation(".punktlandung-loader-ellipse-highlight-inner"),
          geometry: {
            outer: readEllipseGeometry(".punktlandung-loader-ellipse-highlight-outer"),
            middle: readEllipseGeometry(".punktlandung-loader-ellipse-highlight-middle"),
            inner: readEllipseGeometry(".punktlandung-loader-ellipse-highlight-inner")
          }
        };
      });
      const animations = [animationMetrics.beam, animationMetrics.outer, animationMetrics.middle, animationMetrics.inner];
      const progresses = animations.map((animation) => Number(animation?.progress ?? Number.NaN));
      const phaseSpread = Math.max(...progresses) - Math.min(...progresses);
      const ellipseKeyframeIsHistorical = [animationMetrics.outer, animationMetrics.middle, animationMetrics.inner].every((animation) => (
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
      const ellipseGeometryMatchesResultPin = (
        Math.abs((animationMetrics.geometry.middle.rx / animationMetrics.geometry.outer.rx) - 0.68) < 0.01 &&
        Math.abs((animationMetrics.geometry.middle.ry / animationMetrics.geometry.outer.ry) - 0.68) < 0.01 &&
        Math.abs((animationMetrics.geometry.inner.rx / animationMetrics.geometry.outer.rx) - 0.38) < 0.01 &&
        Math.abs((animationMetrics.geometry.inner.ry / animationMetrics.geometry.outer.ry) - 0.38) < 0.01
      );
      if (!ellipseKeyframeIsHistorical || !beamRotatesCounterClockwise || !ellipseGeometryMatchesResultPin || !Number.isFinite(phaseSpread) || phaseSpread > 0.04) {
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

    if (target.expectedActiveControls) {
      for (const label of target.expectedActiveControls) {
        const control = page.locator('[data-active="true"]').filter({ hasText: label }).first();
        await control.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
        if ((await control.textContent().catch(() => null))?.trim() !== label) {
          problems.push(`Erwartete Auswahl ist nicht aktiv: "${label}".`);
        }
      }
    }

    await page.waitForFunction(
      () => (document.body?.innerText ?? "").trim().length > 0,
      null,
      { timeout: 10000 }
    );

    if (target.name === "aufloesung") {
      const targetPin = page.locator(
        ".punktlandung-results-map .leaflet-marker-icon:has(.punktlandung-map-label-actual):visible"
      ).first();
      await targetPin.waitFor({ state: "visible", timeout: 10000 });
      await targetPin.click();
      const infoPopup = page.locator(".punktlandung-location-info-popup").filter({ visible: true }).first();
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
      const homeMapIsLive = await page.locator(".punktlandung-home-map-preview").getAttribute("data-render-mode") === "animated-live";
      if (homeMapIsLive) {
        await page.locator(".punktlandung-home-map-preview .maplibregl-canvas").waitFor({ state: "attached", timeout: 20000 });
        await page.locator(".punktlandung-home-map-preview .punktlandung-map-label").first().waitFor({ state: "visible", timeout: 20000 });
        await page.locator(".punktlandung-home-map-preview[data-animation-complete='true']").waitFor({ state: "visible", timeout: 30000 });
        // The completion callback and MapLibre's final paint happen in the same
        // frame. Sample stability only after that final paint has settled.
        await page.waitForTimeout(250);
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
        const liveMap = document.querySelector(".punktlandung-home-map-preview[data-render-mode='animated-live']");
        const liveRoute = document.querySelector(".punktlandung-home-map-preview [data-result-route='connection']");
        const liveRouteOverlay = liveRoute?.closest("svg[data-settled]");
        const liveTarget = document.querySelector(".punktlandung-home-map-preview [data-result-marker-kind='target']");
        const liveTargetPin = document.querySelector(".punktlandung-home-map-preview [data-result-marker-kind='target'] svg[class*='markerPin']");
        const liveLabels = document.querySelectorAll(".punktlandung-home-map-preview [data-result-marker-kind][data-visible='true'][data-label-visible='true'] [data-marker-label]");
        const revealContainer = document.querySelector(".punktlandung-home-map-preview [data-result-reveal-phase]");
        return liveMap
          ? {
              routePresent: Boolean(liveRoute),
              connectorAnimation: liveRoute ? getComputedStyle(liveRoute).animationName : "missing",
              routeSettled: liveRouteOverlay?.getAttribute("data-settled") === "true",
              targetPinPresent: Boolean(liveTargetPin),
              targetPinAnimation: liveTargetPin ? getComputedStyle(liveTargetPin).animationName : "missing",
              targetLanding: liveTarget?.getAttribute("data-landing") === "true",
              visibleLabelCount: liveLabels.length,
              revealPhase: revealContainer?.getAttribute("data-result-reveal-phase") ?? null
            }
          : {
              routePresent: Boolean(connector),
              connectorAnimation: connector ? getComputedStyle(connector).animationName : "none",
              routeSettled: true,
              targetPinPresent: Boolean(targetPin),
              targetPinAnimation: targetPin ? getComputedStyle(targetPin).animationName : "none",
              targetLanding: false,
              visibleLabelCount: document.querySelectorAll(".punktlandung-home-map-static-label").length,
              revealPhase: "settled"
            };
      });
      homeMapStability.intendedMotion = intendedMotion;
    }

    if (target.name.startsWith("spielen") || target.name === "nochmal-ansehen") {
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

    if (target.name.startsWith("spielen")) {
      const readHudGeometry = () => page.evaluate(() => {
        const timeValue = document.querySelector(".punktlandung-game-stat-value-time");
        const timeBox = timeValue?.closest(".punktlandung-game-stat");
        const timeLabel = timeBox?.querySelector("p:first-child");
        const task = document.querySelector(".punktlandung-task-card");
        const rect = (element) => {
          const box = element?.getBoundingClientRect();
          return box ? { left: box.left, right: box.right, width: box.width, centerX: (box.left + box.right) / 2 } : null;
        };
        return { value: timeValue?.textContent?.trim() ?? "", timeBox: rect(timeBox), timeLabel: rect(timeLabel), task: rect(task) };
      });
      const hudBefore = await readHudGeometry();
      await page.waitForFunction(
        (previousValue) => document.querySelector(".punktlandung-game-stat-value-time")?.textContent?.trim() !== previousValue,
        hudBefore.value,
        { timeout: 2500 }
      ).catch(() => {});
      const hudAfter = await readHudGeometry();
      const timeBoxDelta = Math.abs((hudBefore.timeBox?.width ?? 0) - (hudAfter.timeBox?.width ?? 0));
      const taskCenterDelta = Math.abs((hudBefore.task?.centerX ?? 0) - (hudAfter.task?.centerX ?? 0));
      const labelCenterDelta = Math.abs((hudAfter.timeLabel?.centerX ?? 0) - (hudAfter.timeBox?.centerX ?? 0));
      if (!hudBefore.timeBox || !hudAfter.timeBox || timeBoxDelta > 0.5 || taskCenterDelta > 0.5 || labelCenterDelta > 1) {
        problems.push(`Zeit-HUD oder Suchkategorie wandert beim Countdown (${JSON.stringify({ timeBoxDelta, taskCenterDelta, labelCenterDelta, hudBefore, hudAfter })}).`);
      }
    }

    if (target.expectLandscapeGameHud && viewport.category === "mobile" && viewport.width > viewport.height) {
      const landscapeHud = await page.evaluate(() => {
        const box = (selector) => {
          const element = document.querySelector(selector);
          const rect = element?.getBoundingClientRect();
          return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
        };
        const stats = [...document.querySelectorAll(".punktlandung-game-stat")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        });
        const back = document.querySelector(".punktlandung-game-back-button");
        return {
          title: box(".punktlandung-task-card-title"),
          task: box(".punktlandung-task-card"),
          viewer: box(".punktlandung-game-viewer"),
          mapPanel: box(".punktlandung-guess-map-panel"),
          stats,
          back: box(".punktlandung-game-back-button"),
          backDisplay: back ? getComputedStyle(back).display : "missing"
        };
      });
      const inside = (inner, outer, tolerance = 1) => inner && outer
        && inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance
        && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
      if (!inside(landscapeHud.title, landscapeHud.task)) {
        problems.push(`Die Landscape-Suchkategorie liegt nicht vollstaendig im Aufgabenrahmen (${JSON.stringify(landscapeHud)}).`);
      }
      if (!landscapeHud.stats.length || landscapeHud.stats.some((stat) => !inside(stat, landscapeHud.viewer))) {
        problems.push(`Runde/Zeit liegen im Landscape nicht vollstaendig auf dem Bild (${JSON.stringify(landscapeHud)}).`);
      }
      if (landscapeHud.backDisplay === "none" || !inside(landscapeHud.back, landscapeHud.viewer)) {
        problems.push(`Der Zurueck-Button ist im Phone-Landscape nicht erreichbar (${JSON.stringify(landscapeHud)}).`);
      }
      if (!landscapeHud.mapPanel || !landscapeHud.viewer || landscapeHud.mapPanel.left < landscapeHud.viewer.right - 2) {
        problems.push(`Die Landscape-Karte liegt nicht rechts neben der Bildflaeche (${JSON.stringify(landscapeHud)}).`);
      }
    }

    if (target.expectFlagFullyVisible) {
      const flagFit = await page.locator(".punktlandung-panorama-image--flag").first().evaluate((image) => {
        const rect = image.getBoundingClientRect();
        const viewport = image.closest(".punktlandung-panorama-viewport")?.getBoundingClientRect();
        return {
          objectFit: getComputedStyle(image).objectFit,
          inside: Boolean(viewport)
            && rect.left >= viewport.left - 1
            && rect.top >= viewport.top - 1
            && rect.right <= viewport.right + 1
            && rect.bottom <= viewport.bottom + 1
        };
      });
      if (flagFit.objectFit !== "contain" || !flagFit.inside) {
        problems.push(`Die Flagge wird beschnitten (${JSON.stringify(flagFit)}).`);
      }
    }

    if (target.expectNoMobileMapTooltip && viewport.category === "mobile") {
      const tooltipState = await page.evaluate(() => {
        const unified = [...document.querySelectorAll(".punktlandung-unified-tooltip")]
          .some((element) => getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width > 0);
        const controls = [...document.querySelectorAll(".punktlandung-guess-map-panel button, .maplibregl-ctrl-group button")];
        const pseudoVisible = controls.some((control) => {
          const style = getComputedStyle(control, "::after");
          const content = style.content;
          return content !== "none" && content !== "normal" && content !== '""'
            && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 0) > 0;
        });
        return { unified, pseudoVisible, active: document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "" };
      });
      if (tooltipState.unified || tooltipState.pseudoVisible) {
        problems.push(`Mobiler Kartenhinweis bleibt nach der Bedienung sichtbar (${JSON.stringify(tooltipState)}).`);
      }
    }

    if (target.expectResultNavigationControls) {
      const controls = await page.evaluate(() => {
        const frame = document.querySelector("[aria-label='Interaktive 3D-Ergebniskarte'] [data-current-pitch]");
        return {
          zoomIn: Boolean(document.querySelector(".maplibregl-ctrl-zoom-in")),
          zoomOut: Boolean(document.querySelector(".maplibregl-ctrl-zoom-out")),
          compass: Boolean(document.querySelector(".maplibregl-ctrl-compass")),
          pitch: Number(frame?.getAttribute("data-current-pitch")),
          terrain: Number(frame?.getAttribute("data-terrain-exaggeration")),
          guessVisible: document.querySelector("[data-result-marker-kind='guess']")?.getAttribute("data-visible")
        };
      });
      if (!controls.zoomIn || !controls.zoomOut || !controls.compass || controls.pitch < 30 || controls.terrain < 1 || controls.guessVisible === "true") {
        problems.push(`No-Guess-Aufloesung hat keinen vollwertigen Ergebnis-Globe (${JSON.stringify(controls)}).`);
      }
    }

    if (target.expectResultRankMetrics) {
      const ranking = await page.evaluate(() => {
        const row = document.querySelector(".punktlandung-results-row");
        const distance = row?.querySelector(".punktlandung-results-distance-primary")?.textContent?.trim() ?? "";
        const points = row?.querySelector(".punktlandung-results-points")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const rowRect = row?.getBoundingClientRect();
        const distanceRect = row?.querySelector(".punktlandung-results-distance-primary")?.getBoundingClientRect();
        const pointsRect = row?.querySelector(".punktlandung-results-points")?.getBoundingClientRect();
        const inside = (rect) => Boolean(rect && rowRect && rect.left >= rowRect.left - 1 && rect.right <= rowRect.right + 1 && rect.top >= rowRect.top - 1 && rect.bottom <= rowRect.bottom + 1);
        return { distance, points, distanceInside: inside(distanceRect), pointsInside: inside(pointsRect) };
      });
      if (!ranking.distance || !ranking.points.includes("Punkte") || !ranking.distanceInside || !ranking.pointsInside) {
        problems.push(`Rundenrang trennt Entfernung und Punkte nicht eindeutig (${JSON.stringify(ranking)}).`);
      }
    }

    if (target.expectTenPlayerResults) {
      const tenPlayerResults = await page.evaluate(() => {
        const panels = [...document.querySelectorAll(".punktlandung-results-sidebar .punktlandung-results-panel")];
        return panels.map((panel) => {
          const list = panel.querySelector(".punktlandung-results-list");
          const rows = [...panel.querySelectorAll(".punktlandung-results-row")];
          const panelRect = panel.getBoundingClientRect();
          return {
            rows: rows.length,
            listScrolls: Boolean(list && list.scrollHeight > list.clientHeight + 1),
            allRowsInside: rows.every((row) => {
              const rect = row.getBoundingClientRect();
              return rect.top >= panelRect.top - 1 && rect.bottom <= panelRect.bottom + 1;
            }),
            clippedCells: rows.some((row) => [...row.querySelectorAll(".punktlandung-results-rank, .punktlandung-results-player, .punktlandung-results-secondary-metrics, .punktlandung-results-distance-primary, .punktlandung-results-points")]
              .some((cell) => cell.scrollWidth > cell.clientWidth + 1))
          };
        });
      });
      if (tenPlayerResults.length !== 2 || tenPlayerResults.some((panel) => panel.rows !== 10)) {
        problems.push(`Zehn-Spieler-Auflösung zeigt nicht beide vollständigen Ranglisten (${JSON.stringify(tenPlayerResults)}).`);
      }
      if (viewport.name === "laptop" && tenPlayerResults.some((panel) => panel.listScrolls || !panel.allRowsInside || panel.clippedCells)) {
        problems.push(`Zehn-Spieler-Auflösung passt am Laptop nicht kollisionsfrei ohne innere Scrollliste (${JSON.stringify(tenPlayerResults)}).`);
      }
    }

    if (target.expectReplayControlParity) {
      const replayControls = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll(".punktlandung-image-replay :is(.punktlandung-replay-top-actions, .punktlandung-map-panel-actions) button")]
          .filter((button) => button.getBoundingClientRect().width > 0)
          .filter((button) => !["X", "Maximieren", "Minimieren"].includes(button.textContent?.trim() ?? ""))
          .map((button) => {
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            const content = button.firstElementChild?.getBoundingClientRect();
            return { label: button.textContent?.trim(), height: rect.height, radius: style.borderRadius, contentOffset: content ? Math.abs((content.top + content.bottom) / 2 - (rect.top + rect.bottom) / 2) : 0 };
          });
        return buttons;
      });
      const heights = replayControls.map((button) => button.height);
      if (replayControls.length > 0 && (replayControls.length < 2 || Math.max(...heights) - Math.min(...heights) > 1 || new Set(replayControls.map((button) => button.radius)).size > 1 || replayControls.some((button) => button.contentOffset > 1.5))) {
        problems.push(`Replay-Aktionen haben keine gemeinsame Höhe, Rundung und optische Zentrierung (${JSON.stringify(replayControls)}).`);
      }
    }

    if (target.expectTenPlayerFinal) {
      const tenPlayerFinal = await page.evaluate(() => {
        const list = document.querySelector(".punktlandung-final-table-list");
        const rows = [...document.querySelectorAll(".punktlandung-final-table-list > .punktlandung-final-player-row")];
        const metricValues = [...document.querySelectorAll(".punktlandung-final-player-metrics strong")];
        const tableRect = document.querySelector(".punktlandung-final-table")?.getBoundingClientRect();
        const saveRect = document.querySelector(".punktlandung-final-save-status")?.getBoundingClientRect();
        const listRect = list?.getBoundingClientRect();
        const highlightsPanelRect = document.querySelector(".punktlandung-final-highlights-panel")?.getBoundingClientRect();
        const highlights = [...document.querySelectorAll(".punktlandung-final-highlights > .punktlandung-final-player-row")];
        return {
          rows: rows.length,
          highlights: highlights.length,
          highlightsInside: Boolean(highlightsPanelRect && highlights.every((card) => card.getBoundingClientRect().bottom <= highlightsPanelRect.bottom + 1)),
          winner: document.querySelector(".punktlandung-final-winner-name")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          listScrolls: Boolean(list && list.scrollHeight > list.clientHeight + 1),
          metricsClip: metricValues.some((value) => value.scrollWidth > value.clientWidth + 1),
          saveAfterTable: Boolean(saveRect && listRect && saveRect.top >= listRect.bottom - 1),
          tableInside: Boolean(tableRect && rows.every((row) => row.getBoundingClientRect().bottom <= tableRect.bottom + 1))
        };
      });
      if (tenPlayerFinal.rows !== 10 || tenPlayerFinal.highlights !== 6 || tenPlayerFinal.winner !== "Tabea ist der Globus-Gott" || !tenPlayerFinal.saveAfterTable) {
        problems.push(`Zehn-Spieler-Endstand ist inhaltlich oder in seiner Reihenfolge unvollständig (${JSON.stringify(tenPlayerFinal)}).`);
      }
      if (viewport.name === "laptop" && (tenPlayerFinal.listScrolls || tenPlayerFinal.metricsClip || !tenPlayerFinal.tableInside || !tenPlayerFinal.highlightsInside)) {
        problems.push(`Zehn-Spieler-Endstand passt am Laptop nicht vollständig ohne innere Scrollliste oder abgeschnittene Werte (${JSON.stringify(tenPlayerFinal)}).`);
      }
    }

    if (target.expectGuessMapCamera) {
      const map = page.locator(".punktlandung-map-test-map .leaflet-container").first();
      const mapSurface = await page.locator(".punktlandung-map-test-map[data-map-ready='true'] .maplibregl-canvas").first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      if (mapSurface.width < 240 || mapSurface.height < 180) {
        problems.push(`Die produktive Testkarte meldet Ready ohne sichtbare MapLibre-Flaeche (${JSON.stringify(mapSurface)}).`);
      }
      const readCamera = () => map.evaluate((element) => ({
        zoom: Number(element.getAttribute("data-current-zoom")),
        lat: Number(element.getAttribute("data-current-lat")),
        lng: Number(element.getAttribute("data-current-lng")),
        zoomSnap: Number(element.getAttribute("data-zoom-snap")),
        zoomDelta: Number(element.getAttribute("data-zoom-delta"))
      }));
      const initial = await readCamera();
      await page.locator(".punktlandung-map-test-map .leaflet-control-zoom-in").click();
      await page.waitForTimeout(350);
      const zoomed = await readCamera();
      await page.getByRole("button", { name: "Karte zurücksetzen" }).click();
      await page.waitForTimeout(350);
      const reset = await readCamera();
      if (
        Math.abs(initial.zoom - 1.5) > 0.01
        || Math.abs(zoomed.zoom - initial.zoom - 0.5) > 0.01
        || Math.abs(reset.zoom - 1.5) > 0.01
        || initial.zoomSnap !== 0.5
        || initial.zoomDelta !== 0.5
        || Math.abs(reset.lat - 20) > 0.01
        || Math.abs(reset.lng) > 0.01
      ) {
        problems.push(`Produktive Kartenstartkamera oder Halbzoom ist instabil (${JSON.stringify({ initial, zoomed, reset })}).`);
      }
    }

    if (target.expectRoundHudCapacity) {
      const roundHud = await page.evaluate(() => {
        const value = document.querySelector(".punktlandung-game-stat-value-round");
        const box = value?.closest(".punktlandung-game-stat");
        const rect = box?.getBoundingClientRect();
        return {
          value: value?.textContent?.trim() ?? "",
          clipped: Boolean(value && value.scrollWidth > value.clientWidth + 1),
          boxWidth: rect?.width ?? 0,
          nowrap: value ? getComputedStyle(value).whiteSpace === "nowrap" : false,
          tabular: value ? getComputedStyle(value).fontVariantNumeric.includes("tabular-nums") : false
        };
      });
      if (roundHud.value !== "20/20" || roundHud.clipped || roundHud.boxWidth < 50 || !roundHud.nowrap || !roundHud.tabular) {
        problems.push(`Zweistelliger Rundenzähler passt nicht stabil ins HUD (${JSON.stringify(roundHud)}).`);
      }
    }

    if (target.expectGlobeZoomFloor) {
      const zoomOut = page.locator("[aria-label='Interaktive 3D-Ergebniskarte'] .maplibregl-ctrl-zoom-out").first();
      await zoomOut.waitFor({ state: "visible", timeout: 10000 });
      await zoomOut.evaluate((button) => {
        for (let index = 0; index < 16; index += 1) button.click();
      });
      await page.waitForTimeout(700);
      const zoomFloor = await page.locator("[aria-label='Interaktive 3D-Ergebniskarte'] [data-min-zoom]").first().evaluate((frame) => ({
        current: Number(frame.getAttribute("data-current-zoom")),
        minimum: Number(frame.getAttribute("data-min-zoom"))
      }));
      if (!Number.isFinite(zoomFloor.current) || !Number.isFinite(zoomFloor.minimum) || zoomFloor.current < zoomFloor.minimum - 0.02) {
        problems.push(`Der Ergebnis-Globe unterschreitet seine Zoom-Untergrenze (${JSON.stringify(zoomFloor)}).`);
      }
    }

    if (target.expectCompassToggle) {
      const frame = page.locator("[aria-label='Interaktive 3D-Ergebniskarte'] [data-current-bearing]").first();
      const compass = page.locator("[aria-label='Interaktive 3D-Ergebniskarte'] .maplibregl-ctrl-compass").first();
      const readCamera = () => frame.evaluate((element) => ({
        bearing: Number(element.getAttribute("data-current-bearing")),
        pitch: Number(element.getAttribute("data-current-pitch"))
      }));
      const initial = await readCamera();
      await compass.click();
      await page.waitForTimeout(650);
      const north = await readCamera();
      const northLabel = await compass.getAttribute("aria-label");
      await compass.click();
      await page.waitForTimeout(650);
      const restored = await readCamera();
      const restoredLabel = await compass.getAttribute("aria-label");
      if (
        Math.abs(north.bearing) > .5
        || Math.abs(north.pitch) > .5
        || northLabel !== "Gedrehte Ansicht wiederherstellen"
        || restoredLabel !== "Nach Norden ausrichten"
        || Math.abs(restored.bearing - initial.bearing) > .75
        || Math.abs(restored.pitch - initial.pitch) > .75
      ) {
        problems.push(`Der Nordpfeil stellt die gedrehte Ansicht nicht zweistufig wieder her (${JSON.stringify({ initial, north, restored, northLabel, restoredLabel })}).`);
      }
    }

    if (target.expectTouchControlDismissal) {
      const controlRoot = "[aria-label='Interaktive 3D-Ergebniskarte']";
      const controlSelectors = [
        ".maplibregl-ctrl-zoom-in",
        ".maplibregl-ctrl-zoom-out",
        ".maplibregl-ctrl-compass",
        ".maplibregl-ctrl-compass"
      ];
      if (viewport.category === "mobile") {
        for (const [index, selector] of controlSelectors.entries()) {
          const control = page.locator(`${controlRoot} ${selector}`).first();
          await control.evaluate((button) => {
            button.dispatchEvent(new PointerEvent("pointerdown", {
              bubbles: true,
              cancelable: true,
              pointerType: "touch"
            }));
            button.click();
          });
          await page.waitForTimeout(selector.includes("compass") ? 620 : 380);
          const touchState = await control.evaluate((button) => ({
            focused: document.activeElement === button,
            ariaLabel: button.getAttribute("aria-label"),
            title: button.getAttribute("title"),
            tooltip: button.getAttribute("data-tooltip"),
            pseudoTooltipVisible: (() => {
              const style = getComputedStyle(button, "::after");
              const content = style.content;
              return content !== "none" && content !== "normal" && content !== '""'
                && style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity) > 0;
            })(),
            visibleSharedTooltip: [...document.querySelectorAll(".punktlandung-unified-tooltip")]
              .some((element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
              })
          }));
          if (touchState.focused || touchState.pseudoTooltipVisible || touchState.visibleSharedTooltip || touchState.title || !touchState.ariaLabel || !touchState.tooltip) {
            problems.push(`Touch-Kartensteuerung ${index + 1} hinterlässt Fokus/Tooltip oder verliert ihren zugänglichen Namen (${JSON.stringify(touchState)}).`);
          }
        }
      } else {
        const zoomIn = page.locator(`${controlRoot} .maplibregl-ctrl-zoom-in`).first();
        await zoomIn.hover();
        await page.locator(".punktlandung-unified-tooltip").filter({ hasText: "Karte vergrößern" }).waitFor({ state: "visible", timeout: 2000 });
        await page.mouse.move(4, 4);
      }
    }

    if (target.expectedBearingSign) {
      const bearing = await page.locator("[aria-label='Interaktive 3D-Ergebniskarte'] [data-current-bearing]").first()
        .evaluate((frame) => Number(frame.getAttribute("data-current-bearing")));
      if (!Number.isFinite(bearing) || Math.sign(bearing) !== target.expectedBearingSign || Math.abs(bearing) < 5) {
        problems.push(`Geografische Diagonale endet auf der falschen Kameraseite (Bearing ${bearing}, erwartetes Vorzeichen ${target.expectedBearingSign}).`);
      }
    }

    if (target.expectGlobeLabelOrder) {
      const labelOrder = await page.evaluate(() => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        };
        const frame = [...document.querySelectorAll("[data-current-zoom]")]
          .find((candidate) => visible(candidate) && candidate.querySelectorAll("[data-result-marker-kind][data-visible='true'][data-label-visible='true']").length === 2);
        if (!frame) return null;
        const markers = [...frame.querySelectorAll("[data-result-marker-kind][data-visible='true'][data-label-visible='true']")]
          .map((marker) => {
            const pin = marker.querySelector("svg[class*='markerPin']");
            const label = marker.querySelector("[data-marker-label]");
            if (!pin || !label) return null;
            const pinRect = pin.getBoundingClientRect();
            const labelRect = label.getBoundingClientRect();
            return {
              kind: marker.getAttribute("data-result-marker-kind"),
              placement: marker.getAttribute("data-label-vertical"),
              pinY: (pinRect.top + pinRect.bottom) / 2,
              pinTop: pinRect.top,
              pinBottom: pinRect.bottom,
              labelTop: labelRect.top,
              labelBottom: labelRect.bottom
            };
          })
          .filter(Boolean)
          .sort((first, second) => first.pinY - second.pinY);
        if (markers.length !== 2) return null;
        const [north, south] = markers;
        return {
          north,
          south,
          northernAbove: north.placement === "above" && north.labelBottom <= north.pinTop + 1,
          southernBelow: south.placement === "below" && south.labelTop >= south.pinBottom - 1
        };
      });
      if (!labelOrder?.northernAbove || !labelOrder?.southernBelow) {
        problems.push(`Die Zwei-Pin-Labels folgen nicht der sichtbaren Nord-Süd-Reihenfolge (${JSON.stringify(labelOrder)}).`);
      }
    }

    if (target.expectTargetInfoReservation) {
      const reservation = await page.evaluate(() => {
        const label = [...document.querySelectorAll(".punktlandung-map-label-actual[data-info-indicator]")]
          .find((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0;
          });
        if (!label) return null;
        const textElement = label.querySelector("[data-marker-label-text]");
        const textNode = textElement
          ? textElement.firstChild
          : [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        const labelRect = label.getBoundingClientRect();
        const style = getComputedStyle(label);
        const range = textNode ? document.createRange() : null;
        if (range && textNode) range.selectNodeContents(textNode);
        const textRect = range?.getBoundingClientRect() ?? null;
        const paddingRight = Number.parseFloat(style.paddingRight);
        const paddingLeft = Number.parseFloat(style.paddingLeft);
        const indicatorStyle = getComputedStyle(label, "::after");
        const indicatorWidth = Number.parseFloat(indicatorStyle.width);
        const indicatorRight = Number.parseFloat(indicatorStyle.right);
        return {
          paddingRight,
          paddingLeft,
          indicatorGap: paddingRight - indicatorRight - indicatorWidth,
          textClearance: textRect ? labelRect.right - textRect.right : null,
          overflowPx: Math.max(0, label.scrollWidth - label.clientWidth),
          width: labelRect.width,
          textWidth: textRect?.width ?? null,
          wraps: label.scrollHeight > Number.parseFloat(style.lineHeight) * 1.6,
          label: label.textContent?.trim() ?? ""
        };
      });
      const naturalWidthLimit = reservation?.textWidth === null
        ? Number.POSITIVE_INFINITY
        : reservation.textWidth + reservation.paddingLeft + reservation.paddingRight + 4;
      if (
        !reservation
        || reservation.paddingRight < 28
        || reservation.paddingRight > 36
        || reservation.indicatorGap < 4
        || reservation.indicatorGap > 10
        || reservation.overflowPx > 1
        || (!reservation.wraps && reservation.width > naturalWidthLimit + 2)
        || !reservation.label
      ) {
        problems.push(`Zielbadge passt Breite, Umbruch oder kompakten Infoabstand nicht an den Inhalt an (${JSON.stringify(reservation)}).`);
      }
    }

    if (target.expectReplaySourceLaneSeamless) {
      const replayBackgrounds = await page.evaluate(() => {
        const replay = document.querySelector(".punktlandung-image-replay");
        const viewport = replay?.querySelector(".punktlandung-panorama-viewport");
        return replay && viewport ? {
          replay: getComputedStyle(replay).backgroundColor,
          sourceLane: getComputedStyle(viewport).backgroundColor
        } : null;
      });
      if (!replayBackgrounds || replayBackgrounds.replay !== replayBackgrounds.sourceLane) {
        problems.push(`Die Quellenzeile hebt sich als eigener Hintergrundstreifen ab (${JSON.stringify(replayBackgrounds)}).`);
      }
    }

    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    }).catch(() => {});
    if (target.expectGlobeSafeArea) {
      const readMarkerCenters = () => page.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll("[data-result-marker-kind][data-visible='true']")].map((marker) => {
          const rect = marker.getBoundingClientRect();
          return [marker.getAttribute("data-result-marker-kind"), { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }];
        })
      ));
      const before = await readMarkerCenters();
      await page.waitForTimeout(700);
      const after = await readMarkerCenters();
      const deltas = Object.keys(before).flatMap((kind) => after[kind]
        ? [Math.abs(before[kind].x - after[kind].x), Math.abs(before[kind].y - after[kind].y)]
        : [Number.POSITIVE_INFINITY]);
      globeCompositionStability = { markerCount: Object.keys(after).length, maxMovementPx: deltas.length ? Math.max(...deltas) : Number.POSITIVE_INFINITY };
    }
    const metrics = await collectLayoutMetricsStable(page, target.readySelector ?? null);
    metrics.revealTrace = await page.evaluate(() => window.__punktlandungRevealTrace ?? []);
    if (homeMapStability) metrics.homeMapStability = homeMapStability;
    if (mapScrollStability) metrics.mapScrollStability = mapScrollStability;
    if (globeCompositionStability) metrics.globeCompositionStability = globeCompositionStability;
    if (metrics.applicationError) problems.push("Die Ansicht zeigt einen Application error.");
    if (metrics.bodyTextLength === 0 || metrics.visibleElementCount === 0) problems.push("Der Body hat keinen sichtbaren Inhalt.");
    if (target.expectDenseResultMap && (
      !metrics.denseResultMapSafety
      || metrics.denseResultMapSafety.labelCount !== 11
      || metrics.denseResultMapSafety.playerPinCount !== 10
      || !metrics.denseResultMapSafety.labelsInside
      || metrics.denseResultMapSafety.labelOverlaps.length > 0
      || metrics.denseResultMapSafety.labelPinOverlaps.length > 0
      || !metrics.denseResultMapSafety.rankOrderCorrect
      || !metrics.denseResultMapSafety.targetAbovePlayers
    )) {
      problems.push(`Die Zehn-Spieler-Kartenkomposition verletzt Label-, Safe-Area- oder Stapelregeln (${JSON.stringify(metrics.denseResultMapSafety)}).`);
    }
    if (target.expectedText && !metrics.bodyText.includes(target.expectedText)) {
      problems.push(`Erwarteter Ansichtstext fehlt: "${target.expectedText}".`);
    }
    if (target.name.startsWith("endergebnis") && viewport.category === "mobile") {
      const finalOrder = await page.evaluate(() => {
        const top = (selector) => document.querySelector(selector)?.getBoundingClientRect().top ?? null;
        return {
          hero: top(".punktlandung-final-hero"),
          table: top(".punktlandung-final-table-heading"),
          highlights: top(".punktlandung-final-highlights-panel"),
          controls: top(".punktlandung-final-topbar")
        };
      });
      if (
        Object.values(finalOrder).some((value) => value == null)
        || !(finalOrder.hero < finalOrder.table && finalOrder.table < finalOrder.highlights && finalOrder.highlights < finalOrder.controls)
      ) {
        problems.push(`Mobile Endstand-Reihenfolge ist nicht Partie abgeschlossen, Finaltabelle, Partie in Zahlen, Speichern/Buttons (${JSON.stringify(finalOrder)}).`);
      }
    }
    if (target.name === "rankings" && /\bTeilnehmer(?:n)?\b|\bTeilnehmenden\b/i.test(metrics.bodyText)) {
      problems.push("Die Ranking-Ansicht zeigt weiterhin die Gesamtzahl der Teilnehmenden.");
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
    if (metrics.sharedRaster && (
      !metrics.sharedRaster.horizontalFullWidth
      || !metrics.sharedRaster.horizontalRepeatsVertically
      || !metrics.sharedRaster.verticalGridPresent
      || !metrics.sharedRaster.startsOutsideHeader
    )) {
      problems.push(`Gemeinsamer Rastervertrag verletzt (${JSON.stringify(metrics.sharedRaster)}).`);
    }
    if (["home", "rankings"].includes(target.name) && !metrics.sharedRaster) {
      problems.push("Die gemeinsame Raster-Shell wurde auf der erwarteten Seite nicht erkannt.");
    }
    if (target.expectRevealSequence) {
      const phaseEntry = (phase) => metrics.revealTrace.find((entry) => entry.phase === phase);
      const landing = phaseEntry("landing");
      const landed = phaseEntry("landed");
      const labels = phaseEntry("labels");
      const phaseNames = metrics.revealTrace.map((entry) => entry.phase);
      const ordered = ["prepared", "route", "landing", "labels", "landed", "settled"]
        .every((phase, index, expected) => phaseNames.indexOf(phase) > (index === 0 ? -1 : phaseNames.indexOf(expected[index - 1])));
      const valid = Boolean(
        ordered
        && landing?.targetVisible && landing?.targetLanding && !landing?.targetLabelVisible
        && labels?.targetVisible && labels?.targetLanding && labels?.targetLabelVisible
        && landed?.targetVisible && !landed?.targetLanding && landed?.targetLabelVisible
        && landed.at - landing.at >= landing.landingDurationMs - 120
        && labels.at - landing.at >= labels.targetLabelDelayMs - 80
      );
      if (!valid) {
        problems.push(`Gemeinsamer Reveal-Vertrag verletzt (${JSON.stringify(metrics.revealTrace)}).`);
      }
    }
    if (target.expectStaticReveal) {
      const transitional = metrics.revealTrace.some((entry) => ["route", "landing", "landed", "labels"].includes(entry.phase));
      const settled = metrics.revealTrace.some((entry) => entry.phase === "settled");
      if (transitional || !settled) {
        problems.push(`Die statische Replay-Endkomposition erzwingt unerwartet eine Animation (${JSON.stringify(metrics.revealTrace)}).`);
      }
    }
    if (metrics.questionMarkCentering?.some((item) => !item.centered)) {
      problems.push(`Fragezeichen sitzt nicht mittig im Kreis (${JSON.stringify(metrics.questionMarkCentering)}).`);
    }
    if (target.name === "home" && (!metrics.homeMapPreview
      || metrics.homeMapPreview.renderMode !== "animated-live"
      || !metrics.homeMapPreview.liveCanvasMounted
      || !metrics.homeMapPreview.baseImageLoaded)) {
      problems.push("Die Startseiten-Vorschau hat Live-Ergebnisanimation und responsive Fallback-Basis nicht vollständig geladen.");
    }
    if (target.name === "home" && metrics.homeMapPreview && !metrics.homeMapPreview.animationComplete) {
      problems.push("Die Startseiten-Ergebnisanimation wurde nicht vollständig abgeschlossen.");
    }
    if (target.name === "home" && metrics.homeMapPreview && Math.abs(metrics.homeMapPreview.terrainExaggeration - 1) > 0.01) {
      problems.push(`Die Startseiten-Globe-Vorschau verwendet ${metrics.homeMapPreview.terrainExaggeration}× statt des vereinbarten 1,0×-Terrains.`);
    }
    if (target.name === "home" && metrics.homeMapPreview && !metrics.homeMapPreview.labelsInside) {
      problems.push("Die Kartenlabels liegen nicht vollständig mit Randabstand innerhalb der Vorschau.");
    }
    if (target.expectHomeInfoTopLayer && (
      !metrics.homeInfoSafety?.inside
      || !metrics.homeInfoSafety?.topLayerAtAllSamples
    )) {
      problems.push(`Die Startseiten-Zielinformation liegt nicht vollständig und unverdeckt auf der obersten Kartenebene (${JSON.stringify(metrics.homeInfoSafety)}).`);
    }
    const homeInfoMapWidth = metrics.homeInfoSafety?.bounds?.map
      ? metrics.homeInfoSafety.bounds.map.right - metrics.homeInfoSafety.bounds.map.left
      : 0;
    if (target.expectHomeInfoTopLayer && homeInfoMapWidth >= 700 && (
      metrics.homeInfoSafety?.targetCenterDelta > 12
      || metrics.homeInfoSafety?.overlapsPlayerBadge
    )) {
      problems.push(`Die Desktop-Zielinformation ist nicht am Zielbadge zentriert oder kollidiert sichtbar mit dem Tippbadge (${JSON.stringify(metrics.homeInfoSafety)}).`);
    }
    if (target.name === "home" && metrics.homeMapPreview && !metrics.homeMapPreview.visualsInside) {
      problems.push("Pins, Ellipsen oder Labels verletzen die Safe Area der Startseitenkarte.");
    }
    if (target.name === "home" && (!metrics.homeMapStability || metrics.homeMapStability.visualCount < 2 || metrics.homeMapStability.maxMovementPx > 1)) {
      problems.push("Die statischen Karten-Overlays bewegen sich außerhalb der vorgesehenen Linien- und Zielpin-Animation.");
    }
    if (target.name === "home" && metrics.homeMapStability && (
      !metrics.homeMapStability.intendedMotion?.routePresent
      || !metrics.homeMapStability.intendedMotion?.targetPinPresent
      || metrics.homeMapStability.intendedMotion?.connectorAnimation === "none"
      || !metrics.homeMapStability.intendedMotion?.targetPinAnimation?.includes("targetIdle")
      || !metrics.homeMapStability.intendedMotion?.routeSettled
      || metrics.homeMapStability.intendedMotion?.targetLanding
      || metrics.homeMapStability.intendedMotion?.visibleLabelCount !== 2
      || !["settled", "reduced-settled"].includes(metrics.homeMapStability.intendedMotion?.revealPhase)
    )) {
      problems.push(`Die Startseiten-Punktlandung endet nicht vollständig und ruhig (${JSON.stringify(metrics.homeMapStability.intendedMotion)}).`);
    }

    if (target.name === "nochmal-ansehen") {
      const topActionHeights = await page.locator(".punktlandung-replay-top-actions > button:visible").evaluateAll(
        (buttons) => buttons.map((button) => button.getBoundingClientRect().height)
      );
      if (topActionHeights.length >= 2 && Math.max(...topActionHeights) - Math.min(...topActionHeights) > 1) {
        problems.push(`Replay-Buttons sind nicht gleich hoch (${topActionHeights.map((height) => height.toFixed(1)).join(" / ")} px).`);
      }
      const backCentering = await page.evaluate(() => {
        const button = [...document.querySelectorAll(".punktlandung-replay-top-actions .punktlandung-back-button, .punktlandung-map-panel-actions .punktlandung-replay-map-back")]
          .find((candidate) => {
            const rect = candidate.getBoundingClientRect();
            const style = getComputedStyle(candidate);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          });
        const content = button?.querySelector(".punktlandung-back-control-content, .punktlandung-inline-action-content");
        const buttonRect = button?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();
        return buttonRect && contentRect ? {
          horizontalDelta: Math.abs((buttonRect.left + buttonRect.right) / 2 - (contentRect.left + contentRect.right) / 2),
          verticalDelta: Math.abs((buttonRect.top + buttonRect.bottom) / 2 - (contentRect.top + contentRect.bottom) / 2)
        } : null;
      }).catch(() => null);
      if (backCentering && (backCentering.horizontalDelta > 1 || backCentering.verticalDelta > 1)) {
        problems.push(`Replay-Zurück-Inhalt ist nicht exakt zentriert (${JSON.stringify(backCentering)}).`);
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
    if (target.expectResultPerformance && (
      !metrics.resultPerformance.prewarmReady
      || !Number.isFinite(metrics.resultPerformance.submitToSurfaceMs)
      || !Number.isFinite(metrics.resultPerformance.submitToMotionMs)
    )) {
      problems.push(`Prewarm oder Übergangsmessung der Auflösung fehlt (${JSON.stringify(metrics.resultPerformance)}).`);
    }
    const strictPopupEdge = viewport.width > 480;
    if (target.name.startsWith("aufloesung-zielinfo") && (
      !metrics.resultPopupSafety ||
      metrics.resultPopupSafety.visualCount < 5 ||
      !metrics.resultPopupSafety.allInside ||
      (strictPopupEdge && (!metrics.resultPopupSafety.directionCorrect || !metrics.resultPopupSafety.tipMeetsLabelEdge))
    )) {
      problems.push("Zielinfo, beide Pins und beide Labels liegen nicht vollständig und richtungsrichtig innerhalb der Auflösungskarte.");
    }
    if (target.expectCloseAndReopen && (
      !metrics.targetInfoCloseControl
      || metrics.targetInfoCloseControl.hitWidth < 44
      || metrics.targetInfoCloseControl.hitHeight < 44
      || metrics.targetInfoCloseControl.visualWidth < 30
      || metrics.targetInfoCloseControl.visualWidth > 33
      || metrics.targetInfoCloseControl.visualHeight < 30
      || metrics.targetInfoCloseControl.visualHeight > 33
      || metrics.targetInfoCloseControl.glyph !== "×"
    )) {
      problems.push(`Das Zielinfo-X hat keine getrennte 44-px-Hitbox und kompakte sichtbare Kreisform (${JSON.stringify(metrics.targetInfoCloseControl)}).`);
    }
    if (target.expectGlobeSafeArea && (
      !metrics.globeResultSafety
      || metrics.globeResultSafety.markerCount !== (target.expectExtremeTargetRouteTail ? 1 : 2)
      || (target.expectExtremeTargetRouteTail
        ? metrics.globeResultSafety.routeCount !== 1
        : target.allowOmittedGlobeRoute
        ? ![0, 1].includes(metrics.globeResultSafety.routeCount)
        : metrics.globeResultSafety.routeCount !== 1)
      || !(target.expectExtremeTargetRouteTail ? metrics.globeResultSafety.markersInside : metrics.globeResultSafety.allInside)
      || !metrics.globeResultSafety.controlsGerman
      || metrics.globeResultSafety.targetPinAnimations.some((animationName) => !animationName.includes("targetIdle"))
      || (!target.expectExtremeTargetRouteTail && metrics.globeResultSafety.routeAnimations.some((animationName) => animationName === "none"))
      || !metrics.globeResultSafety.routeSettled
      || metrics.globeResultSafety.targetLanding
      || metrics.globeResultSafety.visibleLabelCount !== (target.expectExtremeTargetRouteTail ? 1 : 2)
      || !["settled", "reduced-settled"].includes(metrics.globeResultSafety.revealPhase)
      || !metrics.globeResultSafety.controlStacking?.controlsAboveContent
      || (metrics.globeResultSafety.routeCount === 1
        && (target.expectExtremeTargetRouteTail
          ? (metrics.globeResultSafety.routeEndpointClearances?.at(-1) ?? Number.NEGATIVE_INFINITY) < 4
          : !metrics.globeResultSafety.routeEndpointClearances?.every((clearance) => clearance >= 4)))
      || (target.expectExtremeTargetRouteTail && (
        !metrics.globeResultSafety.routeVisibleEntry
        || metrics.globeResultSafety.routeVisibleEntry.edgeInset > 12
        || (target.expectedRouteEntrySide && metrics.globeResultSafety.routeVisibleEntry.side !== target.expectedRouteEntrySide)
      ))
      || !metrics.globeCompositionStability
      || metrics.globeCompositionStability.markerCount !== (target.expectExtremeTargetRouteTail ? 1 : 2)
      || metrics.globeCompositionStability.maxMovementPx > 1
    )) {
      problems.push(`Globe-Ergebnis verletzt Safe Area, eindeutige Linienzeichnung, Ellipsenabstand oder deutsche Steuerungslogik (${JSON.stringify(metrics.globeResultSafety)}).`);
    }
    if (target.expectGameHudSafeArea && viewport.category === "desktop" && (
      !metrics.gameHudSafeArea || metrics.gameHudSafeArea.gapPx < 8
    )) {
      problems.push(`Die maximierte Tippkarte verletzt die Runde-/Zeit-Safe-Area (${JSON.stringify(metrics.gameHudSafeArea)}).`);
    }
    if (target.expectActiveRoute && (
      metrics.globeResultSafety?.routeCount !== 1
      || metrics.globeResultSafety.routeAnimations.some((animationName) => animationName === "none")
    )) {
      problems.push(`Die gesetzte Ergebnisroute bewegt sich im geöffneten Informationszustand nicht weiter (${JSON.stringify(metrics.globeResultSafety?.routeAnimations)}).`);
    }
    if (target.expectStableGlobeLabelTypography && (
      metrics.globeLabelTypography.length !== 2
      || metrics.globeLabelTypography.some((label) => label.fontSize !== 12
        || label.paddingTop < 6
        || label.paddingBottom < 6
        || label.height < 26)
    )) {
      problems.push(`Globe-Labeltypografie ist zwischen den Runden zu klein oder flach (${JSON.stringify(metrics.globeLabelTypography)}).`);
    }
    if (target.expectMapAttributionSafe && (
      !metrics.mapAttributionSafety?.panelInsideMap
      || !metrics.mapAttributionSafety?.closeInsidePanel
      || metrics.mapAttributionSafety.scrollWidth > metrics.mapAttributionSafety.clientWidth + 1
      || metrics.mapAttributionSafety.closeWidth < 40
      || metrics.mapAttributionSafety.closeHeight < 40
    )) {
      problems.push(`Kartenquellen oder Schließen-Aktion verlassen die Kartenfläche (${JSON.stringify(metrics.mapAttributionSafety)}).`);
    }
    if (target.expectTerrainExaggeration && Math.abs((metrics.globeResultSafety?.terrainExaggeration ?? 0) - target.expectTerrainExaggeration) > 0.01) {
      problems.push(`Globe-Terrain ist ${(metrics.globeResultSafety?.terrainExaggeration ?? 0)}× statt ${target.expectTerrainExaggeration.toFixed(1)}× aktiv.`);
    }
    if (target.expectGlobeInfoOverlay && (viewport.width <= 879 || viewport.height <= 500)) {
      const before = metrics.globeOverlayProbe?.before;
      const after = metrics.globeOverlayProbe?.after;
      const mapMovement = before?.player && after?.player
        ? Math.max(Math.abs(before.player.x - after.player.x), Math.abs(before.player.y - after.player.y))
        : Number.POSITIVE_INFINITY;
      if (
        !metrics.globeInfoOverlaySafety?.inside
        || !metrics.globeInfoOverlaySafety.avoidsNavigation
        || !metrics.globeInfoOverlaySafety.avoidsAttribution
        || mapMovement > 1
      ) {
        problems.push(`Mobile Globe-Zielinfo ist nicht sicher zentriert oder bewegt die Karte (${JSON.stringify({ safety: metrics.globeInfoOverlaySafety, mapMovement })}).`);
      }
    }
    if (target.expectImageRecoverySafe && (
      !metrics.imageRecoverySafety?.insideViewer
      || !metrics.imageRecoverySafety.avoidsSource
      || !metrics.imageRecoverySafety.avoidsMap
      || !metrics.imageRecoverySafety.receivesPointer
      || !metrics.imageRecoverySafety.sourceAboveBackdrop
    )) {
      problems.push(`Die spaete Bildladeaktion ist auf dem Mobilgeraet nicht sicher erreichbar (${JSON.stringify(metrics.imageRecoverySafety)}).`);
    }
    if (target.expectStableMapOnPopup && viewport.width >= 900 && viewport.height >= 480) {
      const before = metrics.popupMapProbe?.before;
      const after = metrics.popupMapProbe?.after;
      // The mint target pin deliberately has a subtle idle motion. The player
      // pin is static and therefore the reliable reference for map movement.
      const movement = before?.player && after?.player
        ? [Math.abs(before.player.x - after.player.x), Math.abs(before.player.y - after.player.y)]
        : [Number.POSITIVE_INFINITY];
      if (!movement.length || Math.max(...movement) > 1) {
        problems.push(`Die Desktop-Ergebniskarte bewegt sich beim Öffnen der Ortsinfo (${movement.join(" / ")} px).`);
      }
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
    if (target.expectCloseAndReopen && target.clickSelector) {
      const closeButton = page.getByRole("button", { name: "Zusatzinformationen schließen" }).first();
      await closeButton.click({ timeout: 5000 });
      await page.locator(".punktlandung-globe-info-overlay:visible, .kartenlabor-result-popup:visible").waitFor({ state: "hidden", timeout: 5000 });
      const parsedScreenshot = path.parse(screenshot);
      closedScreenshot = await saveViewportScreenshot(page, path.join(parsedScreenshot.dir, `${parsedScreenshot.name}-closed${parsedScreenshot.ext}`));
    }

    const normalizedConsole = normalizeConsoleMessages(consoleErrors);
    const normalizedHttp = normalizeHttpErrors(httpErrors);
    for (const responseError of normalizedHttp.relevant) problems.push(`HTTP-Fehler: ${responseError}`);
    for (const consoleError of normalizedConsole.relevant) problems.push(`Browserfehler: ${consoleError}`);
    return {
      target: target.name,
      viewport: viewport.name,
      status: problems.length ? "failed" : "passed",
      durationMs: Date.now() - startedAt,
      responseStatus,
      screenshot,
      closedScreenshot,
      metrics,
      problems,
      warnings,
      httpErrors: normalizedHttp.relevant,
      ignoredHttpErrors: normalizedHttp.ignored,
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
    const normalizedHttp = normalizeHttpErrors(httpErrors);
    return {
      target: target.name,
      viewport: viewport.name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      responseStatus,
      screenshot,
      closedScreenshot,
      metrics: null,
      problems: [error instanceof Error ? error.message : String(error)],
      warnings,
      httpErrors: normalizedHttp.relevant,
      ignoredHttpErrors: normalizedHttp.ignored,
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
console.log("Seitenauswahl: npm run check:responsive -- --page=home,spielen,aufloesung");
console.log("Einzelviewport: npm run check:responsive -- --viewport=laptop");
console.log("Viewportauswahl: npm run check:responsive -- --viewport=phone-small,phone-large,laptop");
console.log("Schnellprofil: npm run check:responsive -- --profile=quick");

if (args.help) {
  process.exit(0);
}

const requestedPages = args.page?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
const unknownPages = requestedPages.filter((page) => !availableNames.includes(page));
if (unknownPages.length) {
  console.error(`Unbekannte Seite: ${unknownPages.join(", ")}`);
  console.error(`Verfuegbar: ${availableNames.join(", ")}`);
  process.exit(1);
}

const availableViewportNames = viewports.map((viewport) => viewport.name);
const requestedViewports = args.viewport?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
const unknownViewports = requestedViewports.filter((viewport) => !availableViewportNames.includes(viewport));
if (unknownViewports.length) {
  console.error(`Unbekannter Viewport: ${unknownViewports.join(", ")}`);
  console.error(`Verfuegbar: ${availableViewportNames.join(", ")}`);
  process.exit(1);
}

if (!Object.hasOwn(viewportProfiles, args.profile)) {
  console.error(`Unbekanntes Profil: ${args.profile}`);
  console.error(`Verfuegbar: ${Object.keys(viewportProfiles).join(", ")}`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

const selected = requestedPages.length ? targets.filter((target) => requestedPages.includes(target.name)) : targets;
const selectedTargets = selected.filter((target) => target.access !== "todo");
const skippedTargets = selected.filter((target) => target.access === "todo");
const profileViewportNames = viewportProfiles[args.profile];
const selectedViewports = requestedViewports.length
  ? viewports.filter((viewport) => requestedViewports.includes(viewport.name))
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
