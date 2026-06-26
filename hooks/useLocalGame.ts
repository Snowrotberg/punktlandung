"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { builtInLocations } from "@/data/locations";
import { averageGuess, badgeFor, countryCodeFromGuess, haversineDistanceKm, isGuessInCountry, scoreDistance } from "@/lib/geo";
import { evaluateTerritoryGuess } from "@/lib/locationBoundaries";
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

const playerColors = ["#2563eb", "#f43f5e", "#f59e0b", "#06b6d4", "#7c3aed", "#f97316", "#ec4899", "#eab308", "#0ea5e9", "#dc2626"];
const recentLocationsStorageKey = "punktlandung-recent-location-ids";
const sessionStorageKey = "punktlandung-active-session-v1";
const sessionResetStorageKey = "punktlandung-reset-session-v1";
const recentLocationLimit = 120;
const sessionTtlMs = 1000 * 60 * 60 * 6;
const locationCategories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);
const historyStateKey = "punktlandung-history-v1";

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
  category: "mixed"
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
  queueCategory: GameSettings["category"] | null;
  lastLocationId: string | null;
};

type BrowserHistoryState = {
  appState: typeof historyStateKey;
  room: RoomState | null;
};

export type InitialLocalGameMode = GameSettings["localMode"] | "online";

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
  const state: BrowserHistoryState = {
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
    adGateUntil: typeof room.adGateUntil === "number" ? room.adGateUntil : null
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

function shuffledLocationIds(category: GameSettings["category"], recentLocationIds: string[], previousLocationId?: string | null): string[] {
  const pool = category === "mixed" ? builtInLocations : builtInLocations.filter((location) => location.category === category);
  const sourceBase = pool.length > 0 ? pool : builtInLocations;
  const recent = new Set(recentLocationIds);
  const fresh = sourceBase.filter((location) => !recent.has(location.id));
  const ids = (fresh.length > 0 ? fresh : sourceBase).map((location) => location.id);

  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }

  if (ids.length > 1 && ids[0] === previousLocationId) {
    const swapIndex = 1 + randomIndex(ids.length - 1);
    [ids[0], ids[swapIndex]] = [ids[swapIndex], ids[0]];
  }

  return ids;
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
  const evaluated = contenders.map((player): RoundResult => {
    const guess = guessesByPlayer.get(player.id) ?? null;
    if (!guess) {
      return { playerId: player.id, distanceKm: 20038, points: 0, badge: "Verschollen", eliminated: false, guess, countryCorrect: false };
    }

    const distanceKm = haversineDistanceKm(guess, location);
    const guessedCountry = guess.countryCode ?? countryCodeFromGuess(guess);
    const countryCorrect =
      location.category === "flags" && (guessedCountry === location.countryCode || isGuessInCountry(guess, location.countryCode));
    const territoryMatch = evaluateTerritoryGuess(location, guess);
    const sameContinent = countryCorrect || guessedCountry === location.countryCode || guessedCountry === location.continent;
    const finalDistanceKm = territoryMatch?.distanceKm ?? distanceKm;
    const finalPoints = countryCorrect ? 5000 : territoryMatch?.points ?? scoreDistance(distanceKm);
    const finalBadge = countryCorrect ? "Richtiges Land" : territoryMatch?.badge ?? badgeFor(distanceKm, sameContinent);
    const territoryCorrect = territoryMatch?.isTerritoryHit ?? false;

    return {
      playerId: player.id,
      distanceKm: finalDistanceKm,
      points: finalPoints,
      badge: finalBadge,
      eliminated: false,
      guess,
      countryCorrect: countryCorrect || territoryCorrect
    };
  });

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
    summaries: [...room.summaries, summary]
  };
}

function createInitialRoom(playerId: string, playerName: string, mode: InitialLocalGameMode): RoomState {
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
      adGateUntil: null
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
    adGateUntil: null
  });
}

export function useLocalGame(initialMode?: InitialLocalGameMode) {
  const [playerId] = useState("local_host");
  const [room, setRoom] = useState<RoomState | null>(() => (initialMode ? createInitialRoom("local_host", "Geo-Gast", initialMode) : null));
  const [error, setError] = useState<string | null>(null);
  const [recentLocationIds, setRecentLocationIds] = useState<string[]>([]);
  const locationQueueRef = useRef<string[]>([]);
  const queueCategoryRef = useRef<GameSettings["category"] | null>(null);
  const lastLocationIdRef = useRef<string | null>(null);
  const isRestoringHistoryRef = useRef(false);
  const previousRoomRef = useRef<RoomState | null>(null);

  const drawLocation = useCallback(
    (settings: GameSettings, forcedRecentIds = recentLocationIds) => {
      const avoidIds = uniqueIds([...forcedRecentIds, ...readStoredRecentLocationIds()]);
      if (queueCategoryRef.current !== settings.category || locationQueueRef.current.length === 0) {
        locationQueueRef.current = shuffledLocationIds(settings.category, avoidIds, lastLocationIdRef.current);
        queueCategoryRef.current = settings.category;
      }

      if (locationQueueRef.current.length > 1 && locationQueueRef.current[0] === lastLocationIdRef.current) {
        const swapIndex = 1 + randomIndex(locationQueueRef.current.length - 1);
        [locationQueueRef.current[0], locationQueueRef.current[swapIndex]] = [locationQueueRef.current[swapIndex], locationQueueRef.current[0]];
      }

      const nextId = locationQueueRef.current.shift() ?? builtInLocations[0].id;
      lastLocationIdRef.current = nextId;
      return builtInLocations.find((location) => location.id === nextId) ?? builtInLocations[0];
    },
    [recentLocationIds]
  );

  useEffect(() => {
    if (consumeSessionResetFlag()) {
      clearStoredSession();
      writeBrowserHistoryState(null, "replace");
      previousRoomRef.current = null;
      setRoom(null);
      setRecentLocationIds(readStoredRecentLocationIds());
      return;
    }

    if (initialMode) {
      clearStoredSession();
      previousRoomRef.current = room;
      setRecentLocationIds(readStoredRecentLocationIds());
      return;
    }

    const browserState = readBrowserHistoryState();
    const storedSession = readStoredSession(playerId);
    if (browserState?.room) {
      previousRoomRef.current = browserState.room;
      setRoom(browserState.room);
      lastLocationIdRef.current = browserState.room.location?.id ?? browserState.room.summaries.at(-1)?.location.id ?? null;
      setRecentLocationIds(readStoredRecentLocationIds());
      return;
    }

    if (storedSession) {
      locationQueueRef.current = storedSession.locationQueue;
      queueCategoryRef.current = storedSession.queueCategory;
      lastLocationIdRef.current = storedSession.lastLocationId ?? storedSession.room.location?.id ?? null;
      setRecentLocationIds(storedSession.recentLocationIds.length ? storedSession.recentLocationIds : readStoredRecentLocationIds());
      setRoom(storedSession.room);
      return;
    }

    if (browserState) {
      previousRoomRef.current = null;
      setRoom(null);
      setRecentLocationIds(readStoredRecentLocationIds());
      return;
    }

    writeBrowserHistoryState(null, "replace");
    setRecentLocationIds(readStoredRecentLocationIds());
  }, []);

  useEffect(() => {
    setRoom((current) => (current ? applyPlayerPalette(current) : current));
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
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
    }, 250);

    return () => window.clearInterval(timer);
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

    const previousStatus = previousRoom?.status ?? null;
    const nextStatus = room?.status ?? null;
    const previousMode = previousRoom?.settings.localMode ?? null;
    const nextMode = room?.settings.localMode ?? null;
    const previousRound = previousRoom?.currentRound ?? null;
    const nextRound = room?.currentRound ?? null;

    const shouldPush =
      (!previousRoom && !!room) ||
      (!!previousRoom && !room) ||
      previousStatus !== nextStatus ||
      previousMode !== nextMode ||
      previousRound !== nextRound;

    writeBrowserHistoryState(room, shouldPush ? "push" : "replace");
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
      adGateUntil: null
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
      adGateUntil: null
    });
    setRoom(nextRoom);
    setError(null);
  }, [playerId]);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    setRoom((current) => {
      if (!current || current.status !== "lobby") return current;
      const nextSettings: GameSettings = {
        ...current.settings,
        ...settings,
        mode: current.kind === "online" ? settings.mode ?? current.settings.mode : "classic",
        timeLimitSec: clampInt(settings.timeLimitSec, current.settings.timeLimitSec, 0, 600),
        rounds: clampInt(settings.rounds, current.settings.rounds, 1),
        localPlayerCount: clampInt(settings.localPlayerCount, current.settings.localPlayerCount, 1, 10)
      };
      if (nextSettings.localMode === "couch" && nextSettings.localPlayerCount < 2) nextSettings.localPlayerCount = 2;
      if (nextSettings.localMode === "solo") nextSettings.localPlayerCount = 1;
      return syncLocalPlayers({ ...current, settings: nextSettings });
    });
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

  const startRound = useCallback(() => {
    setRoom((current) => {
      if (!current || current.status === "guessing") return current;
      if (current.currentRound >= current.settings.rounds) return { ...current, status: "finished" };

      const usedInThisGame = current.summaries.map((summary) => summary.location.id);
      const location = drawLocation(current.settings, uniqueIds([...recentLocationIds, ...usedInThisGame]));
      const roundStartedAt = Date.now();
      setRecentLocationIds((ids) => rememberLocationId(location.id, ids));

      return {
        ...current,
        currentRound: current.currentRound + 1,
        status: "guessing",
        location,
        guesses: [],
        timedOutPlayerIds: [],
        emojiEvents: [],
        roundEndsAt: turnEndFrom(roundStartedAt, current.settings),
        roundStartedAt,
        adGateUntil: null
      };
    });
  }, [drawLocation]);

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
        currentRound:
          current.status === "guessing" && !current.summaries.some((summary) => summary.roundNumber === current.currentRound)
            ? Math.max(0, current.currentRound - 1)
            : current.currentRound
      };
    });
  }, []);

  const skipLocation = useCallback(() => {
    setRoom((current) => {
      if (!current || current.status !== "guessing") return current;
      const nextRecent = current.location
        ? [current.location.id, ...recentLocationIds.filter((item) => item !== current.location?.id)].slice(0, recentLocationLimit)
        : recentLocationIds;
      locationQueueRef.current = locationQueueRef.current.filter((id) => id !== current.location?.id);
      const location = drawLocation(current.settings, nextRecent);
      const roundStartedAt = Date.now();
      setRecentLocationIds((ids) => rememberLocationId(location.id, uniqueIds([...nextRecent, ...ids])));
      return {
        ...current,
        location,
        guesses: [],
        timedOutPlayerIds: [],
        emojiEvents: [],
        roundEndsAt: turnEndFrom(roundStartedAt, current.settings),
        roundStartedAt
      };
    });
  }, [drawLocation, recentLocationIds]);

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
      restart,
      leaveRoom,
      clearError: () => setError(null),
      setTeam,
      unlockCosmetic
    }),
    [cancelRound, createOnlineSetup, createSolo, error, leaveRoom, playerId, renamePlayer, restart, room, setTeam, skipLocation, startRound, submitGuess, unlockCosmetic, updateHostParticipation, updateSettings]
  );
}
