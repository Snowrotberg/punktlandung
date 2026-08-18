"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicRankedGame, PublicResolvedRankedRound } from "@/lib/rankedGame";
import type { GameSettings, GeoLocation, Guess, LatLng, Player, RoomState, RoundSummary, TeamId } from "@/types/game";
import { enqueueRankedUpload, getRankedUploadQueue, removeRankedUpload } from "@/lib/rankedUploadQueue";
import { playerColorAt } from "@/lib/playerPalette";
import { prepareLocationImage } from "@/lib/imagePreload.client";
import { browserUuid } from "@/lib/browserUuid";
import { readStoredSetupSettings, writeStoredSetupSettings } from "@/lib/setupSettings.client";

type ApiPayload = { data?: PublicRankedGame; error?: { message?: string } };

class RankedRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RankedRequestError";
  }
}

const playerId = "ranked-player";
const activeRankedSessionKey = "punktlandung-ranked-active-game-v1";
const dismissedRankedSessionKey = "punktlandung-ranked-dismissed-game-v1";
const activeRankedSessionTtlMs = 24 * 60 * 60 * 1000;

export type RankedSyncStatus = "secured" | "uploading" | "pending" | "verified";

type StoredRankedSession = {
  gameId: string;
  name: string;
  settings: GameSettings;
  savedAt: number;
  game?: PublicRankedGame;
  room?: RoomState;
};
const initialSettings: GameSettings = {
  mode: "classic",
  localMode: "solo",
  localPlayerCount: 1,
  timeLimitSec: 60,
  rounds: 15,
  noMove: false,
  noPan: false,
  noZoom: false,
  mapPackId: "world",
  category: "mixed",
  difficulty: "medium"
};

function makePlayer(name: string, score = 0): Player {
  return { id: playerId, name: name || "Spieler 1", color: playerColorAt(0), score, connected: true, isHost: true, team: "aurora", status: "active", cosmetic: "none" };
}

function makeRoom(name: string, settings?: GameSettings): RoomState {
  const resolvedSettings = settings ?? { ...initialSettings, ...readStoredSetupSettings(initialSettings) };
  return {
    code: "RANKED",
    kind: "solo",
    hostId: playerId,
    hostParticipation: "host_player",
    status: "lobby",
    settings: { ...resolvedSettings, localMode: "solo", localPlayerCount: 1 },
    players: [makePlayer(name)],
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
  };
}

function readStoredRankedSession(): StoredRankedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(activeRankedSessionKey) ?? "null") as Partial<StoredRankedSession> | null;
    if (!parsed?.gameId || !parsed.name || !parsed.settings || !parsed.savedAt || Date.now() - parsed.savedAt > activeRankedSessionTtlMs) {
      window.localStorage.removeItem(activeRankedSessionKey);
      return null;
    }
    return parsed as StoredRankedSession;
  } catch {
    return null;
  }
}

function writeStoredRankedSession(game: PublicRankedGame, room: RoomState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(activeRankedSessionKey, JSON.stringify({
      gameId: game.gameId,
      name: room.players[0]?.name ?? "Spieler 1",
      settings: room.settings,
      savedAt: Date.now(),
      game,
      room
    } satisfies StoredRankedSession));
    window.localStorage.removeItem(dismissedRankedSessionKey);
  } catch {
    // A ranked game remains playable if persistent browser storage is unavailable.
  }
}

function readDismissedRankedGameId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dismissedRankedSessionKey) ?? "null") as { gameId?: string; dismissedAt?: number } | null;
    if (!parsed?.gameId || !parsed.dismissedAt || Date.now() - parsed.dismissedAt > activeRankedSessionTtlMs) {
      window.localStorage.removeItem(dismissedRankedSessionKey);
      return null;
    }
    return parsed.gameId;
  } catch {
    return null;
  }
}

function clearStoredRankedSession(dismissedGameId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(activeRankedSessionKey);
    if (dismissedGameId) {
      window.localStorage.setItem(dismissedRankedSessionKey, JSON.stringify({ gameId: dismissedGameId, dismissedAt: Date.now() }));
    }
  } catch {
    // Clearing an optional recovery marker is best effort.
  }
}

function pendingUploadsForGame(gameId: string | null): number {
  if (!gameId) return 0;
  return getRankedUploadQueue().filter((item) => item.gameId === gameId).length;
}

function promptLocation(game: PublicRankedGame, name = "Aufgabe"): GeoLocation | null {
  const prompt = game.activeRound;
  if (!prompt) return null;
  const promptVersion = new URL(prompt.assetUrl, "http://punktlandung.local").searchParams.get("v") ?? "0";
  return {
    id: `${prompt.roundId}@${promptVersion}`,
    title: name,
    countryCode: "",
    countryName: "",
    continent: "",
    lat: 0,
    lng: 0,
    panoramaUrl: prompt.assetUrl,
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    sourceUrl: prompt.assetUrl,
    category: prompt.category
  };
}

function roundIdFromPromptLocationId(locationId: string): string {
  return locationId.split("@", 1)[0];
}

function resolvedLocation(round: PublicResolvedRankedRound): GeoLocation {
  return { ...round.location, id: round.roundId, panoramaUrl: "", attribution: "Wikimedia Commons", source: "wikimedia" };
}

function summaryFor(round: PublicResolvedRankedRound, guess: Guess | null): RoundSummary {
  const result = { ...round.result, playerId };
  return { roundNumber: round.roundNumber, location: resolvedLocation(round), results: [result], crewGuess: null, crewDistanceKm: null, duel: [], completedAt: round.resolvedAt, roundStartedAt: guess?.createdAt ? guess.createdAt - (guess.responseTimeMs ?? 0) : undefined };
}

function resolvedGuess(round: PublicResolvedRankedRound): Guess | null {
  return round.result.guess ? { ...round.result.guess, playerId } : null;
}

function roomFromRankedGame(next: PublicRankedGame, name: string, storedSettings: GameSettings): RoomState {
  const summaries = next.resolvedRounds.map((round) => summaryFor(round, resolvedGuess(round)));
  const latestResolved = next.resolvedRounds.at(-1) ?? null;
  const activeLocation = promptLocation(next);
  const totalRounds = next.activeRound?.totalRounds ?? Math.max(storedSettings.rounds, next.resolvedRounds.length);
  const settings: GameSettings = {
    ...storedSettings,
    localMode: "solo",
    localPlayerCount: 1,
    rounds: totalRounds,
    category: next.activeRound?.category ?? latestResolved?.location.category ?? storedSettings.category,
    timeLimitSec: next.timeLimitSec ?? storedSettings.timeLimitSec,
    difficulty: next.difficulty ?? storedSettings.difficulty,
    noZoom: next.noZoom ?? storedSettings.noZoom
  };
  const finished = next.status === "completed";
  const latestGuess = latestResolved ? resolvedGuess(latestResolved) : null;
  return {
    ...makeRoom(name, settings),
    status: finished ? "finished" : "guessing",
    players: [makePlayer(name, next.score)],
    currentRound: next.activeRound?.roundNumber ?? latestResolved?.roundNumber ?? 0,
    location: activeLocation ?? (latestResolved ? resolvedLocation(latestResolved) : null),
    guesses: finished && latestGuess ? [latestGuess] : [],
    timedOutPlayerIds: finished && latestResolved && !latestGuess ? [playerId] : [],
    roundStartedAt: next.activeRound?.startedAt ?? null,
    roundEndsAt: next.activeRound?.deadlineAt ?? null,
    summaries
  };
}

export function useRankedSoloGame(enabled: boolean) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<PublicRankedGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(enabled);
  const guessRef = useRef<Guess | null>(null);
  const expiryAttemptedRef = useRef(new Set<string>());
  const uploadFlushInFlightRef = useRef(false);
  const readyRoundRef = useRef<string | null>(null);
  const activeGameIdRef = useRef<string | null>(null);
  const advancingRoundRef = useRef(false);
  const rerollInFlightRef = useRef(new Set<string>());
  const recoveryStartedRef = useRef(false);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const retryDelays = [0, 250, 650];
    let lastStatus = 0;

    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      if (retryDelays[attempt] > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
      }

      try {
        const response = await fetch(url, {
          ...init,
          headers: { accept: "application/json", ...init?.headers },
          credentials: "same-origin",
          cache: "no-store"
        });
        lastStatus = response.status;
        const rawPayload = await response.text();
        let payload: ApiPayload | null = null;
        try {
          payload = rawPayload ? JSON.parse(rawPayload) as ApiPayload : null;
        } catch {
          // The Next.js development server can briefly answer with its HTML
          // fallback while a newly visited API route is being compiled.
        }

        if (payload && response.ok && payload.data) return payload.data;
        if (payload && (!response.ok || payload.error)) {
          throw new RankedRequestError(
            payload.error?.message ?? `Die Serverprüfung ist momentan nicht verfügbar (${response.status}).`,
            response.status
          );
        }

        const transientHtmlResponse = !payload && (response.status === 404 || response.status >= 500 || rawPayload.trimStart().startsWith("<!DOCTYPE"));
        if (!transientHtmlResponse || attempt === retryDelays.length - 1) {
          throw new RankedRequestError(
            "Der Spielserver hat vorübergehend keine gültige Antwort geliefert. Bitte versuche es noch einmal.",
            response.status
          );
        }
      } catch (cause) {
        if (cause instanceof RankedRequestError || attempt === retryDelays.length - 1) throw cause;
      }
    }

    throw new RankedRequestError("Der Spielserver ist momentan nicht erreichbar.", lastStatus || 503);
  }, []);

  const prepareRankedPrompt = useCallback(async (initialGame: PublicRankedGame) => {
    let next = initialGame;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const location = promptLocation(next);
      if (!location || !next.activeRound) return null;
      const preparedLocation = await prepareLocationImage(location);
      if (preparedLocation) return { game: next, location: preparedLocation };
      next = await request(
        `/api/v1/ranked-games/${encodeURIComponent(next.gameId)}/rounds/${encodeURIComponent(next.activeRound.roundId)}/reroll`,
        { method: "POST" }
      );
    }
    return null;
  }, [request]);

  useEffect(() => {
    activeGameIdRef.current = game?.gameId ?? null;
    if (game && room) writeStoredRankedSession(game, room);
  }, [game, room]);

  useEffect(() => {
    if (!enabled) {
      recoveryStartedRef.current = false;
      setRestoring(false);
      return;
    }
    // Several callbacks below change identity as a recovered prompt is prepared.
    // Without this guard the effect can run a second time immediately after a
    // successful explicit rescue. By then the `resume` query has been removed,
    // so that second run could restore an unrelated stale localStorage game and
    // overwrite the correct one in the UI.
    if (recoveryStartedRef.current) return;
    recoveryStartedRef.current = true;
    const stored = readStoredRankedSession();
    const resumeGameId = new URLSearchParams(window.location.search).get("resume");
    const dismissedGameId = readDismissedRankedGameId();
    const recoveryName = stored?.name
      ?? window.localStorage.getItem("punktlandung-name")
      ?? "Spieler 1";
    const recoverySettings = stored?.settings
      ?? { ...initialSettings, ...readStoredSetupSettings(initialSettings), localMode: "solo" as const, localPlayerCount: 1 };
    setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
    let cancelled = false;
    const recoverGame = async () => {
      if (resumeGameId) {
        return request(`/api/v1/ranked-games/active?resume=${encodeURIComponent(resumeGameId)}`);
      }
      if (stored) {
        try {
          return await request(`/api/v1/ranked-games/${encodeURIComponent(stored.gameId)}`);
        } catch {
          // The local marker may be stale or a previous transient response may
          // have interrupted restoration. The signed guest cookie still lets
          // the server locate the latest active game without exposing its id.
        }
      }
      return request("/api/v1/ranked-games/active");
    };
    void recoverGame()
      .then(async (next) => ({ next, prepared: next.status === "completed" ? null : await prepareRankedPrompt(next) }))
      .then(({ next, prepared }) => {
        if (cancelled) return;
        if (!stored && dismissedGameId === next.gameId) return;
        if (next.status !== "completed" && !prepared) throw new Error("No ranked prompt image could be prepared.");
        const visibleGame = prepared?.game ?? next;
        activeGameIdRef.current = visibleGame.gameId;
        setGame(visibleGame);
        const restoredRoom = roomFromRankedGame(visibleGame, recoveryName, recoverySettings);
        if (prepared) restoredRoom.location = prepared.location;
        setRoom(restoredRoom);
        setError(null);
        if (resumeGameId) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("resume");
          window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        // An explicit recovery link must never silently open a different game
        // from localStorage. Keeping the requested id visible also makes a
        // transient server failure safely retryable with a reload.
        if (resumeGameId) {
          setGame(null);
          setRoom(null);
          setError("Diese gespeicherte Partie konnte gerade nicht wiederhergestellt werden. Bitte lade die Seite erneut.");
          return;
        }
        if (
          !stored &&
          cause instanceof RankedRequestError &&
          (cause.status === 401 || cause.status === 404)
        ) {
          return;
        }
        if (stored?.game && stored.room) {
          activeGameIdRef.current = stored.game.gameId;
          setGame(stored.game);
          setRoom(stored.room);
        }
        setError("Die Partie bleibt gespeichert, konnte aber gerade nicht mit dem Server synchronisiert werden. Bitte lade die Seite erneut.");
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => { cancelled = true; };
  }, [enabled, prepareRankedPrompt, request]);

  const applyResolved = useCallback((next: PublicRankedGame, guess: Guess | null, timedOut = false) => {
    setGame(next);
    const resolved = next.resolvedRounds.at(-1);
    setRoom((value) => {
      if (!value || !resolved) return value;
      const summaries = value.summaries.some((summary) => summary.roundNumber === resolved.roundNumber)
        ? value.summaries
        : [...value.summaries, summaryFor(resolved, guess)];
      const nextPlayer = makePlayer(value.players[0]?.name ?? "Spieler 1", next.score);
      return { ...value, status: next.status === "completed" ? "finished" : "results", players: [nextPlayer], location: resolvedLocation(resolved), guesses: guess ? [guess] : [], timedOutPlayerIds: timedOut ? [playerId] : [], summaries, currentRound: resolved.roundNumber, roundEndsAt: null, roundStartedAt: null };
    });
  }, []);

  const createSolo = useCallback((name: string, mode: "solo" | "couch" = "solo") => {
    if (mode !== "solo") return;
    setGame(null);
    setError(null);
    setRoom(makeRoom(name));
  }, []);

  const updateSettings = useCallback((changes: Partial<GameSettings>) => {
    setRoom((current) => {
      if (!current || current.status !== "lobby") return current;
      const settings = { ...current.settings, ...changes, localMode: "solo" as const, localPlayerCount: 1 };
      writeStoredSetupSettings(settings);
      return { ...current, settings };
    });
  }, []);

  const startRound = useCallback(async () => {
    const current = room;
    if (!current || current.status === "guessing") return;
    if (current.status === "results") {
      if (advancingRoundRef.current) return;
      advancingRoundRef.current = true;
      try {
        readyRoundRef.current = null;
        setError(null);
        const gameId = game?.gameId ?? activeGameIdRef.current;
        if (!gameId) throw new Error("Die laufende Partie konnte nicht gefunden werden.");

        // The response that resolved the previous round can briefly be older than
        // the server state and therefore omit the already waiting next round.
        // Always refresh the exact game before advancing instead of turning the
        // button into a silent no-op when activeRound is missing locally.
        const latest = await request(`/api/v1/ranked-games/${encodeURIComponent(gameId)}`);
        activeGameIdRef.current = latest.gameId;
        if (latest.status === "completed") {
          setGame(latest);
          setRoom(roomFromRankedGame(latest, current.players[0]?.name ?? "Spieler 1", current.settings));
          return;
        }

        const prepared = await prepareRankedPrompt(latest);
        if (!prepared) throw new Error("Das nächste Bild ist gerade nicht erreichbar. Bitte versuche es erneut.");
        setGame(prepared.game);
        setRoom((value) => value ? {
          ...value,
          status: "guessing",
          currentRound: prepared.game.activeRound?.roundNumber ?? value.currentRound + 1,
          location: prepared.location,
          guesses: [],
          timedOutPlayerIds: [],
          roundStartedAt: prepared.game.activeRound?.startedAt ?? null,
          roundEndsAt: prepared.game.activeRound?.deadlineAt ?? null
        } : value);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Die nächste Runde konnte gerade nicht geladen werden. Bitte versuche es erneut.");
      } finally {
        advancingRoundRef.current = false;
      }
      return;
    }
    if (current.status !== "lobby") return;
    try {
      readyRoundRef.current = null;
      setError(null);
      const timeLimitSec = ([0, 15, 30, 60] as number[]).includes(current.settings.timeLimitSec) ? current.settings.timeLimitSec : 60;
      const difficulty = current.settings.difficulty === "easy" || current.settings.difficulty === "hard" ? current.settings.difficulty : "medium";
      const next = await request("/api/v1/ranked-games", { method: "POST", headers: { "content-type": "application/json", "x-ranked-defer-start": "true" }, body: JSON.stringify({ requestId: browserUuid(), rulesetId: "daily-five", rounds: current.settings.rounds, timeLimitSec, category: current.settings.category, difficulty, noZoom: current.settings.noZoom }) });
      const prepared = await prepareRankedPrompt(next);
      if (!prepared) throw new Error("Die Bilder sind gerade nicht erreichbar. Bitte versuche es noch einmal.");
      activeGameIdRef.current = prepared.game.gameId;
      setGame(prepared.game);
      setRoom((value) => value ? { ...value, status: "guessing", currentRound: prepared.game.activeRound?.roundNumber ?? 1, location: prepared.location, guesses: [], timedOutPlayerIds: [], roundStartedAt: prepared.game.activeRound?.startedAt ?? null, roundEndsAt: prepared.game.activeRound?.deadlineAt ?? null, settings: { ...value.settings, timeLimitSec: prepared.game.timeLimitSec ?? 60, difficulty: prepared.game.difficulty ?? "medium", noZoom: prepared.game.noZoom ?? false, rounds: prepared.game.activeRound?.totalRounds ?? value.settings.rounds } } : value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Partie konnte nicht gestartet werden.");
    }
  }, [game, prepareRankedPrompt, request, room]);

  const markLocationReady = useCallback(async (locationId: string, ready: boolean) => {
    const roundId = roundIdFromPromptLocationId(locationId);
    if (!enabled || !game?.activeRound || game.activeRound.roundId !== roundId) return;
    if (!ready) {
      // A failed first image must not consume the round timer. The server
      // timer only starts after the ready mutation, so this is safe until the
      // round has actually been acknowledged as ready.
      if (readyRoundRef.current !== roundId) {
        setRoom((value) => value ? { ...value, roundStartedAt: null, roundEndsAt: null } : value);
      }
      return;
    }
    if (readyRoundRef.current === roundId) return;
    readyRoundRef.current = roundId;
    try {
      const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/rounds/${encodeURIComponent(roundId)}/ready`, { method: "POST" });
      setGame(next);
      setRoom((value) => value ? { ...value, roundStartedAt: next.activeRound?.startedAt ?? null, roundEndsAt: next.activeRound?.deadlineAt ?? null } : value);
    } catch (cause) {
      enqueueRankedUpload({ id: `ready:${game.gameId}:${roundId}`, kind: "ready", gameId: game.gameId, roundId, url: `/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/rounds/${encodeURIComponent(roundId)}/ready` });
      setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
      readyRoundRef.current = null;
      setError(cause instanceof Error ? cause.message : "Die Runde konnte nicht gestartet werden.");
    }
  }, [enabled, game, request]);

  const submitGuess = useCallback(async (point: LatLng & { countryCode?: string }) => {
    if (!game?.activeRound || !room || room.status !== "guessing") return;
    const submittedAt = Date.now();
    const guess: Guess = { playerId, lat: point.lat, lng: point.lng, countryCode: point.countryCode, createdAt: submittedAt, responseTimeMs: room.roundStartedAt ? Math.max(0, submittedAt - room.roundStartedAt) : undefined };
    const guessId = browserUuid();
    const uploadId = `guess:${game.gameId}:${game.activeRound.roundId}`;
    const uploadBody = JSON.stringify({ roundId: game.activeRound.roundId, guessId, lat: point.lat, lng: point.lng, countryCode: point.countryCode });
    guessRef.current = guess;
    try {
      setError(null);
      setUploading(true);
      const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/guess`, { method: "POST", headers: { "content-type": "application/json" }, body: uploadBody });
      removeRankedUpload(uploadId);
      applyResolved(next, guessRef.current);
      guessRef.current = null;
    } catch (cause) {
      enqueueRankedUpload({ id: uploadId, kind: "guess", gameId: game.gameId, roundId: game.activeRound.roundId, url: `/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/guess`, body: uploadBody });
      setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
      setError(cause instanceof Error ? cause.message : "Der Tipp konnte nicht geprüft werden.");
    } finally {
      setUploading(false);
    }
  }, [applyResolved, game, request, room]);

  useEffect(() => {
    if (!enabled || !game || !room || room.status !== "guessing" || !room.roundEndsAt) return;

    // `game.activeRound` can already point at the next pending round after the
    // server committed an expiry while the visible room still shows the old
    // round. Reconcile against the round that is actually on screen.
    const roundId = room.location
      ? roundIdFromPromptLocationId(room.location.id)
      : game.activeRound?.roundId;
    if (!roundId) return;
    const reconcileResolvedRound = async () => {
      if (Date.now() <= room.roundEndsAt!) return false;
      try {
        const latest = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}`);
        if (!latest.resolvedRounds.some((round) => round.roundNumber === room.currentRound)) return false;
        removeRankedUpload(`expire:${game.gameId}:${roundId}`);
        applyResolved(latest, null, true);
        return true;
      } catch {
        return false;
      }
    };
    const expire = async () => {
      if (expiryAttemptedRef.current.has(roundId) || Date.now() <= room.roundEndsAt!) return;
      expiryAttemptedRef.current.add(roundId);
      const uploadId = `expire:${game.gameId}:${roundId}`;
      const uploadBody = JSON.stringify({ roundId });
      try {
        setUploading(true);
        const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/expire`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: uploadBody
        });
        removeRankedUpload(uploadId);
        applyResolved(next, null, true);
      } catch (cause) {
        // The server may have committed the expiry even when the mutation
        // response was interrupted. Re-read the game before queueing a retry
        // so the browser cannot remain on a round that is already resolved.
        try {
          const latest = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}`);
          if (latest.resolvedRounds.some((round) => round.roundNumber === room.currentRound)) {
            removeRankedUpload(uploadId);
            applyResolved(latest, null, true);
            return;
          }
        } catch {
          // The normal upload queue remains the offline/transient fallback.
        }
        // A client timer can reach the deadline a fraction before the server
        // clock does. Do not permanently mark the round as handled when that
        // first expiry request is rejected; the interval must be able to retry
        // and move the UI from 0s to the round result.
        expiryAttemptedRef.current.delete(roundId);
        const nonRetryableClientError = cause instanceof RankedRequestError
          && cause.status >= 400
          && cause.status < 500
          && cause.status !== 408
          && cause.status !== 429;
        if (nonRetryableClientError) {
          removeRankedUpload(uploadId);
        } else {
          enqueueRankedUpload({ id: uploadId, kind: "expire", gameId: game.gameId, roundId, url: `/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/expire`, body: uploadBody });
        }
        setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
        if (!(cause instanceof RankedRequestError) || cause.status !== 409) {
          setError(cause instanceof Error ? cause.message : "Die abgelaufene Runde konnte nicht geprüft werden.");
        }
      } finally {
        setUploading(false);
      }
    };

    void expire();
    void reconcileResolvedRound();
    // Stay below the server's per-minute expiry guard even when the browser
    // clock is noticeably ahead of the server clock.
    const timer = window.setInterval(() => void expire(), 4000);
    const reconciliationTimer = window.setInterval(() => void reconcileResolvedRound(), 2000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(reconciliationTimer);
    };
  }, [applyResolved, enabled, game, request, room]);

  const flushUploads = useCallback(async () => {
    if (!enabled || uploadFlushInFlightRef.current) return;
    uploadFlushInFlightRef.current = true;
    const queue = getRankedUploadQueue();
    try {
      setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
      if (!queue.length || !navigator.onLine) return;
      setUploading(true);
      for (const item of queue) {
        try {
          const next = await request(item.url, { method: "POST", headers: { "content-type": "application/json" }, body: item.body });
          removeRankedUpload(item.id);
          const belongsToVisibleGame = activeGameIdRef.current === item.gameId;
          if (item.kind === "guess" && belongsToVisibleGame) {
            const body = JSON.parse(item.body ?? "{}") as { lat?: number; lng?: number; countryCode?: string };
            applyResolved(next, { playerId, lat: body.lat ?? 0, lng: body.lng ?? 0, countryCode: body.countryCode, createdAt: item.createdAt, responseTimeMs: undefined });
          } else if (item.kind === "expire" && belongsToVisibleGame) {
            applyResolved(next, null, true);
          } else if (item.kind === "ready" && belongsToVisibleGame) {
            setGame(next);
            setRoom((value) => value ? { ...value, roundStartedAt: next.activeRound?.startedAt ?? null, roundEndsAt: next.activeRound?.deadlineAt ?? null } : value);
          } else if (item.kind === "reroll" && belongsToVisibleGame) {
            setGame(next);
            setRoom((value) => value ? { ...value, location: promptLocation(next), roundStartedAt: null, roundEndsAt: null } : value);
          }
        } catch (cause) {
          const nonRetryableClientError = cause instanceof RankedRequestError
            && cause.status >= 400
            && cause.status < 500
            && cause.status !== 408
            && cause.status !== 429;
          if (!nonRetryableClientError) break;
          removeRankedUpload(item.id);
        }
      }
    } finally {
      setUploading(false);
      setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
      uploadFlushInFlightRef.current = false;
    }
  }, [applyResolved, enabled, request]);

  useEffect(() => {
    void flushUploads();
    window.addEventListener("online", flushUploads);
    const timer = window.setInterval(() => void flushUploads(), 5000);
    return () => { window.removeEventListener("online", flushUploads); window.clearInterval(timer); };
  }, [flushUploads]);

  const cancelRound = useCallback(() => { readyRoundRef.current = null; clearStoredRankedSession(activeGameIdRef.current); activeGameIdRef.current = null; setGame(null); setRoom((current) => current ? { ...current, status: "lobby", location: null, guesses: [], roundEndsAt: null, roundStartedAt: null, currentRound: 0, summaries: [] } : current); }, []);
  const restart = useCallback(() => { clearStoredRankedSession(activeGameIdRef.current); activeGameIdRef.current = null; setGame(null); setRoom((current) => current ? makeRoom(current.players[0]?.name ?? "Spieler 1", current.settings) : current); }, []);
  const leaveRoom = useCallback(() => { clearStoredRankedSession(activeGameIdRef.current); activeGameIdRef.current = null; setGame(null); setRoom(null); }, []);
  const renamePlayer = useCallback((target: string, name: string) => setRoom((current) => current ? { ...current, players: current.players.map((player) => player.id === target ? { ...player, name } : player) } : current), []);
  const skipLocation = useCallback(async (locationId: string) => {
    const roundId = roundIdFromPromptLocationId(locationId);
    if (!game?.activeRound || game.activeRound.roundId !== roundId || rerollInFlightRef.current.has(roundId)) return;
    rerollInFlightRef.current.add(roundId);
    readyRoundRef.current = null;
    setError(null);
    try {
      const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/rounds/${encodeURIComponent(roundId)}/reroll`, { method: "POST" });
      const prepared = await prepareRankedPrompt(next);
      if (!prepared) throw new Error("Das nächste Bild ist gerade nicht erreichbar. Bitte versuche es erneut.");
      setGame(prepared.game);
      setRoom((value) => value ? { ...value, location: prepared.location, roundStartedAt: null, roundEndsAt: null } : value);
    } catch (cause) {
      const retryable = !(cause instanceof RankedRequestError)
        || cause.status >= 500
        || cause.status === 408
        || cause.status === 429;
      if (retryable) {
        enqueueRankedUpload({ id: `reroll:${game.gameId}:${roundId}`, kind: "reroll", gameId: game.gameId, roundId, url: `/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/rounds/${encodeURIComponent(roundId)}/reroll` });
        setPendingUploadCount(pendingUploadsForGame(activeGameIdRef.current));
      }
      setError(cause instanceof Error ? cause.message : "Es konnte kein anderer Ort geladen werden.");
    } finally {
      rerollInFlightRef.current.delete(roundId);
    }
  }, [game, prepareRankedPrompt, request]);

  return useMemo(() => ({
    playerId, room, error, status: "open" as const, isHost: Boolean(room), me: room?.players[0] ?? null,
    restoring, pendingUploadCount, syncStatus: (pendingUploadCount > 0 ? (uploading ? "uploading" : "pending") : game?.status === "completed" && game.claimed && game.integrityStatus === "verified" ? "verified" : "secured") as RankedSyncStatus,
    clearError: () => setError(null), createSolo, createOnlineSetup: () => undefined, updateSettings, updateHostParticipation: () => undefined, renamePlayer,
    startRound, submitGuess, cancelRound, markLocationReady, skipLocation, restart, leaveRoom, setTeam: (_team: TeamId) => undefined,
    readyNextRound: () => undefined, unlockCosmetic: () => undefined
  }), [cancelRound, createSolo, error, game, leaveRoom, markLocationReady, pendingUploadCount, renamePlayer, restart, restoring, room, skipLocation, startRound, submitGuess, updateSettings, uploading]);
}
