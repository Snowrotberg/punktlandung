export const setupResumeStorageKey = "punktlandung-resume-setup-v1";
export const visibleResumeSetupStorageKey = "punktlandung-visible-resume-setup-v1";
const activeLocalSessionStorageKey = "punktlandung-active-session-v1";
const activeRankedSessionStorageKey = "punktlandung-ranked-active-game-v1";
const dismissedRankedSessionStorageKey = "punktlandung-ranked-dismissed-game-v1";
const sessionResetStorageKey = "punktlandung-reset-session-v1";

export type SetupResumeKind = "local" | "ranked";

export function isResumableGameStatus(status: string | undefined): boolean {
  return status === "guessing" || status === "results";
}

export function shouldRestoreStoredGame(status: string, recoveryRequested: boolean): boolean {
  return recoveryRequested && (status === "lobby" || isResumableGameStatus(status));
}

export function shouldDiscardResumeOnHistoryExit(
  resumePending: boolean,
  setupPath: string,
  nextPath: string
): boolean {
  return resumePending && nextPath !== setupPath;
}

export function shouldStartTimerAfterImageReady(ready: boolean, roundStartedAt: number | null, roundEndsAt: number | null): boolean {
  return ready && roundStartedAt === null && roundEndsAt === null;
}

export function explicitRankedResumeGameId(value: string | null): string | null {
  return value && value !== "ranked" && value !== "1" ? value : null;
}

export function setupResumeUrl(setupPath: string, kind: SetupResumeKind): string {
  return kind === "ranked" ? `${setupPath}?resume=ranked` : `${setupPath}?resume=1`;
}

function storedResumeKind(): SetupResumeKind | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(setupResumeStorageKey);
    // "1" is retained for sessions written by the previous implementation.
    return value === "ranked" ? "ranked" : value === "local" || value === "1" ? "local" : null;
  } catch {
    return null;
  }
}

export function requestSetupResume(kind: SetupResumeKind): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(setupResumeStorageKey, kind);
  } catch {
    // The persisted game state remains the fallback when sessionStorage is unavailable.
  }
}

export function hasSetupResumeRequest(kind?: SetupResumeKind): boolean {
  const stored = storedResumeKind();
  return kind ? stored === kind : stored !== null;
}

export function consumeSetupResumeRequest(kind: SetupResumeKind): boolean {
  if (!hasSetupResumeRequest(kind)) return false;
  try {
    window.sessionStorage.removeItem(setupResumeStorageKey);
  } catch {
    // Treat the marker as consumed for this mount even if cleanup is blocked.
  }
  return true;
}

export function clearSetupResumeRequest(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(setupResumeStorageKey);
  } catch {
    // A stale marker is harmless when storage is unavailable.
  }
}

export function markResumeSetupVisible(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(visibleResumeSetupStorageKey, "1");
  } catch {
    // The live in-memory room still owns the current setup view.
  }
}

export function clearVisibleResumeSetup(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(visibleResumeSetupStorageKey);
  } catch {
    // Best effort only.
  }
}

export function discardResumeAfterLandingNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(visibleResumeSetupStorageKey) !== "1") return false;
    const rankedRaw = window.localStorage.getItem(activeRankedSessionStorageKey);
    let rankedGameId: string | null = null;
    try {
      const ranked = JSON.parse(rankedRaw ?? "null") as { gameId?: unknown } | null;
      rankedGameId = typeof ranked?.gameId === "string" ? ranked.gameId : null;
    } catch {
      rankedGameId = null;
    }
    window.sessionStorage.removeItem(visibleResumeSetupStorageKey);
    window.sessionStorage.removeItem(setupResumeStorageKey);
    window.sessionStorage.setItem(sessionResetStorageKey, "1");
    window.localStorage.removeItem(activeLocalSessionStorageKey);
    window.localStorage.removeItem(activeRankedSessionStorageKey);
    if (rankedGameId) {
      window.localStorage.setItem(dismissedRankedSessionStorageKey, JSON.stringify({
        gameId: rankedGameId,
        dismissedAt: Date.now()
      }));
    }
    return true;
  } catch {
    return false;
  }
}
