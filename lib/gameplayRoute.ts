import type { RoundStatus } from "@/types/game";

export function gameplayRouteForStatus(status: RoundStatus | undefined, resumePending = false): string | null {
  if (resumePending) return null;
  if (status === "guessing") return "/spielen";
  if (status === "results") return "/aufloesung";
  if (status === "finished") return "/endergebnis";
  return null;
}

export function gameplayStatusForRoute(pathname: string): Exclude<RoundStatus, "lobby"> | null {
  if (pathname === "/spielen") return "guessing";
  if (pathname === "/aufloesung") return "results";
  if (pathname === "/endergebnis") return "finished";
  return null;
}
