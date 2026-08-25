import assert from "node:assert/strict";
import test from "node:test";
import { buildUsageTimeline, earliestUsageTimestamp, PUBLIC_BETA_STARTED_AT } from "../lib/adminUsageTimeline";
import type { UsageEvent } from "../lib/usageMetrics.server";

function event(at: string, name: UsageEvent["event"], details: Partial<UsageEvent> = {}): UsageEvent {
  return { version: 1, at, event: name, ...details };
}

test("Gesamt starts with the public beta and keeps pre-measurement buckets empty", () => {
  const events = [
    event("2026-08-22T10:00:00.000Z", "page_view"),
    event("2026-08-23T10:00:00.000Z", "visit_start")
  ];
  const start = earliestUsageTimestamp(events);
  const timeline = buildUsageTimeline(events, "all", undefined, new Date("2026-08-23T18:00:00.000Z"), start);

  assert.equal(start, Date.parse("2026-08-22T10:00:00.000Z"));
  assert.equal(PUBLIC_BETA_STARTED_AT, Date.parse("2026-07-26T00:00:00+02:00"));
  assert.equal(timeline[0].axisLabel, "26.07.");
  assert.equal(timeline[0].pageViews, null);
  assert.equal(timeline[0].visits, null);
  assert.equal(timeline.at(-1)?.axisLabel, "23.08.");
  assert.equal(timeline.reduce((sum, bucket) => sum + (bucket.pageViews ?? 0), 0), 1);
  assert.equal(timeline.reduce((sum, bucket) => sum + (bucket.visits ?? 0), 0), 1);
});

test("fixed periods show the real selected end date and leave pre-measurement buckets empty", () => {
  const now = new Date("2026-08-23T18:00:00.000Z");
  const since = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1_000);
  const measurementStart = Date.parse("2026-08-22T10:00:00.000Z");
  const timeline = buildUsageTimeline([], "6m", since, now, measurementStart);

  assert.equal(timeline[0].axisLabel, "24.02.");
  assert.equal(timeline.at(-1)?.axisLabel, "23.08.");
  assert.equal(timeline[0].pageViews, null);
  assert.equal(timeline.at(-1)?.pageViews, 0);
});

test("active usage minutes are aggregated per bucket", () => {
  const events = [event("2026-08-23T10:00:00.000Z", "page_engagement", { durationMs: 90_000 })];
  const start = earliestUsageTimestamp(events);
  const timeline = buildUsageTimeline(events, "today", new Date("2026-08-23T00:00:00.000Z"), new Date("2026-08-23T18:00:00.000Z"), start);
  assert.equal(timeline[0].activeMinutes, 1.5);
});

test("today uses an unambiguous label instead of a two-day axis", () => {
  const now = new Date("2026-08-23T20:00:00.000Z");
  const timeline = buildUsageTimeline([], "today", new Date("2026-08-21T20:00:00.000Z"), now, now.getTime() - 1_000);

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].label, "Heute");
  assert.equal(timeline[0].axisLabel, "Heute");
});
