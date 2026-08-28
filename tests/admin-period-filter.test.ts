import assert from "node:assert/strict";
import test from "node:test";
import {
  adminUsagePeriods,
  adminUsagePeriodSince,
  filterAdminUsageEvents,
  parseAdminUsagePeriod
} from "../lib/adminPeriodFilter";
import type { UsageEvent } from "../lib/usageMetrics.server";

const now = new Date("2026-08-28T10:00:00.000Z");
const event = (at: string): UsageEvent => ({ version: 1, at, event: "page_view" });

test("admin periods keep the requested order and safe default", () => {
  assert.deepEqual(adminUsagePeriods.map(({ key, label }) => [key, label]), [
    ["all", "Gesamt"], ["6m", "6 Monate"], ["3m", "3 Monate"],
    ["30d", "30 Tage"], ["7d", "7 Tage"], ["today", "Heute"]
  ]);
  assert.equal(parseAdminUsagePeriod(undefined), "all");
  assert.equal(parseAdminUsagePeriod("unknown"), "all");
  assert.equal(parseAdminUsagePeriod("30d"), "30d");
});

test("rolling admin periods use their real requested boundaries", () => {
  assert.equal(adminUsagePeriodSince("all", now), undefined);
  assert.equal(adminUsagePeriodSince("7d", now)?.toISOString(), "2026-08-21T10:00:00.000Z");
  assert.equal(adminUsagePeriodSince("30d", now)?.toISOString(), "2026-07-29T10:00:00.000Z");
  assert.equal(adminUsagePeriodSince("3m", now)?.toISOString(), "2026-05-30T10:00:00.000Z");
  assert.equal(adminUsagePeriodSince("6m", now)?.toISOString(), "2026-03-01T10:00:00.000Z");
});

test("admin event filtering changes the actual result set", () => {
  const events = [
    event("2026-03-15T12:00:00.000Z"),
    event("2026-08-10T12:00:00.000Z"),
    event("2026-08-25T12:00:00.000Z"),
    event("2026-08-28T08:00:00.000Z"),
    event("2026-08-29T08:00:00.000Z")
  ];
  assert.equal(filterAdminUsageEvents(events, "all", now).length, 4);
  assert.equal(filterAdminUsageEvents(events, "30d", now).length, 3);
  assert.equal(filterAdminUsageEvents(events, "7d", now).length, 2);
  assert.deepEqual(filterAdminUsageEvents(events, "today", now).map((item) => item.at), ["2026-08-28T08:00:00.000Z"]);
});
