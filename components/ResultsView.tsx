"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Clock3,
  Eye,
  Gauge,
  Images,
  MapPin,
  Medal,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Target,
  Trophy
} from "lucide-react";
import type { LocationCategory, Player, RoomState, RoundResult, RoundSummary } from "@/types/game";
import { formatDistance, rankResults } from "@/lib/geo";
import { BackButton } from "./BackButton";
import { Button, ButtonLink } from "./Button";
import { GuessMap } from "./GuessMap";
import { FeedbackDialog } from "./FeedbackDialog";
import { LegalLinks } from "./LegalLinks";
import { PanoramaViewer } from "./PanoramaViewer";
import { TriangleIcon } from "./TriangleIcon";
import { useSound } from "./SoundProvider";
import redesignStyles from "./redesign/RedesignResultsView.module.css";
import { saveCompletedGame, type SaveCompletedGameInput } from "@/app/endergebnis/actions";
import { enqueueCompletedGameSave, flushCompletedGameSaves } from "@/lib/completedGameSaveQueue.client";
import type { RankedSyncStatus } from "@/hooks/useRankedSoloGame";
import { enqueueRankedGameClaim } from "@/lib/rankedGameClaimQueue.client";
import { playerColorAt } from "@/lib/playerPalette";
import type { ResultCameraScenario } from "@/lib/globeResultCamera";

const GlobeResultMap = dynamic(
  () => import("./GlobeMapLab").then((module) => module.GlobeResultMap),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[18rem] bg-slate-950" aria-hidden="true" />
  }
);

const punktlandungDistanceKm = 0.5;
const punktlandungDelayMs = 850;
const punktlandungVisibleMs = 5200;
const feedbackPromptStorageKey = "punktlandung-feedback-prompt-v1";
const feedbackSkipMs = 14 * 24 * 60 * 60 * 1000;
const feedbackSentMs = 90 * 24 * 60 * 60 * 1000;
const badgeArticleMap: Record<string, string> = {
  "Globus-Gott": "Der",
  "Pin-Papst": "Der",
  "Koordinaten-Kaiser": "Der",
  "Kompasskönig": "Der",
  Atlasmeister: "Der",
  Spurensucher: "Der",
  Wegweiser: "Der",
  Kartenkenner: "Der",
  Abzweigprofi: "Der",
  Falschfahrer: "Der",
  Punktlandung: "Die",
  Satellitenhirn: "Das",
  Weltenbummler: "Der",
  "Atlas-Akrobat": "Der",
  "Kontinent-Kenner": "Der",
  Verschollen: "Der",
  "Richtiges Land": "Das"
};
const overallRankingTitles = [
  "Globus-Gott",
  "Pin-Papst",
  "Koordinaten-Kaiser",
  "Kompasskönig",
  "Atlasmeister",
  "Spurensucher",
  "Wegweiser",
  "Kartenkenner",
  "Abzweigprofi",
  "Falschfahrer"
] as const;
const scoreHeatmapGradient = "linear-gradient(90deg, #f43f5e 0%, #fb923c 36%, #facc15 64%, #34d399 100%)";
const redesignScoreGradient = "linear-gradient(90deg, #7567e8 0%, #938cff 42%, #56c7c0 72%, #5ee7bd 100%)";
const categoryLabels: Record<LocationCategory, string> = {
  mixed: "Gemischte Kategorien",
  landmarks: "Wahrzeichen",
  cities: "Städte",
  landscapes: "Landschaft",
  flags: "Flaggen",
  capitals: "Hauptstädte",
  streetview: "Straßenansicht"
};

const landingLabelsByCategory: Record<LocationCategory, string> = {
  mixed: "Volltreffer",
  landmarks: "Richtiges Wahrzeichen",
  cities: "Richtige Stadt",
  landscapes: "Richtiger Ort",
  flags: "Richtiges Land",
  capitals: "Richtige Hauptstadt",
  streetview: "Volltreffer"
};

type PlayerFinalStats = {
  player: Player;
  rank: number;
  title: string;
  roundsPlayed: number;
  averagePoints: number;
  averageDistanceKm: number | null;
  hitRate: number;
  hits: number;
  bestRoundPoints: number;
  bestRoundLabel: string;
  scoreDeviation: number | null;
  timedGuesses: number;
  totalGuessSeconds: number | null;
  averageGuessSeconds: number | null;
};

type FinalHighlight = {
  label: string;
  value: string;
  detail: string;
  color?: string;
  tone?: "metric" | "category";
  icon: "closest" | "round" | "hits" | "speed" | "distance" | "consistency";
};

type ResultsViewProps = {
  room: RoomState;
  isHost: boolean;
  meId?: string | null;
  onNext: () => void | Promise<void>;
  onReadyNextRound?: () => void;
  onBackToLobby: () => void;
  onRestart: () => void;
  onLeave: () => void;
  onDiscardSession?: () => void;
  redesign?: boolean;
  accountsEnabled?: boolean;
  accountAuthenticated?: boolean;
  serverRanked?: boolean;
  rankedGameId?: string | null;
  rankedSyncStatus?: RankedSyncStatus;
  pendingUploadCount?: number;
  initialSurface?: "resolution" | "final";
};

function playerFor(players: Player[], id: string): Player | undefined {
  return players.find((player) => player.id === id);
}

function badgeWithArticle(badge: string): string {
  const article = badgeArticleMap[badge];
  return article ? `${article} ${badge}` : badge;
}

function overallRankingTitleFor(rankIndex: number, playerCount: number): string {
  if (playerCount <= 1) return "";
  const lastTitleIndex = overallRankingTitles.length - 1;
  const mappedIndex = Math.round((rankIndex / Math.max(1, playerCount - 1)) * lastTitleIndex);
  return overallRankingTitles[Math.min(lastTitleIndex, Math.max(0, mappedIndex))] ?? "";
}

function scoreHeatmapPercent(points: number): number {
  return Math.max(4, Math.min(100, (points / 5000) * 100));
}

function scoreLead(players: Player[]): number {
  if (players.length < 2) return players[0]?.score ?? 0;
  return Math.max(0, (players[0]?.score ?? 0) - (players[1]?.score ?? 0));
}

function feedbackPromptAllowed(): boolean {
  try {
    const nextPromptAt = Number(window.localStorage.getItem(feedbackPromptStorageKey) || 0);
    return !Number.isFinite(nextPromptAt) || nextPromptAt <= Date.now();
  } catch {
    return true;
  }
}

function postponeFeedbackPrompt(durationMs: number): void {
  try {
    window.localStorage.setItem(feedbackPromptStorageKey, String(Date.now() + durationMs));
  } catch {
    // The feedback dialog remains optional when browser storage is unavailable.
  }
}

function playerAccentStyle(color = playerColorAt(0)): CSSProperties {
  return {
    background: color,
    boxShadow: `0 0 10px ${color}cc, 0 0 22px ${color}66`,
    filter: "saturate(1.18)"
  };
}

function displayCountryName(location: RoomState["location"]): string {
  if (!location) return "";
  const looksLikeIsoCode = /^[A-Z]{2,3}$/.test(location.countryName);
  if (location.category === "flags" && looksLikeIsoCode) {
    return location.title.replace(/^Flagge von\s+/i, "");
  }
  return location.countryName;
}

function displayContinent(continent: string): string {
  const labels: Record<string, string> = {
    Africa: "Afrika",
    Asia: "Asien",
    Europe: "Europa",
    "North America": "Nordamerika",
    "South America": "Südamerika",
    Oceania: "Ozeanien",
    Antarctica: "Antarktis"
  };
  return labels[continent] ?? continent;
}

function isResultHit(result: RoundResult): boolean {
  return Boolean(result.guess && (result.countryCorrect || result.distanceKm <= punktlandungDistanceKm));
}

function formatPoints(points: number): string {
  return Math.round(points).toLocaleString("de-DE");
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  return `${Math.round(seconds)} s`;
}

function roundsPlayedLabel(rounds: number): string {
  return `${rounds} ${rounds === 1 ? "Runde" : "Runden"}`;
}

function formatGuessTime(milliseconds: number | undefined): string | null {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) return null;
  const seconds = milliseconds / 1000;
  return `${seconds.toLocaleString("de-DE", {
    maximumFractionDigits: seconds < 10 ? 1 : 0
  })} s`;
}

function buildFinalStats(players: Player[], summaries: RoundSummary[]): PlayerFinalStats[] {
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);

  return rankedPlayers.map((player, index) => {
    const playerResults = summaries.flatMap((round) =>
      round.results
        .filter((result) => result.playerId === player.id)
        .map((result) => ({ result, round }))
    );
    const roundsPlayed = playerResults.length;
    const distances = playerResults.map(({ result }) => result.distanceKm).filter(Number.isFinite);
    const guessSeconds = playerResults
      .map(({ result }) => result.guess?.responseTimeMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => value / 1000);
    const hits = playerResults.filter(({ result }) => isResultHit(result)).length;
    const bestRound = playerResults.reduce<{ points: number; label: string; distanceKm: number } | null>((best, entry) => {
      if (best && entry.result.points <= best.points) return best;
      return {
        points: entry.result.points,
        label: entry.round.location.title,
        distanceKm: entry.result.distanceKm
      };
    }, null);
    const averagePoints = roundsPlayed > 0 ? player.score / roundsPlayed : 0;
    const scoreDeviation = roundsPlayed > 1
      ? Math.sqrt(playerResults.reduce((sum, { result }) => sum + (result.points - averagePoints) ** 2, 0) / roundsPlayed)
      : null;

    return {
      player,
      rank: index + 1,
      title: overallRankingTitleFor(index, rankedPlayers.length),
      roundsPlayed,
      averagePoints,
      averageDistanceKm: distances.length > 0 ? distances.reduce((sum, distance) => sum + distance, 0) / distances.length : null,
      hitRate: roundsPlayed > 0 ? (hits / roundsPlayed) * 100 : 0,
      hits,
      bestRoundPoints: bestRound?.points ?? 0,
      bestRoundLabel: bestRound ? `${bestRound.label} · ${formatDistance(bestRound.distanceKm)}` : "Keine Runde",
      scoreDeviation,
      timedGuesses: guessSeconds.length,
      totalGuessSeconds: guessSeconds.length > 0 ? guessSeconds.reduce((sum, seconds) => sum + seconds, 0) : null,
      averageGuessSeconds: guessSeconds.length > 0 ? guessSeconds.reduce((sum, seconds) => sum + seconds, 0) / guessSeconds.length : null
    };
  });
}

function buildFinalHighlights(stats: PlayerFinalStats[], summaries: RoundSummary[], players: Player[]): FinalHighlight[] {
  const allResults = summaries.flatMap((round) => round.results.map((result) => ({ result, round })));
  const closest = allResults
    .filter(({ result }) => result.guess)
    .sort((a, b) => a.result.distanceKm - b.result.distanceKm)[0];
  const strongestRound = allResults.sort((a, b) => b.result.points - a.result.points)[0];
  const mostAccurate = [...stats]
    .filter((stat) => stat.averageDistanceKm !== null)
    .sort((a, b) => (a.averageDistanceKm ?? Infinity) - (b.averageDistanceKm ?? Infinity))[0];
  const fastest = [...stats]
    .filter((stat) => stat.totalGuessSeconds !== null)
    .sort((a, b) => (a.totalGuessSeconds ?? Infinity) - (b.totalGuessSeconds ?? Infinity))[0];
  const mostLandings = [...stats]
    .filter((stat) => stat.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.hitRate - a.hitRate || b.averagePoints - a.averagePoints)[0];
  const mostConsistent = [...stats]
    .filter((stat) => stat.scoreDeviation !== null)
    .sort((a, b) => (a.scoreDeviation ?? Infinity) - (b.scoreDeviation ?? Infinity) || b.averagePoints - a.averagePoints)[0];

  return [
    closest
      ? {
          label: "Knappster Tipp",
          value: playerFor(players, closest.result.playerId)?.name ?? "Spieler",
          detail: `${formatDistance(closest.result.distanceKm)} bei ${closest.round.location.title}`,
          color: playerFor(players, closest.result.playerId)?.color,
          icon: "closest"
        }
      : null,
    strongestRound
      ? {
          label: "Beste Einzelrunde",
          value: playerFor(players, strongestRound.result.playerId)?.name ?? "Spieler",
          detail: `${formatPoints(strongestRound.result.points)} Punkte bei ${strongestRound.round.location.title}`,
          color: playerFor(players, strongestRound.result.playerId)?.color,
          icon: "round"
        }
      : null,
    mostLandings
      ? {
          label: "Meiste Punktlandungen",
          value: mostLandings.player.name,
          detail: `${mostLandings.hits}/${Math.max(1, mostLandings.roundsPlayed)} Runden · ${formatPercent(mostLandings.hitRate)}`,
          color: mostLandings.player.color,
          icon: "hits"
        }
      : null,
    fastest
      ? {
          label: "Schnellster Tipper",
          value: fastest.player.name,
          detail: `${formatSeconds(fastest.totalGuessSeconds)} gesamt · Ø ${formatSeconds(fastest.averageGuessSeconds)}`,
          color: fastest.player.color,
          icon: "speed"
        }
      : null,
    mostAccurate
      ? {
          label: "Bester Entfernungsschnitt",
          value: mostAccurate.player.name,
          detail: mostAccurate.averageDistanceKm === null ? "Keine Wertung" : `${formatDistance(mostAccurate.averageDistanceKm)} im Schnitt`,
          color: mostAccurate.player.color,
          icon: "distance"
        }
      : null,
    mostConsistent
      ? {
          label: "Konstanteste Leistung",
          value: mostConsistent.player.name,
          detail: `Ø ${formatPoints(mostConsistent.averagePoints)} Punkte · ± ${formatPoints(mostConsistent.scoreDeviation ?? 0)}`,
          color: mostConsistent.player.color,
          icon: "consistency"
        }
      : null
  ].filter(Boolean) as FinalHighlight[];
}

const resultsSurfaceStorageKey = "punktlandung-results-surface-v1";

function resultsSessionId(room: RoomState): string {
  return `${room.code}:${room.summaries.at(-1)?.completedAt ?? 0}`;
}

function readStoredFinalSurface(room: RoomState): boolean {
  if (typeof window === "undefined" || room.status !== "finished") return false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(resultsSurfaceStorageKey) ?? "null") as { sessionId?: string; surface?: string } | null;
    return stored?.sessionId === resultsSessionId(room) && stored.surface === "final";
  } catch {
    return false;
  }
}

function writeStoredFinalSurface(room: RoomState, showFinal: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (showFinal) {
      window.localStorage.setItem(resultsSurfaceStorageKey, JSON.stringify({ sessionId: resultsSessionId(room), surface: "final" }));
      return;
    }
    const stored = JSON.parse(window.localStorage.getItem(resultsSurfaceStorageKey) ?? "null") as { sessionId?: string } | null;
    if (stored?.sessionId === resultsSessionId(room)) window.localStorage.removeItem(resultsSurfaceStorageKey);
  } catch {
    // The result view remains usable when browser storage is unavailable.
  }
}

export function ResultsView({ room, isHost, meId, onNext, onReadyNextRound, onBackToLobby, onRestart, onDiscardSession, redesign = false, accountsEnabled = false, accountAuthenticated = false, serverRanked = false, rankedGameId = null, rankedSyncStatus = "secured", pendingUploadCount = 0, initialSurface }: ResultsViewProps) {
  const { playSuccess } = useSound();
  const revealed = true;
  const [nowTick, setNowTick] = useState(Date.now());
  const [showLanding, setShowLanding] = useState(false);
  const [showImageReplay, setShowImageReplay] = useState(false);
  const [showFinalStandings, setShowFinalStandings] = useState(() => initialSurface === "final" || readStoredFinalSurface(room));
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "auth" | "error">("idle");
  const [saveOfferDismissed, setSaveOfferDismissed] = useState(false);
  const [replayMapSize, setReplayMapSize] = useState<"closed" | "open" | "full">("closed");
  const [advancingRound, setAdvancingRound] = useState(false);
  const [globeUnavailable, setGlobeUnavailable] = useState(false);
  const [resultAnimationComplete, setResultAnimationComplete] = useState(false);

  useEffect(() => {
    if (!room.nextRoundPreviewUrl) return;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    image.src = room.nextRoundPreviewUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [room.nextRoundPreviewUrl]);
  const [replayChromeHidden, setReplayChromeHidden] = useState(false);
  const [replayChromeHoverHidden, setReplayChromeHoverHidden] = useState(false);
  const [isReplayMobilePortrait, setIsReplayMobilePortrait] = useState(false);
  const [isReplayMobileLandscape, setIsReplayMobileLandscape] = useState(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const replayMapCloseTimer = useRef<number | null>(null);
  const summary = room.summaries?.[room.summaries.length - 1] ?? null;
  const location = summary?.location ?? null;
  const ranked = useMemo(() => rankResults(summary?.results ?? []), [summary]);
  const canonicalPlayers = useMemo(
    () => room.players.map((player, index) => ({ ...player, color: player.color || playerColorAt(index) })),
    [room.players]
  );
  const globeScenario = useMemo<ResultCameraScenario | null>(() => {
    if (!summary || !location) return null;
    const submittedResults = ranked.filter((result) => result.guess);
    if (submittedResults.length !== 1) return null;
    const primaryResult = submittedResults.find((result) => result.playerId === meId) ?? submittedResults[0];
    if (!primaryResult?.guess) return null;
    const player = playerFor(canonicalPlayers, primaryResult.playerId);
    const rankIndex = ranked.findIndex((result) => result.playerId === primaryResult.playerId);
    return {
      id: `result-${summary.roundNumber}-${summary.completedAt}-${primaryResult.playerId}`,
      label: `${player?.name ?? "Spieler"} → ${location.title}`,
      description: "Echte Tipp- und Zielkoordinaten dieser Runde",
      playerName: `#${Math.max(0, rankIndex) + 1} ${player?.name ?? "Spieler"}`,
      targetName: location.title,
      targetDescription: location.shortDescription ?? `${location.countryName} · ${location.continent}`,
      guess: [primaryResult.guess.lng, primaryResult.guess.lat],
      target: [location.lng, location.lat]
    };
  }, [canonicalPlayers, location, meId, ranked, summary]);
  const sortedPlayers = [...canonicalPlayers].sort((a, b) => b.score - a.score);
  const finalStats = useMemo(() => buildFinalStats(canonicalPlayers, room.summaries ?? []), [canonicalPlayers, room.summaries]);
  const finalHighlights = useMemo(() => buildFinalHighlights(finalStats, room.summaries ?? [], canonicalPlayers), [canonicalPlayers, finalStats, room.summaries]);
  const completedRounds = room.summaries?.length ?? room.settings.rounds;
  const displayedFinalHighlights = finalHighlights.slice(0, 6);
  const champion = sortedPlayers[0] ?? null;
  const runnerUp = sortedPlayers[1] ?? null;
  const lastPlayer = sortedPlayers.length > 1 ? sortedPlayers[sortedPlayers.length - 1] : null;
  const championStats = finalStats[0] ?? null;
  const lead = scoreLead(sortedPlayers);
  const bestRoundResult = ranked[0] ?? null;
  const latestResultByPlayerId = useMemo(() => new Map(ranked.map((result) => [result.playerId, result])), [ranked]);
  const finished = room.status === "finished";
  const showFinalSurface = () => {
    writeStoredFinalSurface(room, true);
    setShowFinalStandings(true);
  };
  const showResolutionSurface = () => {
    writeStoredFinalSurface(room, false);
    setShowFinalStandings(false);
  };
  const meStats = finalStats.find((entry) => entry.player.id === meId) ?? finalStats[0] ?? null;
  const buildSaveInput = (): SaveCompletedGameInput | null => {
    if (!meStats || !room.summaries.length) return null;
    return {
      saveKey: `${room.code}:${room.summaries[0]?.roundStartedAt ?? room.summaries[0]?.completedAt ?? 0}:${meStats.player.id}`,
      category: room.settings.category,
      timeLimitSec: room.settings.timeLimitSec,
      difficulty: room.settings.difficulty === "easy" || room.settings.difficulty === "hard" ? room.settings.difficulty : "medium",
      noZoom: room.settings.noZoom,
      score: meStats.player.score,
      completedRounds,
      roundDurationMs: Math.max(1000, room.settings.timeLimitSec * 1000),
      totalResponseTimeMs: Math.round((meStats.totalGuessSeconds ?? 0) * 1000),
      startedAt: room.summaries[0]?.roundStartedAt ?? room.summaries[0]?.completedAt ?? Date.now(),
      completedAt: room.summaries.at(-1)?.completedAt ?? Date.now(),
      rounds: room.summaries.map((round, index) => ({
        roundId: `${room.code}_${index + 1}`,
        roundNumber: index + 1,
        locationId: round.location.id,
        locationSnapshot: round.location as unknown as Record<string, unknown>,
        startedAt: round.roundStartedAt ?? Math.max(1, round.completedAt - Math.max(1000, room.settings.timeLimitSec * 1000)),
        resolvedAt: round.completedAt,
        result: round.results.find((entry) => entry.playerId === meStats.player.id) ?? {
          points: 0,
          distanceKm: 20_015,
          badge: "Keine Abgabe",
          countryCorrect: false,
          eliminated: false,
          guess: null
        }
      }))
    };
  };
  const saveGame = async (): Promise<boolean> => {
    if (savePromiseRef.current) return savePromiseRef.current;
    if (!meStats || saveState === "saved") return saveState === "saved";
    const input = buildSaveInput();
    if (!input) return false;
    setSaveState("saving");
    const savePromise = (async () => {
      try {
        // Queue before the network request. A reload or route change can no
        // longer discard the completed result while the request is pending.
        enqueueCompletedGameSave(input);
        const result = await flushCompletedGameSaves(saveCompletedGame);
        const saved = result.savedKeys.includes(input.saveKey);
        setSaveState(saved ? "saved" : result.authRequired ? "auth" : "error");
        return saved;
      } catch (error) {
        console.error("[ResultsView] completed game save failed", error);
        setSaveState("error");
        return false;
      }
    })();
    savePromiseRef.current = savePromise;
    try {
      return await savePromise;
    } finally {
      if (savePromiseRef.current === savePromise) savePromiseRef.current = null;
    }
  };

  useEffect(() => {
    if (serverRanked || !finished || !accountAuthenticated || saveState === "saved" || saveState === "saving") return;
    void saveGame();
  }, [accountAuthenticated, finished, saveState, serverRanked, summary?.completedAt]);
  const handleBackToLobby = async () => {
    if (finished && accountAuthenticated && saveState !== "saved") await saveGame();
    onBackToLobby();
  };
  const prepareSaveAndOpenLogin = () => {
    if (serverRanked && rankedGameId) {
      enqueueRankedGameClaim(rankedGameId);
    } else {
      const input = buildSaveInput();
      if (input) enqueueCompletedGameSave(input);
    }
    window.location.assign("/anmelden?returnTo=%2Fendergebnis");
  };
  const isFlagRound = location?.category === "flags";
  const landingHits = useMemo(
    () => ranked.filter((result) => result.guess && (result.distanceKm <= punktlandungDistanceKm || result.countryCorrect)),
    [ranked]
  );
  const landingLabel = landingHits.some((result) => result.countryCorrect) && location ? landingLabelsByCategory[location.category] : "Unter 500 m";
  const hasModePanel = room.settings.mode === "crew" || room.settings.mode === "duel";
  const replayMapExpanded = replayMapSize !== "closed";
  const replayMapFull = replayMapSize === "full";
  const replayMapInteractive = replayMapExpanded || isReplayMobilePortrait;
  const showReplayMapSizeButton = (replayMapExpanded || isReplayMobilePortrait) && (!replayMapFull || isReplayMobilePortrait);
  const showReplayMapCloseButton = replayMapExpanded && (!isReplayMobilePortrait || replayMapFull);
  const replayChromeSuppressed = replayChromeHidden || replayChromeHoverHidden;
  const isReplayMobileViewport = isReplayMobilePortrait || isReplayMobileLandscape;
  const countryLabel = displayCountryName(location);
  const continentLabel = displayContinent(location?.continent ?? "");
  const onlineNextRoundGate = room.kind === "online" && room.status === "results";
  const activeOnlinePlayers = useMemo(
    () => canonicalPlayers.filter((player) => player.connected && player.status === "active"),
    [canonicalPlayers]
  );
  const readyPlayerIds = useMemo(() => new Set(room.nextRoundReadyPlayerIds ?? []), [room.nextRoundReadyPlayerIds]);
  const readyPlayerCount = activeOnlinePlayers.filter((player) => readyPlayerIds.has(player.id)).length;
  const isMeReadyForNextRound = Boolean(meId && readyPlayerIds.has(meId));
  const nextRoundCountdownSeconds =
    onlineNextRoundGate && room.nextRoundStartsAt ? Math.max(0, Math.ceil((room.nextRoundStartsAt - nowTick) / 1000)) : null;
  const readyStatusText = `${readyPlayerCount}/${activeOnlinePlayers.length} bereit`;
  const nextRoundButtonLabel =
    onlineNextRoundGate && nextRoundCountdownSeconds !== null
      ? `Start in ${nextRoundCountdownSeconds}s`
      : onlineNextRoundGate && !isHost
        ? isMeReadyForNextRound
          ? readyStatusText
          : "Bereit für nächste Runde"
        : "Nächste Runde";
    const nextRoundButtonContent = nextRoundButtonLabel === "Nächste Runde" ? (
      <span className="punktlandung-next-round-label" aria-label="Nächste Runde">
        <span>Nächste</span>
        <span>Runde</span>
      </span>
    ) : nextRoundButtonLabel;
  const nextRoundButtonDisabled = advancingRound || (onlineNextRoundGate
    ? isHost
      ? Boolean(room.nextRoundStartsAt)
      : isMeReadyForNextRound || !onReadyNextRound
    : !isHost);
  const scoreGradient = redesign ? redesignScoreGradient : scoreHeatmapGradient;
  const handleNextRoundButton = async () => {
    if (advancingRound) return;
    if (onlineNextRoundGate && !isHost) {
      onReadyNextRound?.();
      return;
    }
    setAdvancingRound(true);
    // Leave the replay surface immediately. Preparing the already prefetched
    // image can still take a moment on slower connections; keeping the old
    // image visible made the click look broken and invited duplicate clicks.
    setReplayMapSize("closed");
    setShowImageReplay(false);
    try {
      await Promise.resolve(onNext());
    } finally {
      setAdvancingRound(false);
    }
  };
  const replayMapPanelLayout = replayMapFull
    ? "fixed bottom-3 right-3 h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] sm:bottom-4 sm:right-4 sm:h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)]"
    : replayMapExpanded
      ? "absolute bottom-3 left-3 right-3 h-[min(56svh,470px)] sm:bottom-4 sm:left-auto sm:right-4 sm:h-[min(56svh,540px)] sm:w-[min(58vw,720px)] min-[1900px]:h-[min(56svh,580px)] min-[1900px]:w-[min(52vw,820px)] min-[2400px]:w-[min(48vw,980px)]"
      : "absolute bottom-3 left-3 right-3 h-[14.5rem] cursor-pointer sm:bottom-4 sm:left-auto sm:right-4 sm:h-[16.5rem] sm:w-[min(52vw,440px)] min-[1900px]:h-[18rem] min-[1900px]:w-[min(48vw,520px)] sm:hover:-translate-y-1";

  useEffect(() => {
    setShowLanding(false);
    setShowImageReplay(false);
    setShowFinalStandings(readStoredFinalSurface(room));
    setFeedbackDialogOpen(false);
    setReplayMapSize("closed");
    setReplayChromeHidden(false);
    setReplayChromeHoverHidden(false);
    setGlobeUnavailable(false);
  }, [room.code, room.status, summary?.roundNumber, summary?.completedAt]);

  useEffect(() => {
    setResultAnimationComplete(!globeScenario);
  }, [globeScenario]);

  useEffect(() => {
    if (!finished || !showFinalStandings || !feedbackPromptAllowed()) return;
    if (accountsEnabled && !accountAuthenticated && !saveOfferDismissed) return;
    const timer = window.setTimeout(() => setFeedbackDialogOpen(true), 1100);
    return () => window.clearTimeout(timer);
  }, [accountAuthenticated, accountsEnabled, finished, saveOfferDismissed, showFinalStandings, summary?.completedAt]);

  useEffect(() => {
    if (!replayChromeHidden) return;
    const timer = window.setTimeout(() => setReplayChromeHidden(false), 5000);
    return () => window.clearTimeout(timer);
  }, [replayChromeHidden]);

  useEffect(() => {
    if (!room.nextRoundStartsAt) return;
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [room.nextRoundStartsAt]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 879px) and (orientation: portrait)");
    const update = () => setIsReplayMobilePortrait(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px) and (max-height: 520px) and (orientation: landscape)");
    const update = () => setIsReplayMobileLandscape(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => {
      if (replayMapCloseTimer.current !== null) window.clearTimeout(replayMapCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (landingHits.length === 0 || !revealed || !resultAnimationComplete) return;
    const showTimer = window.setTimeout(() => {
      setShowLanding(true);
      playSuccess();
    }, punktlandungDelayMs);
    const hideTimer = window.setTimeout(() => setShowLanding(false), punktlandungDelayMs + punktlandungVisibleMs);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [landingHits.length, playSuccess, resultAnimationComplete, revealed, summary?.roundNumber]);

  const openImageReplay = () => {
    setReplayMapSize("closed");
    setReplayChromeHidden(false);
    setShowImageReplay(true);
  };

  const openReplayMapByHover = () => {
    if (isReplayMobilePortrait) return;
    if (replayMapFull) return;
    if (replayMapCloseTimer.current !== null) {
      window.clearTimeout(replayMapCloseTimer.current);
      replayMapCloseTimer.current = null;
    }
    setReplayMapSize("open");
  };

  const closeReplayMapByHover = () => {
    if (isReplayMobilePortrait) return;
    if (replayMapFull) return;
    if (replayMapCloseTimer.current !== null) window.clearTimeout(replayMapCloseTimer.current);
    replayMapCloseTimer.current = window.setTimeout(() => {
      setReplayMapSize("closed");
      replayMapCloseTimer.current = null;
    }, 480);
  };

  const hideReplayChrome = () => {
    setReplayMapSize("closed");
    setReplayChromeHidden(true);
  };

  const toggleReplayImageFocus = () => {
    if (!isReplayMobileViewport || replayMapFull) return;
    if (replayChromeHidden) {
      setReplayChromeHidden(false);
      return;
    }
    hideReplayChrome();
  };

  if (!summary || !location) return null;

  return (
    <main className={`punktlandung-results-shell h-dvh overflow-x-hidden overflow-y-auto bg-slate-950 p-2 text-slate-50 md:p-4 xl:overflow-hidden ${redesign ? redesignStyles.redesign : ""}`}>
      {showLanding && landingHits.length > 0 && (
        <div
          aria-live="polite"
          className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/72 p-4 backdrop-blur-[5px]"
          onClick={() => setShowLanding(false)}
        >
          <div
            className="punktlandung-celebration relative grid min-h-[340px] w-full max-w-2xl place-items-center overflow-hidden rounded-md bg-slate-950/94 px-6 py-11 text-center shadow-[0_34px_110px_rgba(0,0,0,0.72),0_0_70px_rgba(52,211,153,0.30)] ring-2 ring-emerald-300/90"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="punktlandung-aura" />
            <div className="punktlandung-ring" />
            <div className="punktlandung-ring punktlandung-ring-delay" />
            <div className="punktlandung-spark punktlandung-spark-1" />
            <div className="punktlandung-spark punktlandung-spark-2" />
            <div className="punktlandung-spark punktlandung-spark-3" />
            <div className="punktlandung-spark punktlandung-spark-4" />
            <div className="punktlandung-pin" />
            <div className="relative z-10 mt-40 w-full max-w-[44rem] rounded-md bg-slate-950/76 px-4 py-5 shadow-[0_22px_70px_rgba(0,0,0,0.50),0_0_55px_rgba(52,211,153,0.18)] ring-1 ring-emerald-300/35 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.34em] text-emerald-200 drop-shadow-[0_0_18px_rgba(52,211,153,0.85)]">{landingLabel}</p>
              <h2 className="mt-2 text-4xl font-black leading-none text-white drop-shadow-[0_0_28px_rgba(52,211,153,0.58)] md:text-6xl">Punktlandung!</h2>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {landingHits.map((result, index) => {
                  const player = playerFor(canonicalPlayers, result.playerId);
                  return (
                    <span
                      key={result.playerId}
                      className="punktlandung-hit-chip rounded-md px-3 py-1.5 text-sm font-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.25)] drop-shadow-[0_2px_14px_rgba(0,0,0,0.80)]"
                      style={{ "--player-color": player?.color ?? "#34d399" } as CSSProperties}
                    >
                      #{index + 1} {player?.name ?? "Spieler"}
                      <span className="punktlandung-hit-chip-detail">
                        {" "}
                        · {result.countryCorrect ? "voll getroffen" : `${formatDistance(result.distanceKm)} entfernt`}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        aria-hidden={!showImageReplay}
        inert={!showImageReplay}
        className={`punktlandung-image-replay fixed inset-0 z-[100] overflow-hidden bg-slate-950 transition-opacity duration-150 ${
          showImageReplay ? "visible pointer-events-auto opacity-100" : "invisible pointer-events-none opacity-0"
        }`}
      >
          <div className="punktlandung-replay-viewer absolute inset-0 overflow-hidden">
            <PanoramaViewer
              location={location}
              settings={room.settings}
              isHost={false}
              onSkipLocation={() => undefined}
              chromeHidden={replayChromeSuppressed}
              onViewportTap={isReplayMobileViewport ? toggleReplayImageFocus : undefined}
              sourceVariant="detail"
            />
          </div>

          {showImageReplay && !replayChromeSuppressed && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.42)_0%,rgba(2,6,23,0)_28%,rgba(2,6,23,0.04)_68%,rgba(2,6,23,0.36)_100%)]" />}

          {showImageReplay && !replayChromeSuppressed && (
            <div className="punktlandung-replay-header absolute left-3 right-3 top-3 z-30 grid grid-cols-[minmax(0,min(36rem,calc(100vw-6rem)))_auto] items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
              <div className="punktlandung-replay-info max-w-[min(36rem,calc(100vw-1.5rem))] rounded-md bg-slate-950/58 px-4 py-3 shadow-[0_18px_46px_rgba(0,0,0,0.34)] ring-1 ring-slate-600/60 backdrop-blur-md sm:px-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-300">Bild nochmal ansehen</p>
                <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">{location.title}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-200">
                  {countryLabel} · {continentLabel}
                </p>
              </div>

              <div className="punktlandung-replay-top-actions grid gap-2 justify-self-end sm:flex">
                <BackButton
                  className="punktlandung-action-back-button punktlandung-optical-arrow-left min-h-12"
                  onClick={() => {
                    setReplayMapSize("closed");
                    setShowImageReplay(false);
                  }}
                  label={showFinalStandings ? "Zurück zum Endstand" : "Zurück zur Auflösung"}
                />
                {finished ? (
                  showFinalStandings ? (
                    <Button sound="select" tone="selected" className="punktlandung-command-button punktlandung-primary-action min-h-12 text-xs normal-case" disabled={!isHost} onClick={onRestart}>
                      Neue Partie
                    </Button>
                  ) : (
                    <Button
                      sound="select"
                      tone="selected"
                      className="punktlandung-command-button punktlandung-primary-action min-h-12 text-xs normal-case"
                      onClick={() => {
                        setReplayMapSize("closed");
                        setShowImageReplay(false);
                        showFinalSurface();
                      }}
                    >
                      Endstand ansehen
                    </Button>
                  )
                ) : (
                  <Button sound="select" tone="selected" className="punktlandung-command-button punktlandung-primary-action punktlandung-optical-arrow-right min-h-12 text-xs normal-case" disabled={nextRoundButtonDisabled} onClick={handleNextRoundButton}>
                    <span className="punktlandung-inline-action-content">
                      <span>{nextRoundButtonContent}</span>
                      <TriangleIcon direction="right" className="punktlandung-inline-action-icon h-4 w-4" />
                    </span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {!isReplayMobileViewport && !replayMapFull && (
          <button
            type="button"
            onClick={replayChromeHidden ? () => setReplayChromeHidden(false) : hideReplayChrome}
            onMouseEnter={() => setReplayChromeHoverHidden(true)}
            onMouseLeave={() => setReplayChromeHoverHidden(false)}
            className={`punktlandung-focus-tab fixed left-0 z-[80] rounded-r-md border-3 px-2.5 py-4 text-[12px] font-black tracking-[0.02em] shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-md transition ${
              replayChromeSuppressed
                ? "border-emerald-300/85 bg-emerald-400/18 text-emerald-100"
                : "border-slate-500/70 bg-slate-950/58 text-slate-100 hover:border-emerald-300/80 hover:bg-slate-900/86"
            }`}
            title={replayChromeSuppressed ? "Einblendungen wieder anzeigen" : "Einblendungen für 5 Sekunden ausblenden"}
          >
            <span className="punktlandung-focus-tab-content">
              <span className="punktlandung-focus-tab-text">{replayChromeSuppressed ? "Einblenden" : "Bild frei"}</span>
              <Eye className="punktlandung-focus-tab-icon" aria-hidden="true" />
            </span>
          </button>
          )}

          {!replayChromeSuppressed && (
            <section
            className={`punktlandung-guess-map-panel ${replayMapFull ? "punktlandung-guess-map-panel--full" : replayMapExpanded ? "punktlandung-guess-map-panel--open" : "punktlandung-guess-map-panel--closed"} origin-bottom-right transform-gpu z-40 overflow-hidden rounded-md bg-slate-950/88 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.34)] ring-1 ring-indigo-300/45 backdrop-blur-md transition-[width,height,transform] duration-300 sm:p-3 ${replayMapPanelLayout}`}
            onMouseEnter={openReplayMapByHover}
            onMouseLeave={closeReplayMapByHover}
            onClick={() => {
              if (!replayMapExpanded && !isReplayMobilePortrait) setReplayMapSize("open");
            }}
          >
            <div className="flex h-full flex-col gap-3">
              <div className="punktlandung-map-panel-header flex items-center justify-between gap-3">
                <p className="punktlandung-map-panel-title min-w-0 text-xs font-black uppercase tracking-[0.2em] text-indigo-300">Karte öffnen</p>
                <div className="punktlandung-map-panel-actions flex shrink-0 gap-2">
                  {showReplayMapSizeButton && (
                    <Button
                      className="punktlandung-map-size-button min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm"
                      tone="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        setReplayMapSize((value) => (value === "full" ? (isReplayMobilePortrait ? "closed" : "open") : "full"));
                      }}
                      title={replayMapFull ? "Karte verkleinern" : "Karte maximieren"}
                    >
                      {replayMapFull ? "Minimieren" : "Maximieren"}
                    </Button>
                  )}
                  <Button
                    className="punktlandung-replay-map-back punktlandung-map-secondary-button punktlandung-optical-arrow-left min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm"
                    tone="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      setReplayMapSize("closed");
                      setShowImageReplay(false);
                    }}
                    data-tooltip={showFinalStandings ? "Zurück zum Endstand" : "Zurück zur Auflösung"}
                  >
                    <span className="punktlandung-inline-action-content">
                      <TriangleIcon direction="left" className="h-4 w-4" />
                      <span>Zurück</span>
                    </span>
                  </Button>
                  {finished ? (
                    showFinalStandings ? (
                      <Button sound="select" tone="selected" className="punktlandung-replay-map-next punktlandung-map-primary-button punktlandung-primary-action min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm" disabled={!isHost} onClick={onRestart}>
                        Neue Partie
                      </Button>
                    ) : (
                      <Button
                        sound="select"
                        tone="selected"
                        className="punktlandung-replay-map-next punktlandung-map-primary-button punktlandung-primary-action min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm"
                        onClick={() => {
                          setReplayMapSize("closed");
                          setShowImageReplay(false);
                          showFinalSurface();
                        }}
                      >
                        Endstand ansehen
                      </Button>
                    )
                  ) : (
                    <Button sound="select" tone="selected" className="punktlandung-replay-map-next punktlandung-map-primary-button punktlandung-primary-action punktlandung-optical-arrow-right min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm" disabled={nextRoundButtonDisabled} onClick={handleNextRoundButton}>
                      <span className="punktlandung-inline-action-content">
                        <span>{nextRoundButtonContent}</span>
                        <TriangleIcon direction="right" className="punktlandung-inline-action-icon h-4 w-4" />
                      </span>
                    </Button>
                  )}
                  {showReplayMapCloseButton && (
                    <Button
                      className="punktlandung-map-close-button min-h-10 min-w-10 px-0 py-0 text-sm sm:min-h-11 sm:min-w-11"
                      tone="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        setReplayMapSize("closed");
                      }}
                      title="Karte wieder klein machen"
                    >
                      X
                    </Button>
                  )}
                </div>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-md ring-1 ring-slate-700/70">
                <div className={replayMapInteractive ? "h-full w-full" : "pointer-events-none h-full w-full"}>
                  {showImageReplay && globeScenario && !globeUnavailable ? (
                    <GlobeResultMap
                      key={`${globeScenario.id}-replay`}
                      scenario={globeScenario}
                      animate={false}
                      onUnavailable={() => setGlobeUnavailable(true)}
                    />
                  ) : showImageReplay ? (
                    <GuessMap
                      mode="results"
                      players={canonicalPlayers}
                      summary={summary}
                      guesses={room.guesses}
                      resultPaddingScale={0.9}
                      resultZoomScale={replayMapFull ? 1.08 : 1.16}
                      noPan={!replayMapInteractive}
                      noZoom={!replayMapInteractive}
                      showLabels={replayMapInteractive}
                      resizeSignal={`${replayMapSize}-${replayMapInteractive ? "interactive" : "locked"}-${showImageReplay ? "replay" : "hidden"}`}
                    />
                  ) : null}
                </div>
                {!replayMapInteractive && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.06)_100%)]" />}
              </div>
            </div>
          </section>
          )}
      </div>

      {finished && showFinalStandings && !showImageReplay && (
        <div
          className={`punktlandung-final-standings-grid mx-auto grid min-h-full max-w-[132rem] gap-3 transition-opacity duration-300 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,0.96fr)_minmax(35rem,1.04fr)] xl:overflow-hidden ${
            revealed ? "opacity-100" : "opacity-0"
          }`}
        >
          <section className="punktlandung-final-left grid min-h-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
            <div className="punktlandung-final-hero relative isolate overflow-hidden rounded-md border border-emerald-300/35 bg-slate-900/78 p-4 shadow-[0_26px_70px_rgba(0,0,0,0.34)] ring-1 ring-emerald-300/20">
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.34em] text-emerald-300">
                    <Trophy aria-hidden="true" className="h-4 w-4" />
                    Endstand
                  </p>
                  <h1 className="mt-2 text-3xl font-black leading-none text-white md:text-4xl">Partie abgeschlossen</h1>
                </div>
              </div>

              <div className="relative z-10 mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.04fr)_minmax(15rem,0.96fr)]">
                <div className="punktlandung-final-winner-card rounded-md bg-slate-950/62 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.24)] ring-1 ring-emerald-300/40" style={{ "--player-color": champion?.color ?? "#5ee7bd" } as CSSProperties}>
                  <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-emerald-200">
                    <Medal aria-hidden="true" className="h-5 w-5" />
                    Sieger der Partie
                  </p>
                  <div className="mt-3 flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="punktlandung-final-player-accent h-14 w-2 rounded-full" style={playerAccentStyle(champion?.color)} />
                    <div className="min-w-0">
                      <p className="punktlandung-final-winner-name break-words text-[clamp(1.85rem,3.2vw,3rem)] font-black leading-[0.95] text-white">{champion?.name ?? "Niemand"}</p>
                      <p className="mt-2 text-sm font-semibold text-emerald-300">
                        {champion ? `${formatPoints(champion.score)} Punkte` : "Keine Wertung"}
                        {runnerUp ? ` · ${formatPoints(lead)} Vorsprung` : ""}
                      </p>
                      <p className="mt-1 text-sm italic text-slate-300">
                        {championStats?.title ? `ist ${badgeWithArticle(championStats.title)}` : "ist unangefochten"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="punktlandung-final-summary-column min-w-0">
                  <p className="punktlandung-final-rounds-played mb-2 inline-flex w-full items-center justify-end gap-2 text-sm font-semibold text-slate-300">
                    <RotateCcw aria-hidden="true" className="h-4 w-4 text-indigo-300" />
                    {roundsPlayedLabel(completedRounds)} gespielt
                  </p>
                  <div className="punktlandung-final-summary-metrics grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300"><Gauge aria-hidden="true" className="h-4 w-4 shrink-0" />Punkte je Runde</p>
                    <p className="mt-1 text-xl font-black">{championStats ? formatPoints(championStats.averagePoints) : "0"}</p>
                  </div>
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300"><Target aria-hidden="true" className="h-4 w-4 shrink-0" />Trefferquote</p>
                    <p className="mt-1 text-xl font-black">{championStats ? formatPercent(championStats.hitRate) : "0 %"}</p>
                  </div>
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />Ø Entfernung</p>
                    <p className="mt-1 truncate text-xl font-black">{championStats?.averageDistanceKm == null ? "-" : formatDistance(championStats.averageDistanceKm)}</p>
                  </div>
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300"><Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />Tippzeit gesamt</p>
                    <p className="mt-1 text-xl font-black">{formatSeconds(championStats?.totalGuessSeconds ?? null)}</p>
                  </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="punktlandung-final-highlights-panel min-h-0 rounded-md border border-slate-700/55 bg-slate-900/72 p-4 xl:overflow-hidden">
              <div>
                <h2 className="flex items-center gap-2 text-[22px] font-black leading-tight"><BarChart3 aria-hidden="true" className="h-5 w-5 text-emerald-300" />Partie in Zahlen</h2>
              </div>
              <div className="punktlandung-final-highlights mt-3 grid min-h-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {displayedFinalHighlights.map((highlight) => {
                    const HighlightIcon = highlight.icon === "closest"
                      ? MapPin
                      : highlight.icon === "round"
                        ? Award
                        : highlight.icon === "hits"
                          ? Target
                          : highlight.icon === "speed"
                            ? Clock3
                            : highlight.icon === "distance"
                              ? Gauge
                            : highlight.icon === "consistency"
                              ? Activity
                              : Sparkles;
                    return (
                    <div key={`${highlight.tone ?? "metric"}-${highlight.label}`} className="punktlandung-final-player-row relative min-w-0 overflow-hidden rounded-md bg-slate-950/48 p-3 ring-1 ring-slate-700/55" style={{ "--player-color": highlight.color } as CSSProperties}>
                      {highlight.color ? (
                        <span aria-hidden="true" className="punktlandung-final-player-accent absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full" style={playerAccentStyle(highlight.color)} />
                      ) : null}
                      <p className={`flex items-center gap-1.5 font-black uppercase text-indigo-300 ${highlight.tone === "category" ? "text-[11px] tracking-[0.18em]" : "text-xs tracking-[0.14em]"}`}>
                        <HighlightIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />
                        {highlight.label}
                      </p>
                      <p className="mt-1 break-words text-xl font-black leading-tight text-white">{highlight.value}</p>
                      <p className="mt-0.5 line-clamp-2 min-h-8 break-words text-[13px] font-semibold leading-4 text-slate-300">{highlight.detail}</p>
                    </div>
                    );
                  })}
              </div>
            </div>
          </section>

          <aside className="punktlandung-final-table min-h-0 rounded-md border border-slate-700/55 bg-slate-900/72 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)] xl:overflow-hidden">
            <div className={`punktlandung-final-topbar mb-3 flex items-center gap-2 border-b border-slate-700/55 pb-3${accountsEnabled && !accountAuthenticated && !saveOfferDismissed ? " is-expanded-save-offer" : ""}`}>
            {accountsEnabled && (
              <section className="punktlandung-final-save-status min-w-0 flex-1 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-3 py-2 text-left" aria-live="polite">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">{accountAuthenticated ? "Automatisch speichern" : "Spielstand mitnehmen"}</p>
                {serverRanked && finished ? (
                  rankedSyncStatus === "verified" ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-100">Gespeichert und fürs Ranking gewertet.</p>
                  ) : rankedSyncStatus === "uploading" ? (
                    <p className="mt-1 text-sm font-semibold text-slate-200">Deine Partie wird gerade gespeichert …</p>
                  ) : rankedSyncStatus === "pending" ? (
                    <p className="mt-1 text-sm font-semibold text-amber-100">Die Speicherung läuft weiter. Dein Ergebnis bleibt erhalten.</p>
                  ) : !accountAuthenticated ? (
                    saveOfferDismissed ? (
                      <p className="mt-1 text-sm font-semibold text-slate-300">Nicht gespeichert.</p>
                    ) : (
                      <div className="mt-1 grid gap-2">
                        <p className="text-sm font-semibold text-slate-200">Melde dich an oder erstelle ein Konto, um deine Partie zu speichern und ins Ranking aufzunehmen. Das Spielen bleibt kostenlos.</p>
                        <div className="flex flex-wrap gap-2">
                          <ButtonLink tone="selected" className="punktlandung-command-button punktlandung-primary-action min-h-11 text-xs normal-case" href="/anmelden?returnTo=%2Fendergebnis" onNavigate={prepareSaveAndOpenLogin}>Spielstand speichern</ButtonLink>
                          <Button tone="ghost" className="min-h-11 text-xs normal-case" onClick={() => setSaveOfferDismissed(true)}>Nicht speichern</Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-200">Deine Partie wird deinem Konto hinzugefügt …</p>
                  )
                ) : saveState === "saved" ? (
                  <p className="mt-1 text-sm font-semibold text-emerald-100">Gespeichert. Deine Partie erscheint jetzt im Spielverlauf.</p>
                ) : accountAuthenticated && saveState === "saving" ? (
                  <p className="mt-1 text-sm font-semibold text-slate-200">Deine Partie wird gerade automatisch gespeichert …</p>
                ) : saveState === "auth" ? (
                    <p className="mt-1 text-sm font-semibold text-slate-200">Melde dich an, um diese Runde dauerhaft zu speichern. <a className="text-emerald-300 underline" href="/anmelden?returnTo=%2Fendergebnis" onClick={(event) => { event.preventDefault(); prepareSaveAndOpenLogin(); }}>Jetzt anmelden</a></p>
                ) : !accountAuthenticated && saveOfferDismissed ? (
                  <p className="mt-1 text-sm font-semibold text-slate-300">Nicht gespeichert.</p>
                  ) : !accountAuthenticated ? (
                  <div className="mt-1 grid gap-2">
                    <p className="text-sm font-semibold text-slate-200">Möchtest du diese Partie dauerhaft speichern? Das Spiel bleibt auch ohne Konto kostenlos.</p>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink tone="selected" className="punktlandung-command-button punktlandung-primary-action min-h-11 text-xs normal-case" href="/anmelden?returnTo=%2Fendergebnis" onNavigate={prepareSaveAndOpenLogin}>Spielstand speichern</ButtonLink>
                      <Button tone="ghost" className="min-h-9 text-xs normal-case" onClick={() => setSaveOfferDismissed(true)}>Nicht speichern</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-200">{saveState === "error" ? "Das automatische Speichern hat noch nicht geklappt." : "Ergebnisse und Punktzahl werden automatisch deinem Konto hinzugefügt."}</p>
                    <Button tone="selected" className="min-h-9 text-xs normal-case" disabled={saveState === "saving"} onClick={saveGame}>
                      {saveState === "saving" ? "Speichere …" : "Erneut versuchen"}
                    </Button>
                  </div>
                )}
              </section>
            )}
            <div className="punktlandung-final-actions flex shrink-0 flex-wrap justify-end gap-2">
              <Button tone="ghost" className="punktlandung-command-button min-h-11 text-xs normal-case" onClick={() => setFeedbackDialogOpen(true)}>
                <span className="punktlandung-inline-action-content"><MessageSquareText aria-hidden="true" className="h-4 w-4" /><span>Feedback geben</span></span>
              </Button>
              <Button tone="ghost" className="punktlandung-command-button min-h-11 text-xs normal-case" onClick={showResolutionSurface}>
                <span className="punktlandung-inline-action-content"><Images aria-hidden="true" className="h-4 w-4" /><span>Letzte Auflösung</span></span>
              </Button>
              <BackButton className="punktlandung-optical-arrow-left min-h-11" disabled={!isHost} onClick={handleBackToLobby} label="Zurück zu den Spieleinstellungen" />
              <Button tone="selected" className="punktlandung-command-button punktlandung-primary-action min-h-11 text-xs normal-case" disabled={!isHost} onClick={onRestart}>
                <span className="punktlandung-inline-action-content"><RotateCcw aria-hidden="true" className="h-4 w-4" /><span>Neue Partie</span></span>
              </Button>
            </div>
            </div>
            <div className="punktlandung-final-table-heading flex flex-wrap items-end justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[24px] font-black leading-tight"><Award aria-hidden="true" className="h-6 w-6 text-emerald-300" />Finaltabelle</h2>
              <p className="text-xs font-semibold text-slate-400">{finalStats.length} gewertet</p>
            </div>
            <div className={`punktlandung-final-table-list mt-3 grid gap-1.5${finalStats.length >= 6 ? " is-dense" : ""}`}>
              {finalStats.map((stat) => {
                const maxScore = Math.max(1, champion?.score ?? stat.player.score);
                const percent = Math.max(4, Math.min(100, (stat.player.score / maxScore) * 100));
                const barBackgroundSize = `${10000 / Math.max(1, percent)}% 100%`;
                const hasLongPlayerName = Array.from(stat.player.name).length >= 14;
                return (
                  <div key={stat.player.id} className={`punktlandung-final-player-row rounded-md bg-slate-950/45 px-3 py-1.5 ring-1 ring-slate-700/55${hasLongPlayerName ? " has-long-name" : ""}`} style={{ "--player-color": stat.player.color } as CSSProperties}>
                      <div className="punktlandung-final-player-identity flex min-w-0 items-start gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-7 shrink-0 text-base font-black text-indigo-200">#{stat.rank}</span>
                        <span aria-hidden="true" className="punktlandung-final-player-accent h-7 w-1 rounded-full" style={playerAccentStyle(stat.player.color)} />
                        <div className="punktlandung-final-player-name-line flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <span className="punktlandung-final-player-name break-words text-[15px] font-black leading-tight">{stat.player.name}</span>
                          {stat.title ? <span className="punktlandung-final-player-title text-[11px] italic text-emerald-300">· {badgeWithArticle(stat.title)}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="punktlandung-final-player-score mt-1.5 grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3">
                      <div className="h-1.5 overflow-hidden rounded-sm bg-slate-800">
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${percent}%`,
                            background: scoreGradient,
                            backgroundSize: barBackgroundSize,
                            boxShadow: "0 0 12px rgba(52, 211, 153, 0.22)"
                          }}
                        />
                      </div>
                      <span className="min-w-[4.5rem] shrink-0 text-right text-lg font-black text-emerald-300" title="Punkte insgesamt">
                        <small className="mr-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Gesamt</small>
                        {formatPoints(stat.player.score)}
                      </span>
                    </div>
                    <div className="punktlandung-final-player-metrics mt-2 grid gap-x-2 gap-y-1.5 text-[10px] text-slate-300">
                      <p title={`Punkte je Runde: ${formatPoints(stat.averagePoints)}`}><Gauge aria-hidden="true" /><span className="font-black text-indigo-300">Punkte je Runde</span><strong>{formatPoints(stat.averagePoints)}</strong></p>
                      <p title={`Trefferquote: ${formatPercent(stat.hitRate)}`}><Target aria-hidden="true" /><span className="font-black text-indigo-300">Trefferquote</span><strong>{formatPercent(stat.hitRate)} · {stat.hits}/{Math.max(1, stat.roundsPlayed)}</strong></p>
                      <p title={`Durchschnittliche Entfernung: ${stat.averageDistanceKm === null ? "keine Wertung" : formatDistance(stat.averageDistanceKm)}`}><MapPin aria-hidden="true" /><span className="font-black text-indigo-300">Ø Entfernung</span><strong>{stat.averageDistanceKm === null ? "-" : formatDistance(stat.averageDistanceKm)}</strong></p>
                      <p title={`Tippzeit insgesamt: ${formatSeconds(stat.totalGuessSeconds)}`}><Clock3 aria-hidden="true" /><span className="font-black text-indigo-300">Tippzeit gesamt</span><strong>{formatSeconds(stat.totalGuessSeconds)}</strong></p>
                    </div>
                  </div>
                );
              })}
            </div>
            <LegalLinks onNavigate={onDiscardSession} className="punktlandung-final-footer mt-auto border-t border-slate-700/55 pt-3" align="end" />
          </aside>
        </div>
      )}

      {!showImageReplay && (!finished || !showFinalStandings) && (
        <div
          className={`punktlandung-results-grid mx-auto grid min-h-full max-w-[132rem] gap-2 transition-opacity duration-300 md:gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_420px] xl:overflow-hidden min-[2200px]:max-w-[calc(100vw-1rem)] min-[2200px]:grid-cols-[minmax(0,1fr)_560px] ${
            revealed ? "opacity-100" : "opacity-0"
          }`}
        >
        <section className="grid min-h-0 grid-rows-[auto_minmax(300px,1fr)_auto] gap-2 md:gap-3">
          <div className="punktlandung-results-hero relative rounded-md bg-slate-900/72 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-4">
            <div className="punktlandung-results-hero-header flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-300">
                  Auflösung · Runde {summary.roundNumber} von {room.settings.rounds}
                </p>
                <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">{location.title}</h1>
                <p className="mt-1 text-sm text-slate-300">
                  {countryLabel} · {continentLabel}
                </p>
              </div>
              <BackButton className="punktlandung-results-mobile-header-back" disabled={!isHost} onClick={handleBackToLobby} label="Zurück zu den Spieleinstellungen" />
              <div className="hidden sm:flex sm:flex-wrap sm:justify-end sm:gap-2">
                <Button data-tooltip="Zurück zu den Spieleinstellungen" tone="ghost" className="punktlandung-route-tooltip punktlandung-command-button punktlandung-results-action-back punktlandung-optical-arrow-left min-h-12 text-xs normal-case" disabled={!isHost} onClick={handleBackToLobby}>
                  <span className="punktlandung-inline-action-content">
                    <TriangleIcon direction="left" className="h-4 w-4" />
                    <span>Zurück</span>
                  </span>
                </Button>
                <Button tone="ghost" className="punktlandung-command-button min-h-12 text-xs normal-case" onClick={openImageReplay}>
                  Bild nochmal ansehen
                </Button>
                {!finished ? (
                  <Button sound="select" tone="selected" className="punktlandung-command-button punktlandung-primary-action punktlandung-optical-arrow-right min-h-12 text-xs normal-case" disabled={nextRoundButtonDisabled} onClick={handleNextRoundButton}>
                    <span className="punktlandung-inline-action-content">
                    <span>{nextRoundButtonContent}</span>
                      <TriangleIcon direction="right" className="punktlandung-inline-action-icon h-4 w-4" />
                    </span>
                  </Button>
                ) : (
                  <Button sound="select" tone="selected" className="punktlandung-command-button punktlandung-primary-action min-h-12 text-xs normal-case" onClick={showFinalSurface}>
                    Endstand ansehen
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="punktlandung-results-map min-h-0 overflow-hidden rounded-md bg-slate-900 shadow-[0_22px_58px_rgba(0,0,0,0.28)] ring-1 ring-slate-700/70">
            {globeScenario && !globeUnavailable ? (
              <GlobeResultMap
                key={globeScenario.id}
                scenario={globeScenario}
                onAnimationComplete={() => setResultAnimationComplete(true)}
                onUnavailable={() => {
                  setGlobeUnavailable(true);
                  setResultAnimationComplete(true);
                }}
              />
            ) : (
              <GuessMap mode="results" players={canonicalPlayers} summary={summary} guesses={room.guesses} noPan={false} noZoom={false} />
            )}
          </div>

          <div className="punktlandung-results-mobile-actions grid grid-cols-3 gap-2 sm:hidden">
            <Button aria-label="Zurück zu den Spieleinstellungen" tone="ghost" className="punktlandung-optical-arrow-left min-h-12 w-full px-3 py-2 text-xs normal-case" disabled={!isHost} onClick={handleBackToLobby}>
              <span className="punktlandung-inline-action-content">
                <TriangleIcon direction="left" className="h-4 w-4" />
                <span>Zurück</span>
              </span>
            </Button>
            <Button tone="ghost" className="min-h-12 w-full px-3 py-2 text-xs normal-case" onClick={openImageReplay}>
              Bild nochmal ansehen
            </Button>
            {!finished ? (
              <Button sound="select" tone="selected" className="punktlandung-primary-action punktlandung-optical-arrow-right min-h-12 w-full px-3 py-2 text-xs normal-case" disabled={nextRoundButtonDisabled} onClick={handleNextRoundButton}>
                <span className="punktlandung-inline-action-content">
                  <span>{nextRoundButtonContent}</span>
                  <TriangleIcon direction="right" className="punktlandung-inline-action-icon h-4 w-4" />
                </span>
              </Button>
            ) : (
              <Button sound="select" tone="selected" className="punktlandung-primary-action min-h-12 w-full px-3 py-2 text-xs normal-case" onClick={showFinalSurface}>
                Endstand ansehen
              </Button>
            )}
          </div>
        </section>

        <aside
          className={`punktlandung-results-sidebar grid min-h-0 gap-2 md:gap-3 ${
            hasModePanel ? "grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]" : "grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          }`}
        >
          <div className="punktlandung-results-panel punktlandung-results-ranking-panel min-h-0 overflow-hidden rounded-md bg-slate-900/72 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-4">
            <h2 className="flex items-center gap-2 text-[22px] font-black leading-tight"><Medal aria-hidden="true" className="h-5 w-5 text-emerald-300" />Rundenrang</h2>
            <div className="punktlandung-results-list punktlandung-results-flat-list mt-2 grid min-h-0">
              {ranked.map((result, index) => {
                const player = playerFor(canonicalPlayers, result.playerId);
                const scorePercent = scoreHeatmapPercent(result.points);
                const guessTime = formatGuessTime(result.guess?.responseTimeMs);
                return (
                  <div
                    key={result.playerId}
                    className="punktlandung-results-row punktlandung-player-bordered-row relative min-w-0 overflow-hidden rounded-md px-3"
                    style={{ "--player-color": player?.color ?? playerColorAt(0) } as CSSProperties}
                  >
                    <span
                      aria-hidden="true"
                      className="punktlandung-final-player-accent absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                      style={playerAccentStyle(player?.color)}
                    />
                    <div className="punktlandung-results-round-grid w-full min-w-0">
                      <div className="punktlandung-results-topline min-w-0">
                        <span className="punktlandung-results-rank shrink-0 font-black">#{index + 1}</span>
                        <div className="punktlandung-results-identity min-w-0">
                          <span className="punktlandung-results-player min-w-0 font-black">{player?.name ?? "Spieler"}</span>
                          <span className="punktlandung-results-distance text-xs text-slate-300">
                            · {isFlagRound && result.countryCorrect ? "richtiges Land" : `${formatDistance(result.distanceKm)} entfernt`}
                          </span>
                          {guessTime ? (
                            <span
                              className="punktlandung-results-secondary-metrics"
                              title={`Tippzeit in dieser Runde: ${guessTime}`}
                            >
                              · {guessTime} Tippzeit
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="punktlandung-results-scoreline min-w-0">
                        <div className="punktlandung-results-scorebar h-2 min-w-[64px] overflow-hidden rounded-sm bg-slate-800">
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${scorePercent}%`,
                              background: scoreGradient,
                              backgroundSize: `${10000 / scorePercent}% 100%`,
                              boxShadow: "0 0 12px rgba(52, 211, 153, 0.22)"
                            }}
                          />
                        </div>
                        <span className="punktlandung-results-points shrink-0 text-right font-black text-slate-200">{result.points}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {room.settings.mode === "crew" && (
            <div className="rounded-md bg-slate-900/72 p-3 ring-1 ring-emerald-300/45 md:p-4">
              <h2 className="text-[22px] font-black leading-tight">Crew-Kompass</h2>
              <p className="mt-3 text-sm text-slate-300">
                Gruppentipp: {summary.crewDistanceKm === null ? "kein Pin" : `${formatDistance(summary.crewDistanceKm)} daneben`}
              </p>
            </div>
          )}

          {room.settings.mode === "duel" && (
            <div className="rounded-md bg-slate-900/72 p-3 ring-1 ring-rose-400/45 md:p-4">
              <h2 className="text-[22px] font-black leading-tight">Teamstand</h2>
              <div className="mt-4 space-y-3">
                {summary.duel.map((team) => (
                  <div key={team.team}>
                    <div className="flex justify-between text-sm font-black">
                      <span>{team.team === "aurora" ? "Team A" : "Team B"}</span>
                      <span>{team.hp} Punkte übrig</span>
                    </div>
                    <div className="mt-2 h-4 rounded-sm bg-slate-800">
                      <div className="h-full rounded-sm bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, team.hp / 200))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="punktlandung-results-panel punktlandung-results-overall-panel min-h-0 overflow-hidden rounded-md bg-slate-900/72 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-4">
            <h2 className="flex items-center gap-2 text-[22px] font-black leading-tight"><Trophy aria-hidden="true" className="h-5 w-5 text-emerald-300" />Gesamtwertung</h2>
            <div className="punktlandung-results-list punktlandung-results-flat-list mt-2 grid min-h-0">
              {sortedPlayers.map((player, index) => {
                const overallTitle = overallRankingTitleFor(index, sortedPlayers.length);
                const totalPercent = Math.max(4, Math.min(100, (player.score / Math.max(1, champion?.score ?? player.score)) * 100));
                const playerStats = finalStats.find((stats) => stats.player.id === player.id);
                return (
                  <div
                    key={player.id}
                    className="punktlandung-results-row punktlandung-results-total-row punktlandung-player-bordered-row relative min-w-0 overflow-hidden rounded-md px-3"
                    style={{ "--player-color": player.color } as CSSProperties}
                  >
                    <span
                      aria-hidden="true"
                      className="punktlandung-final-player-accent absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                      style={playerAccentStyle(player.color)}
                    />
                    <div className="punktlandung-results-topline min-w-0">
                      <span className="punktlandung-results-rank shrink-0 font-black">#{index + 1}</span>
                      <div className="punktlandung-results-identity min-w-0">
                        <span className="punktlandung-results-player min-w-0 font-black">{player.name}</span>
                        {overallTitle ? (
                          <span className="punktlandung-results-distance text-xs font-normal italic text-emerald-300">
                            · {badgeWithArticle(overallTitle)}
                          </span>
                        ) : null}
                        {playerStats ? (
                          <span
                            className="punktlandung-results-secondary-metrics"
                            title={`Durchschnitt: ${formatPoints(playerStats.averagePoints)} Punkte pro Runde${
                              playerStats.averageDistanceKm === null ? "" : ` und ${formatDistance(playerStats.averageDistanceKm)} Entfernung`
                            }`}
                          >
                            · Ø {formatPoints(playerStats.averagePoints)} Pkt./R.
                            {playerStats.averageDistanceKm === null ? null : <> · Ø {formatDistance(playerStats.averageDistanceKm)}</>}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="punktlandung-results-scoreline min-w-0">
                      <div className="punktlandung-results-scorebar h-2 min-w-[64px] overflow-hidden rounded-sm bg-slate-800">
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${totalPercent}%`,
                            background: scoreGradient,
                            backgroundSize: `${10000 / totalPercent}% 100%`,
                            boxShadow: "0 0 12px rgba(52, 211, 153, 0.22)"
                          }}
                        />
                      </div>
                      <span className="punktlandung-results-points shrink-0 text-right font-black text-emerald-300">{player.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <LegalLinks onNavigate={onDiscardSession} className="punktlandung-results-footer pt-1" align="start" />
          <LegalLinks onNavigate={onDiscardSession} className="punktlandung-results-footer-mobile pt-1" align="end" />
        </aside>
        </div>
      )}
      <FeedbackDialog
        open={feedbackDialogOpen}
        context={{
          source: "post-game",
          mode: room.kind,
          category: room.settings.category,
          rounds: completedRounds
        }}
        onClose={() => {
          postponeFeedbackPrompt(feedbackSkipMs);
          setFeedbackDialogOpen(false);
        }}
        onSubmitted={() => postponeFeedbackPrompt(feedbackSentMs)}
      />
    </main>
  );
}
