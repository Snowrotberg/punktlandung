"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { averageGuess, haversineDistanceKm } from "@/lib/geo";
import { prepareLocationImage } from "@/lib/imagePreload.client";
import { shuffledLocationIds } from "@/lib/locationSelection";
import { consumeSetupResumeRequest, isResumableGameStatus, shouldRestoreStoredGame, shouldStartTimerAfterImageReady } from "@/lib/gameResume.client";
import { PLAYER_PALETTE } from "@/lib/playerPalette";
import { evaluatePlayerGuess } from "@/lib/roundEvaluation";
import { readStoredSetupSettings, writeStoredSetupSettings } from "@/lib/setupSettings.client";
import type {
  Cosmetic,
  GameSettings,
  GeoLocation,
  Guess,
  HostParticipation,
  LatLng,
  Player,
  RoomKind,
  RoomState,
  RoundResult,
  RoundSummary,
  TeamId
} from "@/types/game";

const playerColors = PLAYER_PALETTE;
const recentLocationsStorageKey = "punktlandung-recent-location-ids";
const sessionStorageKey = "punktlandung-active-session-v1";
const sessionResetStorageKey = "punktlandung-reset-session-v1";
const recentLocationLimit = 400;
const sessionTtlMs = 1000 * 60 * 60 * 72;
const historyStateKey = "punktlandung-history-v1";
const locationCategories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);
let locationCatalogPromise: Promise<GeoLocation[]> | null = null;

function loadLocationCatalog(): Promise<GeoLocation[]> {
  locationCatalogPromise ??= import("@/data/locations").then((module) => module.builtInLocations);
  return locationCatalogPromise;
}

const defaultSettings: GameSettings = {
  mode: "classic",
  localMode: "solo",
  localPlayerCount: 1,
  timeLimitSec: 60,
  rounds: 15,
  noMove: false,
  noPan: false,
  noZoom: false,
  mapPackId: "world-party",
  category: "mixed",
  difficulty: "medium"
};

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function prefetchLocationImage(location: GeoLocation): void {
  void prepareLocationImage(location);
}

function readStoredRecentLocationIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(recentLocationsStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberLocationId(locationId: string, baseIds: string[] = []): string[] {
  const nextIds = uniqueIds([locationId, ...baseIds]).slice(0, recentLocationLimit);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(recentLocationsStorageKey, JSON.stringify(nextIds));
  }
  return nextIds;
}

type StoredSession = {
  savedAt: number;
  room: RoomState;
  recentLocationIds: string[];
  locationQueue: string[];
  queueCategory: string | null;
  lastLocationId: string | null;
};

type BrowserHistoryState = {
  appState: typeof historyStateKey;
  room: RoomState | null;
};

export type InitialLocalGameMode = GameSettings["localMode"] | "online";

function storedRoomMatchesInitialMode(room: RoomState, initialMode: InitialLocalGameMode): boolean {
  if (initialMode === "online") return room.kind === "online";
  return room.kind === "solo" && room.settings.localMode === initialMode;
}

function readStoredSession(fallbackHostId: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.savedAt || !parsed.room || Date.now() - parsed.savedAt > sessionTtlMs) {
      window.localStorage.removeItem(sessionStorageKey);
      return null;
    }
    const normalizedRoom = normalizeStoredRoom(parsed.room as Partial<RoomState>, fallbackHostId);
    if (!normalizedRoom) {
      window.localStorage.removeItem(sessionStorageKey);
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      room: normalizedRoom,
      recentLocationIds: Array.isArray(parsed.recentLocationIds) ? parsed.recentLocationIds.filter((id): id is string => typeof id === "string") : [],
      locationQueue: Array.isArray(parsed.locationQueue) ? parsed.locationQueue.filter((id): id is string => typeof id === "string") : [],
      queueCategory: parsed.queueCategory ?? null,
      lastLocationId: typeof parsed.lastLocationId === "string" ? parsed.lastLocationId : null
    };
  } catch {
    window.localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function writeStoredSession(session: Omit<StoredSession, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {
    window.localStorage.removeItem(sessionStorageKey);
  }
}

function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(sessionStorageKey);
}

function consumeSessionResetFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const shouldReset = window.sessionStorage.getItem(sessionResetStorageKey) === "1";
    if (shouldReset) window.sessionStorage.removeItem(sessionResetStorageKey);
    return shouldReset;
  } catch {
    return false;
  }
}

function readBrowserHistoryState(): BrowserHistoryState | null {
  if (typeof window === "undefined") return null;
  const state = window.history.state as Partial<BrowserHistoryState> | null;
  if (!state || state.appState !== historyStateKey) return null;
  return {
    appState: historyStateKey,
    room: state.room && typeof state.room === "object" ? normalizeStoredRoom(state.room as Partial<RoomState>, "local_host") : null
  };
}

function writeBrowserHistoryState(room: RoomState | null, method: "push" | "replace"): void {
  if (typeof window === "undefined") return;
  const currentState = window.history.state;
  const state: BrowserHistoryState & Record<string, unknown> = {
    ...(currentState && typeof currentState === "object" ? currentState : {}),
    appState: historyStateKey,
    room
  };
  if (method === "push") {
    window.history.pushState(state, "");
    return;
  }
  window.history.replaceState(state, "");
}

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<LatLng>;
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

function isGeoLocation(value: unknown): value is GeoLocation {
  if (!value || typeof value !== "object" || !isLatLng(value)) return false;
  const location = value as Partial<GeoLocation>;
  const panoramaUrlsValid = location.panoramaUrls === undefined || Array.isArray(location.panoramaUrls);
  return (
    typeof location.id === "string" &&
    typeof location.title === "string" &&
    typeof location.countryCode === "string" &&
    typeof location.countryName === "string" &&
    typeof location.continent === "string" &&
    typeof location.panoramaUrl === "string" &&
    typeof location.attribution === "string" &&
    typeof location.source === "string" &&
    typeof location.category === "string" &&
    locationCategories.has(location.category) &&
    panoramaUrlsValid
  );
}

function normalizePlayers(players: unknown): Player[] {
  if (!Array.isArray(players)) return [];
  return assignPlayerPalette(players.filter((player): player is Player => {
    if (!player || typeof player !== "object") return false;
    const item = player as Partial<Player>;
    return typeof item.id === "string" && typeof item.name === "string" && typeof item.score === "number";
  }));
}

function assignPlayerPalette(players: Player[]): Player[] {
  let changed = false;
  const nextPlayers = players.map((player, index) => {
    const color = playerColors[index % playerColors.length];
    if (player.color === color) return player;
    changed = true;
    return { ...player, color };
  });
  return changed ? nextPlayers : players;
}

function applyPlayerPalette(room: RoomState): RoomState {
  const players = assignPlayerPalette(room.players);
  return players === room.players ? room : { ...room, players };
}

function normalizeGuesses(guesses: unknown): Guess[] {
  if (!Array.isArray(guesses)) return [];
  return guesses.filter((guess): guess is Guess => {
    if (!guess || typeof guess !== "object") return false;
    const item = guess as Partial<Guess>;
    return typeof item.playerId === "string" && isLatLng(item);
  });
}

function normalizeSummaries(summaries: unknown): RoundSummary[] {
  if (!Array.isArray(summaries)) return [];
  return summaries.filter((summary): summary is RoundSummary => {
    if (!summary || typeof summary !== "object") return false;
    const item = summary as Partial<RoundSummary>;
    return (
      typeof item.roundNumber === "number" &&
      isGeoLocation(item.location) &&
      Array.isArray(item.results) &&
      typeof item.completedAt === "number"
    );
  });
}

function normalizeStoredRoom(room: Partial<RoomState>, fallbackHostId: string): RoomState | null {
  if (!room || typeof room !== "object" || !room.settings) return null;
  const players = normalizePlayers(room.players);
  const rawKind = (room as { kind?: unknown }).kind;
  const kind: RoomKind = rawKind === "party" ? "party" : rawKind === "online" || rawKind === "wifi" ? "online" : "solo";
  const hostParticipation: HostParticipation =
    room.hostParticipation === "host_only" || room.hostParticipation === "host_player"
      ? room.hostParticipation
      : kind === "online"
        ? "host_only"
        : "host_player";
  if (players.length === 0 && kind !== "online") return null;
  const summaries = normalizeSummaries(room.summaries);
  const guesses = normalizeGuesses(room.guesses);
  const location = isGeoLocation(room.location) ? room.location : null;
  const requestedStatus = room.status === "guessing" || room.status === "results" || room.status === "finished" ? room.status : "lobby";
  const status =
    (requestedStatus === "results" || requestedStatus === "finished") && summaries.length === 0
      ? "lobby"
      : requestedStatus === "guessing" && !location
        ? "lobby"
        : requestedStatus;

  return {
    code: typeof room.code === "string" ? room.code : "LOKAL",
    kind,
    hostId: typeof room.hostId === "string" ? room.hostId : fallbackHostId,
    hostParticipation,
    hostPlayerName: typeof room.hostPlayerName === "string" ? sanitizeName(room.hostPlayerName) : undefined,
    status,
    settings: {
      ...defaultSettings,
      ...room.settings,
      mode: kind === "online" && (room.settings.mode === "duel" || room.settings.mode === "classic") ? room.settings.mode : "classic",
      timeLimitSec: clampInt(room.settings.timeLimitSec, defaultSettings.timeLimitSec, 0, 600),
      rounds: clampInt(room.settings.rounds, defaultSettings.rounds, 1),
      localPlayerCount: clampInt(room.settings.localPlayerCount, defaultSettings.localPlayerCount, 1, 10)
    },
    players,
    currentRound: clampInt(room.currentRound, 0, 0),
    location,
    guesses,
    timedOutPlayerIds: Array.isArray(room.timedOutPlayerIds) ? room.timedOutPlayerIds.filter((id): id is string => typeof id === "string") : [],
    roundEndsAt: typeof room.roundEndsAt === "number" ? room.roundEndsAt : null,
    roundStartedAt: typeof room.roundStartedAt === "number" ? room.roundStartedAt : null,
    summaries,
    emojiEvents: Array.isArray(room.emojiEvents) ? room.emojiEvents : [],
    adGateUntil: typeof room.adGateUntil === "number" ? room.adGateUntil : null,
    nextRoundReadyPlayerIds: Array.isArray(room.nextRoundReadyPlayerIds)
      ? room.nextRoundReadyPlayerIds.filter((id): id is string => typeof id === "string")
      : [],
    nextRoundStartsAt: typeof room.nextRoundStartsAt === "number" ? room.nextRoundStartsAt : null
  };
}

function sanitizeName(input: string): string {
  const trimmed = input.replace(/[^\p{L}\p{N}\s_.-]/gu, "").trim();
  return trimmed.slice(0, 18) || "Gast";
}

function sanitizeEditableName(input: string): string {
  return input.replace(/[^\p{L}\p{N}\s_.-]/gu, "").slice(0, 18);
}

function clampInt(input: number | undefined, fallback: number, min: number, max?: number): number {
  const rounded = Math.round(Number(input ?? fallback));
  if (!Number.isFinite(rounded)) return fallback;
  const lowerBounded = Math.max(min, rounded);
  return max === undefined ? lowerBounded : Math.min(max, lowerBounded);
}

function makePlayer(playerId: string, name: string, isHost: boolean, index: number, localOnly = false): Player {
  return {
    id: playerId,
    name: sanitizeName(name),
    color: playerColors[index % playerColors.length],
    score: 0,
    connected: true,
    isHost,
    team: index % 2 === 0 ? "aurora" : "pulse",
    status: "active",
    cosmetic: "none",
    localOnly
  };
}

function syncLocalPlayers(room: RoomState): RoomState {
  if (room.kind !== "solo") {
    return {
      ...room,
      players: assignPlayerPalette(room.players.map((player, index) => ({ ...player, connected: true, isHost: index === 0 })))
    };
  }

  const host = room.players.find((player) => player.id === room.hostId) ?? room.players[0];
  if (!host) return room;

  const localMode = room.settings.localMode;
  const count = localMode === "couch" ? Math.max(2, Math.min(10, room.settings.localPlayerCount)) : 1;
  const nextPlayers = [
    { ...host, color: playerColors[0], connected: true, localOnly: false, isHost: true },
    ...Array.from({ length: count - 1 }, (_, index) => {
      const localPlayerId = `local_${index + 2}`;
      const existingPlayer = room.players.find((player) => player.id === localPlayerId);
      return existingPlayer
        ? { ...existingPlayer, color: playerColors[index + 1], connected: true, localOnly: true, isHost: false, status: "active" as const }
        : makePlayer(localPlayerId, `Spieler ${index + 2}`, false, index + 1, true);
    })
  ];
  const nextPlayerIds = new Set(nextPlayers.map((player) => player.id));

  return {
    ...room,
    players: nextPlayers,
    guesses: room.guesses.filter((guess) => nextPlayerIds.has(guess.playerId)),
    timedOutPlayerIds: room.timedOutPlayerIds.filter((id) => nextPlayerIds.has(id))
  };
}

function activePlayers(room: RoomState): Player[] {
  return room.players.filter((player) => player.connected && player.status === "active");
}

function isLocalSequentialRoom(room: RoomState): boolean {
  return room.kind === "solo" && room.settings.localMode === "couch" && activePlayers(room).length > 1;
}

function hasResolvedPlayer(room: RoomState, playerId: string): boolean {
  return room.guesses.some((guess) => guess.playerId === playerId) || room.timedOutPlayerIds.includes(playerId);
}

function unresolvedPlayers(room: RoomState): Player[] {
  return activePlayers(room).filter((player) => !hasResolvedPlayer(room, player.id));
}

function turnEndFrom(startedAt: number, settings: GameSettings): number | null {
  return settings.timeLimitSec > 0 ? startedAt + settings.timeLimitSec * 1000 : null;
}

function evaluateRound(room: RoomState): RoomState {
  if (!room.location || room.status !== "guessing") return room;

  const location = room.location;
  const guessesByPlayer = new Map(room.guesses.map((guess) => [guess.playerId, guess]));
  const contenders = room.players.filter((player) => player.status === "active");
  const evaluated = contenders.map((player): RoundResult =>
    evaluatePlayerGuess(player.id, location, guessesByPlayer.get(player.id) ?? null)
  );

  const nextPlayers = room.players.map((player) => {
    const result = evaluated.find((item) => item.playerId === player.id);
    return result ? { ...player, score: player.score + result.points } : player;
  });
  const crewGuess = room.settings.mode === "crew" ? averageGuess(room.guesses) : null;
  const crewDistanceKm = crewGuess ? haversineDistanceKm(crewGuess, location) : null;
  const summary: RoundSummary = {
    roundNumber: room.currentRound,
    location,
    results: evaluated.sort((a, b) => b.points - a.points),
    crewGuess,
    crewDistanceKm,
    duel: [
      { team: "aurora", averageDistanceKm: 0, hp: 20000 },
      { team: "pulse", averageDistanceKm: 0, hp: 20000 }
    ],
    completedAt: Date.now(),
    roundStartedAt: room.roundStartedAt ?? undefined
  };

  return {
    ...room,
    players: nextPlayers,
    status: room.currentRound >= room.settings.rounds ? "finished" : "results",
    roundEndsAt: null,
    roundStartedAt: null,
    timedOutPlayerIds: [],
    summaries: [...room.summaries, summary],
    nextRoundReadyPlayerIds: [],
    nextRoundStartsAt: null
  };
}

function createInitialRoom(
  playerId: string,
  playerName: string,
  mode: InitialLocalGameMode,
  hydrateStoredSettings = false
): RoomState {
  // Browser storage is intentionally read only after React has hydrated.
  // Reading it during the lazy state initializer makes the first client
  // render differ from SSR whenever a player has saved setup preferences.
  const storedSettings = hydrateStoredSettings ? readStoredSetupSettings(defaultSettings) : {};
  if (mode === "online") {
    return syncLocalPlayers({
      code: "ONLINE",
      kind: "online",
      hostId: playerId,
      hostParticipation: "host_player",
      hostPlayerName: sanitizeName(playerName),
      status: "lobby",
      settings: {
        ...defaultSettings,
        ...storedSettings,
        localMode: "solo",
        localPlayerCount: 1
      },
      players: [],
      currentRound: 0,
      location: null,
      guesses: [],
      timedOutPlayerIds: [],
      roundEndsAt: null,
      roundStartedAt: null,
      summaries: [],
      emojiEvents: [],
      adGateUntil: null,
      nextRoundReadyPlayerIds: [],
      nextRoundStartsAt: null
    });
  }

  const normalizedLocalMode = mode === "couch" ? "couch" : "solo";
  return syncLocalPlayers({
    code: "LOKAL",
    kind: "solo",
    hostId: playerId,
    hostParticipation: "host_player",
    hostPlayerName: sanitizeName(playerName),
    status: "lobby",
    settings: {
      ...defaultSettings,
      ...storedSettings,
      localMode: normalizedLocalMode,
      localPlayerCount: normalizedLocalMode === "couch" ? 2 : 1
    },
    players: [makePlayer(playerId, playerName, true, 0)],
    currentRound: 0,
    location: null,
    guesses: [],
    timedOutPlayerIds: [],
    roundEndsAt: null,
    roundStartedAt: null,
    summaries: [],
    emojiEvents: [],
    adGateUntil: null,
    nextRoundReadyPlayerIds: [],
    nextRoundStartsAt: null
  });
}

export function useLocalGame(initialMode?: InitialLocalGameMode, restoreStoredSession = false) {
  const [playerId] = useState("local_host");
  const [room, setRoom] = useState<RoomState | null>(() => (initialMode ? createInitialRoom("local_host", "Geo-Gast", initialMode) : null));
  // A route-owned setup already exists synchronously. Hydrate a resumable
  // session in the effect below without blocking the normal page transition
  // behind the full-screen game loading state.
  // Let the setup route restore a browser-back session before GameApp creates
  // a fresh lobby for the requested mode.
  const [restoring, setRestoring] = useState(Boolean(restoreStoredSession || initialMode));
  const [resumePending, setResumePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentLocationIds, setRecentLocationIds] = useState<string[]>([]);
  const locationsRef = useRef<GeoLocation[]>([]);
  const locationQueueRef = useRef<string[]>([]);
  const queueCategoryRef = useRef<string | null>(null);
  const lastLocationIdRef = useRef<string | null>(null);
  const isRestoringHistoryRef = useRef(false);
  const previousRoomRef = useRef<RoomState | null>(null);
  const roomRef = useRef<RoomState | null>(room);
  const resumePendingRef = useRef(false);
  roomRef.current = room;

  const ensureLocationCatalog = useCallback(async () => {
    if (locationsRef.current.length === 0) locationsRef.current = await loadLocationCatalog();
    return locationsRef.current;
  }, []);

  const drawLocation = useCallback(
    (settings: GameSettings, forcedRecentIds = recentLocationIds) => {
      const locations = locationsRef.current;
      if (locations.length === 0) return null;
      const avoidIds = uniqueIds([...forcedRecentIds, ...readStoredRecentLocationIds()]);
      const queueSettingsKey = `${settings.category}:${settings.difficulty}`;
      if (queueCategoryRef.current !== queueSettingsKey || locationQueueRef.current.length === 0) {
        locationQueueRef.current = shuffledLocationIds(locations, settings.category, settings.difficulty, settings.rounds, avoidIds, lastLocationIdRef.current);
        queueCategoryRef.current = queueSettingsKey;
      }

      if (locationQueueRef.current.length > 1 && locationQueueRef.current[0] === lastLocationIdRef.current) {
        const swapIndex = 1 + randomIndex(locationQueueRef.current.length - 1);
        [locationQueueRef.current[0], locationQueueRef.current[swapIndex]] = [locationQueueRef.current[swapIndex], locationQueueRef.current[0]];
      }

      const nextId = locationQueueRef.current.shift() ?? locations[0].id;
      lastLocationIdRef.current = nextId;
      return locations.find((location) => location.id === nextId) ?? locations[0];
    },
    [recentLocationIds]
  );

  // Start loading the catalog as soon as the setup lobby exists. This keeps
  // the first click from having to wait for the catalog chunk to initialize.
  useEffect(() => {
    if (!room || room.status !== "lobby") return;
    void ensureLocationCatalog();
  }, [ensureLocationCatalog, room?.status]);

  // Build the first package while the player is still in the setup screen and
  // warm exactly one upcoming Wikimedia thumbnail. Subsequent rounds warm the
  // next queue entry while the current image is already being played.
  useEffect(() => {
    if (!room || (room.status !== "lobby" && room.status !== "guessing" && room.status !== "results")) return;
    const timer = window.setTimeout(async () => {
      const locations = await ensureLocationCatalog();
      const queueSettingsKey = `${room.settings.category}:${room.settings.difficulty}`;
      if (queueCategoryRef.current !== queueSettingsKey || locationQueueRef.current.length === 0) {
        const usedInThisGame = room.summaries.map((summary) => summary.location.id);
        locationQueueRef.current = shuffledLocationIds(
          locations,
          room.settings.category,
          room.settings.difficulty,
          room.settings.rounds,
          uniqueIds([...recentLocationIds, ...usedInThisGame]),
          lastLocationIdRef.current
        );
        queueCategoryRef.current = queueSettingsKey;
      }
      const nextLocation = locations.find((location) => location.id === locationQueueRef.current[0]);
      if (nextLocation) prefetchLocationImage(nextLocation);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ensureLocationCatalog, recentLocationIds, room?.currentRound, room?.location?.id, room?.settings.category, room?.settings.difficulty, room?.settings.rounds, room?.status]);

  useEffect(() => {
    if (consumeSessionResetFlag()) {
      clearStoredSession();
      writeBrowserHistoryState(null, "replace");
      previousRoomRef.current = null;
      setRoom(null);
      setRecentLocationIds(readStoredRecentLocationIds());
      setRestoring(false);
      return;
    }

    if (initialMode) {
      const storedSession = readStoredSession(playerId);
      const browserState = readBrowserHistoryState();
      const returningToSetup = consumeSetupResumeRequest("local")
        || new URLSearchParams(window.location.search).get("resume") === "1";
      const resumableRoom = storedSession?.room ?? (returningToSetup ? browserState?.room ?? null : null);
      const canRestoreRouteSession = resumableRoom
        && storedRoomMatchesInitialMode(resumableRoom, initialMode)
        // A setup route is a deliberate new-game entry point. Only an
        // explicit recovery route (or a return from the legal page) may
        // restore a previously active round; otherwise an old PWA/browser
        // session must not hijack the Solo/Party setup screen.
        && shouldRestoreStoredGame(resumableRoom.status, restoreStoredSession || returningToSetup);
      if (canRestoreRouteSession) {
        locationQueueRef.current = storedSession?.locationQueue ?? [];
        queueCategoryRef.current = storedSession?.queueCategory ?? null;
        lastLocationIdRef.current = storedSession?.lastLocationId ?? resumableRoom.location?.id ?? null;
        previousRoomRef.current = resumableRoom;
        setRecentLocationIds(storedSession?.recentLocationIds?.length ? storedSession.recentLocationIds : readStoredRecentLocationIds());
        setRoom(resumableRoom);
        resumePendingRef.current = returningToSetup && isResumableGameStatus(resumableRoom.status);
        setResumePending(resumePendingRef.current);
        setRestoring(false);
        return;
      }
      clearStoredSession();
      const clientInitialRoom = createInitialRoom(playerId, "Geo-Gast", initialMode, true);
      previousRoomRef.current = clientInitialRoom;
      setRoom(clientInitialRoom);
      setRecentLocationIds(readStoredRecentLocationIds());
      setRestoring(false);
      return;
    }

    const browserState = readBrowserHistoryState();
    const storedSession = readStoredSession(playerId);
    if (browserState?.room) {
      previousRoomRef.current = browserState.room;
      setRoom(browserState.room);
      lastLocationIdRef.current = browserState.room.location?.id ?? browserState.room.summaries.at(-1)?.location.id ?? null;
      setRecentLocationIds(readStoredRecentLocationIds());
      setRestoring(false);
      return;
    }

    if (restoreStoredSession && storedSession) {
      locationQueueRef.current = storedSession.locationQueue;
      queueCategoryRef.current = storedSession.queueCategory;
      lastLocationIdRef.current = storedSession.lastLocationId ?? storedSession.room.location?.id ?? null;
      setRecentLocationIds(storedSession.recentLocationIds.length ? storedSession.recentLocationIds : readStoredRecentLocationIds());
      setRoom(storedSession.room);
      setRestoring(false);
      return;
    }

    if (browserState) {
      previousRoomRef.current = null;
      setRoom(null);
      setRecentLocationIds(readStoredRecentLocationIds());
      setRestoring(false);
      return;
    }

    writeBrowserHistoryState(null, "replace");
    setRecentLocationIds(readStoredRecentLocationIds());
    setRestoring(false);
  }, []);

  useEffect(() => {
    setRoom((current) => (current ? applyPlayerPalette(current) : current));
  });

  useEffect(() => {
    const reconcileElapsedRound = () => {
      setRoom((current) => {
        if (!current || current.status !== "guessing" || !current.roundEndsAt || Date.now() < current.roundEndsAt) return current;
        if (isLocalSequentialRoom(current)) {
          const nextTimedOutPlayer = unresolvedPlayers(current)[0];
          if (!nextTimedOutPlayer) return evaluateRound(current);
          const nextRoom = {
            ...current,
            timedOutPlayerIds: uniqueIds([...current.timedOutPlayerIds, nextTimedOutPlayer.id])
          };
          const nextTurnStartedAt = Date.now();
          return unresolvedPlayers(nextRoom).length === 0
            ? evaluateRound(nextRoom)
            : { ...nextRoom, roundEndsAt: turnEndFrom(nextTurnStartedAt, nextRoom.settings), roundStartedAt: nextTurnStartedAt };
        }
        return evaluateRound(current);
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") reconcileElapsedRound();
    };
    const timer = window.setInterval(reconcileElapsedRound, 250);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", reconcileElapsedRound);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", reconcileElapsedRound);
    };
  }, []);

  useEffect(() => {
    if (!room) return;
    writeStoredSession({
      room,
      recentLocationIds,
      locationQueue: locationQueueRef.current,
      queueCategory: queueCategoryRef.current,
      lastLocationId: lastLocationIdRef.current
    });
  }, [room, recentLocationIds]);

  useEffect(() => {
    const persistLatestSession = () => {
      const current = roomRef.current;
      if (!current) return;
      writeStoredSession({
        room: current,
        recentLocationIds,
        locationQueue: locationQueueRef.current,
        queueCategory: queueCategoryRef.current,
        lastLocationId: lastLocationIdRef.current
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistLatestSession();
    };
    window.addEventListener("pagehide", persistLatestSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persistLatestSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [recentLocationIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      const browserState = readBrowserHistoryState();
      isRestoringHistoryRef.current = true;
      setRoom(browserState?.room ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const previousRoom = previousRoomRef.current;

    if (isRestoringHistoryRef.current) {
      isRestoringHistoryRef.current = false;
      previousRoomRef.current = room;
      return;
    }

    if (!previousRoom && !room) {
      writeBrowserHistoryState(null, "replace");
      previousRoomRef.current = room;
      return;
    }

    // Game state belongs to the current route. Pushing one browser-history entry
    // per lobby/round/status change made Back restore an older running timer
    // instead of leaving the game page.
    writeBrowserHistoryState(room, "replace");
    previousRoomRef.current = room;
  }, [room]);

  const createSolo = useCallback((playerName: string, localMode: GameSettings["localMode"] = "solo") => {
    const persistedRecentIds = readStoredRecentLocationIds();
    locationQueueRef.current = [];
    queueCategoryRef.current = null;
    lastLocationIdRef.current = persistedRecentIds[0] ?? null;
    setRecentLocationIds(persistedRecentIds);
    const normalizedLocalMode = localMode === "couch" ? "couch" : "solo";
    const nextRoom = syncLocalPlayers({
      code: "LOKAL",
      kind: "solo",
      hostId: playerId,
      hostParticipation: "host_player",
      hostPlayerName: sanitizeName(playerName),
      status: "lobby",
      settings: {
        ...defaultSettings,
        ...readStoredSetupSettings(defaultSettings),
        localMode: normalizedLocalMode,
        localPlayerCount: normalizedLocalMode === "couch" ? 2 : 1
      },
      players: [makePlayer(playerId, playerName, true, 0)],
      currentRound: 0,
      location: null,
      guesses: [],
      timedOutPlayerIds: [],
      roundEndsAt: null,
      roundStartedAt: null,
      summaries: [],
      emojiEvents: [],
      adGateUntil: null,
      nextRoundReadyPlayerIds: [],
      nextRoundStartsAt: null
    });
    setRoom(nextRoom);
    setError(null);
  }, [playerId]);

  const createOnlineSetup = useCallback((options: { hostParticipation: HostParticipation; playerName?: string }) => {
    const persistedRecentIds = readStoredRecentLocationIds();
    locationQueueRef.current = [];
    queueCategoryRef.current = null;
    lastLocationIdRef.current = persistedRecentIds[0] ?? null;
    setRecentLocationIds(persistedRecentIds);
    const nextRoom = syncLocalPlayers({
      code: "ONLINE",
      kind: "online",
      hostId: playerId,
      hostParticipation: options.hostParticipation,
      hostPlayerName: options.hostParticipation === "host_player" ? sanitizeName(options.playerName ?? "") : undefined,
      status: "lobby",
      settings: {
        ...defaultSettings,
        ...readStoredSetupSettings(defaultSettings),
        localMode: "solo",
        localPlayerCount: 1
      },
      players: [],
      currentRound: 0,
      location: null,
      guesses: [],
      timedOutPlayerIds: [],
      roundEndsAt: null,
      roundStartedAt: null,
      summaries: [],
      emojiEvents: [],
      adGateUntil: null,
      nextRoundReadyPlayerIds: [],
      nextRoundStartsAt: null
    });
    setRoom(nextRoom);
    setError(null);
  }, [playerId]);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    setRoom((current) => {
      if (!current || (current.status !== "lobby" && !resumePendingRef.current)) return current;
      const baseRoom = current.status !== "lobby"
        ? {
            ...current,
            status: "lobby" as const,
            location: null,
            guesses: [],
            timedOutPlayerIds: [],
            roundEndsAt: null,
            roundStartedAt: null,
            currentRound: 0,
            summaries: []
          }
        : current;
      const nextSettings: GameSettings = {
        ...current.settings,
        ...settings,
        mode: baseRoom.kind === "online" ? settings.mode ?? baseRoom.settings.mode : "classic",
        timeLimitSec: clampInt(settings.timeLimitSec, current.settings.timeLimitSec, 0, 600),
        rounds: clampInt(settings.rounds, current.settings.rounds, 1),
        localPlayerCount: clampInt(settings.localPlayerCount, current.settings.localPlayerCount, 1, 10)
      };
      if (nextSettings.localMode === "couch" && nextSettings.localPlayerCount < 2) nextSettings.localPlayerCount = 2;
      if (nextSettings.localMode === "solo") nextSettings.localPlayerCount = 1;
      writeStoredSetupSettings(nextSettings);
      resumePendingRef.current = false;
      setResumePending(false);
      return syncLocalPlayers({ ...baseRoom, settings: nextSettings });
    });
  }, []);

  const resumeRound = useCallback(() => {
    resumePendingRef.current = false;
    setResumePending(false);
  }, []);

  const discardResume = useCallback(() => {
    resumePendingRef.current = false;
    setResumePending(false);
    setRoom((current) => current && current.status !== "lobby"
      ? {
          ...current,
          status: "lobby",
          location: null,
          guesses: [],
          timedOutPlayerIds: [],
          roundEndsAt: null,
          roundStartedAt: null,
          currentRound: 0,
          summaries: []
        }
      : current);
  }, []);

  const updateHostParticipation = useCallback((hostParticipation: HostParticipation, playerName?: string) => {
    setRoom((current) => {
      if (!current || current.status !== "lobby" || current.kind !== "online") return current;
      return {
        ...current,
        hostParticipation,
        hostPlayerName: hostParticipation === "host_player" ? sanitizeName(playerName ?? current.hostPlayerName ?? "") : undefined
      };
    });
  }, []);

  const renamePlayer = useCallback((targetPlayerId: string, name: string) => {
    setRoom((current) => {
      if (!current || current.status !== "lobby") return current;
      return {
        ...current,
        players: current.players.map((player) => (player.id === targetPlayerId ? { ...player, name: sanitizeEditableName(name) } : player))
      };
    });
  }, []);

  const startRound = useCallback(async () => {
    const current = roomRef.current;
    if (!current || current.status === "guessing") return;
    if (current.currentRound >= current.settings.rounds) {
      setRoom((value) => value ? { ...value, status: "finished" } : value);
      return;
    }

    setError(null);
    await ensureLocationCatalog();
    const usedInThisGame = current.summaries.map((summary) => summary.location.id);
    const attemptedIds: string[] = [];
    let location: GeoLocation | null = null;
    for (let attempt = 0; attempt < 4 && !location; attempt += 1) {
      const candidate = drawLocation(
        current.settings,
        uniqueIds([...recentLocationIds, ...usedInThisGame, ...attemptedIds])
      );
      if (!candidate) break;
      attemptedIds.push(candidate.id);
      location = await prepareLocationImage(candidate);
    }

    if (!location) {
      setError("Die Bilder sind gerade nicht erreichbar. Bitte versuche es noch einmal.");
      return;
    }

    setRecentLocationIds((ids) => rememberLocationId(location!.id, ids));
    setRoom((latest) => {
      if (!latest || latest.status === "guessing" || latest.currentRound !== current.currentRound) return latest;
      const nextRoom: RoomState = {
        ...latest,
        currentRound: latest.currentRound + 1,
        status: "guessing",
        location,
        guesses: [],
        timedOutPlayerIds: [],
        emojiEvents: [],
        roundEndsAt: null,
        roundStartedAt: null,
        adGateUntil: null,
        nextRoundReadyPlayerIds: [],
        nextRoundStartsAt: null
      };
      roomRef.current = nextRoom;
      return nextRoom;
    });
  }, [drawLocation, ensureLocationCatalog, recentLocationIds]);

  const submitGuess = useCallback((guess: LatLng & { countryCode?: string }, targetPlayerId?: string) => {
    setRoom((current) => {
      if (!current || current.status !== "guessing") return current;
      const playerIdForGuess = targetPlayerId ?? playerId;
      const player = current.players.find((candidate) => candidate.id === playerIdForGuess);
      if (!player || player.status !== "active") return current;
      const guessedAt = Date.now();
      const nextGuess: Guess = {
        playerId: playerIdForGuess,
        lat: Math.max(-85, Math.min(85, guess.lat)),
        lng: Math.max(-180, Math.min(180, guess.lng)),
        countryCode: guess.countryCode,
        createdAt: guessedAt,
        responseTimeMs: current.roundStartedAt ? Math.max(0, guessedAt - current.roundStartedAt) : undefined
      };
      const nextRoom = {
        ...current,
        guesses: current.guesses.filter((item) => item.playerId !== playerIdForGuess).concat(nextGuess),
        timedOutPlayerIds: current.timedOutPlayerIds.filter((id) => id !== playerIdForGuess)
      };
      const completed = activePlayers(nextRoom).every((active) => hasResolvedPlayer(nextRoom, active.id));
      if (completed) return evaluateRound(nextRoom);
      if (isLocalSequentialRoom(nextRoom)) {
        const nextTurnStartedAt = Date.now();
        return { ...nextRoom, roundEndsAt: turnEndFrom(nextTurnStartedAt, nextRoom.settings), roundStartedAt: nextTurnStartedAt };
      }
      return nextRoom;
    });
  }, [playerId]);

  const cancelRound = useCallback(() => {
    setRoom((current) => {
      if (!current) return current;
      return {
        ...current,
        status: "lobby",
        location: null,
        guesses: [],
        timedOutPlayerIds: [],
        roundEndsAt: null,
        roundStartedAt: null,
        adGateUntil: null,
        nextRoundReadyPlayerIds: [],
        nextRoundStartsAt: null,
        currentRound:
          current.status === "guessing" && !current.summaries.some((summary) => summary.roundNumber === current.currentRound)
            ? Math.max(0, current.currentRound - 1)
            : current.currentRound
      };
    });
  }, []);

  const skipLocation = useCallback(async () => {
    const current = roomRef.current;
    if (!current || current.status !== "guessing") return;

    const nextRecent = current.location
      ? [current.location.id, ...recentLocationIds.filter((item) => item !== current.location?.id)].slice(0, recentLocationLimit)
      : recentLocationIds;
    locationQueueRef.current = locationQueueRef.current.filter((id) => id !== current.location?.id);

    let preparedLocation: GeoLocation | null = null;
    const attemptedIds: string[] = [];
    for (let attempt = 0; attempt < 4 && !preparedLocation; attempt += 1) {
      let candidate = drawLocation(current.settings, uniqueIds([...nextRecent, ...attemptedIds]));
      if (!candidate) {
        await ensureLocationCatalog();
        candidate = drawLocation(current.settings, uniqueIds([...nextRecent, ...attemptedIds]));
      }
      if (!candidate) break;
      attemptedIds.push(candidate.id);
      preparedLocation = await prepareLocationImage(candidate);
    }

    if (!preparedLocation) {
      const message = "Der andere Ort konnte gerade nicht vorbereitet werden. Bitte versuche es erneut.";
      setError(message);
      throw new Error(message);
    }

    setRecentLocationIds((ids) => rememberLocationId(preparedLocation!.id, uniqueIds([...nextRecent, ...ids])));
    setRoom((latest) => {
      if (!latest || latest.status !== "guessing" || latest.location?.id !== current.location?.id) return latest;
      const nextRoom = {
        ...latest,
        location: preparedLocation,
        guesses: [],
        timedOutPlayerIds: [],
        emojiEvents: [],
        roundEndsAt: null,
        roundStartedAt: null
      };
      roomRef.current = nextRoom;
      return nextRoom;
    });
  }, [drawLocation, ensureLocationCatalog, recentLocationIds]);

  const markLocationReady = useCallback((locationId: string, ready: boolean) => {
    setRoom((current) => {
      if (!current || current.status !== "guessing" || current.location?.id !== locationId) return current;
      // A transient remount/error after the round became visible must not reset
      // its clock. Fresh rounds have null timestamps until the first successful
      // image load; resumed rounds retain their original absolute deadline.
      if (!shouldStartTimerAfterImageReady(ready, current.roundStartedAt, current.roundEndsAt)) return current;
      const roundStartedAt = Date.now();
      return {
        ...current,
        roundEndsAt: turnEndFrom(roundStartedAt, current.settings),
        roundStartedAt
      };
    });
  }, []);

  const restart = useCallback(() => {
    const persistedRecentIds = readStoredRecentLocationIds();
    locationQueueRef.current = [];
    queueCategoryRef.current = null;
    lastLocationIdRef.current = persistedRecentIds[0] ?? null;
    setRecentLocationIds(persistedRecentIds);
    setRoom((current) => {
      if (!current) return current;
      return syncLocalPlayers({
        ...current,
        status: "lobby",
        currentRound: 0,
        location: null,
        guesses: [],
        timedOutPlayerIds: [],
        roundEndsAt: null,
        roundStartedAt: null,
        summaries: [],
        adGateUntil: null,
        nextRoundReadyPlayerIds: [],
        nextRoundStartsAt: null,
        players: current.players.map((player) => ({ ...player, score: 0, status: "active" }))
      });
    });
  }, []);

  const setTeam = useCallback((_team: TeamId) => undefined, []);
  const unlockCosmetic = useCallback((_cosmetic: Cosmetic) => undefined, []);
  const leaveRoom = useCallback(() => {
    clearStoredSession();
    writeBrowserHistoryState(null, "replace");
    previousRoomRef.current = null;
    isRestoringHistoryRef.current = false;
    setRoom(null);
  }, []);

  return useMemo(
    () => ({
      playerId,
      room,
      restoring,
      error,
      status: "open" as const,
      isHost: Boolean(room),
      me: room?.players.find((player) => player.id === playerId) ?? null,
      createSolo,
      createOnlineSetup,
      updateSettings,
      updateHostParticipation,
      renamePlayer,
      startRound,
      submitGuess,
      cancelRound,
      skipLocation,
      markLocationReady,
      resumePending,
      resumeRound,
      discardResume,
      restart,
      readyNextRound: () => undefined,
      leaveRoom,
      clearError: () => setError(null),
      setTeam,
      unlockCosmetic
    }),
    [cancelRound, createOnlineSetup, createSolo, discardResume, error, leaveRoom, markLocationReady, playerId, renamePlayer, restart, resumePending, resumeRound, restoring, room, setTeam, skipLocation, startRound, submitGuess, unlockCosmetic, updateHostParticipation, updateSettings]
  );
}
