import type { GeoLocation, Player, RoundResult, RoundSummary } from "@/types/game";

export const ACCOUNT_ROUND_MAP_ROOT_MARGIN = "35% 0px";

export type AccountRoundReplayMap =
  | { kind: "guess-and-target"; players: Player[]; summary: RoundSummary }
  | { kind: "target-only"; players: Player[]; summary: RoundSummary };

export function buildAccountRoundReplayMap({
  location,
  result,
  resolvedAt,
  playerName
}: {
  location: GeoLocation;
  result: RoundResult;
  resolvedAt: number | null;
  playerName: string;
}): AccountRoundReplayMap {
  return {
    kind: result.guess ? "guess-and-target" : "target-only",
    players: [{
      id: result.playerId,
      name: playerName,
      color: "#f43f7a",
      score: result.points,
      connected: false,
      isHost: false,
      team: "aurora",
      status: "active",
      cosmetic: "none"
    }],
    summary: {
      roundNumber: 1,
      location,
      results: [result],
      crewGuess: null,
      crewDistanceKm: null,
      duel: [],
      completedAt: resolvedAt ?? 0
    }
  };
}

export function accountRoundMapMounts({
  nearViewport,
  maximized
}: {
  nearViewport: boolean;
  maximized: boolean;
}) {
  return {
    embedded: nearViewport && !maximized,
    modal: maximized
  };
}
