import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readUsageEvents } from "../lib/usageMetrics.server";

const lookbackDays = Math.max(7, Math.min(90, Number(process.env.IMAGE_HEALTH_LOOKBACK_DAYS) || 30));
const minimumSamples = Math.max(5, Math.min(100, Number(process.env.IMAGE_HEALTH_MINIMUM_SAMPLES) || 8));
const slowThresholdMs = Math.max(5_000, Math.min(30_000, Number(process.env.IMAGE_HEALTH_SLOW_MS) || 12_000));
const outputPath = path.join(process.cwd(), "data", "generated", "image-health-exclusions.generated.json");

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] ?? 0;
}

async function main() {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const events = (await readUsageEvents(since)).filter((event) =>
    event.event === "image_delivery" && event.locationId && !event.cacheHit
  );
  const byLocation = new Map<string, typeof events>();
  for (const event of events) {
    if (!event.locationId) continue;
    const current = byLocation.get(event.locationId) ?? [];
    current.push(event);
    byLocation.set(event.locationId, current);
  }

  const excluded = [...byLocation.entries()].flatMap(([locationId, samples]) => {
    if (samples.length < minimumSamples) return [];
    const failures = samples.filter((sample) => sample.outcome === "failed").length;
    const degraded = samples.filter((sample) => sample.outcome === "failed" || sample.outcome === "fallback").length;
    const durations = samples.map((sample) => sample.durationMs).filter((value): value is number => Number.isFinite(value));
    const failureRate = failures / samples.length;
    const p95 = percentile(durations, 0.95);
    const persistentlyBroken = failures >= 3 && failureRate >= 0.5;
    const persistentlySlow = degraded >= 3 && p95 >= slowThresholdMs;
    return persistentlyBroken || persistentlySlow ? [locationId] : [];
  }).sort();

  await writeFile(outputPath, `${JSON.stringify(excluded, null, 2)}\n`, "utf8");
  console.log(`Bildgesundheit geprüft: ${events.length} Messungen, ${excluded.length} Orte temporär quarantänisiert.`);
}

void main();
