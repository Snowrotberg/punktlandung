import type { UsageEvent } from "./usageMetrics.server";

export type GameplayTypeStatistic = {
  key: "solo" | "party" | "online" | "unknown";
  label: string;
  count: number;
  share: number | null;
};

const labels: Record<GameplayTypeStatistic["key"], string> = {
  solo: "Solo",
  party: "Party an einem Gerät",
  online: "Online-Raum",
  unknown: "Nicht zugeordnet"
};

export function summarizeGameplayTypes(events: UsageEvent[]): GameplayTypeStatistic[] {
  const starts = events.filter((event) => event.event === "game_start");
  const counts = new Map<GameplayTypeStatistic["key"], number>();
  for (const event of starts) {
    const key = event.gameType === "solo" || event.gameType === "party" || event.gameType === "online"
      ? event.gameType
      : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const keys: GameplayTypeStatistic["key"][] = ["solo", "party", "online"];
  if (counts.get("unknown")) keys.push("unknown");
  return keys.map((key) => ({
    key,
    label: labels[key],
    count: counts.get(key) ?? 0,
    share: starts.length ? Math.round(((counts.get(key) ?? 0) / starts.length) * 100) : null
  }));
}
