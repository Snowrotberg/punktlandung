import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { builtInLocations } from "../data/locations";
import { averageGuess, badgeFor, countryCodeFromGuess, haversineDistanceKm, isGuessInCountry, scoreDistance } from "../lib/geo";
import { evaluateTerritoryGuess } from "../lib/locationBoundaries";
import type {
  ClientMessage,
  Cosmetic,
  GameSettings,
  Guess,
  HostParticipation,
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
};

type InternalRoom = RoomState & {
  locationQueue: string[];
  failedLocationIds: string[];
  recentLocationIds: string[];
  duelHp: Record<TeamId, number>;
  createdAt: number;
  lastActivityAt: number;
};

const PORT = Number(process.env.WS_PORT ?? 3001);
const ROOM_TTL_MS = 1000 * 60 * 60 * 3;
const AD_GATE_MS = 0;
const RECENT_ROOM_LOCATION_LIMIT = 120;
const RECENT_GLOBAL_LOCATION_LIMIT = 80;
const FAILED_LOCATION_LIMIT = 80;
const clients = new Map<string, Client>();
const rooms = new Map<string, InternalRoom>();
let lastGlobalLocationId: string | null = null;
let recentGlobalLocationIds: string[] = [];

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

const playerColors = ["#2563eb", "#f43f5e", "#f59e0b", "#06b6d4", "#7c3aed", "#f97316", "#ec4899", "#eab308", "#0ea5e9", "#dc2626"];

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
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
    location: room.status === "lobby" || room.status === "finished" ? null : room.location,
    guesses: room.status === "results" ? room.guesses : room.guesses.map((guess) => ({ ...guess, lat: 0, lng: 0 })),
    timedOutPlayerIds: room.timedOutPlayerIds,
    roundEndsAt: room.roundEndsAt,
    roundStartedAt: room.roundStartedAt,
    summaries: room.summaries,
    emojiEvents: room.emojiEvents.slice(-30),
    adGateUntil: room.adGateUntil
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

function shuffledLocationIds(category: GameSettings["category"], blockedIds: string[] = [], avoidIds: string[] = []): string[] {
  const pool = category === "mixed" ? builtInLocations : builtInLocations.filter((location) => location.category === category);
  const sourceBase = pool.length > 0 ? pool : builtInLocations;
  const blocked = new Set(blockedIds);
  const avoided = new Set(avoidIds);
  const available = sourceBase.filter((location) => !blocked.has(location.id));
  const notRecentlyUsed = available.filter((location) => !avoided.has(location.id));
  const source = notRecentlyUsed.length > 0 ? notRecentlyUsed : available.length > 0 ? available : sourceBase;
  const globallyFresh = source.filter((location) => !recentGlobalLocationIds.includes(location.id));
  const ids = (globallyFresh.length > 0 ? globallyFresh : source).map((location) => location.id);
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

function nextLocation(room: InternalRoom) {
  if (room.locationQueue.length === 0) {
    room.locationQueue = shuffledLocationIds(room.settings.category, room.failedLocationIds, room.recentLocationIds);
  }
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

function activePlayers(room: InternalRoom): Player[] {
  return room.players.filter((player) => player.connected && player.status === "active");
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
  room.timedOutPlayerIds = room.timedOutPlayerIds.filter((id) => nextPlayerIds.has(id));
}

function createRoom(client: Client, playerName: string | undefined, kind: RoomKind, hostParticipation?: HostParticipation): void {
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
    locationQueue: [],
    failedLocationIds: [],
    recentLocationIds: [],
    duelHp: { aurora: 20000, pulse: 20000 },
    createdAt: Date.now(),
    lastActivityAt: Date.now()
  };
  syncLocalPlayers(room);
  rooms.set(code, room);
  client.roomCode = code;
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
  if (existing) {
    existing.name = sanitizeName(playerName);
    existing.connected = true;
  } else {
    room.players.push(makePlayer(client.id, playerName, false, room.players.length));
  }
  client.roomCode = code;
  broadcast(room);
}

function replacePlayerId(room: InternalRoom, previousPlayerId: string, nextPlayerId: string): void {
  if (previousPlayerId === nextPlayerId) return;
  const player = room.players.find((candidate) => candidate.id === previousPlayerId);
  if (player) {
    room.players = room.players.filter((candidate) => candidate.id !== nextPlayerId);
    player.id = nextPlayerId;
    player.connected = true;
  }
  room.guesses = room.guesses.map((guess) => (guess.playerId === previousPlayerId ? { ...guess, playerId: nextPlayerId } : guess));
  room.timedOutPlayerIds = room.timedOutPlayerIds.map((id) => (id === previousPlayerId ? nextPlayerId : id));
  room.summaries = room.summaries.map((summary) => ({
    ...summary,
    results: summary.results.map((result) => ({
      ...result,
      playerId: result.playerId === previousPlayerId ? nextPlayerId : result.playerId,
      guess: result.guess?.playerId === previousPlayerId ? { ...result.guess, playerId: nextPlayerId } : result.guess
    }))
  }));
}

function resumeRoom(client: Client, codeInput: string, previousPlayerId: string): void {
  const code = codeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const room = rooms.get(code);
  if (!room || room.kind !== "online") return;
  if (room.hostId !== previousPlayerId) return;

  replacePlayerId(room, previousPlayerId, client.id);
  room.hostId = client.id;
  for (const player of room.players) player.isHost = player.id === room.hostId;
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
  room.guesses = room.guesses.filter((guess) => guess.playerId !== client.id);
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
    room.timedOutPlayerIds = [];
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
    broadcast(room);
    return;
  }
  room.currentRound += 1;
  const roundStartedAt = Date.now();
  room.status = "guessing";
  room.location = nextLocation(room);
  room.guesses = [];
  room.timedOutPlayerIds = [];
  room.emojiEvents = [];
  room.roundEndsAt = room.settings.timeLimitSec > 0 ? roundStartedAt + room.settings.timeLimitSec * 1000 : null;
  room.roundStartedAt = roundStartedAt;
  room.adGateUntil = null;
  broadcast(room);
}

function skipLocation(client: Client, room: InternalRoom, locationId?: string): void {
  const player = room.players.find((candidate) => candidate.id === client.id);
  if (!player || room.status !== "guessing") return;
  if (locationId && room.location?.id !== locationId) return;
  if (room.location) {
    const failedId = room.location.id;
    room.failedLocationIds = [failedId, ...room.failedLocationIds.filter((id) => id !== failedId)].slice(0, FAILED_LOCATION_LIMIT);
    room.locationQueue = room.locationQueue.filter((id) => id !== failedId);
  }
  room.location = nextLocation(room);
  const roundStartedAt = Date.now();
  room.guesses = [];
  room.timedOutPlayerIds = [];
  room.emojiEvents = [];
  room.roundEndsAt = room.settings.timeLimitSec > 0 ? roundStartedAt + room.settings.timeLimitSec * 1000 : null;
  room.roundStartedAt = roundStartedAt;
  broadcast(room);
}

function evaluateRound(room: InternalRoom): void {
  if (!room.location || room.status !== "guessing") return;
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
    return {
      playerId: player.id,
      distanceKm: territoryMatch?.distanceKm ?? distanceKm,
      points: countryCorrect ? 5000 : territoryMatch?.points ?? scoreDistance(distanceKm),
      badge: countryCorrect ? "Richtiges Land" : territoryMatch?.badge ?? badgeFor(distanceKm, sameContinent),
      eliminated: false,
      guess,
      countryCorrect: countryCorrect || (territoryMatch?.isTerritoryHit ?? false)
    };
  });

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
  broadcast(room);
}

function submitGuess(client: Client, room: InternalRoom, input: { lat: number; lng: number }, countryCode?: string, playerId?: string): void {
  const targetPlayerId = room.kind === "solo" && playerId && requireHost(client, room) ? playerId : client.id;
  const player = room.players.find((candidate) => candidate.id === targetPlayerId);
  if (!player || player.status !== "active" || room.status !== "guessing") return;
  const guessedAt = Date.now();
  const guess: Guess = {
    playerId: targetPlayerId,
    lat: Math.max(-85, Math.min(85, input.lat)),
    lng: Math.max(-180, Math.min(180, input.lng)),
    countryCode,
    createdAt: guessedAt,
    responseTimeMs: room.roundStartedAt ? Math.max(0, guessedAt - room.roundStartedAt) : undefined
  };
  room.guesses = room.guesses.filter((existing) => existing.playerId !== targetPlayerId).concat(guess);
  room.timedOutPlayerIds = room.timedOutPlayerIds.filter((id) => id !== targetPlayerId);
  if (activePlayers(room).every((active) => room.guesses.some((existing) => existing.playerId === active.id) || room.timedOutPlayerIds.includes(active.id))) {
    evaluateRound(room);
  } else {
    broadcast(room);
  }
}

function updateSettings(client: Client, room: InternalRoom, patch: Partial<GameSettings>): void {
  if (!requireHost(client, room) || room.status !== "lobby") return;
  const previousCategory = room.settings.category;
  room.settings = {
    ...room.settings,
    ...patch,
    timeLimitSec: clampInt(patch.timeLimitSec, room.settings.timeLimitSec, 0, 600),
    rounds: clampInt(patch.rounds, room.settings.rounds, 1),
    localPlayerCount: clampInt(patch.localPlayerCount, room.settings.localPlayerCount, 1, 10)
  };
  if (room.kind === "solo") {
    room.settings.mode = "classic";
    if (room.settings.localMode === "couch" && room.settings.localPlayerCount < 2) room.settings.localPlayerCount = 2;
    if (room.settings.localMode === "solo") room.settings.localPlayerCount = 1;
    syncLocalPlayers(room);
  }
  if (patch.category && patch.category !== previousCategory) {
    room.locationQueue = [];
    room.failedLocationIds = [];
    room.recentLocationIds = [];
  }
  broadcast(room);
}

function handleMessage(client: Client, raw: string): void {
  let message: ClientMessage;
  try {
    message = JSON.parse(raw) as ClientMessage;
  } catch {
    sendError(client, "Die Nachricht war kein gültiges JSON.");
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
    resumeRoom(client, message.code, message.previousPlayerId);
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
      const allowed: Cosmetic[] = ["crown", "visor", "halo", "neon-frame"];
      if (allowed.includes(message.cosmetic)) {
        const player = room.players.find((candidate) => candidate.id === client.id);
        if (player) player.cosmetic = message.cosmetic;
        broadcast(room);
      }
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
        room.timedOutPlayerIds = [];
        room.roundEndsAt = null;
        room.roundStartedAt = null;
        room.adGateUntil = null;
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
    case "restart":
      if (!requireHost(client, room)) return;
      room.status = "lobby";
      room.currentRound = 0;
      room.location = null;
      room.guesses = [];
      room.timedOutPlayerIds = [];
      room.roundEndsAt = null;
      room.roundStartedAt = null;
      room.summaries = [];
      room.adGateUntil = null;
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

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "Punktlandung WebSocket", rooms: rooms.size }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  const client: Client = { id: id("player"), socket, roomCode: null };
  clients.set(client.id, client);
  send(client, { type: "hello", playerId: client.id });

  socket.on("message", (data) => handleMessage(client, data.toString()));
  socket.on("close", () => {
    clients.delete(client.id);
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
    broadcast(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === "guessing" && room.roundEndsAt && now >= room.roundEndsAt) evaluateRound(room);
    if (now - room.lastActivityAt > ROOM_TTL_MS) rooms.delete(room.code);
  }
}, 500);

server.listen(PORT, () => {
  console.log(`Punktlandung WebSocket server listening on http://127.0.0.1:${PORT}`);
});
