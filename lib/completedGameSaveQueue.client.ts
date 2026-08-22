import type { SaveCompletedGameInput } from "@/app/endergebnis/actions";

const storageKey = "punktlandung-completed-game-save-queue-v1";
const maxQueuedSaves = 5;

type QueuedSave = SaveCompletedGameInput;

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
