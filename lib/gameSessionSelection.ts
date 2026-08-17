import type { RoundStatus } from "@/types/game";

/**
 * Result routes must finish restoring the browser-local game before an
 * authenticated account may switch the view to a server-backed ranked game.
 * That keeps a completed guest game available across the login redirect.
 */
export function preferLocalRequiredSession(
  requiredStatus: RoundStatus | undefined,
  localRestoring: boolean,
  localStatus: RoundStatus | undefined
): boolean {
  return Boolean(requiredStatus && (localRestoring || localStatus === requiredStatus));
}
