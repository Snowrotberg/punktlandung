type AccuracyRound = {
  status: string;
  location: { category: string };
  result?: { countryCorrect: boolean } | null;
};

type CategoryGame = {
  category: string;
  score: number | null;
  completed_rounds: number | null;
  planned_rounds: number | null;
};

export function calculateFlagAccuracy(rounds: AccuracyRound[]) {
  const eligibleRounds = rounds.filter(
    (round) => round.status === "resolved" && round.location.category === "flags" && round.result
  );
  const hits = eligibleRounds.filter((round) => round.result?.countryCorrect).length;

  return {
    hits,
    total: eligibleRounds.length,
    percentage: eligibleRounds.length ? Math.round((hits / eligibleRounds.length) * 100) : null
  };
}

export function bestAveragePointsByCategory(games: CategoryGame[]) {
  const best = new Map<string, number>();

  for (const game of games) {
    const rounds = game.completed_rounds ?? game.planned_rounds ?? 0;
    if (rounds <= 0 || typeof game.score !== "number") continue;
    const average = Math.round(game.score / rounds);
    best.set(game.category, Math.max(best.get(game.category) ?? 0, average));
  }

  return Array.from(best.entries()).sort((left, right) => right[1] - left[1]);
}
