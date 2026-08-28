import { leaderboardPeriodKey } from "./leaderboards";
import type { UsageEvent } from "./usageMetrics.server";

export const adminUsagePeriods = [
  { key: "all", days: null, label: "Gesamt" },
  { key: "6m", days: 180, label: "6 Monate" },
  { key: "3m", days: 90, label: "3 Monate" },
  { key: "30d", days: 30, label: "30 Tage" },
  { key: "7d", days: 7, label: "7 Tage" },
  { key: "today", days: 2, label: "Heute" }
] as const;

export type AdminUsagePeriodKey = (typeof adminUsagePeriods)[number]["key"];

export function parseAdminUsagePeriod(value: string | undefined): AdminUsagePeriodKey {
  return adminUsagePeriods.some((period) => period.key === value) ? value as AdminUsagePeriodKey : "all";
}

export function adminUsagePeriodSince(periodKey: AdminUsagePeriodKey, now: Date): Date | undefined {
  const period = adminUsagePeriods.find((item) => item.key === periodKey)!;
  return period.days === null ? undefined : new Date(now.getTime() - period.days * 24 * 60 * 60 * 1_000);
}

export function filterAdminUsageEvents(events: UsageEvent[], periodKey: AdminUsagePeriodKey, now: Date): UsageEvent[] {
  const since = adminUsagePeriodSince(periodKey, now);
  const inRange = since ? events.filter((event) => {
    const timestamp = Date.parse(event.at);
    return Number.isFinite(timestamp) && timestamp >= since.getTime() && timestamp <= now.getTime();
  }) : events.filter((event) => {
    const timestamp = Date.parse(event.at);
    return Number.isFinite(timestamp) && timestamp <= now.getTime();
  });
  if (periodKey !== "today") return inRange;
  const todayKey = leaderboardPeriodKey(now.getTime(), "daily");
  return inRange.filter((event) => leaderboardPeriodKey(Date.parse(event.at), "daily") === todayKey);
}
