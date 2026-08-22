const storageKey = "punktlandung-ranked-game-claim-queue-v1";
const maxPendingClaims = 5;

function validGameId(gameId: unknown): gameId is string {
  return typeof gameId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(gameId);
}

export function readPendingRankedGameClaims(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(validGameId))].slice(-maxPendingClaims);
  } catch {
    return [];
  }
}

export function enqueueRankedGameClaim(gameId: string): void {
  if (typeof window === "undefined" || !validGameId(gameId)) return;
  try {
    const next = [...readPendingRankedGameClaims().filter((value) => value !== gameId), gameId].slice(-maxPendingClaims);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // The visible result can still be claimed during the current session.
  }
}

export function removeRankedGameClaim(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(readPendingRankedGameClaims().filter((value) => value !== gameId)));
  } catch {
    // A later successful idempotent claim remains harmless.
  }
}
