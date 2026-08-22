import type { SaveCompletedGameInput, SaveCompletedGameResult } from "@/app/endergebnis/actions";

const storageKey = "punktlandung-completed-game-save-queue-v1";
const maxQueuedSaves = 5;

export type QueuedSave = SaveCompletedGameInput;
export type CompletedGameSaveExecutor = (input: SaveCompletedGameInput) => Promise<SaveCompletedGameResult>;
export type CompletedGameSaveFlushResult = {
  savedKeys: string[];
  discardedInvalidKeys: string[];
  authRequired: boolean;
};

let activeFlush: Promise<CompletedGameSaveFlushResult> | null = null;

function readQueue(): QueuedSave[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is QueuedSave => Boolean(entry && typeof entry.saveKey === "string"));
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedSave[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(queue.slice(-maxQueuedSaves)));
  } catch {
    // Saving remains usable when browser storage is unavailable.
  }
}

export function enqueueCompletedGameSave(input: SaveCompletedGameInput): void {
  const queue = readQueue().filter((entry) => entry.saveKey !== input.saveKey);
  queue.push(input);
  writeQueue(queue);
}

export function removeCompletedGameSave(saveKey: string): void {
  writeQueue(readQueue().filter((entry) => entry.saveKey !== saveKey));
}

export function readCompletedGameSaves(): QueuedSave[] {
  return readQueue();
}

export function flushCompletedGameSaves(save: CompletedGameSaveExecutor): Promise<CompletedGameSaveFlushResult> {
  if (activeFlush) return activeFlush;
  const flush = (async () => {
    const result: CompletedGameSaveFlushResult = { savedKeys: [], discardedInvalidKeys: [], authRequired: false };
    for (const entry of readQueue()) {
      let saved: SaveCompletedGameResult;
      try {
        saved = await save(entry);
      } catch {
        // Keep the entry for a later online/reload retry.
        break;
      }
      if (saved.ok) {
        removeCompletedGameSave(entry.saveKey);
        result.savedKeys.push(entry.saveKey);
        continue;
      }
      if (saved.code === "invalid") {
        // A permanently invalid/corrupted payload must not block newer games.
        removeCompletedGameSave(entry.saveKey);
        result.discardedInvalidKeys.push(entry.saveKey);
        continue;
      }
      if (saved.code === "auth_required") result.authRequired = true;
      // Authentication and transient persistence failures remain queued.
      break;
    }
    return result;
  })();
  activeFlush = flush;
  return flush.finally(() => {
    if (activeFlush === flush) activeFlush = null;
  });
}
