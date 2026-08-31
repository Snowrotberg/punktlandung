import { createServer } from "node:http";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { recordUsageEvent, type UsageEventName, type UsageEvent } from "../lib/usageMetrics.server";
import { builtInLocations, prioritizeCatalogImages } from "../data/locations";
import { averageGuess, countryCodeFromGuess, haversineDistanceKm, scoreDistance } from "../lib/geo";
import { filterLocationsByDifficulty } from "../lib/locationDifficulty";
import { PLAYER_PALETTE } from "../lib/playerPalette";
import { evaluatePlayerGuess } from "../lib/roundEvaluation";
import { captureMatchesRoom, guessFromCapture, onlineSubmissionAuthorized, serverObservedCaptureBeforeDeadline, type GuessCapture } from "../lib/guessCapture";
import type {
  ClientMessage,
  Cosmetic,
  GameSettings,
  GameMode,
  Guess,
  HostParticipation,
  LocalMode,
  LocationCategory,
  Player,
  RoomKind,
  RoomState,
  RoundResult,
  RoundSummary,
  ServerMessage,
  TeamId
} from "../types/game";

type Client = {
  id: string;
  socket: WebSocket;
  roomCode: string | null;
  resumeToken: string;
  messageWindowStartedAt: number;
  messageCount: number;
};

type InternalRoom = RoomState & {
  locationQueue: string[];
  failedLocationIds: string[];
  recentLocationIds: string[];
  duelHp: Record<TeamId, number>;
  createdAt: number;
  lastActivityAt: number;
  resumeTokens: Map<string, string>;
  nextRoundPromptToken: string | null;
  nextRoundPromptLocationId: string | null;
  activePromptToken: string | null;
  pendingGuesses: Map<string, GuessCapture>;
};

type PromptAsset = {
  roomCode: string;
  locationId: string;
  sourceUrl: string;
  expiresAt: number;
  responsePromise?: Promise<{ bytes: ArrayBuffer; contentType: string } | null>;
};

function boundedEnvInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

const PORT = Number(process.env.WS_PORT ?? 3001);
const HOST = process.env.WS_HOST ?? "127.0.0.1";
const MAX_WS_PAYLOAD_BYTES = boundedEnvInteger("WS_MAX_PAYLOAD_BYTES", 32 * 1024, 1024, 1024 * 1024);
const MESSAGE_RATE_WINDOW_MS = boundedEnvInteger("WS_RATE_WINDOW_MS", 10_000, 1_000, 60_000);
const MESSAGE_RATE_LIMIT = boundedEnvInteger("WS_RATE_LIMIT", 80, 5, 500);
const MAX_ACTIVE_ROOMS = boundedEnvInteger("WS_MAX_ACTIVE_ROOMS", 1_000, 1, 10_000);
const MAX_PLAYERS_PER_ROOM = boundedEnvInteger("WS_MAX_PLAYERS_PER_ROOM", 10, 1, 10);
const MAX_CONNECTIONS = boundedEnvInteger("WS_MAX_CONNECTIONS", 5_000, 10, 50_000);
const ROOM_TTL_MS = 1000 * 60 * 60 * 3;
const AD_GATE_MS = 0;
const NEXT_ROUND_COUNTDOWN_MS = 30_000;
const RECENT_ROOM_LOCATION_LIMIT = 300;
const RECENT_GLOBAL_LOCATION_LIMIT = 200;
const FAILED_LOCATION_LIMIT = 80;
const PROMPT_ASSET_TTL_MS = 10 * 60 * 1000;
const PROMPT_FETCH_TIMEOUT_MS = 8_000;
const PROMPT_MAX_BYTES = 18 * 1024 * 1024;
const clients = new Map<string, Client>();
const rooms = new Map<string, InternalRoom>();
const promptAssets = new Map<string, PromptAsset>();
let lastGlobalLocationId: string | null = null;
let recentGlobalLocationIds: string[] = [];
let connectionCapacityWarningActive = false;
let roomCapacityWarningActive = false;
let lastRecordedConnections = -1;
let lastRecordedRooms = -1;

function recordOperationalEvent(event: UsageEventName, details: Omit<UsageEvent, "version" | "at" | "event"> = {}): void {
  void recordUsageEvent(event, details).catch((error) => {
    console.warn(`[metrics] Could not persist ${event}:`, error instanceof Error ? error.message : error);
  });
}

const allowedOrigins = new Set(
  (process.env.WS_ALLOWED_ORIGINS ??
    "https://punktlandung.app,https://www.punktlandung.app,http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

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
  difficulty: "easy"
};

const playerColors = PLAYER_PALETTE;

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function resumeToken(): string {
  return randomBytes(32).toString("hex");
}

function resumeTokenMatches(expected: string | undefined, supplied: string): boolean {
  if (!expected || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function sanitizeName(input: string): string {
  const trimmed = input.replace(/[^\p{L}\p{N}\s_.-]/gu, "").trim();
  return trimmed.slice(0, 18) || "Gast";
}

function clampInt(input: number | undefined, fallback: number, min: number, max?: number): number {
  const rounded = Math.round(Number(input ?? fallback));
  if (!Number.isFinite(rounded)) return fallback;
  const lowerBounded = Math.max(min, rounded);
  return max === undefined ? lowerBounded : Math.min(max, lowerBounded);
}

function makePlayer(clientId: string, name: string, isHost: boolean, index: number, localOnly = false): Player {
  return {
    id: clientId,
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

function publicRoom(room: InternalRoom): RoomState {
  const activeLocation = room.location && room.activePromptToken
    ? { ...room.location, deliveryUrl: `/api/online-prompt/${room.activePromptToken}` }
    : room.location;
  return {
    code: room.code,
    kind: room.kind,
    hostId: room.hostId,
    hostParticipation: room.hostParticipation,
    hostPlayerName: room.hostPlayerName,
    status: room.status,
    settings: room.settings,
    players: room.players,
    currentRound: room.currentRound,
    location: room.status === "lobby" || room.status === "finished" ? null : activeLocation,
    guesses: room.status === "results" ? room.guesses : room.guesses.map((guess) => ({ ...guess, lat: 0, lng: 0 })),
    timedOutPlayerIds: room.timedOutPlayerIds,
    roundEndsAt: room.roundEndsAt,
    roundStartedAt: room.roundStartedAt,
    summaries: room.summaries,
    emojiEvents: room.emojiEvents.slice(-30),
    adGateUntil: room.adGateUntil,
    nextRoundReadyPlayerIds: room.nextRoundReadyPlayerIds,
    nextRoundStartsAt: room.nextRoundStartsAt,
    nextRoundPreviewUrl: room.status === "results" && room.nextRoundPromptToken
      ? `/api/online-prompt/${room.nextRoundPromptToken}`
      : null
  };
}

function send(client: Client, message: ServerMessage): void {
  if (client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(message));
  }
}

function broadcast(room: InternalRoom): void {
  room.lastActivityAt = Date.now();
  const payload: ServerMessage = { type: "room_state", state: publicRoom(room) };
  for (const client of clients.values()) {
    if (client.roomCode === room.code) send(client, payload);
  }
}

function sendError(client: Client, message: string): void {
  send(client, { type: "error", message });
}

function capacitySnapshot() {
  const connectionUtilization = clients.size / MAX_CONNECTIONS;
  const roomUtilization = rooms.size / MAX_ACTIVE_ROOMS;
  return {
    status: connectionUtilization >= 1 || roomUtilization >= 1 ? "full" : connectionUtilization >= 0.8 || roomUtilization >= 0.8 ? "warning" : "ok",
    connections: {
      active: clients.size,
      limit: MAX_CONNECTIONS,
      utilizationPercent: Math.round(connectionUtilization * 10_000) / 100
    },
    rooms: {
      active: rooms.size,
      limit: MAX_ACTIVE_ROOMS,
      utilizationPercent: Math.round(roomUtilization * 10_000) / 100
    },
    playersPerRoomLimit: MAX_PLAYERS_PER_ROOM
  };
}

function reportCapacityWarnings(): void {
  const snapshot = capacitySnapshot();
  const connectionsWarning = snapshot.connections.utilizationPercent >= 80;
  const roomsWarning = snapshot.rooms.utilizationPercent >= 80;
  if (connectionsWarning && !connectionCapacityWarningActive) {
    console.warn(`[capacity] WebSocket connections at ${snapshot.connections.utilizationPercent}% (${snapshot.connections.active}/${snapshot.connections.limit}).`);
  }
  if (roomsWarning && !roomCapacityWarningActive) {
    console.warn(`[capacity] Active rooms at ${snapshot.rooms.utilizationPercent}% (${snapshot.rooms.active}/${snapshot.rooms.limit}).`);
  }
  connectionCapacityWarningActive = connectionsWarning;
  roomCapacityWarningActive = roomsWarning;
  if (clients.size !== lastRecordedConnections || rooms.size !== lastRecordedRooms) {
    lastRecordedConnections = clients.size;
    lastRecordedRooms = rooms.size;
    recordOperationalEvent("capacity_sample", { connections: clients.size, rooms: rooms.size });
  }
}

function findRoomFor(client: Client): InternalRoom | null {
  return client.roomCode ? rooms.get(client.roomCode) ?? null : null;
}

function requireHost(client: Client, room: InternalRoom): boolean {
  if (room.hostId !== client.id) {
    sendError(client, "Nur der Host kann diese Aktion auslösen.");
    return false;
  }
  return true;
}

function shuffledLocationIds(
  category: GameSettings["category"],
  difficulty: GameSettings["difficulty"],
  blockedIds: string[] = [],
  avoidIds: string[] = []
): string[] {
  const pool = category === "mixed" ? builtInLocations : builtInLocations.filter((location) => location.category === category);
  const categoryPool = pool.length > 0 ? pool : builtInLocations;
  const sourceBase = filterLocationsByDifficulty(categoryPool, difficulty);
  const blocked = new Set(blockedIds);
  const avoided = new Set(avoidIds);
  const available = sourceBase.filter((location) => !blocked.has(location.id));
  const notRecentlyUsed = available.filter((location) => !avoided.has(location.id));
  const source = notRecentlyUsed.length > 0 ? notRecentlyUsed : available.length > 0 ? available : sourceBase;
  const globallyFresh = source.filter((location) => !recentGlobalLocationIds.includes(location.id));
  const ids = prioritizeCatalogImages(globallyFresh.length > 0 ? globallyFresh : source).map((location) => location.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  if (ids.length > 1 && ids[0] === lastGlobalLocationId) {
    const swapIndex = 1 + randomInt(ids.length - 1);
    [ids[0], ids[swapIndex]] = [ids[swapIndex], ids[0]];
  }
  return ids;
}

function ensureLocationQueue(room: InternalRoom): void {
  if (room.locationQueue.length === 0) {
    room.locationQueue = shuffledLocationIds(room.settings.category, room.settings.difficulty, room.failedLocationIds, room.recentLocationIds);
  }
}

function nextLocation(room: InternalRoom) {
  ensureLocationQueue(room);
  if (room.location && room.locationQueue.length > 1 && room.locationQueue[0] === room.location.id) {
    const swapIndex = 1 + randomInt(room.locationQueue.length - 1);
    [room.locationQueue[0], room.locationQueue[swapIndex]] = [room.locationQueue[swapIndex], room.locationQueue[0]];
  }
  const nextId = room.locationQueue.shift() ?? builtInLocations[0].id;
  lastGlobalLocationId = nextId;
  recentGlobalLocationIds = [nextId, ...recentGlobalLocationIds.filter((id) => id !== nextId)].slice(0, RECENT_GLOBAL_LOCATION_LIMIT);
  room.recentLocationIds = [nextId, ...room.recentLocationIds.filter((id) => id !== nextId)].slice(0, RECENT_ROOM_LOCATION_LIMIT);
  return builtInLocations.find((location) => location.id === nextId) ?? builtInLocations[0];
}

function prepareNextRoundPrompt(room: InternalRoom): void {
  if (room.kind !== "online" || room.status !== "results" || room.currentRound >= room.settings.rounds) return;
  ensureLocationQueue(room);
  const location = builtInLocations.find((candidate) => candidate.id === room.locationQueue[0]);
  if (!location) return;
  const token = randomBytes(24).toString("base64url");
  promptAssets.set(token, {
    roomCode: room.code,
    locationId: location.id,
    sourceUrl: location.panoramaUrl,
    expiresAt: Date.now() + PROMPT_ASSET_TTL_MS
  });
  room.nextRoundPromptToken = token;
  room.nextRoundPromptLocationId = location.id;
}

function activePlayers(room: InternalRoom): Player[] {
  return room.players.filter((player) => player.connected && player.status === "active");
}

function resetNextRoundGate(room: InternalRoom): void {
  room.nextRoundReadyPlayerIds = [];
  room.nextRoundStartsAt = null;
}

function markNextRoundReady(room: InternalRoom, playerId: string): void {
  if (!room.nextRoundReadyPlayerIds.includes(playerId)) room.nextRoundReadyPlayerIds.push(playerId);
}

function allActivePlayersReady(room: InternalRoom): boolean {
  const activeIds = activePlayers(room).map((player) => player.id);
  return activeIds.length > 0 && activeIds.every((playerId) => room.nextRoundReadyPlayerIds.includes(playerId));
}

function syncLocalPlayers(room: InternalRoom): void {
  if (room.kind !== "solo") return;
  const host = room.players.find((player) => player.id === room.hostId) ?? room.players.find((player) => !player.localOnly);
  if (!host) return;
  host.connected = true;
  host.localOnly = false;
  host.isHost = true;

  const count = room.settings.localMode === "couch" ? Math.max(2, Math.min(10, room.settings.localPlayerCount)) : 1;
  const localPlayers = Array.from({ length: count - 1 }, (_, index) =>
    makePlayer(`local_${room.code}_${index + 2}`, `Spieler ${index + 2}`, false, index + 1, true)
  );
  const nextPlayers = [host, ...localPlayers];
  const nextPlayerIds = new Set(nextPlayers.map((player) => player.id));
  room.players = nextPlayers;
  room.guesses = room.guesses.filter((guess) => nextPlayerIds.has(guess.playerId));
  room.pendingGuesses = new Map([...room.pendingGuesses].filter(([playerId]) => nextPlayerIds.has(playerId)));
  room.timedOutPlayerIds = room.timedOutPlayerIds.filter((id) => nextPlayerIds.has(id));
}

function createRoom(client: Client, playerName: string | undefined, kind: RoomKind, hostParticipation?: HostParticipation): void {
  if (findRoomFor(client)) {
    sendError(client, "Bitte verlasse zuerst deinen aktuellen Raum.");
    return;
  }
  if (rooms.size >= MAX_ACTIVE_ROOMS) {
    sendError(client, "Der Server ist momentan ausgelastet. Bitte versuche es gleich noch einmal.");
    return;
  }
  const code = roomCode();
  const normalizedHostParticipation: HostParticipation =
    kind === "online" ? hostParticipation ?? "host_only" : "host_player";
  const normalizedHostPlayerName = sanitizeName(playerName ?? "Host");
  const player = makePlayer(client.id, normalizedHostPlayerName, true, 0);
  const players = kind === "online" && normalizedHostParticipation === "host_only" ? [] : [player];
  const room: InternalRoom = {
    code,
    kind,
    hostId: client.id,
    hostParticipation: normalizedHostParticipation,
    hostPlayerName: normalizedHostParticipation === "host_player" ? normalizedHostPlayerName : undefined,
    status: "lobby",
    settings: { ...defaultSettings, mode: kind === "solo" || kind === "online" ? "classic" : defaultSettings.mode },
    players,
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
    nextRoundStartsAt: null,
    locationQueue: [],
    failedLocationIds: [],
    recentLocationIds: [],
    duelHp: { aurora: 20000, pulse: 20000 },
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    resumeTokens: new Map([[client.id, client.resumeToken]]),
    nextRoundPromptToken: null,
    nextRoundPromptLocationId: null,
    activePromptToken: null,
    pendingGuesses: new Map()
  };
  syncLocalPlayers(room);
  rooms.set(code, room);
  client.roomCode = code;
  recordOperationalEvent("room_created", { gameType: kind === "online" ? "online" : kind === "party" ? "party" : "solo" });
  reportCapacityWarnings();
  broadcast(room);
}

function joinRoom(client: Client, codeInput: string, playerName: string): void {
  const code = codeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const room = rooms.get(code);
  if (!room) {
    sendError(client, "Diesen Raum gibt es nicht mehr.");
    return;
  }
  const existing = room.players.find((player) => player.id === client.id);
  if (!existing && room.players.filter((player) => !player.localOnly).length >= MAX_PLAYERS_PER_ROOM) {
    sendError(client, "Dieser Raum ist bereits voll.");
    return;
  }
  if (existing) {
    existing.name = sanitizeName(playerName);
    existing.connected = true;
  } else {
    room.players.push(makePlayer(client.id, playerName, false, room.players.length));
  }
  room.resumeTokens.set(client.id, client.resumeToken);
  client.roomCode = code;
  recordOperationalEvent("room_joined", { gameType: "online" });
  broadcast(room);
}

function replacePlayerId(room: InternalRoom, previousPlayerId: string, nextPlayerId: string, nextResumeToken: string): void {
  if (previousPlayerId === nextPlayerId) return;
  const player = room.players.find((candidate) => candidate.id === previousPlayerId);
  if (player) {
    room.players = room.players.filter((candidate) => candidate.id !== nextPlayerId);
    player.id = nextPlayerId;
    player.connected = true;
  }
  room.guesses = room.guesses.map((guess) => (guess.playerId === previousPlayerId ? { ...guess, playerId: nextPlayerId } : guess));
  const pendingGuess = room.pendingGuesses.get(previousPlayerId);
  room.pendingGuesses.delete(previousPlayerId);
  if (pendingGuess) room.pendingGuesses.set(nextPlayerId, { ...pendingGuess, playerId: nextPlayerId });
  room.timedOutPlayerIds = room.timedOutPlayerIds.map((id) => (id === previousPlayerId ? nextPlayerId : id));
  room.nextRoundReadyPlayerIds = room.nextRoundReadyPlayerIds.map((id) => (id === previousPlayerId ? nextPlayerId : id));
  room.summaries = room.summaries.map((summary) => ({
    ...summary,
    results: summary.results.map((result) => ({
      ...result,
      playerId: result.playerId === previousPlayerId ? nextPlayerId : result.playerId,
      guess: result.guess?.playerId === previousPlayerId ? { ...result.guess, playerId: nextPlayerId } : result.guess
    }))
  }));
  room.resumeTokens.delete(previousPlayerId);
  room.resumeTokens.set(nextPlayerId, nextResumeToken);
}

function resumeRoom(client: Client, codeInput: string, previousPlayerId: string, suppliedResumeToken: string): void {
  const code = codeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const room = rooms.get(code);
  if (!room || room.kind !== "online") {
    sendError(client, "Die Sitzung konnte nicht wiederhergestellt werden.");
    return;
  }
  const isHostResume = room.hostId === previousPlayerId;
  const isKnownPlayer = room.players.some((player) => player.id === previousPlayerId);
  if (!isHostResume && !isKnownPlayer) {
    sendError(client, "Die Sitzung konnte nicht wiederhergestellt werden.");
    return;
  }
  if (!resumeTokenMatches(room.resumeTokens.get(previousPlayerId), suppliedResumeToken)) {
    sendError(client, "Die Sitzung konnte nicht wiederhergestellt werden.");
    return;
  }

  replacePlayerId(room, previousPlayerId, client.id, client.resumeToken);
  if (isHostResume) {
    room.hostId = client.id;
    for (const player of room.players) player.isHost = player.id === room.hostId;
  }
  client.roomCode = code;
  broadcast(room);
}

function leaveRoom(client: Client): void {
  const room = findRoomFor(client);
  if (!room) {
    send(client, { type: "left_room" });
    return;
  }
  room.players = room.players.filter((player) => player.id !== client.id);
  room.resumeTokens.delete(client.id);
  room.guesses = room.guesses.filter((guess) => guess.playerId !== client.id);
  room.pendingGuesses.delete(client.id);
  room.nextRoundReadyPlayerIds = room.nextRoundReadyPlayerIds.filter((playerId) => playerId !== client.id);
  client.roomCode = null;
  send(client, { type: "left_room" });

  if (room.kind === "online" && room.hostId === client.id) {
    rooms.delete(room.code);
    return;
  }

  if (room.kind !== "online" && room.players.filter((player) => !player.localOnly).length === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === client.id) {
    const nextHost = room.players.find((player) => !player.localOnly) ?? room.players[0];
    room.hostId = nextHost.id;
    for (const player of room.players) player.isHost = player.id === room.hostId;
  }

  if (room.status === "guessing" && activePlayers(room).length === 0) {
    room.status = "lobby";
    room.location = null;
    room.roundEndsAt = null;
    room.roundStartedAt = null;
    room.guesses = [];
    room.pendingGuesses.clear();
    room.timedOutPlayerIds = [];
    resetNextRoundGate(room);
  }

  if (room.kind === "online" && room.status === "results" && allActivePlayersReady(room)) {
    startRoundNow(room);
    return;
  }

  broadcast(room);
}

function startRound(client: Client, room: InternalRoom): void {
  if (!requireHost(client, room)) return;
  if (room.status === "guessing") return;
  if (room.adGateUntil && Date.now() < room.adGateUntil) {
    sendError(client, "Die Interstitial-Pause läuft noch.");
    return;
  }
  if (room.currentRound >= room.settings.rounds) {
    room.status = "finished";
    resetNextRoundGate(room);
    broadcast(room);
    return;
  }
  if (room.kind === "online" && room.status === "results") {
    markNextRoundReady(room, client.id);
    if (allActivePlayersReady(room)) {
      startRoundNow(room);
      return;
    }
    room.nextRoundStartsAt = room.nextRoundStartsAt ?? Date.now() + NEXT_ROUND_COUNTDOWN_MS;
    broadcast(room);
    return;
  }
  startRoundNow(room);
}

function startRoundNow(room: InternalRoom): void {
  room.currentRound += 1;
  room.status = "guessing";
  room.location = nextLocation(room);
  room.activePromptToken = room.nextRoundPromptLocationId === room.location.id ? room.nextRoundPromptToken : null;
  room.nextRoundPromptToken = null;
  room.nextRoundPromptLocationId = null;
  room.guesses = [];
  room.pendingGuesses.clear();
  room.timedOutPlayerIds = [];
  room.emojiEvents = [];
  // The host starts the clock with image_ready only after the prompt has
  // actually loaded. Slow Wikimedia responses must not consume guessing time.
  room.roundEndsAt = null;
  room.roundStartedAt = null;
  room.adGateUntil = null;
  resetNextRoundGate(room);
  broadcast(room);
}

function readyNextRound(client: Client, room: InternalRoom): void {
  if (room.kind !== "online" || room.status !== "results") return;
  const player = room.players.find((candidate) => candidate.id === client.id && candidate.connected && candidate.status === "active");
  if (!player) return;
  markNextRoundReady(room, client.id);
  if (allActivePlayersReady(room)) {
    startRoundNow(room);
    return;
  }
  broadcast(room);
}

function skipLocation(client: Client, room: InternalRoom, locationId?: string): void {
  if (!requireHost(client, room) || room.status !== "guessing") return;
  if (locationId && room.location?.id !== locationId) return;
  if (room.location) {
    const failedId = room.location.id;
    room.failedLocationIds = [failedId, ...room.failedLocationIds.filter((id) => id !== failedId)].slice(0, FAILED_LOCATION_LIMIT);
    room.locationQueue = room.locationQueue.filter((id) => id !== failedId);
  }
  room.location = nextLocation(room);
  room.activePromptToken = null;
  room.guesses = [];
  room.pendingGuesses.clear();
  room.timedOutPlayerIds = [];
  room.emojiEvents = [];
  room.roundEndsAt = null;
  room.roundStartedAt = null;
  broadcast(room);
}

function markLocationReady(client: Client, room: InternalRoom, locationId: string, ready: boolean): void {
  if (!requireHost(client, room) || room.status !== "guessing" || room.location?.id !== locationId) return;
  if (!ready) {
    if (room.roundStartedAt || room.roundEndsAt) {
      room.roundStartedAt = null;
      room.roundEndsAt = null;
      broadcast(room);
    }
    return;
  }
  if (room.roundStartedAt) return;
  const roundStartedAt = Date.now();
  room.roundStartedAt = roundStartedAt;
  room.roundEndsAt = room.settings.timeLimitSec > 0 ? roundStartedAt + room.settings.timeLimitSec * 1000 : null;
  broadcast(room);
}

function evaluateRound(room: InternalRoom): void {
  if (!room.location || room.status !== "guessing") return;
  for (const capture of room.pendingGuesses.values()) {
    if (!captureMatchesRoom(room, capture)) continue;
    room.guesses = room.guesses.filter((guess) => guess.playerId !== capture.playerId).concat(guessFromCapture(capture));
  }
  room.pendingGuesses.clear();
  const location = room.location;
  const guessesByPlayer = new Map(room.guesses.map((guess) => [guess.playerId, guess]));
  const contenders = room.players.filter((player) => player.status === "active");
  const evaluated = contenders.map((player): RoundResult =>
    evaluatePlayerGuess(player.id, location, guessesByPlayer.get(player.id) ?? null)
  );

  if (room.settings.mode === "elimination" && evaluated.length > 1) {
    const wrongCountry = evaluated.filter((result) => {
      if (room.location?.category === "flags" && result.countryCorrect) return false;
      const guessCountry = result.guess?.countryCode ?? (result.guess ? countryCodeFromGuess(result.guess) : undefined);
      return guessCountry !== undefined && guessCountry !== location.countryCode;
    });
    const pool = wrongCountry.length > 0 ? wrongCountry : evaluated;
    const loser = [...pool].sort((a, b) => b.distanceKm - a.distanceKm)[0];
    loser.eliminated = true;
    const player = room.players.find((candidate) => candidate.id === loser.playerId);
    if (player) player.status = "eliminated";
  }

  if (room.settings.mode === "classic" || room.settings.mode === "elimination") {
    for (const result of evaluated) {
      const player = room.players.find((candidate) => candidate.id === result.playerId);
      if (player) player.score += result.points;
    }
  }

  const successfulGuesses = room.guesses.filter((guess) => contenders.some((player) => player.id === guess.playerId));
  const crewGuess = room.settings.mode === "crew" ? averageGuess(successfulGuesses) : null;
  const crewDistanceKm = crewGuess ? haversineDistanceKm(crewGuess, location) : null;
  if (room.settings.mode === "crew" && crewDistanceKm !== null) {
    const teamPoints = scoreDistance(crewDistanceKm);
    for (const player of contenders) player.score += teamPoints;
  }

  const duel = (["aurora", "pulse"] as TeamId[]).map((team) => {
    const teamGuesses = successfulGuesses.filter((guess) => room.players.find((player) => player.id === guess.playerId)?.team === team);
    const teamDistances = teamGuesses.map((guess) => haversineDistanceKm(guess, location));
    const averageDistanceKm =
      teamDistances.length > 0 ? teamDistances.reduce((sum, value) => sum + value, 0) / teamDistances.length : 2500;
    if (room.settings.mode === "duel") {
      room.duelHp[team] = Math.max(0, Math.round(room.duelHp[team] - averageDistanceKm));
      const teamScore = Math.max(0, Math.round(5000 - averageDistanceKm));
      for (const player of room.players.filter((candidate) => candidate.team === team)) player.score += teamScore;
    }
    return { team, averageDistanceKm, hp: room.duelHp[team] };
  });

  const summary: RoundSummary = {
    roundNumber: room.currentRound,
    location,
    results: evaluated.sort((a, b) => b.points - a.points),
    crewGuess,
    crewDistanceKm,
    duel,
    completedAt: Date.now(),
    roundStartedAt: room.roundStartedAt ?? undefined
  };
  room.summaries.push(summary);
  room.status = room.currentRound >= room.settings.rounds ? "finished" : "results";
  room.roundEndsAt = null;
  room.roundStartedAt = null;
  room.timedOutPlayerIds = [];
  room.adGateUntil = room.status === "results" && AD_GATE_MS > 0 ? Date.now() + AD_GATE_MS : null;
  resetNextRoundGate(room);
  if (room.status === "results") prepareNextRoundPrompt(room);
  broadcast(room);
}

function submitGuess(client: Client, room: InternalRoom, input: { lat: number; lng: number }, countryCode?: string, playerId?: string): void {
  const targetPlayerId = room.kind === "solo" && playerId && requireHost(client, room) ? playerId : client.id;
  const player = room.players.find((candidate) => candidate.id === targetPlayerId);
  if (!player || player.status !== "active" || room.status !== "guessing" || !room.roundStartedAt) return;
  const pending = room.pendingGuesses.get(targetPlayerId);
  const validPending = pending && captureMatchesRoom(room, pending, targetPlayerId) ? pending : null;
  const guessedAt = Date.now();
  if (!onlineSubmissionAuthorized(room.roundEndsAt, guessedAt, Boolean(validPending))) return;
  const guess: Guess = validPending
    ? guessFromCapture({ ...validPending, point: { ...validPending.point, countryCode: countryCode ?? validPending.point.countryCode } })
    : {
        playerId: targetPlayerId,
        lat: Math.max(-85, Math.min(85, input.lat)),
        lng: Math.max(-180, Math.min(180, input.lng)),
        countryCode,
        createdAt: guessedAt,
        responseTimeMs: room.roundStartedAt ? Math.max(0, guessedAt - room.roundStartedAt) : undefined
      };
  room.pendingGuesses.delete(targetPlayerId);
  room.guesses = room.guesses.filter((existing) => existing.playerId !== targetPlayerId).concat(guess);
  room.timedOutPlayerIds = room.timedOutPlayerIds.filter((id) => id !== targetPlayerId);
  if (activePlayers(room).every((active) => room.guesses.some((existing) => existing.playerId === active.id) || room.timedOutPlayerIds.includes(active.id))) {
    evaluateRound(room);
  } else {
    broadcast(room);
  }
}

function captureGuess(client: Client, room: InternalRoom, capture: GuessCapture, receivedAt: number): void {
  const targetPlayerId = room.kind === "solo" && capture.playerId && requireHost(client, room) ? capture.playerId : client.id;
  const normalized = { ...capture, playerId: targetPlayerId };
  const player = room.players.find((candidate) => candidate.id === targetPlayerId);
  if (!player || player.status !== "active") return;
  if (!captureMatchesRoom(room, normalized, targetPlayerId)) return;
  if (!serverObservedCaptureBeforeDeadline(normalized.roundStartedAt, normalized.roundEndsAt, receivedAt)) return;
  room.pendingGuesses.set(targetPlayerId, { ...normalized, capturedAt: receivedAt, capturedAtMonotonic: receivedAt });
}

function updateSettings(client: Client, room: InternalRoom, patch: Partial<GameSettings>): void {
  if (!requireHost(client, room) || room.status !== "lobby") return;
  const previousCategory = room.settings.category;
  const previousDifficulty = room.settings.difficulty;
  room.settings = {
    ...room.settings,
    ...patch,
    timeLimitSec: clampInt(patch.timeLimitSec, room.settings.timeLimitSec, 0, 600),
    rounds: clampInt(patch.rounds, room.settings.rounds, 1, 100),
    localPlayerCount: clampInt(patch.localPlayerCount, room.settings.localPlayerCount, 1, 10)
  };
  if (room.kind === "solo") {
    room.settings.mode = "classic";
    if (room.settings.localMode === "couch" && room.settings.localPlayerCount < 2) room.settings.localPlayerCount = 2;
    if (room.settings.localMode === "solo") room.settings.localPlayerCount = 1;
    syncLocalPlayers(room);
  }
  if ((patch.category && patch.category !== previousCategory) || (patch.difficulty && patch.difficulty !== previousDifficulty)) {
    room.locationQueue = [];
    room.failedLocationIds = [];
    room.recentLocationIds = [];
  }
  broadcast(room);
}

const gameModes = new Set<GameMode>(["classic", "crew", "elimination", "duel"]);
const localModes = new Set<LocalMode>(["solo", "couch"]);
const locationCategories = new Set<LocationCategory>([
  "mixed",
  "landmarks",
  "cities",
  "landscapes",
  "flags",
  "capitals",
  "streetview"
]);
const gameDifficulties = new Set<GameSettings["difficulty"]>(["mixed", "easy", "medium", "hard"]);
const hostParticipations = new Set<HostParticipation>(["host_player", "host_only"]);
const teams = new Set<TeamId>(["aurora", "pulse"]);
const unlockableCosmetics = new Set<Cosmetic>(["crown", "visor", "halo", "neon-frame"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isShortString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatedSettingsPatch(value: unknown): Partial<GameSettings> | null {
  if (!isRecord(value)) return null;
  const patch: Partial<GameSettings> = {};
  if (value.mode !== undefined) {
    if (typeof value.mode !== "string" || !gameModes.has(value.mode as GameMode)) return null;
    patch.mode = value.mode as GameMode;
  }
  if (value.localMode !== undefined) {
    if (typeof value.localMode !== "string" || !localModes.has(value.localMode as LocalMode)) return null;
    patch.localMode = value.localMode as LocalMode;
  }
  for (const key of ["localPlayerCount", "timeLimitSec", "rounds"] as const) {
    if (value[key] !== undefined) {
      if (!isFiniteNumber(value[key])) return null;
      patch[key] = value[key];
    }
  }
  for (const key of ["noMove", "noPan", "noZoom"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "boolean") return null;
      patch[key] = value[key];
    }
  }
  if (value.mapPackId !== undefined) {
    if (!isShortString(value.mapPackId, 80)) return null;
    patch.mapPackId = value.mapPackId;
  }
  if (value.category !== undefined) {
    if (typeof value.category !== "string" || !locationCategories.has(value.category as LocationCategory)) return null;
    patch.category = value.category as LocationCategory;
  }
  if (value.difficulty !== undefined) {
    if (typeof value.difficulty !== "string" || !gameDifficulties.has(value.difficulty as GameSettings["difficulty"])) return null;
    patch.difficulty = value.difficulty as GameSettings["difficulty"];
  }
  return patch;
}

function validatedClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value) || !isShortString(value.type, 40)) return null;
  switch (value.type) {
    case "create_room":
    case "create_solo":
      return isShortString(value.playerName, 100) ? { type: value.type, playerName: value.playerName } : null;
    case "create_online_room": {
      if (value.playerName !== undefined && !isShortString(value.playerName, 100)) return null;
      if (
        value.hostParticipation !== undefined &&
        (typeof value.hostParticipation !== "string" || !hostParticipations.has(value.hostParticipation as HostParticipation))
      ) return null;
      return {
        type: value.type,
        playerName: value.playerName as string | undefined,
        hostParticipation: value.hostParticipation as HostParticipation | undefined
      };
    }
    case "resume_room":
      return isShortString(value.code, 12) &&
        isShortString(value.previousPlayerId, 128) &&
        typeof value.resumeToken === "string" &&
        /^[a-f0-9]{64}$/i.test(value.resumeToken)
        ? { type: value.type, code: value.code, previousPlayerId: value.previousPlayerId, resumeToken: value.resumeToken }
        : null;
    case "join_room":
      return isShortString(value.code, 12) && isShortString(value.playerName, 100)
        ? { type: value.type, code: value.code, playerName: value.playerName }
        : null;
    case "update_settings": {
      const settings = validatedSettingsPatch(value.settings);
      return settings ? { type: value.type, settings } : null;
    }
    case "capture_guess": {
      if (!hasOnlyKeys(value, ["type", "guess", "countryCode", "playerId", "roundNumber", "locationId", "roundStartedAt", "roundEndsAt"])) return null;
      if (!isRecord(value.guess) || !isFiniteNumber(value.guess.lat) || !isFiniteNumber(value.guess.lng)) return null;
      if (value.countryCode !== undefined && !isShortString(value.countryCode, 8)) return null;
      if (value.playerId !== undefined && !isShortString(value.playerId, 128)) return null;
      if (!Number.isInteger(value.roundNumber) || !isShortString(value.locationId, 128)) return null;
      if (!isFiniteNumber(value.roundStartedAt) || !(value.roundEndsAt === null || isFiniteNumber(value.roundEndsAt))) return null;
      return {
        type: value.type,
        guess: { lat: value.guess.lat, lng: value.guess.lng },
        countryCode: typeof value.countryCode === "string" ? value.countryCode.toUpperCase() : undefined,
        playerId: value.playerId as string | undefined,
        roundNumber: value.roundNumber as number,
        locationId: value.locationId,
        roundStartedAt: value.roundStartedAt,
        roundEndsAt: value.roundEndsAt
      };
    }
    case "submit_guess": {
      if (!isRecord(value.guess) || !isFiniteNumber(value.guess.lat) || !isFiniteNumber(value.guess.lng)) return null;
      if (value.countryCode !== undefined && !isShortString(value.countryCode, 8)) return null;
      if (value.playerId !== undefined && !isShortString(value.playerId, 128)) return null;
      return {
        type: value.type,
        guess: { lat: value.guess.lat, lng: value.guess.lng },
        countryCode: typeof value.countryCode === "string" ? value.countryCode.toUpperCase() : undefined,
        playerId: value.playerId as string | undefined
      };
    }
    case "send_emoji":
      return isShortString(value.emoji, 16) && isFiniteNumber(value.x)
        ? { type: value.type, emoji: value.emoji, x: value.x }
        : null;
    case "unlock_cosmetic":
      return typeof value.cosmetic === "string" && unlockableCosmetics.has(value.cosmetic as Cosmetic)
        ? { type: value.type, cosmetic: value.cosmetic as Cosmetic }
        : null;
    case "set_team":
      return typeof value.team === "string" && teams.has(value.team as TeamId)
        ? { type: value.type, team: value.team as TeamId }
        : null;
    case "skip_location":
      return value.locationId === undefined || isShortString(value.locationId, 128)
        ? { type: value.type, locationId: value.locationId as string | undefined }
        : null;
    case "image_ready":
      return isShortString(value.locationId, 128) && typeof value.ready === "boolean"
        ? { type: value.type, locationId: value.locationId, ready: value.ready }
        : null;
    case "start_round":
    case "ready_next_round":
    case "cancel_round":
    case "leave_room":
    case "restart":
      return { type: value.type };
    default:
      return null;
  }
}

function handleMessage(client: Client, raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendError(client, "Die Nachricht war kein gültiges JSON.");
    return;
  }
  const message = validatedClientMessage(parsed);
  if (!message) {
    sendError(client, "Die Nachricht hatte kein gültiges Format.");
    return;
  }

  if (message.type === "create_room") {
    createRoom(client, message.playerName, "party");
    return;
  }
  if (message.type === "create_online_room") {
    createRoom(client, message.playerName, "online", message.hostParticipation);
    return;
  }
  if (message.type === "resume_room") {
    resumeRoom(client, message.code, message.previousPlayerId, message.resumeToken);
    return;
  }
  if (message.type === "create_solo") {
    createRoom(client, message.playerName, "solo");
    return;
  }
  if (message.type === "join_room") {
    joinRoom(client, message.code, message.playerName);
    return;
  }
  if (message.type === "leave_room") {
    leaveRoom(client);
    return;
  }

  const room = findRoomFor(client);
  if (!room) {
    sendError(client, "Du bist in keinem Raum.");
    return;
  }

  switch (message.type) {
    case "update_settings":
      updateSettings(client, room, message.settings);
      break;
    case "start_round":
      startRound(client, room);
      break;
    case "ready_next_round":
      readyNextRound(client, room);
      break;
    case "capture_guess": {
      const receivedAt = Date.now();
      captureGuess(client, room, {
        point: { ...message.guess, countryCode: message.countryCode },
        playerId: message.playerId ?? client.id,
        roundNumber: message.roundNumber,
        locationId: message.locationId,
        roundStartedAt: message.roundStartedAt,
        roundEndsAt: message.roundEndsAt,
        capturedAt: receivedAt,
        capturedAtMonotonic: 0
      }, receivedAt);
      break;
    }
    case "submit_guess":
      submitGuess(client, room, message.guess, message.countryCode, message.playerId);
      break;
    case "send_emoji":
      room.emojiEvents.push({
        id: id("emoji"),
        playerId: client.id,
        emoji: message.emoji.slice(0, 4),
        x: Math.max(5, Math.min(95, message.x)),
        createdAt: Date.now()
      });
      broadcast(room);
      break;
    case "unlock_cosmetic": {
      const player = room.players.find((candidate) => candidate.id === client.id);
      if (player) player.cosmetic = message.cosmetic;
      broadcast(room);
      break;
    }
    case "set_team": {
      const player = room.players.find((candidate) => candidate.id === client.id);
      if (player) player.team = message.team;
      broadcast(room);
      break;
    }
    case "cancel_round":
      if (!requireHost(client, room)) return;
      if (room.status === "guessing" || room.status === "results") {
        room.status = "lobby";
        room.location = null;
        room.guesses = [];
        room.pendingGuesses.clear();
        room.timedOutPlayerIds = [];
        room.roundEndsAt = null;
        room.roundStartedAt = null;
        room.adGateUntil = null;
        resetNextRoundGate(room);
        const lastSummary = room.summaries.at(-1);
        if (!lastSummary || lastSummary.roundNumber !== room.currentRound) {
          room.currentRound = Math.max(0, room.currentRound - 1);
        }
        broadcast(room);
      }
      break;
    case "skip_location":
      skipLocation(client, room, message.locationId);
      break;
    case "image_ready":
      markLocationReady(client, room, message.locationId, message.ready);
      break;
    case "restart":
      if (!requireHost(client, room)) return;
      room.status = "lobby";
      room.currentRound = 0;
      room.location = null;
      room.guesses = [];
      room.pendingGuesses.clear();
      room.timedOutPlayerIds = [];
      room.roundEndsAt = null;
      room.roundStartedAt = null;
      room.summaries = [];
      room.adGateUntil = null;
      resetNextRoundGate(room);
      room.locationQueue = [];
      room.failedLocationIds = [];
      room.recentLocationIds = [];
      room.duelHp = { aurora: 20000, pulse: 20000 };
      for (const player of room.players) {
        player.score = 0;
        player.status = "active";
      }
      broadcast(room);
      break;
  }
}

function promptImageUrl(sourceUrl: string): string {
  try {
    const source = new URL(sourceUrl);
    if (source.hostname !== "commons.wikimedia.org" && source.hostname !== "upload.wikimedia.org") return sourceUrl;
    const prefixes = ["/wiki/Special:FilePath/", "/wiki/Special:Redirect/file/"];
    const prefix = prefixes.find((candidate) => source.pathname.startsWith(candidate));
    const rawFile = prefix
      ? source.pathname.slice(prefix.length)
      : source.pathname.split("/").filter(Boolean).at(-1);
    if (!rawFile) return sourceUrl;
    const fileName = decodeURIComponent(rawFile);
    const target = new URL(`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}`);
    target.searchParams.set("width", "1400");
    return target.toString();
  } catch {
    return sourceUrl;
  }
}

async function readPromptAsset(asset: PromptAsset): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (asset.responsePromise) return asset.responsePromise;
  asset.responsePromise = (async () => {
    try {
      const response = await fetch(promptImageUrl(asset.sourceUrl), {
        redirect: "follow",
        signal: AbortSignal.timeout(PROMPT_FETCH_TIMEOUT_MS),
        headers: {
          accept: "image/avif,image/webp,image/*,*/*",
          "user-agent": "Punktlandung/1.0 (https://punktlandung.app; aintartstudio@gmail.com)"
        }
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
      if (!contentType.startsWith("image/") || contentType === "image/svg+xml") return null;
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > PROMPT_MAX_BYTES) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0 || bytes.byteLength > PROMPT_MAX_BYTES) return null;
      return { bytes, contentType };
    } catch {
      return null;
    }
  })();
  return asset.responsePromise;
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const promptMatch = requestUrl.pathname.match(/^\/prompt\/([A-Za-z0-9_-]{32})$/);
  if (promptMatch && (req.method === "GET" || req.method === "HEAD")) {
    const asset = promptAssets.get(promptMatch[1]);
    if (!asset || asset.expiresAt <= Date.now()) {
      res.writeHead(404, { "cache-control": "no-store" });
      res.end();
      return;
    }
    const image = await readPromptAsset(asset);
    if (!image) {
      res.writeHead(502, { "cache-control": "no-store" });
      res.end();
      return;
    }
    res.writeHead(200, {
      "content-type": image.contentType,
      "content-length": String(image.bytes.byteLength),
      "cache-control": "private, max-age=600",
      "x-content-type-options": "nosniff"
    });
    res.end(req.method === "HEAD" ? undefined : Buffer.from(image.bytes));
    return;
  }
  const memory = process.memoryUsage();
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({
    ok: true,
    service: "Punktlandung WebSocket",
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal
    },
    capacity: capacitySnapshot()
  }));
});

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_WS_PAYLOAD_BYTES,
  verifyClient: ({ origin }: { origin: string }) => allowedOrigins.has(origin)
});

function consumeMessageBudget(client: Client): boolean {
  const now = Date.now();
  if (now - client.messageWindowStartedAt >= MESSAGE_RATE_WINDOW_MS) {
    client.messageWindowStartedAt = now;
    client.messageCount = 0;
  }
  client.messageCount += 1;
  if (client.messageCount <= MESSAGE_RATE_LIMIT) return true;
  client.socket.close(1008, "Zu viele Nachrichten");
  return false;
}

wss.on("connection", (socket) => {
  if (clients.size >= MAX_CONNECTIONS) {
    console.warn(`[capacity] Rejected WebSocket connection at limit ${clients.size}/${MAX_CONNECTIONS}.`);
    recordOperationalEvent("ws_connection_rejected", { connections: clients.size, rooms: rooms.size });
    socket.close(1013, "Server ausgelastet");
    return;
  }
  const client: Client = {
    id: id("player"),
    socket,
    roomCode: null,
    resumeToken: resumeToken(),
    messageWindowStartedAt: Date.now(),
    messageCount: 0
  };
  clients.set(client.id, client);
  recordOperationalEvent("ws_connection_accepted");
  reportCapacityWarnings();
  send(client, { type: "hello", playerId: client.id, resumeToken: client.resumeToken });

  socket.on("message", (data) => {
    if (!consumeMessageBudget(client)) return;
    try {
      handleMessage(client, data.toString());
    } catch {
      sendError(client, "Die Nachricht konnte nicht verarbeitet werden.");
    }
  });
  socket.on("error", () => {
    // The close handler owns room cleanup; socket errors must not crash the process.
  });
  socket.on("close", () => {
    clients.delete(client.id);
    reportCapacityWarnings();
    const room = findRoomFor(client);
    if (!room) return;
    if (room.kind === "online" && room.hostId === client.id) {
      const hostPlayer = room.players.find((candidate) => candidate.id === client.id);
      if (hostPlayer) hostPlayer.connected = false;
      broadcast(room);
      return;
    }
    const player = room.players.find((candidate) => candidate.id === client.id);
    if (player) player.connected = false;
    const connectedPlayers = room.players.filter((candidate) => candidate.connected && !candidate.localOnly);
    if (room.kind !== "online" && connectedPlayers.length === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === client.id) {
      const newHost = connectedPlayers[0];
      room.hostId = newHost.id;
      for (const candidate of room.players) candidate.isHost = candidate.id === newHost.id;
    }
    if (room.kind === "online" && room.status === "results" && allActivePlayersReady(room)) {
      startRoundNow(room);
      return;
    }
    broadcast(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === "guessing" && room.roundEndsAt && now >= room.roundEndsAt) evaluateRound(room);
    if (room.kind === "online" && room.status === "results" && room.nextRoundStartsAt && now >= room.nextRoundStartsAt) {
      startRoundNow(room);
    }
    if (now - room.lastActivityAt > ROOM_TTL_MS) rooms.delete(room.code);
  }
  for (const [token, asset] of promptAssets) {
    if (asset.expiresAt <= now) promptAssets.delete(token);
  }
  reportCapacityWarnings();
}, 500);

server.listen(PORT, HOST, () => {
  console.log(`Punktlandung WebSocket server listening on http://${HOST}:${PORT}`);
});
