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

export function shouldShowGameplayStateGuard(input: {
  requiredStatus: Exclude<RoundStatus, "lobby"> | null | undefined;
  currentStatus?: RoundStatus;
  restorationPending: boolean;
  gameplayRouteMismatch: boolean;
  intentionalExitPending: boolean;
}): boolean {
  return Boolean(
    input.requiredStatus
      && input.currentStatus !== input.requiredStatus
      && !input.restorationPending
      && !input.gameplayRouteMismatch
      && !input.intentionalExitPending
  );
}
