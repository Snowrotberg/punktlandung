"use client";

export type RankedUploadKind = "guess" | "ready" | "expire" | "reroll";

export type RankedUpload = {
  id: string;
  kind: RankedUploadKind;
  gameId: string;
  roundId?: string;
  url: string;
  body?: string;
  displayGuess?: { lat: number; lng: number; countryCode?: string };
  createdAt: number;
};

const storageKey = "punktlandung-ranked-upload-queue-v1";

function readQueue(): RankedUpload[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<RankedUpload>;
      const gameId = candidate.gameId ?? gameIdFromUrl(candidate.url);
      if (
        typeof candidate.id !== "string"
        || !["guess", "ready", "expire", "reroll"].includes(candidate.kind ?? "")
        || typeof candidate.url !== "string"
        || !gameId
      ) return [];
      return [{
        id: candidate.id,
        kind: candidate.kind as RankedUploadKind,
        gameId,
        roundId: typeof candidate.roundId === "string" ? candidate.roundId : undefined,
        url: candidate.url,
        body: typeof candidate.body === "string" ? candidate.body : undefined,
        displayGuess: candidate.displayGuess
          && typeof candidate.displayGuess.lat === "number"
          && typeof candidate.displayGuess.lng === "number"
          ? { lat: candidate.displayGuess.lat, lng: candidate.displayGuess.lng, countryCode: candidate.displayGuess.countryCode }
          : undefined,
        createdAt: Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : Date.now()
      }];
    });
  } catch {
    return [];
  }
}

function gameIdFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/ranked-games\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeQueue(value: RankedUpload[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value.slice(0, 20)));
  } catch {
    // Network recovery remains best effort when browser storage is unavailable.
  }
}

export function enqueueRankedUpload(upload: Omit<RankedUpload, "createdAt">): void {
  const queue = readQueue();
  if (!queue.some((item) => item.id === upload.id)) writeQueue([...queue, { ...upload, createdAt: Date.now() }]);
}

export function getRankedUploadQueue(): RankedUpload[] { return readQueue(); }
export function removeRankedUpload(id: string): void { writeQueue(readQueue().filter((item) => item.id !== id)); }
export function removeRankedUploadsForGame(gameId: string): void { writeQueue(readQueue().filter((item) => item.gameId !== gameId)); }
