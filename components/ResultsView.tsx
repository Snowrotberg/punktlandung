"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LocationCategory, Player, RoomState, RoundResult, RoundSummary } from "@/types/game";
import { formatDistance, rankResults } from "@/lib/geo";
import { Button } from "./Button";
import { GuessMap } from "./GuessMap";
import { PanoramaViewer } from "./PanoramaViewer";
import { useSound } from "./SoundProvider";

const punktlandungDistanceKm = 0.5;
const punktlandungDelayMs = 850;
const punktlandungVisibleMs = 5200;
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
const categoryLabels: Record<LocationCategory, string> = {
  mixed: "Gemischt",
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
  bestCategoryLabel: string;
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
};

type ResultsViewProps = {
  room: RoomState;
  isHost: boolean;
  onNext: () => void;
  onBackToLobby: () => void;
  onRestart: () => void;
  onLeave: () => void;
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

function playerAccentStyle(color = "#f43f5e"): CSSProperties {
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
    const categoryStats = new Map<LocationCategory, { count: number; points: number; hits: number }>();

    playerResults.forEach(({ result, round }) => {
      const category = round.location.category;
      const current = categoryStats.get(category) ?? { count: 0, points: 0, hits: 0 };
      current.count += 1;
      current.points += result.points;
      current.hits += isResultHit(result) ? 1 : 0;
      categoryStats.set(category, current);
    });

    const bestCategory = [...categoryStats.entries()].sort(([, a], [, b]) => {
      const averageDiff = b.points / Math.max(1, b.count) - a.points / Math.max(1, a.count);
      if (averageDiff !== 0) return averageDiff;
      return b.hits / Math.max(1, b.count) - a.hits / Math.max(1, a.count);
    })[0]?.[0];

    return {
      player,
      rank: index + 1,
      title: overallRankingTitleFor(index, rankedPlayers.length),
      roundsPlayed,
      averagePoints: roundsPlayed > 0 ? player.score / roundsPlayed : 0,
      averageDistanceKm: distances.length > 0 ? distances.reduce((sum, distance) => sum + distance, 0) / distances.length : null,
      hitRate: roundsPlayed > 0 ? (hits / roundsPlayed) * 100 : 0,
      hits,
      bestRoundPoints: bestRound?.points ?? 0,
      bestRoundLabel: bestRound ? `${bestRound.label} · ${formatDistance(bestRound.distanceKm)}` : "Keine Runde",
      bestCategoryLabel: bestCategory ? categoryLabels[bestCategory] : "Keine",
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

  return [
    closest
      ? {
          label: "Knappster Tipp",
          value: playerFor(players, closest.result.playerId)?.name ?? "Spieler",
          detail: `${formatDistance(closest.result.distanceKm)} bei ${closest.round.location.title}`,
          color: playerFor(players, closest.result.playerId)?.color
        }
      : null,
    strongestRound
      ? {
          label: "Beste Einzelrunde",
          value: playerFor(players, strongestRound.result.playerId)?.name ?? "Spieler",
          detail: `${formatPoints(strongestRound.result.points)} Punkte bei ${strongestRound.round.location.title}`,
          color: playerFor(players, strongestRound.result.playerId)?.color
        }
      : null,
    mostLandings
      ? {
          label: "Meiste Punktlandungen",
          value: mostLandings.player.name,
          detail: `${mostLandings.hits}/${Math.max(1, mostLandings.roundsPlayed)} Runden · ${formatPercent(mostLandings.hitRate)}`,
          color: mostLandings.player.color
        }
      : null,
    fastest
      ? {
          label: "Schnellster Tipper",
          value: fastest.player.name,
          detail: `${formatSeconds(fastest.totalGuessSeconds)} gesamt · Ø ${formatSeconds(fastest.averageGuessSeconds)}`,
          color: fastest.player.color
        }
      : null,
    mostAccurate
      ? {
          label: "Bester Entfernungsschnitt",
          value: mostAccurate.player.name,
          detail: mostAccurate.averageDistanceKm === null ? "Keine Wertung" : `${formatDistance(mostAccurate.averageDistanceKm)} im Schnitt`,
          color: mostAccurate.player.color
        }
      : null
  ].filter(Boolean) as FinalHighlight[];
}

function buildCategoryHighlights(summaries: RoundSummary[], players: Player[]): FinalHighlight[] {
  const byCategory = new Map<LocationCategory, Map<string, { points: number; rounds: number; hits: number }>>();

  summaries.forEach((round) => {
    const category = round.location.category;
    const categoryStats = byCategory.get(category) ?? new Map<string, { points: number; rounds: number; hits: number }>();
    round.results.forEach((result) => {
      const current = categoryStats.get(result.playerId) ?? { points: 0, rounds: 0, hits: 0 };
      current.points += result.points;
      current.rounds += 1;
      current.hits += isResultHit(result) ? 1 : 0;
      categoryStats.set(result.playerId, current);
    });
    byCategory.set(category, categoryStats);
  });

  return [...byCategory.entries()]
    .filter(([, playerStats]) => playerStats.size > 0)
    .map(([category, playerStats]) => {
      const [playerId, stats] = [...playerStats.entries()].sort(([, a], [, b]) => {
        const averageDiff = b.points / Math.max(1, b.rounds) - a.points / Math.max(1, a.rounds);
        if (averageDiff !== 0) return averageDiff;
        return b.hits - a.hits;
      })[0];
      const player = playerFor(players, playerId);
      return {
        label: categoryLabels[category],
        value: player?.name ?? "Spieler",
        detail: `Ø ${formatPoints(stats.points / Math.max(1, stats.rounds))} Punkte · ${stats.hits}/${stats.rounds} Punktl.`,
        color: player?.color,
        tone: "category" as const
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

export function ResultsView({ room, isHost, onNext, onBackToLobby, onRestart }: ResultsViewProps) {
  const { playSuccess } = useSound();
  const [revealed, setRevealed] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [showImageReplay, setShowImageReplay] = useState(false);
  const [showFinalStandings, setShowFinalStandings] = useState(false);
  const [replayMapSize, setReplayMapSize] = useState<"closed" | "open" | "full">("closed");
  const [replayChromeHidden, setReplayChromeHidden] = useState(false);
  const [replayChromeHoverHidden, setReplayChromeHoverHidden] = useState(false);
  const replayMapCloseTimer = useRef<number | null>(null);
  const summary = room.summaries?.[room.summaries.length - 1] ?? null;
  const location = summary?.location ?? null;
  const ranked = useMemo(() => rankResults(summary?.results ?? []), [summary]);
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const finalStats = useMemo(() => buildFinalStats(room.players, room.summaries ?? []), [room.players, room.summaries]);
  const finalHighlights = useMemo(() => buildFinalHighlights(finalStats, room.summaries ?? [], room.players), [finalStats, room.players, room.summaries]);
  const showMixedCategoryStats = room.settings.category === "mixed";
  const finalCategoryHighlights = useMemo(
    () => (showMixedCategoryStats ? buildCategoryHighlights(room.summaries ?? [], room.players) : []),
    [room.players, room.summaries, showMixedCategoryStats]
  );
  const displayedFinalHighlights = useMemo(
    () => [...finalHighlights, ...finalCategoryHighlights],
    [finalCategoryHighlights, finalHighlights]
  );
  const completedRounds = room.summaries?.length ?? room.settings.rounds;
  const champion = sortedPlayers[0] ?? null;
  const runnerUp = sortedPlayers[1] ?? null;
  const lastPlayer = sortedPlayers.length > 1 ? sortedPlayers[sortedPlayers.length - 1] : null;
  const championStats = finalStats[0] ?? null;
  const lead = scoreLead(sortedPlayers);
  const bestRoundResult = ranked[0] ?? null;
  const latestResultByPlayerId = useMemo(() => new Map(ranked.map((result) => [result.playerId, result])), [ranked]);
  const finished = room.status === "finished";
  const isFlagRound = location?.category === "flags";
  const landingHits = useMemo(
    () => ranked.filter((result) => result.guess && (result.distanceKm <= punktlandungDistanceKm || result.countryCorrect)),
    [ranked]
  );
  const landingLabel = landingHits.some((result) => result.countryCorrect) && location ? landingLabelsByCategory[location.category] : "Unter 500 m";
  const hasModePanel = room.settings.mode === "crew" || room.settings.mode === "duel";
  const replayMapExpanded = replayMapSize !== "closed";
  const replayMapFull = replayMapSize === "full";
  const replayChromeSuppressed = replayChromeHidden || replayChromeHoverHidden;
  const countryLabel = displayCountryName(location);
  const continentLabel = displayContinent(location?.continent ?? "");
  const replayMapPanelLayout = replayMapFull
    ? "fixed bottom-3 right-3 h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] sm:bottom-4 sm:right-4 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]"
    : replayMapExpanded
      ? "absolute bottom-3 left-3 right-3 h-[min(56dvh,470px)] sm:bottom-4 sm:left-auto sm:right-4 sm:h-[min(56dvh,540px)] sm:w-[min(58vw,720px)] min-[1900px]:h-[min(56dvh,580px)] min-[1900px]:w-[min(52vw,820px)] min-[2400px]:w-[min(48vw,980px)]"
      : "absolute bottom-3 left-3 right-3 h-[14.5rem] cursor-pointer sm:bottom-4 sm:left-auto sm:right-4 sm:h-[16.5rem] sm:w-[min(52vw,440px)] min-[1900px]:h-[18rem] min-[1900px]:w-[min(48vw,520px)] sm:hover:-translate-y-1";

  useEffect(() => {
    setRevealed(false);
    setShowLanding(false);
    setShowImageReplay(false);
    setShowFinalStandings(false);
    setReplayMapSize("closed");
    setReplayChromeHidden(false);
    setReplayChromeHoverHidden(false);
    const timer = window.setTimeout(() => setRevealed(true), 900);
    return () => window.clearTimeout(timer);
  }, [summary?.roundNumber, summary?.completedAt]);

  useEffect(() => {
    if (!replayChromeHidden) return;
    const timer = window.setTimeout(() => setReplayChromeHidden(false), 5000);
    return () => window.clearTimeout(timer);
  }, [replayChromeHidden]);

  useEffect(() => {
    return () => {
      if (replayMapCloseTimer.current !== null) window.clearTimeout(replayMapCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (landingHits.length === 0 || !revealed) return;
    const showTimer = window.setTimeout(() => {
      setShowLanding(true);
      playSuccess();
    }, punktlandungDelayMs);
    const hideTimer = window.setTimeout(() => setShowLanding(false), punktlandungDelayMs + punktlandungVisibleMs);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [landingHits.length, playSuccess, revealed, summary?.roundNumber]);

  const openImageReplay = () => {
    setReplayMapSize("closed");
    setReplayChromeHidden(false);
    setShowImageReplay(true);
  };

  const openReplayMapByHover = () => {
    if (replayMapFull) return;
    if (replayMapCloseTimer.current !== null) {
      window.clearTimeout(replayMapCloseTimer.current);
      replayMapCloseTimer.current = null;
    }
    setReplayMapSize("open");
  };

  const closeReplayMapByHover = () => {
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

  if (!summary || !location) return null;

  return (
    <main className="h-dvh overflow-x-hidden overflow-y-auto bg-slate-950 p-2 text-slate-50 md:p-4 xl:overflow-hidden">
      {!revealed && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 p-4">
          <div className="w-full max-w-md rounded-md bg-slate-900/90 p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-indigo-300/40">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300">Auflösung</p>
            <p className="mt-3 text-2xl font-black">Karte wird vorbereitet</p>
          </div>
        </div>
      )}

      {showLanding && landingHits.length > 0 && (
        <div aria-live="polite" className="pointer-events-none fixed inset-0 z-[9999] grid place-items-center bg-slate-950/72 p-4 backdrop-blur-[5px]">
          <div className="punktlandung-celebration relative grid min-h-[340px] w-full max-w-2xl place-items-center overflow-hidden rounded-md bg-slate-950/94 px-6 py-11 text-center shadow-[0_34px_110px_rgba(0,0,0,0.72),0_0_70px_rgba(52,211,153,0.30)] ring-2 ring-emerald-300/90">
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
                {landingHits.map((result) => {
                  const player = playerFor(room.players, result.playerId);
                  return (
                    <span
                      key={result.playerId}
                      className="punktlandung-hit-chip rounded-md px-3 py-1.5 text-sm font-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.25)] drop-shadow-[0_2px_14px_rgba(0,0,0,0.80)]"
                      style={{ "--player-color": player?.color ?? "#34d399" } as CSSProperties}
                    >
                      {player?.name ?? "Spieler"} - {result.countryCorrect ? "voll getroffen" : `${formatDistance(result.distanceKm)} entfernt`}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showImageReplay && (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-950">
          <PanoramaViewer
            location={location}
            settings={room.settings}
            isHost={false}
            onSkipLocation={() => undefined}
            chromeHidden={replayChromeSuppressed}
          />

          {!replayChromeSuppressed && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.42)_0%,rgba(2,6,23,0)_28%,rgba(2,6,23,0.04)_68%,rgba(2,6,23,0.36)_100%)]" />}

          {!replayChromeSuppressed && (
            <div className="absolute left-3 top-3 z-30 max-w-[min(36rem,calc(100vw-1.5rem))] rounded-md bg-slate-950/58 px-4 py-3 shadow-[0_18px_46px_rgba(0,0,0,0.34)] ring-1 ring-slate-600/60 backdrop-blur-md sm:left-4 sm:top-4 sm:px-5">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-300">Bild nochmal ansehen</p>
              <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">{location.title}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-200">
                {countryLabel} · {continentLabel}
              </p>
            </div>
          )}

          {!replayChromeSuppressed && (
          <div className="absolute right-3 top-3 z-30 grid gap-2 sm:right-4 sm:top-4 sm:flex">
            <Button
              sound="click"
              tone="ghost"
              className="punktlandung-command-button min-h-12 text-xs normal-case"
              onClick={() => {
                setReplayMapSize("closed");
                setShowImageReplay(false);
              }}
            >
              {showFinalStandings ? "Zurück zum Endstand" : "Zurück zur Auflösung"}
            </Button>
            {finished ? (
              showFinalStandings ? (
                <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 text-xs normal-case" disabled={!isHost} onClick={onRestart}>
                  Neue Partie
                </Button>
              ) : (
                <Button
                  sound="select"
                  tone="selected"
                  className="punktlandung-command-button min-h-12 text-xs normal-case"
                  onClick={() => {
                    setReplayMapSize("closed");
                    setShowImageReplay(false);
                    setShowFinalStandings(true);
                  }}
                >
                  Endstand ansehen
                </Button>
              )
            ) : (
              <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 text-xs normal-case" disabled={!isHost} onClick={onNext}>
                Nächste Runde
              </Button>
            )}
          </div>
          )}

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
            {replayChromeSuppressed ? "Einblenden" : "Bild frei"}
          </button>

          {!replayChromeSuppressed && (
          <section
            className={`punktlandung-guess-map-panel ${replayMapFull ? "punktlandung-guess-map-panel--full" : replayMapExpanded ? "punktlandung-guess-map-panel--open" : "punktlandung-guess-map-panel--closed"} origin-bottom-right transform-gpu z-40 rounded-md bg-slate-950/88 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.34)] ring-1 ring-indigo-300/45 backdrop-blur-md transition-[width,height,transform] duration-300 sm:p-3 ${replayMapPanelLayout}`}
            onMouseEnter={openReplayMapByHover}
            onMouseLeave={closeReplayMapByHover}
            onClick={() => {
              if (!replayMapExpanded) setReplayMapSize("open");
            }}
          >
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-xs font-black uppercase tracking-[0.2em] text-indigo-300">Karte öffnen</p>
                {replayMapExpanded && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      className="min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm"
                      tone="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        setReplayMapSize((value) => (value === "full" ? "open" : "full"));
                      }}
                      title={replayMapFull ? "Karte verkleinern" : "Karte maximieren"}
                    >
                      {replayMapFull ? "Minimieren" : "Maximieren"}
                    </Button>
                    <Button
                      className="min-h-10 min-w-10 px-0 py-0 text-sm sm:min-h-11 sm:min-w-11"
                      tone="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        setReplayMapSize("closed");
                      }}
                      title="Karte wieder klein machen"
                    >
                      X
                    </Button>
                  </div>
                )}
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-md ring-1 ring-slate-700/70">
                <div className={replayMapExpanded ? "h-full w-full" : "pointer-events-none h-full w-full"}>
                  <GuessMap
                    mode="results"
                    players={room.players}
                    summary={summary}
                    guesses={room.guesses}
                    noPan={!replayMapExpanded}
                    noZoom={!replayMapExpanded}
                    showLabels={replayMapExpanded}
                    resizeSignal={replayMapSize}
                  />
                </div>
                {!replayMapExpanded && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.06)_100%)]" />}
              </div>
            </div>
          </section>
          )}
        </div>
      )}

      {finished && showFinalStandings && !showImageReplay && (
        <div
          className={`punktlandung-final-standings-grid mx-auto grid min-h-full max-w-[132rem] gap-3 transition-opacity duration-300 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,0.96fr)_minmax(35rem,1.04fr)] xl:overflow-hidden ${
            revealed ? "opacity-100" : "opacity-0"
          }`}
        >
          <section className="punktlandung-final-left grid min-h-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
            <div className="relative isolate overflow-hidden rounded-md border border-emerald-300/35 bg-slate-900/78 p-4 shadow-[0_26px_70px_rgba(0,0,0,0.34)] ring-1 ring-emerald-300/20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(52,211,153,0.18),transparent_24rem),radial-gradient(circle_at_86%_18%,rgba(99,102,241,0.18),transparent_26rem)]" />
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.34em] text-emerald-300">Endstand</p>
                  <h1 className="mt-2 text-3xl font-black leading-none text-white md:text-4xl">Partie entschieden</h1>
                  <p className="mt-2 text-sm font-semibold text-slate-300">
                    {completedRounds} Runden gespielt
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.04fr)_minmax(18rem,0.96fr)]">
                <div className="rounded-md bg-slate-950/62 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.24)] ring-1 ring-emerald-300/40">
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-200">Sieger der Partie</p>
                  <div className="mt-3 flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="h-14 w-2 rounded-full" style={playerAccentStyle(champion?.color)} />
                    <div className="min-w-0">
                      <p className="truncate text-4xl font-black leading-none text-white md:text-5xl">{champion?.name ?? "Niemand"}</p>
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

                <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-2">
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Punkte je Runde</p>
                    <p className="mt-1 text-xl font-black">{championStats ? formatPoints(championStats.averagePoints) : "0"}</p>
                  </div>
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Punktlandungen</p>
                    <p className="mt-1 text-xl font-black">{championStats ? `${championStats.hits}/${Math.max(1, championStats.roundsPlayed)}` : "0/0"}</p>
                  </div>
                  {showMixedCategoryStats ? (
                    <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Beste Kategorie</p>
                      <p className="mt-1 truncate text-xl font-black">{championStats?.bestCategoryLabel ?? "Keine"}</p>
                    </div>
                  ) : (
                    <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Entfernungsschnitt</p>
                      <p className="mt-1 truncate text-xl font-black">{championStats?.averageDistanceKm == null ? "-" : formatDistance(championStats.averageDistanceKm)}</p>
                    </div>
                  )}
                  <div className="rounded-md bg-slate-950/52 p-3 ring-1 ring-slate-700/70">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Tippzeit gesamt</p>
                    <p className="mt-1 text-xl font-black">{formatSeconds(championStats?.totalGuessSeconds ?? null)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 rounded-md border border-slate-700/55 bg-slate-900/72 p-4 xl:overflow-hidden">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-[22px] font-black leading-tight">Partie in Zahlen</h2>
                <p className="text-xs font-semibold text-slate-400">Bestwerte</p>
              </div>
              <div className="punktlandung-final-highlights mt-3 grid min-h-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {displayedFinalHighlights.map((highlight) => (
                    <div key={`${highlight.tone ?? "metric"}-${highlight.label}`} className="relative min-w-0 overflow-hidden rounded-md bg-slate-950/48 p-3 pl-5 ring-1 ring-slate-700/55">
                      <span aria-hidden="true" className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full" style={playerAccentStyle(highlight.color)} />
                      <p className={`font-black uppercase text-indigo-300 ${highlight.tone === "category" ? "text-[11px] tracking-[0.18em]" : "text-xs tracking-[0.14em]"}`}>
                        {highlight.tone === "category" ? `Kat. ${highlight.label}` : highlight.label}
                      </p>
                      <p className="mt-1 truncate text-xl font-black leading-tight text-white">{highlight.value}</p>
                      <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-300">{highlight.detail}</p>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <aside className="punktlandung-final-table min-h-0 rounded-md border border-slate-700/55 bg-slate-900/72 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)] xl:overflow-hidden">
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <Button tone="ghost" className="punktlandung-command-button min-h-11 text-xs normal-case" onClick={() => setShowFinalStandings(false)}>
                Letzte Auflösung
              </Button>
              <Button sound="click" tone="ghost" className="punktlandung-command-button min-h-11 text-xs normal-case" disabled={!isHost} onClick={onBackToLobby}>
                Zum Spielmodus
              </Button>
              <Button tone="selected" className="punktlandung-command-button min-h-11 text-xs normal-case" disabled={!isHost} onClick={onRestart}>
                Neue Partie
              </Button>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-indigo-300">Bis zu 10 Spieler</p>
                <h2 className="text-[24px] font-black leading-tight">Finaltabelle</h2>
              </div>
              <p className="text-xs font-semibold text-slate-400">{finalStats.length} gewertet</p>
            </div>
            <div className="mt-3 grid gap-1.5">
              {finalStats.map((stat) => {
                const maxScore = Math.max(1, champion?.score ?? stat.player.score);
                const percent = Math.max(4, Math.min(100, (stat.player.score / maxScore) * 100));
                const barBackgroundSize = `${10000 / Math.max(1, percent)}% 100%`;
                return (
                  <div key={stat.player.id} className="rounded-md bg-slate-950/45 px-3 py-1.5 ring-1 ring-slate-700/55">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-7 shrink-0 text-base font-black text-indigo-200">#{stat.rank}</span>
                        <span aria-hidden="true" className="h-7 w-1 rounded-full" style={playerAccentStyle(stat.player.color)} />
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-black leading-tight">{stat.player.name}</p>
                          <p className="truncate text-[11px] italic text-emerald-300">{stat.title ? badgeWithArticle(stat.title) : ""}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-lg font-black text-emerald-300">{formatPoints(stat.player.score)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-slate-800">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${percent}%`,
                          background: scoreHeatmapGradient,
                          backgroundSize: barBackgroundSize,
                          boxShadow: "0 0 12px rgba(52, 211, 153, 0.22)"
                        }}
                      />
                    </div>
                    <div className="mt-1 grid grid-cols-5 gap-2 text-[10px] text-slate-300">
                      <p className="truncate"><span className="font-black text-indigo-300">Pkt/R</span> {formatPoints(stat.averagePoints)}</p>
                      <p className="truncate"><span className="font-black text-indigo-300">Punktl.</span> {stat.hits}/{Math.max(1, stat.roundsPlayed)}</p>
                      <p className="truncate"><span className="font-black text-indigo-300">Ø km</span> {stat.averageDistanceKm === null ? "-" : formatDistance(stat.averageDistanceKm)}</p>
                      <p className="truncate"><span className="font-black text-indigo-300">{showMixedCategoryStats ? "Kat." : "Modus"}</span> {showMixedCategoryStats ? stat.bestCategoryLabel : categoryLabels[room.settings.category]}</p>
                      <p className="truncate"><span className="font-black text-indigo-300">Zeit</span> {formatSeconds(stat.totalGuessSeconds)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
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
          <div className="punktlandung-results-hero rounded-md bg-slate-900/72 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-4">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-300">Auflösung</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-300">
                  Runde {summary.roundNumber}/{room.settings.rounds}
                </p>
                <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">{location.title}</h1>
                <p className="mt-1 text-sm text-slate-300">
                  {countryLabel} · {continentLabel}
                </p>
              </div>
              <div className="hidden sm:flex sm:flex-wrap sm:justify-end sm:gap-2">
                <Button tone="ghost" className="punktlandung-command-button min-h-12 text-xs normal-case" onClick={openImageReplay}>
                  Bild nochmal ansehen
                </Button>
                {!finished ? (
                  <Button sound="click" tone="ghost" className="punktlandung-command-button min-h-12 text-xs normal-case" disabled={!isHost} onClick={onBackToLobby}>
                    Zurück zum Spielmodus
                  </Button>
                ) : (
                  <Button sound="click" tone="ghost" className="punktlandung-command-button min-h-12 text-xs normal-case" disabled={!isHost} onClick={onBackToLobby}>
                    Zum Spielmodus
                  </Button>
                )}
                {!finished ? (
                  <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 text-xs normal-case" disabled={!isHost} onClick={onNext}>
                    Nächste Runde
                  </Button>
                ) : (
                  <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 text-xs normal-case" onClick={() => setShowFinalStandings(true)}>
                    Endstand ansehen
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="punktlandung-results-map min-h-0 overflow-hidden rounded-md bg-slate-900 shadow-[0_22px_58px_rgba(0,0,0,0.28)] ring-1 ring-slate-700/70">
            <GuessMap mode="results" players={room.players} summary={summary} guesses={room.guesses} noPan={false} noZoom={false} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <Button tone="ghost" className="min-h-12 w-full px-4 py-2 text-xs normal-case" onClick={openImageReplay}>
              Bild nochmal ansehen
            </Button>
            {!finished ? (
              <Button sound="click" tone="ghost" className="min-h-12 w-full px-4 py-2 text-xs normal-case" disabled={!isHost} onClick={onBackToLobby}>
                Zurück zum Spielmodus
              </Button>
            ) : (
              <Button sound="click" tone="ghost" className="min-h-12 w-full px-4 py-2 text-xs normal-case" disabled={!isHost} onClick={onBackToLobby}>
                Zum Spielmodus
              </Button>
            )}
            {!finished ? (
              <Button sound="select" tone="selected" className="col-span-2 min-h-12 w-full px-4 py-2 text-xs normal-case" disabled={!isHost} onClick={onNext}>
                Nächste Runde
              </Button>
            ) : (
              <Button sound="select" tone="selected" className="col-span-2 min-h-12 w-full px-4 py-2 text-xs normal-case" onClick={() => setShowFinalStandings(true)}>
                Endstand ansehen
              </Button>
            )}
          </div>
        </section>

        <aside
          className={`punktlandung-results-sidebar grid min-h-0 gap-2 md:gap-3 ${
            hasModePanel ? "grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
          }`}
        >
          <div className="punktlandung-results-panel min-h-0 overflow-hidden rounded-md bg-slate-900/72 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-4">
            <h2 className="text-[22px] font-black leading-tight">Rundenrang</h2>
            <div className="punktlandung-results-list punktlandung-results-flat-list mt-2 grid min-h-0">
              {ranked.map((result, index) => {
                const player = playerFor(room.players, result.playerId);
                const scorePercent = scoreHeatmapPercent(result.points);
                return (
                  <div
                    key={result.playerId}
                    className="punktlandung-results-row relative min-w-0 overflow-hidden border-b border-slate-700/45 pl-4 last:border-b-0"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                      style={playerAccentStyle(player?.color)}
                    />
                    <div className="punktlandung-results-round-grid w-full min-w-0 items-center">
                      <span className="punktlandung-results-rank shrink-0 font-black">#{index + 1}</span>
                      <div className="punktlandung-results-identity min-w-0">
                        <span className="punktlandung-results-player min-w-0 truncate font-black">{player?.name ?? "Spieler"}</span>
                        <span className="punktlandung-results-distance text-xs text-slate-300">
                          · {isFlagRound && result.countryCorrect ? "richtiges Land" : `${formatDistance(result.distanceKm)} entfernt`}
                        </span>
                      </div>
                      <div className="punktlandung-results-scorebar h-2 min-w-[64px] overflow-hidden rounded-sm bg-slate-800">
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${scorePercent}%`,
                            background: scoreHeatmapGradient,
                            backgroundSize: `${10000 / scorePercent}% 100%`,
                            boxShadow: "0 0 12px rgba(52, 211, 153, 0.22)"
                          }}
                        />
                      </div>
                      <span className="punktlandung-results-points shrink-0 text-right font-black text-slate-200">{result.points}</span>
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

          <div className="punktlandung-results-panel min-h-0 overflow-hidden rounded-md bg-slate-900/72 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-4">
            <h2 className="text-[22px] font-black leading-tight">Gesamtwertung</h2>
            <div className="punktlandung-results-list punktlandung-results-flat-list mt-2 grid min-h-0">
              {sortedPlayers.map((player, index) => {
                const overallTitle = overallRankingTitleFor(index, sortedPlayers.length);
                return (
                  <div
                    key={player.id}
                    className="punktlandung-results-row punktlandung-results-total-row relative min-w-0 overflow-hidden border-b border-slate-700/45 pl-4 last:border-b-0"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                      style={playerAccentStyle(player.color)}
                    />
                    <span className="punktlandung-results-rank shrink-0 font-black">#{index + 1}</span>
                    <span className="min-w-0 truncate font-black">{player.name}</span>
                    <span className="min-w-0 truncate text-xs font-normal italic text-emerald-300">{overallTitle ? badgeWithArticle(overallTitle) : ""}</span>
                    <span className="punktlandung-results-points shrink-0 text-right font-black text-emerald-300">{player.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        </div>
      )}
    </main>
  );
}
