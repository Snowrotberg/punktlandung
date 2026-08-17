import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type UsageEventName =
  | "game_start"
  | "game_complete"
  | "image_delivery"
  | "ws_connection_accepted"
  | "ws_connection_rejected"
  | "room_created"
  | "room_joined"
  | "capacity_sample"
  | "page_view"
  | "visit_start";

export type UsageEvent = {
  version: 1;
  at: string;
  event: UsageEventName;
  gameType?: "solo" | "party" | "online";
  gameMode?: string;
  category?: string;
  plannedRounds?: number;
  playerCount?: number;
  connections?: number;
  rooms?: number;
  durationMs?: number;
  outcome?: "loaded" | "fallback" | "failed";
  delivery?: "direct" | "proxy" | "ranked";
  cacheHit?: boolean;
  connectionType?: "slow-2g" | "2g" | "3g" | "4g" | "unknown";
  locationId?: string;
};

export function usageMetricsPath(): string {
  const configured = process.env.USAGE_METRICS_FILE?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data", "runtime", "usage-events.ndjson");
}

export async function recordUsageEvent(event: UsageEventName, details: Omit<UsageEvent, "version" | "at" | "event"> = {}): Promise<void> {
  const filePath = usageMetricsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const entry: UsageEvent = { version: 1, at: new Date().toISOString(), event, ...details };
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readUsageEvents(since?: Date): Promise<UsageEvent[]> {
  let contents: string;
  try {
    contents = await readFile(usageMetricsPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const sinceTime = since?.getTime() ?? Number.NEGATIVE_INFINITY;
  return contents
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line) as UsageEvent;
        return value.version === 1 && new Date(value.at).getTime() >= sinceTime ? [value] : [];
      } catch {
        return [];
      }
    });
}
