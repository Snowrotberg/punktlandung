"use client";

import { useMemo } from "react";
import { playerColorAt } from "@/lib/playerPalette";
import type { GeoLocation, Guess, Player, RoomKind, RoomState, RoundStatus, RoundSummary } from "@/types/game";
import { ResultsView } from "./ResultsView";

const previewTimestamp = 1_800_000_000_000;
const previewNames = ["Maximilian Müller", "Alexandra Wagner", "Mika", "Nora", "Luca", "Kim", "Jona", "Mara", "Noah", "Leni"];
const previewPlaces = ["Brandenburger Tor", "Eiffelturm", "Havanna", "Maputo", "Wawel-Kathedrale", "Avignon", "Vaduz", "Salzburger Dom", "Poitiers", "Chişinău"];

type ResultPreviewProps = {
  playerCount?: number;
  mode?: RoomKind;
  surface?: "resolution" | "final";
};

function clampPlayerCount(value: number, mode: RoomKind): number {
  if (mode === "solo") return 1;
  return Math.max(1, Math.min(10, Math.trunc(value) || 1));
}

function previewLocation(roundIndex: number): GeoLocation {
  const title = previewPlaces[roundIndex] ?? `Ziel ${roundIndex + 1}`;
  return {
    id: `preview-location-${roundIndex + 1}`,
    title,
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat: 52.5163 + roundIndex * 0.01,
    lng: 13.3777 + roundIndex * 0.01,
    panoramaUrl: "/og-punktlandung.jpg",
    attribution: "Punktlandung Vorschau",
    source: "ugc",
    category: roundIndex % 2 === 0 ? "landmarks" : "cities",
    difficulty: "medium",
    shortDescription: `${title} steht hier als Beispieldatensatz, damit sich Auflösung und Endstand ohne vollständige Partie prüfen lassen.`
  };
}

function createPreviewRoom(playerCount: number, mode: RoomKind, status: RoundStatus): RoomState {
  const safePlayerCount = clampPlayerCount(playerCount, mode);
  const playersWithoutScores: Player[] = previewNames.slice(0, safePlayerCount).map((name, index) => ({
    id: `preview-player-${index + 1}`,
    name,
    color: playerColorAt(index),
    score: 0,
    connected: true,
    isHost: index === 0,
    team: index % 2 === 0 ? "aurora" : "pulse",
    status: "active",
    cosmetic: "none",
    localOnly: mode !== "online"
  }));

  const summaries: RoundSummary[] = Array.from({ length: 10 }, (_, roundIndex) => ({
    roundNumber: roundIndex + 1,
    location: previewLocation(roundIndex),
    results: playersWithoutScores.map((player, playerIndex) => {
      const distanceKm = playerIndex === 0 && roundIndex === 0 ? 0.3 : 18 + playerIndex * 57 + roundIndex * 9;
      const guess: Guess = {
        playerId: player.id,
        lat: 52.5 + playerIndex * 0.01,
        lng: 13.4 + roundIndex * 0.01,
        createdAt: previewTimestamp + roundIndex * 60_000 + playerIndex * 500,
        responseTimeMs: 7_000 + playerIndex * 1_250 + roundIndex * 350
      };
      return {
        playerId: player.id,
        distanceKm,
        points: Math.max(350, 4_950 - playerIndex * 285 - roundIndex * 35),
        badge: distanceKm <= 0.5 ? "Punktlandung" : "Nahe dran",
        eliminated: false,
        guess,
        countryCorrect: false
      };
    }),
    crewGuess: null,
    crewDistanceKm: null,
    duel: [],
    completedAt: previewTimestamp + (roundIndex + 1) * 60_000,
    roundStartedAt: previewTimestamp + roundIndex * 60_000
  }));

  const players = playersWithoutScores.map((player) => ({
    ...player,
    score: summaries.reduce((total, summary) => total + (summary.results.find((result) => result.playerId === player.id)?.points ?? 0), 0)
  }));
  const latestSummary = summaries.at(-1)!;

  return {
    code: "VORSCHAU",
    kind: mode,
    hostId: players[0]!.id,
    hostParticipation: "host_player",
    hostPlayerName: players[0]!.name,
    status,
    settings: {
      mode: "classic",
      localMode: mode === "solo" ? "solo" : "couch",
      localPlayerCount: safePlayerCount,
      timeLimitSec: 60,
      rounds: 10,
      noMove: false,
      noPan: false,
      noZoom: false,
      mapPackId: "world-party",
      category: "mixed",
      difficulty: "medium"
    },
    players,
    currentRound: 10,
    location: null,
    guesses: latestSummary.results.map((result) => result.guess).filter((guess): guess is Guess => Boolean(guess)),
    timedOutPlayerIds: [],
    roundEndsAt: null,
    roundStartedAt: null,
    summaries,
    emojiEvents: [],
    adGateUntil: null,
    nextRoundReadyPlayerIds: [],
    nextRoundStartsAt: null,
    nextRoundPreviewUrl: null
  };
}

export function FinalResultPreview({ playerCount = 10, mode = "party", surface = "final" }: ResultPreviewProps) {
  const room = useMemo(
    () => createPreviewRoom(playerCount, mode, surface === "final" ? "finished" : "results"),
    [mode, playerCount, surface]
  );
  const leavePreview = () => window.location.assign("/");

  return (
    <ResultsView
      room={room}
      isHost
      meId={room.players[0]!.id}
      onNext={() => {}}
      onBackToLobby={leavePreview}
      onRestart={leavePreview}
      onLeave={leavePreview}
      redesign
      accountsEnabled={surface === "final"}
      accountAuthenticated={false}
      initialSurface={surface}
    />
  );
}
