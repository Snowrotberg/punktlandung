import type { UsageEvent } from "./usageMetrics.server";

export type UsageTimelinePeriodKey = "all" | "6m" | "3m" | "30d" | "7d" | "today";

export type UsageTimelineBucket = {
  label: string;
  axisLabel: string;
  pageViews: number | null;
  visits: number | null;
  starts: number | null;
  finishes: number | null;
  images: number | null;
  activeMinutes: number | null;
};

export const PUBLIC_BETA_STARTED_AT = Date.parse("2026-07-26T00:00:00+02:00");

const dayMs = 24 * 60 * 60 * 1_000;
const dateFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const yearFormatter = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit", timeZone: "Europe/Berlin" });

function formatDate(timestamp: number, showYear: boolean): string {
  return (showYear ? yearFormatter : dateFormatter).format(new Date(timestamp));
}

function increment(value: number | null, amount = 1): number {
  return (value ?? 0) + amount;
}

export function earliestUsageTimestamp(events: UsageEvent[]): number | null {
  const timestamps = events.map((event) => Date.parse(event.at)).filter(Number.isFinite);
  return timestamps.length ? Math.min(...timestamps) : null;
}

export function buildUsageTimeline(
  events: UsageEvent[],
  periodKey: UsageTimelinePeriodKey,
  since: Date | undefined,
  now: Date,
  measurementStart: number | null
): UsageTimelineBucket[] {
  const nowMs = now.getTime();
  const fallbackStart = nowMs - 30 * dayMs;
  const requestedStart = periodKey === "today"
    ? nowMs - dayMs
    : since?.getTime() ?? (periodKey === "all" ? PUBLIC_BETA_STARTED_AT : measurementStart) ?? fallbackStart;
  const startMs = Math.min(requestedStart, nowMs - 1);
  const bucketTargets: Record<Exclude<UsageTimelinePeriodKey, "all">, number> = { today: 1, "7d": 7, "30d": 15, "3m": 13, "6m": 13 };
  const bucketCount = periodKey === "all"
    ? Math.min(12, Math.max(1, Math.ceil((nowMs - startMs) / dayMs)))
    : bucketTargets[periodKey];
  const bucketDuration = Math.max(1, (nowMs - startMs) / bucketCount);
  const showYear = nowMs - startMs > 330 * dayMs;
  const buckets = Array.from({ length: bucketCount }, (_, index): UsageTimelineBucket => {
    const bucketStart = startMs + index * bucketDuration;
    const bucketEnd = index === bucketCount - 1 ? nowMs : startMs + (index + 1) * bucketDuration;
    const measured = measurementStart !== null && bucketEnd > measurementStart;
    const startLabel = formatDate(bucketStart, showYear);
    const endLabel = formatDate(bucketEnd, showYear);
    return {
      label: periodKey === "today" ? "Heute" : startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`,
      axisLabel: periodKey === "today" ? "Heute" : index === 0 ? formatDate(startMs, showYear) : index === bucketCount - 1 ? formatDate(nowMs, showYear) : startLabel,
      pageViews: measured ? 0 : null,
      visits: measured ? 0 : null,
      starts: measured ? 0 : null,
      finishes: measured ? 0 : null,
      images: measured ? 0 : null,
      activeMinutes: measured ? 0 : null
    };
  });

  for (const event of events) {
    const eventTime = Date.parse(event.at);
    if (!Number.isFinite(eventTime) || eventTime < startMs || eventTime > nowMs) continue;
    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((eventTime - startMs) / bucketDuration)));
    const bucket = buckets[bucketIndex];
    if (event.event === "page_view") bucket.pageViews = increment(bucket.pageViews);
    if (event.event === "visit_start") bucket.visits = increment(bucket.visits);
    if (event.event === "game_start") bucket.starts = increment(bucket.starts);
    if (event.event === "game_complete") bucket.finishes = increment(bucket.finishes);
    if (event.event === "image_delivery" && event.outcome !== "failed") bucket.images = increment(bucket.images);
    if (event.event === "page_engagement" && Number.isFinite(event.durationMs)) {
      bucket.activeMinutes = increment(bucket.activeMinutes, event.durationMs! / 60_000);
    }
  }

  for (const bucket of buckets) {
    if (bucket.activeMinutes !== null) bucket.activeMinutes = Math.round(bucket.activeMinutes * 10) / 10;
  }
  return buckets;
}
