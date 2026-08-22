"use client";

import type { PublicRankedGame } from "@/lib/rankedGame";
import type { GameSettings } from "@/types/game";

const pendingDirectRankedStartKey = "punktlandung-ranked-direct-start-v1";
const pendingDirectRankedStartTtlMs = 60_000;

export type PendingDirectRankedStart = {
  game: PublicRankedGame;
  name: string;
  settings: GameSettings;
  createdAt: number;
};

export function queueDirectRankedStart(value: Omit<PendingDirectRankedStart, "createdAt">): void {
  window.sessionStorage.setItem(pendingDirectRankedStartKey, JSON.stringify({ ...value, createdAt: Date.now() }));
}

export function consumeDirectRankedStart(): PendingDirectRankedStart | null {
  try {
    const raw = window.sessionStorage.getItem(pendingDirectRankedStartKey);
    window.sessionStorage.removeItem(pendingDirectRankedStartKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingDirectRankedStart>;
    if (
      !parsed.game?.gameId
      || !parsed.name
      || !parsed.settings
      || !parsed.createdAt
      || Date.now() - parsed.createdAt > pendingDirectRankedStartTtlMs
    ) return null;
    return parsed as PendingDirectRankedStart;
  } catch {
    return null;
  }
}
