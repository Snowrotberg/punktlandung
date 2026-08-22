import type { RoundStatus } from "@/types/game";

/**
 * Gameplay routes must keep an already restored browser-local game for the
 * entire round transition. Comparing only with the route's required status
 * creates a one-render ownership gap when guessing becomes results (or results
 * becomes finished), which can switch the view to an unrelated ranked session.
 * A lobby is not an active gameplay session and therefore does not get this
 * priority.
 */
export function preferLocalRequiredSession(
  requiredStatus: RoundStatus | undefined,
  localRestoring: boolean,
  localStatus: RoundStatus | undefined
): boolean {
  return Boolean(requiredStatus && (localRestoring || (localStatus && localStatus !== "lobby")));
}

export function shouldUseRankedSoloSession(input: {
  rankedGamesEnabled: boolean;
  resumeRankedGame: boolean;
  routeAllowsRankedSolo: boolean;
  localSessionHasPriority: boolean;
  onSoloFlow: boolean;
}): boolean {
  return (input.rankedGamesEnabled || input.resumeRankedGame)
    && input.routeAllowsRankedSolo
    && !input.localSessionHasPriority
    && input.onSoloFlow;
}

export function shouldRestoreRankedSoloSession(
  requiredStatus: RoundStatus | undefined,
  explicitResume: boolean
): boolean {
  return Boolean(requiredStatus) || explicitResume;
}
