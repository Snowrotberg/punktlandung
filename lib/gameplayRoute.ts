import type { RoundStatus } from "@/types/game";

export function gameplayRouteForStatus(status: RoundStatus | undefined, resumePending = false): string | null {
  if (resumePending) return null;
  if (status === "guessing") return "/spielen";
  if (status === "results") return "/aufloesung";
  if (status === "finished") return "/endergebnis";
  return null;
}
