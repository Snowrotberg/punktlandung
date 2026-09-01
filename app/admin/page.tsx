import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Activity,
  CircleCheckBig,
  Database,
  Gamepad2,
  Gauge,
  Lightbulb,
  MapPinned,
  Megaphone,
  MonitorSmartphone,
  ScanSearch,
  Server,
  Trophy,
  Users,
  type LucideIcon
} from "lucide-react";
import { redirect } from "next/navigation";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { AdminLineChart } from "@/components/admin/AdminLineChart";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";
import { LegalLinks } from "@/components/LegalLinks";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { SectionNavigation } from "@/components/SectionNavigation";
import { builtInLocations, catalogInventoryLocations } from "@/data/locations";
import { getAdminAccountContext } from "@/lib/adminAccess.server";
import { adConfig } from "@/lib/ads";
import { buildUsageTimeline, earliestUsageTimestamp, PUBLIC_BETA_STARTED_AT } from "@/lib/adminUsageTimeline";
import { adminUsagePeriods, adminUsagePeriodSince, filterAdminUsageEvents, parseAdminUsagePeriod } from "@/lib/adminPeriodFilter";
import { selectAdminTopPages } from "@/lib/adminTopPages";
import { summarizeGameplayTypes } from "@/lib/adminGameplayStatistics";
import { buildCatalogStatistics, catalogCategoryLabels } from "@/lib/catalogStatistics";
import { imageFileNameForLicense, imageLicenseHref } from "@/lib/imageLicenseLink";
import {
  applyLocationDifficultyOverrides,
  EASY_DIFFICULTY_SCORE_MAX,
  HARD_DIFFICULTY_SCORE_MIN,
  MINIMUM_DIFFICULTY_SAMPLES,
  SOLVED_DISTANCE_KM_MAX,
  STABLE_DIFFICULTY_SAMPLES,
  summarizeLocationDifficultyMovements,
  type LocationDifficultyOverride
} from "@/lib/locationDifficulty";
import { readUsageEvents, type UsageEvent } from "@/lib/usageMetrics.server";
import { readRoomServerHealth } from "@/lib/roomServerHealth.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { distributeProgress, gameProgressBands, pointProgressBands } from "@/lib/accountProgress";
import { communityRoadmapStatuses, communityStatusLabels, type CommunityStatus } from "@/lib/community";
import { readCommunitySuggestions, type CommunityReadResult } from "@/lib/communityRepository.server";
import { moderateCommunitySuggestion } from "./community-actions";
import layoutStyles from "../konto/dashboard.module.css";
import styles from "./page.module.css";
import { ResponsiveRouteSelect } from "@/components/ResponsiveRouteSelect";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type MetricTone = "good" | "warning" | "critical" | "neutral";
const ROADMAP_PAGE_SIZE = 5;

function AdminMetricValue({
  children,
  tone = "neutral",
  recommendation
}: {
  children: ReactNode;
  tone?: MetricTone;
  recommendation?: string;
}) {
  const toneClass: Record<MetricTone, string> = {
    good: styles.metricGood,
    warning: styles.metricWarning,
    critical: styles.metricCritical,
    neutral: styles.metricNeutral
  };
  const className = `${styles.metricValue} ${toneClass[tone]}`;
  if (!recommendation) return <strong className={className}>{children}</strong>;
  return <strong className={className} tabIndex={0} aria-label={`${String(children)}. ${recommendation}`}>
    {children}
    <span className={styles.metricTooltip} role="tooltip">{recommendation}</span>
  </strong>;
}

function lowerIsBetter(value: number | null, warningAt: number, criticalAt: number): MetricTone {
  if (value === null) return "neutral";
  if (value >= criticalAt) return "critical";
  if (value >= warningAt) return "warning";
  return "good";
}

function higherIsBetter(value: number | null, warningBelow: number, criticalBelow: number): MetricTone {
  if (value === null) return "neutral";
  if (value < criticalBelow) return "critical";
  if (value < warningBelow) return "warning";
  return "good";
}

function catalogPoolTone(value: number): MetricTone {
  return value < 15 ? "critical" : value < 30 ? "warning" : "good";
}

function catalogPoolRecommendation(value: number): string {
  if (value < 15) return "Kritisch: Für längere Partien fehlen ausreichend unterschiedliche Aufgaben. Den Bestand dieser Stufe zuerst ausbauen.";
  if (value < 30) return "Beobachten: Für abwechslungsreiche 30-Runden-Partien sollte diese Stufe auf mindestens 30 Aufgaben wachsen.";
  return "Unauffällig: Der Bestand bietet mindestens 30 Aufgaben und damit einen soliden Puffer für längere Partien.";
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "Noch keine Daten";
  return durationMs < 1_000 ? `${durationMs} ms` : `${(durationMs / 1_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
}

function pageLabel(path: string): string {
  const labels: Record<string, string> = {
    "/": "Startseite", "/solo-modus": "Solo-Modus", "/party-modus": "Party-Modus", "/online-modus": "Online-Modus",
    "/spielen": "Spielrunde", "/aufloesung": "Auflösung", "/endergebnis": "Endergebnis", "/konto": "Spielerkonto",
    "/konto/verlauf": "Spielverlauf", "/konto/verlauf/[spiel]": "Partiedetails", "/rankings": "Rankings", "/infos": "Infos",
    "/community": "Community", "/admin": "Administration"
  };
  return labels[path] ?? path;
}

function pageAdminHref(path: string): string | null {
  if (path === "/aufloesung" || path === "/endergebnis") return `/admin/vorschau?seite=${path.slice(1)}`;
  if (path === "/konto/verlauf/[spiel]") return "/konto/verlauf";
  return /^\/[a-z0-9_/-]*$/.test(path) ? path : null;
}

function formatAdminDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Nicht verfügbar";
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "Nicht verfügbar";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days > 0 ? `${days} T ${hours} Std.` : `${hours} Std. ${Math.floor((seconds % 3_600) / 60)} Min.`;
}

function AdminSectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <h2 className={styles.sectionTitle}><Icon aria-hidden="true" /><span>{children}</span></h2>;
}

function AdminHelp({ title, children }: { title: string; children: ReactNode }) {
  return <InlineInfoPopover align="right" title={title} ariaLabel={`${title} erklären`}>{children}</InlineInfoPopover>;
}

const communityFilters: Array<{ value: "all" | CommunityStatus; label: string }> = [
  { value: "all", label: "Alle" },
  ...communityRoadmapStatuses.map((status) => ({ value: status, label: communityStatusLabels[status] }))
];

async function readAccountProgress(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const pageSize = 1_000;
  const accountIds: string[] = [];
  const games: Array<{ account_id: string | null; score: number | null; integrity_status: string }> = [];

  for (let from = 0; ; from += pageSize) {
    const result = await admin.from("accounts").select("account_id").eq("status", "active").range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    accountIds.push(...page.map((row) => row.account_id));
    if (page.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const result = await admin.from("ranked_games").select("account_id, score, integrity_status").eq("status", "completed").not("account_id", "is", null).range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    games.push(...page);
    if (page.length < pageSize) break;
  }

  const activeIds = new Set(accountIds);
  const progress = new Map(accountIds.map((accountId) => [accountId, { games: 0, points: 0 }]));
  for (const game of games) {
    if (!game.account_id || !activeIds.has(game.account_id)) continue;
    const current = progress.get(game.account_id)!;
    current.games += 1;
    if (game.integrity_status === "verified") current.points += game.score ?? 0;
  }

  const values = [...progress.values()];
  return {
    accountCount: accountIds.length,
    gameBands: distributeProgress(values.map((value) => value.games), gameProgressBands),
    pointBands: distributeProgress(values.map((value) => value.points), pointProgressBands)
  };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ period?: string; communityStatus?: string; roadmapPage?: string }> }) {
  const context = await getAdminAccountContext();
  if (!context) redirect("/konto");
  const params = await searchParams;
  const periodKey = parseAdminUsagePeriod(params.period);
  const period = adminUsagePeriods.find((item) => item.key === periodKey)!;
  const communityStatus = communityFilters.some((filter) => filter.value === params.communityStatus)
    ? params.communityStatus as CommunityStatus | "all"
    : "all";

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const since = adminUsagePeriodSince(periodKey, now);
  const staleGameThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const [accountProgress, completed, verified, active, staleActive, usageEvents, difficultyMetrics, roomServerHealth] = await Promise.all([
    readAccountProgress(admin),
    admin.from("ranked_games").select("game_id", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("ranked_games").select("game_id", { count: "exact", head: true }).eq("integrity_status", "verified"),
    admin.from("ranked_games").select("game_id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("ranked_games").select("game_id", { count: "exact", head: true }).eq("status", "active").lt("started_at", staleGameThreshold),
    readUsageEvents(),
    admin.from("location_difficulty_metrics")
      .select("location_id, verified_rounds, suggested_difficulty, confidence, calculated_at"),
    readRoomServerHealth()
  ]);
  const measurementStart = earliestUsageTimestamp(usageEvents);
  const events = filterAdminUsageEvents(usageEvents, periodKey, now);
  const count = (name: string) => events.filter((event) => event.event === name).length;
  const starts = count("game_start");
  const finishes = count("game_complete");
  const pageViews = count("page_view");
  const visits = count("visit_start");
  const imageEvents = events.filter((event) => event.event === "image_delivery");
  const completedImageDurations = imageEvents
    .filter((event) => event.outcome === "loaded" || event.outcome === "fallback")
    .map((event) => event.durationMs)
    .filter((duration): duration is number => Number.isFinite(duration));
  const imageP50 = percentile(completedImageDurations, 0.5);
  const imageP95 = percentile(completedImageDurations, 0.95);
  const imageFallbacks = imageEvents.filter((event) => event.outcome === "fallback").length;
  const imageFailures = imageEvents.filter((event) => event.outcome === "failed").length;
  const imageCacheHits = imageEvents.filter((event) => event.cacheHit).length;
  const completionRate = starts ? Math.round((finishes / starts) * 100) : null;
  const imageFallbackRate = imageEvents.length ? (imageFallbacks / imageEvents.length) * 100 : null;
  const imageFailureRate = imageEvents.length ? (imageFailures / imageEvents.length) * 100 : null;
  const imageCacheHitRate = imageEvents.length ? Math.round((imageCacheHits / imageEvents.length) * 100) : null;
  const engagementEvents = events.filter((event) => event.event === "page_engagement" && event.path && event.visitId && event.durationMs);
  const visitDurations = new Map<string, number>();
  for (const event of engagementEvents) visitDurations.set(event.visitId!, (visitDurations.get(event.visitId!) ?? 0) + event.durationMs!);
  const averageVisitDuration = visitDurations.size ? [...visitDurations.values()].reduce((sum, value) => sum + value, 0) / visitDurations.size : null;
  const pageStats = new Map<string, { views: number; durationMs: number }>();
  for (const event of events) {
    if (!event.path || (event.event !== "page_view" && event.event !== "page_engagement")) continue;
    const value = pageStats.get(event.path) ?? { views: 0, durationMs: 0 };
    if (event.event === "page_view") value.views += 1;
    if (event.event === "page_engagement") value.durationMs += event.durationMs ?? 0;
    pageStats.set(event.path, value);
  }
  const topPages = selectAdminTopPages(pageStats);
  const deviceLabels: Record<NonNullable<UsageEvent["deviceClass"]>, string> = { phone: "Smartphone", tablet: "Tablet", laptop: "Laptop", desktop: "Monitor/Desktop", "large-screen": "TV / großer Bildschirm" };
  const deviceCounts = new Map<string, number>();
  const viewportCounts = new Map<string, number>();
  for (const event of events.filter((item) => item.event === "page_view")) {
    if (event.deviceClass) deviceCounts.set(event.deviceClass, (deviceCounts.get(event.deviceClass) ?? 0) + 1);
    if (event.viewportBucket) viewportCounts.set(event.viewportBucket, (viewportCounts.get(event.viewportBucket) ?? 0) + 1);
  }
  const sortedDevices = [...deviceCounts].sort((a, b) => b[1] - a[1]);
  const sortedViewports = [...viewportCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const roomServerEvents = events.filter((event) => ["ws_connection_accepted", "ws_connection_rejected", "room_created", "room_joined", "capacity_sample"].includes(event.event));
  const latestSignal = roomServerHealth.checkedAt ?? roomServerEvents.at(-1)?.at;
  const acceptedConnections = count("ws_connection_accepted");
  const rejectedConnections = count("ws_connection_rejected");
  const connectionAttempts = acceptedConnections + rejectedConnections;
  const rejectionRate = connectionAttempts ? (rejectedConnections / connectionAttempts) * 100 : null;
  const staleActiveCount = staleActive.count ?? 0;
  const latestSignalAgeMinutes = latestSignal ? Math.max(0, (now.getTime() - new Date(latestSignal).getTime()) / 60_000) : null;
  const usageTimeline = buildUsageTimeline(events, periodKey, since, now, measurementStart);
  const gameplayTypes = summarizeGameplayTypes(events);
  const metricRows = difficultyMetrics.data ?? [];
  const catalogIds = new Set(builtInLocations.map((location) => location.id));
  const activeMetricRows = metricRows.filter((row) => catalogIds.has(row.location_id));
  const overrides: LocationDifficultyOverride[] = activeMetricRows
    .filter((row) => ["easy", "medium", "hard"].includes(row.suggested_difficulty))
    .filter((row) => ["insufficient", "provisional", "stable"].includes(row.confidence))
    .map((row) => ({
      locationId: row.location_id,
      suggestedDifficulty: row.suggested_difficulty as LocationDifficultyOverride["suggestedDifficulty"],
      confidence: row.confidence as LocationDifficultyOverride["confidence"]
    }));
  const catalogStatistics = buildCatalogStatistics(
    applyLocationDifficultyOverrides(builtInLocations, overrides),
    applyLocationDifficultyOverrides(catalogInventoryLocations, overrides)
  );
  // Historische Ausspielungen können inzwischen gefilterte Katalogeinträge enthalten.
  // Ihre Quellen bleiben im vollständigen Inventar weiterhin nachvollziehbar.
  const locationsById = new Map(catalogInventoryLocations.map((location) => [location.id, location]));
  const topImages = [...imageEvents.filter((event) => event.outcome !== "failed" && event.locationId).reduce((counts, event) => {
    counts.set(event.locationId!, (counts.get(event.locationId!) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const reviewedImageShare = catalogStatistics.totalTasks
    ? (catalogStatistics.reviewedImages / catalogStatistics.totalTasks) * 100
    : null;
  const insufficientMetrics = activeMetricRows.filter((row) => row.confidence === "insufficient").length;
  const provisionalMetrics = activeMetricRows.filter((row) => row.confidence === "provisional").length;
  const stableMetrics = activeMetricRows.filter((row) => row.confidence === "stable").length;
  const highestVerifiedRoundCount = activeMetricRows.reduce((highest, row) => Math.max(highest, row.verified_rounds), 0);
  const difficultyMovements = summarizeLocationDifficultyMovements(builtInLocations, overrides);
  const latestDifficultyUpdate = activeMetricRows.reduce<string | null>((latest, row) =>
    !latest || row.calculated_at > latest ? row.calculated_at : latest, null);
  let community: CommunityReadResult = { available: false, suggestions: [] };
  try {
    community = await readCommunitySuggestions({ admin: true, sort: "new" });
  } catch (error) {
    console.error("Admin community queue could not be loaded", error instanceof Error ? error.message : "unknown error");
  }
  const pendingCommunitySuggestions = community.suggestions.filter((suggestion) => suggestion.status === "pending");
  const managedCommunitySuggestions = community.suggestions.filter((suggestion) =>
    suggestion.status !== "pending" && (communityStatus === "all" || suggestion.status === communityStatus));
  const requestedRoadmapPage = Number.parseInt(params.roadmapPage ?? "1", 10);
  const roadmapPageCount = Math.max(1, Math.ceil(managedCommunitySuggestions.length / ROADMAP_PAGE_SIZE));
  const roadmapPage = Math.min(
    roadmapPageCount,
    Number.isFinite(requestedRoadmapPage) && requestedRoadmapPage > 0 ? requestedRoadmapPage : 1
  );
  const paginatedCommunitySuggestions = managedCommunitySuggestions.slice(
    (roadmapPage - 1) * ROADMAP_PAGE_SIZE,
    roadmapPage * ROADMAP_PAGE_SIZE
  );
  const periodHeading = periodKey === "all" ? "Gesamt" : periodKey === "today" ? "Heute" : `letzte ${period.label}`;
  const measurementNotice = measurementStart === null
    ? "Für diesen Datenbestand liegen noch keine Messdaten vor."
    : `Für diesen Datenbestand liegen Messwerte ab dem ${formatAdminDate(measurementStart)} vor.`;
  const publicBetaStartLabel = formatAdminDate(PUBLIC_BETA_STARTED_AT);

  return <main className={layoutStyles.page}><div className={`${layoutStyles.frame} ${layoutStyles.frameNoAds}`}>
    <RedesignShell className={layoutStyles.app}>
      <RedesignHeader className={layoutStyles.topbar}><RedesignBrand className={layoutStyles.brand} /><div className={layoutStyles.toplinks}><RedesignButtonLink href="/solo-modus" tone="primary" className={layoutStyles.toplink}>Spielen</RedesignButtonLink><AccountHeaderControls /></div></RedesignHeader>
      <SectionNavigation section="account" admin />
      <div className={layoutStyles.narrowShell}><div className={styles.content}>
        <div className={styles.heading}><div><h1>Administration</h1><p>Betrieb, Nutzung und Monetarisierung auf einen Blick.</p></div></div>
        <div className={styles.periodFilter}>
          <span className={styles.periodLabel}>Zeitraum für Nutzung &amp; Auslieferung</span>
          <nav className={styles.periods} aria-label="Zeitraum für Nutzung und Auslieferung">
            {adminUsagePeriods.map((item) => <a key={item.key} href={`/admin?period=${item.key}`} className={item.key === "all" ? styles.periodAll : undefined} aria-current={item.key === periodKey ? "page" : undefined}>{item.label}</a>)}
          </nav>
          <div className={styles.mobilePeriodSelect}>
            <ResponsiveRouteSelect label="Zeitraum" value={periodKey} options={adminUsagePeriods.map((item) => ({ value: item.key, label: item.label, href: `/admin?period=${item.key}` }))} />
          </div>
          <p>Historische Werte folgen dem gewählten Zeitraum. „Gesamt“ beginnt mit der öffentlichen Beta am {publicBetaStartLabel} und reicht bis heute. {measurementNotice} Frühere Nutzung wurde nicht rückwirkend erfasst.</p>
        </div>
        <div className={styles.metricLegend} aria-label="Bedeutung der Kennzahlenfarben">
          <span><i className={styles.legendGood} />Unauffällig</span>
          <span><i className={styles.legendWarning} />Beobachten</span>
          <span><i className={styles.legendCritical} />Kritisch</span>
          <span><i className={styles.legendNeutral} />Ohne Bewertung</span>
          <small>Markierte Werte fokussieren oder mit der Maus berühren, um die Empfehlung zu sehen.</small>
        </div>
        <p className={styles.summaryPurpose}><strong>Schnellüberblick · {periodHeading}</strong><span>Vier zentrale Momentaufnahmen für die erste Einordnung. Zeitverläufe und vollständige Kontrollwerte folgen darunter.</span></p>
        <div className={styles.stats} aria-label={`Schnellüberblick für ${periodHeading}`}>
          <div className={styles.stat}><Users aria-hidden="true" /><strong>{visits}</strong><span>Besuche · {periodHeading}</span></div>
          <div className={styles.stat}><Activity aria-hidden="true" /><strong>{starts}</strong><span>Spielstarts · {periodHeading}</span></div>
          <div className={styles.stat}><CircleCheckBig aria-hidden="true" /><strong>{completionRate === null ? "–" : `${completionRate} %`}</strong><span className={styles.statLabelWithHelp}>Abschlussquote · {periodHeading}<AdminHelp title="Abschlussquote">Die Quote teilt die im gewählten Zeitraum gemessenen Spielabschlüsse durch die Spielstarts. Abgebrochene Partien und Starts, deren Abschluss außerhalb des Zeitraums liegt, senken den Wert.</AdminHelp></span></div>
          <div className={styles.stat}><MonitorSmartphone aria-hidden="true" /><strong>{averageVisitDuration === null ? "–" : formatDuration(averageVisitDuration)}</strong><span>Ø aktive Besuchszeit · {periodHeading}</span></div>
        </div>
        <div className={styles.grid}>
          <div className={`${styles.scopeDivider} ${styles.communityDivider}`}><span>Community &amp; Roadmap</span><p>Neue Vorschläge prüfen und bereits freigegebene Ideen entlang der öffentlichen Roadmap verwalten.</p></div>
          <section className={`${styles.panel} ${styles.catalogPanel} ${styles.communityPanel}`}><div className={styles.panelHeading}><div><AdminSectionTitle icon={Lightbulb}>Neue Vorschläge prüfen</AdminSectionTitle><p className={styles.muted}>Neue Einreichungen sind nicht öffentlich. Du kannst den Text korrigieren und sie anschließend freigeben oder ablehnen.</p></div><a href="/community">Community ansehen</a></div>
            {!community.available ? <p className={styles.muted}>Die Community-Daten konnten nicht geladen werden.</p> : pendingCommunitySuggestions.length === 0 ? <p className={styles.muted}>Aktuell wartet kein neuer Vorschlag auf deine Prüfung.</p> : <div className={styles.communityQueue}>{pendingCommunitySuggestions.map((suggestion) => <form action={moderateCommunitySuggestion} key={suggestion.suggestionId} className={styles.communityItem}>
              <input type="hidden" name="suggestionId" value={suggestion.suggestionId} /><input type="hidden" name="mode" value="review" />
              <div className={styles.communityEditor}><div className={styles.communityMeta}><span>In Prüfung · nicht öffentlich</span><time dateTime={suggestion.createdAt}>{new Date(suggestion.createdAt).toLocaleDateString("de-DE")}</time><small>von {suggestion.authorLabel}</small></div><label>Ideenname<input name="title" defaultValue={suggestion.title} maxLength={100} required /></label><label>Beschreibung<textarea name="details" defaultValue={suggestion.details} maxLength={2000} rows={3} required /></label></div>
              <div className={styles.reviewControls}><label>Interne Notiz <small>Nur für dich sichtbar</small><textarea name="moderationNote" defaultValue={suggestion.moderationNote ?? ""} maxLength={1000} rows={4} placeholder="Eigene Gedanken oder To-dos festhalten" /></label><div className={styles.reviewActions}><button type="submit" name="decision" value="decline" className={styles.secondaryAction}>Nicht freigeben</button><button type="submit" name="decision" value="approve">Freigeben</button></div></div>
            </form>)}</div>}
          </section>
          <section className={`${styles.panel} ${styles.catalogPanel} ${styles.roadmapPanel}`}><div className={styles.panelHeading}><div><AdminSectionTitle icon={MapPinned}>Roadmap verwalten</AdminSectionTitle><p className={styles.muted}>Hier steuerst du ausschließlich den Status bereits geprüfter Vorschläge. Diese Stati werden den Nutzern angezeigt.</p></div></div>
            <nav className={styles.communityFilters} aria-label="Roadmap-Vorschläge filtern">{communityFilters.map((filter) => { const query = new URLSearchParams({ period: periodKey }); if (filter.value !== "all") query.set("communityStatus", filter.value); return <a key={filter.value} href={`/admin?${query.toString()}`} aria-current={communityStatus === filter.value ? "page" : undefined}>{filter.label}</a>; })}</nav>
            {!community.available ? <p className={styles.muted}>Die Community-Daten konnten nicht geladen werden.</p> : managedCommunitySuggestions.length === 0 ? <p className={styles.muted}>Für diesen Filter gibt es noch keine Vorschläge.</p> : <>
              <div className={styles.roadmapList}>{paginatedCommunitySuggestions.map((suggestion) => <details key={suggestion.suggestionId} className={styles.roadmapItem}>
                <summary><span className={styles.roadmapStatus}>{communityStatusLabels[suggestion.status]}</span><strong>{suggestion.title}</strong><span className={styles.roadmapSummaryMeta}>{suggestion.voteCount} {suggestion.voteCount === 1 ? "Stimme" : "Stimmen"} · {new Date(suggestion.createdAt).toLocaleDateString("de-DE")}</span><span className={styles.roadmapToggle}>Bearbeiten</span></summary>
                <form action={moderateCommunitySuggestion} className={styles.communityItem}>
                  <input type="hidden" name="suggestionId" value={suggestion.suggestionId} /><input type="hidden" name="mode" value="roadmap" />
                  <div className={styles.communityEditor}><label>Ideenname<input name="title" defaultValue={suggestion.title} maxLength={100} required /></label><label>Beschreibung<textarea name="details" defaultValue={suggestion.details} maxLength={2000} rows={3} required /></label><em>von {suggestion.authorLabel}</em></div>
                  <div className={styles.reviewControls}><label>Öffentlicher Roadmap-Status<select name="status" defaultValue={suggestion.status}>{communityRoadmapStatuses.map((status) => <option key={status} value={status}>{communityStatusLabels[status]}</option>)}</select></label><label>Interne Notiz <small>Nur für dich sichtbar</small><textarea name="moderationNote" defaultValue={suggestion.moderationNote ?? ""} maxLength={1000} rows={3} placeholder="Eigene Gedanken oder To-dos festhalten" /></label><button type="submit">Änderungen speichern</button></div>
                </form>
              </details>)}</div>
              {roadmapPageCount > 1 ? <nav className={styles.pagination} aria-label="Seiten der Roadmap-Vorschläge">
                {Array.from({ length: roadmapPageCount }, (_, index) => index + 1).map((page) => { const query = new URLSearchParams({ period: periodKey, roadmapPage: String(page) }); if (communityStatus !== "all") query.set("communityStatus", communityStatus); return <a key={page} href={`/admin?${query.toString()}`} aria-current={page === roadmapPage ? "page" : undefined} aria-label={`Seite ${page}`}>{page}</a>; })}
              </nav> : null}
              <p className={styles.paginationSummary}>{managedCommunitySuggestions.length} geprüfte {managedCommunitySuggestions.length === 1 ? "Idee" : "Ideen"} · Seite {roadmapPage} von {roadmapPageCount}</p>
            </>}
          </section>
          <div className={styles.scopeDivider}><span>Aktueller Stand · Echtzeit</span><p>Die folgenden Bestands-, Konto-, Community- und Serverwerte werden beim Öffnen neu geladen und sind unabhängig vom Zeitraumfilter.</p></div>
          <div className={`${styles.stats} ${styles.realtimeStats}`}>
            <div className={styles.stat}><Users aria-hidden="true" /><strong>{accountProgress.accountCount}</strong><span>aktive Spielerkonten</span></div>
            <div className={styles.stat}><CircleCheckBig aria-hidden="true" /><strong>{completed.count ?? 0}</strong><span>abgeschlossene Partien</span></div>
            <div className={styles.stat}><Gauge aria-hidden="true" /><strong>{verified.count ?? 0}</strong><span>verifizierte Partien</span></div>
            <div className={styles.stat}><Server aria-hidden="true" /><strong>{active.count ?? 0}</strong><span className={styles.statLabelWithHelp}>aktive Serverpartien<AdminHelp title="Aktive Serverpartien">Gezählt werden in Supabase noch als aktiv gespeicherte Ranking-Partien. Das sind nicht die gleichzeitig verbundenen Personen oder Räume. Ungewöhnlich alte Einträge werden im Bereich „Raumserver &amp; Synchronisierung“ separat ausgewiesen.</AdminHelp></span></div>
          </div>
          <section className={`${styles.panel} ${styles.catalogPanel} ${styles.catalogOverviewPanel}`}><AdminSectionTitle icon={Database}>Aktueller Aufgabenbestand</AdminSectionTitle>
            <div className={styles.tableWrap}><table className={styles.matrix}>
              <thead><tr><th>Kategorie</th><th>Gesamt</th><th>Leicht</th><th>Mittel</th><th>Schwer</th></tr></thead>
              <tbody>{catalogStatistics.categories.map((row) => <tr key={row.category}><td data-label="Kategorie">{catalogCategoryLabels[row.category]}</td><td data-label="Gesamt"><AdminMetricValue tone={catalogPoolTone(row.total)} recommendation={catalogPoolRecommendation(row.total)}>{row.total}</AdminMetricValue></td><td data-label="Leicht"><AdminMetricValue tone={catalogPoolTone(row.easy)} recommendation={catalogPoolRecommendation(row.easy)}>{row.easy}</AdminMetricValue></td><td data-label="Mittel"><AdminMetricValue tone={catalogPoolTone(row.medium)} recommendation={catalogPoolRecommendation(row.medium)}>{row.medium}</AdminMetricValue></td><td data-label="Schwer"><AdminMetricValue tone={catalogPoolTone(row.hard)} recommendation={catalogPoolRecommendation(row.hard)}>{row.hard}</AdminMetricValue></td></tr>)}</tbody>
              <tfoot><tr><th>Gesamt</th><th>{catalogStatistics.totalTasks}</th><th>{catalogStatistics.categories.reduce((sum, row) => sum + row.easy, 0)}</th><th>{catalogStatistics.categories.reduce((sum, row) => sum + row.medium, 0)}</th><th>{catalogStatistics.categories.reduce((sum, row) => sum + row.hard, 0)}</th></tr></tfoot>
            </table></div>
            <p className={styles.muted}>{catalogStatistics.uniqueVisuals.toLocaleString("de-DE")} unterschiedliche aktive Bilder · {catalogStatistics.countriesAndTerritories} aktive Länder und Gebiete ({catalogStatistics.sourceCountriesAndTerritories} im Quellbestand). Die Werte enthalten bereits belastbare automatische Umstufungen.</p>
            <details className={styles.detailDisclosure}><summary>Qualitätsfilter im Detail <span>{catalogStatistics.strictQualifiedImages.toLocaleString("de-DE")} aktiv · {catalogStatistics.excludedByQuality.toLocaleString("de-DE")} ausgeschlossen</span></summary><ul className={styles.catalogQualityList}>
              <li><span>Quellbestand vor Qualitätsfilter</span><AdminMetricValue tone="neutral" recommendation="Alle weiterhin nachvollziehbaren Wikimedia-Kandidaten vor dem strengen Spielfilter.">{catalogStatistics.sourceTasks.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Streng freigegeben · aktiv</span><AdminMetricValue tone={catalogStatistics.strictQualifiedImages === catalogStatistics.totalTasks ? "good" : "critical"} recommendation={catalogStatistics.strictQualifiedImages === catalogStatistics.totalTasks ? "Alle aktiven Bilder erfüllen Aufnahmejahr, TV-Auflösung, Bildformat und Kategoriebeleg." : "Kritisch: Mindestens ein aktives Bild erfüllt das aktuelle Qualitätsprofil nicht."}>{catalogStatistics.strictQualifiedImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Aktive Dateien mit Einzelnachweis</span><AdminMetricValue tone={catalogStatistics.missingLicenseImages === 0 ? "good" : "critical"} recommendation={catalogStatistics.missingLicenseImages === 0 ? "Alle aktiven Wikimedia-Dateien besitzen Urheber-, Lizenz- und Originalquellenangaben." : "Kritisch: Der Lizenzkatalog ist nicht vollständig mit dem aktiven Bildbestand synchron."}>{catalogStatistics.licensedImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Aktive Dateien ohne Einzelnachweis</span><AdminMetricValue tone={catalogStatistics.missingLicenseImages === 0 ? "good" : "critical"} recommendation={catalogStatistics.missingLicenseImages === 0 ? "Unauffällig: Kein aktives Bild ohne Einzelnachweis." : "Lizenzmetadaten neu erzeugen und das Katalog-Audit wiederholen."}>{catalogStatistics.missingLicenseImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Gesamtes Bildinventar mit Einzelnachweis</span><AdminMetricValue tone={catalogStatistics.missingInventoryLicenseImages === 0 ? "good" : "critical"} recommendation={catalogStatistics.missingInventoryLicenseImages === 0 ? "Auch früher ausgespielte und inzwischen gefilterte Wikimedia-Dateien bleiben vollständig nachvollziehbar." : "Kritisch: Historische Admin-Ausspielungen können auf unvollständige Einzelnachweise verweisen."}>{catalogStatistics.inventoryLicensedImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Bei Commons nachweislich nicht mehr verfügbar</span><AdminMetricValue tone="neutral" recommendation="Gelöschte historische Commons-Dateien werden mit Löschgrund und Protokolllink dokumentiert, aber nicht als vollständiger Lizenzeintrag gezählt.">{catalogStatistics.unavailableInventoryImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Gesamtes Bildinventar ohne Einzelnachweis</span><AdminMetricValue tone={catalogStatistics.missingInventoryLicenseImages === 0 ? "good" : "critical"} recommendation={catalogStatistics.missingInventoryLicenseImages === 0 ? "Unauffällig: Kein archivierter Bildverweis ohne Einzelnachweis." : "Lizenzmetadaten für das vollständige Bildinventar neu erzeugen und das Katalog-Audit wiederholen."}>{catalogStatistics.missingInventoryLicenseImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Nicht aktiv · Qualitätsfilter</span><AdminMetricValue tone={catalogStatistics.excludedByQuality > 0 ? "neutral" : "good"} recommendation="Diese Kandidaten bleiben für Audits erhalten, werden im Spiel aber wegen Alter, Auflösung, Format oder fehlendem Kategoriebeleg nicht gezogen.">{catalogStatistics.excludedByQuality.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Ausschluss · Aufnahme vor 2010</span><AdminMetricValue tone="neutral">{catalogStatistics.exclusionReasons["captured-before-2010"].toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Ausschluss · Aufnahmejahr fehlt</span><AdminMetricValue tone="neutral">{catalogStatistics.exclusionReasons["capture-date-missing"].toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Ausschluss · unter TV-Auflösung</span><AdminMetricValue tone="neutral">{catalogStatistics.exclusionReasons["resolution-below-tv"].toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Ausschluss · ungeeignetes Bildformat</span><AdminMetricValue tone="neutral">{catalogStatistics.exclusionReasons["aspect-ratio-unsuitable"].toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Ausschluss · Kategorie nicht ausreichend belegt</span><AdminMetricValue tone="neutral">{catalogStatistics.exclusionReasons["category-unverified"].toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Aufnahmejahr vorhanden oder Vektorflagge</span><AdminMetricValue tone={higherIsBetter(catalogStatistics.captureMetadataImages / Math.max(1, catalogStatistics.sourceTasks) * 100, 95, 80)} recommendation="Flaggen gelten als zeitunabhängige Vektorgrafiken; bei Fotos wird das Commons-Aufnahmejahr ausgewertet.">{catalogStatistics.captureMetadataImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Aktuell · ab 2010</span><AdminMetricValue tone={catalogStatistics.currentImages >= catalogStatistics.strictQualifiedImages ? "good" : "warning"} recommendation="Fotos vor 2010 werden nicht mehr in den aktiven Katalog aufgenommen.">{catalogStatistics.currentImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>TV-taugliche Quelle · mindestens 2560×1440</span><AdminMetricValue tone={catalogStatistics.tvReadyImages >= catalogStatistics.strictQualifiedImages ? "good" : "warning"} recommendation="Der aktive Masterkatalog ist TV-tauglich; Handy und Laptop erhalten kleinere Wikimedia-Ableitungen desselben Originals.">{catalogStatistics.tvReadyImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Davon 4K-Quelle · mindestens 3840×2160</span><AdminMetricValue tone="neutral" recommendation="4K ist eine zusätzliche Qualitätsstufe, aber keine Pflicht für die aktive Auswahl.">{catalogStatistics.fourKReadyImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Automatisch qualitätsgeprüft</span><AdminMetricValue tone={higherIsBetter(reviewedImageShare, 80, 50)} recommendation={reviewedImageShare === null ? "Noch kein Bestand vorhanden." : reviewedImageShare < 50 ? "Kritisch: Weniger als die Hälfte des Katalogs ist qualitätsgeprüft. Die Prüfung sollte priorisiert werden." : reviewedImageShare < 80 ? "Beobachten: Den Anteil qualitätsgeprüfter Bilder schrittweise auf mindestens 80 % erhöhen." : "Unauffällig: Mindestens 80 % des Katalogs sind qualitätsgeprüft."}>{catalogStatistics.reviewedImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Commons „Featured“ oder „Quality“</span><AdminMetricValue tone={catalogStatistics.featuredOrQualityImages > 0 ? "good" : "warning"} recommendation={catalogStatistics.featuredOrQualityImages > 0 ? "Es sind besonders ausgezeichnete Commons-Bilder im Katalog vorhanden." : "Beobachten: Noch kein Bild trägt das Commons-Prädikat Featured oder Quality. Geeignete Motive gezielt ergänzen."}>{catalogStatistics.featuredOrQualityImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Aufnahme aus den letzten fünf Jahren</span><AdminMetricValue tone={catalogStatistics.recentlyCapturedImages > 0 ? "good" : "warning"} recommendation={catalogStatistics.recentlyCapturedImages > 0 ? "Der Katalog enthält auch aktuelle Aufnahmen." : "Beobachten: Es ist noch keine Aufnahme aus den letzten fünf Jahren gekennzeichnet. Metadaten prüfen oder aktuelle Motive ergänzen."}>{catalogStatistics.recentlyCapturedImages.toLocaleString("de-DE")}</AdminMetricValue></li>
              <li><span>Ø automatischer Bildscore</span><AdminMetricValue tone="neutral" recommendation="Für diesen projektspezifischen Score ist noch kein verbindlicher Qualitätsgrenzwert definiert. Er dient vorerst nur dem Vergleich.">{catalogStatistics.averageImageQualityScore?.toLocaleString("de-DE") ?? "Noch ohne Wert"}</AdminMetricValue></li>
            </ul></details>
          </section>
          <section className={`${styles.panel} ${styles.difficultyPanel}`}><AdminSectionTitle icon={Gauge}><span className={styles.sectionTitleWithHelp}>Automatische Schwierigkeit<AdminHelp title="Automatische Schwierigkeit">Einbezogen werden nur aufgelöste Runden aus vollständig abgeschlossenen, verifizierten Konto-Partien mit 15, 30 oder 60 Sekunden. Der Schwierigkeitswert besteht zu 55 % aus dem Punktverlust, zu 30 % aus nicht gelösten Runden und zu 15 % aus der relativ zum Zeitlimit benötigten Antwortzeit. Als gelöst gilt bei Flaggen das richtige Land, bei allen Kartenmotiven ein Tipp unter {SOLVED_DISTANCE_KM_MAX.toLocaleString("de-DE")} km. Bis einschließlich {Math.round(EASY_DIFFICULTY_SCORE_MAX * 100)} % gilt eine Aufgabe als leicht, ab {Math.round(HARD_DIFFICULTY_SCORE_MIN * 100)} % als schwer, dazwischen als mittel. Ab {MINIMUM_DIFFICULTY_SAMPLES} Runden greift die Einstufung vorläufig, ab {STABLE_DIFFICULTY_SAMPLES} stabil. Stabil bedeutet belastbar, nicht eingefroren.</AdminHelp></span></AdminSectionTitle><div className={styles.difficultyOverview}>
            <div><h3>Reifegrad</h3><ul className={styles.list}>
              <li><span>Noch unter {MINIMUM_DIFFICULTY_SAMPLES} verifizierten Runden</span><AdminMetricValue tone={insufficientMetrics > 0 ? "warning" : "good"} recommendation={insufficientMetrics > 0 ? "Beobachten: Diese Aufgaben behalten ihre Starteinstufung, bis genügend verifizierte Runden vorliegen." : "Unauffällig: Keine Aufgabe liegt unter der Mindestzahl verifizierter Runden."}>{insufficientMetrics}</AdminMetricValue></li>
              <li><span>Vorläufig · {MINIMUM_DIFFICULTY_SAMPLES} bis {STABLE_DIFFICULTY_SAMPLES - 1} Runden</span><AdminMetricValue tone={provisionalMetrics > 0 ? "warning" : "good"} recommendation={provisionalMetrics > 0 ? "Beobachten: Diese Einstufungen sind bereits datenbasiert, können sich mit weiteren Runden aber noch ändern." : "Unauffällig: Keine Einstufung befindet sich im vorläufigen Bereich."}>{provisionalMetrics}</AdminMetricValue></li>
              <li><span>Stabil · ab {STABLE_DIFFICULTY_SAMPLES} Runden</span><AdminMetricValue tone={stableMetrics > 0 ? "good" : "warning"} recommendation={stableMetrics > 0 ? "Unauffällig: Für diese Aufgaben liegt eine belastbare automatische Einstufung vor. Weitere Daten können sie dennoch verändern." : "Beobachten: Noch keine Aufgabe hat genügend Daten für eine stabile Einstufung."}>{stableMetrics}</AdminMetricValue></li>
              <li><span>Höchster Datenstand</span><AdminMetricValue tone={highestVerifiedRoundCount >= MINIMUM_DIFFICULTY_SAMPLES ? "good" : "warning"} recommendation={highestVerifiedRoundCount >= MINIMUM_DIFFICULTY_SAMPLES ? "Mindestens eine Aufgabe wird bereits automatisch eingestuft." : `Dem am häufigsten verifizierten Motiv fehlen noch ${MINIMUM_DIFFICULTY_SAMPLES - highestVerifiedRoundCount} Runden bis zur ersten vorläufigen Einstufung.`}>{highestVerifiedRoundCount} / {MINIMUM_DIFFICULTY_SAMPLES}</AdminMetricValue></li>
              <li><span>Noch ohne Messdaten</span><AdminMetricValue tone={Math.max(0, catalogStatistics.totalTasks - activeMetricRows.length) > 0 ? "warning" : "good"} recommendation="Diese Aufgaben benötigen verifizierte Spielrunden, bevor ihre Schwierigkeit automatisch bewertet werden kann.">{Math.max(0, catalogStatistics.totalTasks - activeMetricRows.length)}</AdminMetricValue></li>
            </ul></div>
            <div><h3>Datenbasierte Einstufung</h3><ul className={styles.list}>
              <li><span>Leicht</span><AdminMetricValue tone="neutral">{difficultyMovements.byDifficulty.easy}</AdminMetricValue></li>
              <li><span>Mittel</span><AdminMetricValue tone="neutral">{difficultyMovements.byDifficulty.medium}</AdminMetricValue></li>
              <li><span>Schwer</span><AdminMetricValue tone="neutral">{difficultyMovements.byDifficulty.hard}</AdminMetricValue></li>
              <li><span>Automatisch wirksam</span><AdminMetricValue tone={difficultyMovements.dataBasedTotal > 0 ? "good" : "warning"}>{difficultyMovements.dataBasedTotal}</AdminMetricValue></li>
            </ul></div>
            <div><h3>Bewegung gegenüber Start</h3><ul className={styles.list}>
              <li><span>In Richtung leichter</span><AdminMetricValue tone="neutral">{difficultyMovements.movement.easier}</AdminMetricValue></li>
              <li><span>Unverändert</span><AdminMetricValue tone="neutral">{difficultyMovements.movement.unchanged}</AdminMetricValue></li>
              <li><span>In Richtung schwerer</span><AdminMetricValue tone="neutral">{difficultyMovements.movement.harder}</AdminMetricValue></li>
              <li><span>Letzte Auswertung</span><AdminMetricValue tone={latestDifficultyUpdate ? "good" : "critical"}>{latestDifficultyUpdate ? new Date(latestDifficultyUpdate).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "Noch keine"}</AdminMetricValue></li>
            </ul></div>
          </div><p className={styles.muted}>Live aus Supabase · Auswertung täglich um 03:15 UTC. Die Bewegungswerte vergleichen die aktuell wirksame automatische Einstufung mit der ursprünglichen Katalogeinstufung. Weil alle verifizierten Runden kumuliert einfließen, werden spätere Einzelrunden mit wachsender Datenmenge weniger ausschlaggebend.</p></section>
          <section className={`${styles.panel} ${styles.progressPanel} ${styles.accountProgressPanel}`}><AdminSectionTitle icon={Trophy}>Fortschritt der Spielerkonten</AdminSectionTitle><div className={styles.progressColumns}>
            <div><h3>Gespielte Partien</h3><ul className={styles.list}>{accountProgress.gameBands.map((band) => <li key={band.label}><span>{band.label}</span><strong>{band.count} · {accountProgress.accountCount ? Math.round((band.count / accountProgress.accountCount) * 100) : 0} %</strong></li>)}</ul></div>
            <div><h3>Gesammelte Ranking-Punkte</h3><ul className={styles.list}>{accountProgress.pointBands.map((band) => <li key={band.label}><span>{band.label}</span><strong>{band.count} · {accountProgress.accountCount ? Math.round((band.count / accountProgress.accountCount) * 100) : 0} %</strong></li>)}</ul></div>
          </div><p className={styles.muted}>Live-Verteilung aller aktiven Konten. Damit wird sichtbar, wann weitere Meilensteinstufen und Motivationstexte benötigt werden.</p></section>
          <section className={`${styles.panel} ${styles.insightsPanel}`}>
            <AdminSectionTitle icon={Activity}>Top-Seiten &amp; Verweildauer</AdminSectionTitle>
            {topPages.length ? <ol className={styles.topList}>{topPages.map(([path, value]) => { const href = pageAdminHref(path); return <li key={path}><span>{href ? <a className={styles.topListLink} href={href} target="_blank" rel="noreferrer"><strong>{pageLabel(path)}</strong><small>{path} · öffnen</small></a> : <><strong>{pageLabel(path)}</strong><small>{path}</small></>}</span><span><b>{value.views} Aufrufe</b><small>Ø {value.views && value.durationMs ? formatDuration(value.durationMs / value.views) : "noch ohne Zeitwert"}</small></span></li>; })}</ol> : <p className={styles.muted}>Die Seitenstatistik beginnt mit diesem Update. Für den gewählten Zeitraum liegen noch keine aufgeschlüsselten Daten vor.</p>}
            <p className={styles.muted}>Ø aktive Besuchszeit: <strong>{averageVisitDuration === null ? "Noch keine Daten" : formatDuration(averageVisitDuration)}</strong>. Zeit zählt nur, solange der Tab sichtbar ist. Interne Verwaltungswege unter <code>/admin</code> bleiben aus dieser kuratierten Rangliste ausgeschlossen; die globalen Aufruf- und Besuchssummen bleiben unverändert.</p>
          </section>
          <section className={`${styles.panel} ${styles.insightsPanel}`}>
            <AdminSectionTitle icon={MonitorSmartphone}>Geräte &amp; Viewports</AdminSectionTitle>
            {sortedDevices.length ? <><ul className={styles.shareList}>{sortedDevices.map(([key, value]) => <li key={key}><span>{deviceLabels[key as keyof typeof deviceLabels]}</span><b>{value} · {Math.round(value / Math.max(1, [...deviceCounts.values()].reduce((sum, count) => sum + count, 0)) * 100)} %</b></li>)}</ul><h3 className={styles.subheading}>Häufigste Viewport-Breiten</h3><ul className={styles.compactList}>{sortedViewports.map(([key, value]) => <li key={key}><span>{key} px</span><b>{value}</b></li>)}</ul></> : <p className={styles.muted}>Die grobe Viewport-Erfassung beginnt mit diesem Update. Es werden keine Modelle oder Gerätekennungen gespeichert.</p>}
          </section>
          <section className={`${styles.panel} ${styles.analyticsPanel} ${styles.analyticsPriorityPanel}`}>
            <div className={styles.analyticsHeading}>
              <AdminSectionTitle icon={Activity}>{`Zeitverlauf · ${periodHeading}`}</AdminSectionTitle>
              <p className={styles.muted}>Diese Kurven beantworten, wann sich Nutzung und Auslieferung verändert haben; sie sind keine zweite Gesamtsumme. Zeiten vor dem Messbeginn bleiben bewusst frei und werden nicht als Nutzung mit dem Wert null ausgegeben.</p>
            </div>
            <div className={styles.chartGrid}>
              <AdminLineChart
                title="Reichweite"
                description="Seitenaufrufe und neu geöffnete Browser-Tabs im Zeitverlauf."
                buckets={usageTimeline}
                series={[
                  { label: "Seitenaufrufe", color: "#5eead4", values: usageTimeline.map((bucket) => bucket.pageViews) },
                  { label: "Besuche", color: "#60a5fa", values: usageTimeline.map((bucket) => bucket.visits) }
                ]}
              />
              <AdminLineChart
                title="Spielaktivität"
                description="Gestartete und vollständig abgeschlossene Partien im Zeitverlauf."
                buckets={usageTimeline}
                series={[
                  { label: "Spielstarts", color: "#a78bfa", values: usageTimeline.map((bucket) => bucket.starts) },
                  { label: "Abschlüsse", color: "#fbbf24", values: usageTimeline.map((bucket) => bucket.finishes) }
                ]}
              />
              <AdminLineChart
                title="Bildausspielungen"
                description="Erfolgreich geladene oder per Fallback angezeigte Spielbilder."
                buckets={usageTimeline}
                series={[{ label: "Bilder", color: "#34d399", values: usageTimeline.map((bucket) => bucket.images) }]}
              />
              <AdminLineChart
                title="Aktive Nutzungszeit"
                description="Summierte Zeit in Minuten, während Seiten sichtbar und aktiv genutzt wurden."
                buckets={usageTimeline}
                series={[{ label: "Minuten", color: "#fb7185", values: usageTimeline.map((bucket) => bucket.activeMinutes) }]}
              />
            </div>
          </section>
          <section className={`${styles.panel} ${styles.gameplayPanel}`}>
            <AdminSectionTitle icon={Gamepad2}>{`Gespielte Spielweisen · ${periodHeading}`}</AdminSectionTitle>
            <ul className={`${styles.list} ${styles.gameplayList}`}>
              {gameplayTypes.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <span className={styles.gameplayMetric}>
                    <strong>{row.count}</strong>
                    {row.share === null ? (
                      <small>Noch keine Starts</small>
                    ) : (
                      <>
                        <i aria-hidden="true">·</i>
                        <small>{row.share} % der Starts</small>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.muted}>Gezählt wird die beim tatsächlichen Start aktive Spielweise. Seitenaufrufe der Einstellungen zählen nicht als Partie.</p>
          </section>
          <section className={`${styles.panel} ${styles.usagePanel}`}><AdminSectionTitle icon={Activity}>{`Kontrollwerte Nutzung · ${periodHeading}`}</AdminSectionTitle><ul className={styles.list}><li><span>Seitenaufrufe</span><AdminMetricValue tone="neutral">{pageViews}</AdminMetricValue></li><li><span>Besuche</span><AdminMetricValue tone="neutral">{visits}</AdminMetricValue></li><li><span>Ø Seiten pro Besuch</span><AdminMetricValue tone="neutral">{visits ? (pageViews / visits).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "Noch keine Daten"}</AdminMetricValue></li><li><span>Spielstarts</span><AdminMetricValue tone="neutral">{starts}</AdminMetricValue></li><li><span>Spielabschlüsse</span><AdminMetricValue tone="neutral">{finishes}</AdminMetricValue></li><li><span>Abschlussquote</span><AdminMetricValue tone={higherIsBetter(completionRate, 60, 25)} recommendation={completionRate === null ? "Noch keine Spielstarts im gewählten Zeitraum; die Quote kann noch nicht bewertet werden." : completionRate < 25 ? "Kritisch: Weniger als ein Viertel der gestarteten Partien wird beendet. Abbruchstellen im Spielablauf prüfen." : completionRate < 60 ? "Beobachten: Viele gestartete Partien werden nicht abgeschlossen. Den Verlauf nach Geräten und Spielschritten untersuchen." : "Unauffällig: Mindestens 60 % der gestarteten Partien werden abgeschlossen."}>{completionRate === null ? "–" : `${completionRate} %`}</AdminMetricValue></li><li><span>Erstellte Onlineräume</span><AdminMetricValue tone="neutral">{count("room_created")}</AdminMetricValue></li></ul><p className={styles.muted}>Vollständige Summen und abgeleitete Werte zum Abgleich mit Schnellüberblick und Zeitverlauf. Anonyme Erfassung ohne Query-Parameter, Nutzerkennung oder persistente Besuchs-ID; ein Besuch gilt jeweils für einen geöffneten Browser-Tab.</p></section>
          <section className={`${styles.panel} ${styles.operationsPanel}`}><AdminSectionTitle icon={Server}>Raumserver &amp; Synchronisierung</AdminSectionTitle><ul className={styles.list}>
            <li><span>Live-Status</span><AdminMetricValue tone={roomServerHealth.status === "ok" ? "good" : roomServerHealth.status === "warning" ? "warning" : "critical"} recommendation={roomServerHealth.status === "ok" ? "Unauffällig: Der Healthcheck meldet einen betriebsbereiten Server." : roomServerHealth.status === "warning" ? "Beobachten: Die Kapazität nähert sich dem Limit. Verbindungen und Räume im Blick behalten." : roomServerHealth.status === "full" ? "Kritisch: Der Server ist ausgelastet. Kapazität erhöhen oder neue Räume vorübergehend begrenzen." : "Kritisch: Der Healthcheck ist nicht erreichbar. Raumserver und Health-URL prüfen."}>{roomServerHealth.status === "ok" ? "Betriebsbereit" : roomServerHealth.status === "warning" ? "Hohe Auslastung" : roomServerHealth.status === "full" ? "Ausgelastet" : "Nicht erreichbar"}</AdminMetricValue></li>
            <li><span>Antwortzeit des Healthchecks</span><AdminMetricValue tone={roomServerHealth.latencyMs === null ? "warning" : lowerIsBetter(roomServerHealth.latencyMs, 250, 1_000)} recommendation={roomServerHealth.latencyMs === null ? "Beobachten: Es fehlt eine Antwortzeit. Healthcheck-Konfiguration prüfen, wenn der Server erreichbar sein sollte." : roomServerHealth.latencyMs >= 1_000 ? "Kritisch: Der Healthcheck reagiert sehr langsam. Serverlast und Netzwerkverbindung prüfen." : roomServerHealth.latencyMs >= 250 ? "Beobachten: Die Antwortzeit ist erhöht. Entwicklung und Serverlast prüfen." : "Unauffällig: Der Healthcheck antwortet in weniger als 250 ms."}>{roomServerHealth.latencyMs === null ? "Nicht verfügbar" : `${roomServerHealth.latencyMs} ms`}</AdminMetricValue></li>
            <li><span>Arbeitsspeicher (RSS)</span><AdminMetricValue tone={roomServerHealth.rssBytes === null ? "warning" : "neutral"} recommendation={roomServerHealth.rssBytes === null ? "Beobachten: Die Speichermessung fehlt. Den Health-Endpunkt um den RSS-Wert ergänzen." : "Der absolute RSS-Wert wird ohne bekanntes Speicherlimit nicht automatisch bewertet."}>{formatBytes(roomServerHealth.rssBytes)}</AdminMetricValue></li>
            <li><span>Heap-Auslastung</span><AdminMetricValue tone={roomServerHealth.heapUsedBytes === null || !roomServerHealth.heapTotalBytes ? "warning" : lowerIsBetter((roomServerHealth.heapUsedBytes / roomServerHealth.heapTotalBytes) * 100, 75, 90)} recommendation={roomServerHealth.heapUsedBytes === null || !roomServerHealth.heapTotalBytes ? "Beobachten: Die Heap-Messung fehlt. Den Health-Endpunkt um verwendeten und verfügbaren Speicher ergänzen." : (roomServerHealth.heapUsedBytes / roomServerHealth.heapTotalBytes) >= .9 ? "Kritisch: Mehr als 90 % des Heaps sind belegt. Speicherleck und Last prüfen." : (roomServerHealth.heapUsedBytes / roomServerHealth.heapTotalBytes) >= .75 ? "Beobachten: Mehr als 75 % des Heaps sind belegt. Verlauf beobachten." : "Unauffällig: Die Heap-Auslastung liegt unter 75 %."}>{roomServerHealth.heapUsedBytes === null ? "Nicht verfügbar" : `${formatBytes(roomServerHealth.heapUsedBytes)} / ${formatBytes(roomServerHealth.heapTotalBytes)}`}</AdminMetricValue></li>
            <li><span>Serverlaufzeit</span><AdminMetricValue tone={roomServerHealth.uptimeSeconds === null ? "warning" : "neutral"} recommendation={roomServerHealth.uptimeSeconds === null ? "Beobachten: Die Serverlaufzeit wird nicht gemeldet. Den Health-Endpunkt um die Uptime ergänzen." : "Die Laufzeit allein ist weder gut noch schlecht; häufige Neustarts sollten über einen zeitlichen Verlauf bewertet werden."}>{formatUptime(roomServerHealth.uptimeSeconds)}</AdminMetricValue></li>
            <li><span>Aktive Verbindungen / Räume</span><AdminMetricValue tone={roomServerHealth.activeConnections === null ? "warning" : "neutral"} recommendation={roomServerHealth.activeConnections === null ? "Beobachten: Aktive Verbindungen und Räume werden nicht gemeldet. Die Servertelemetrie ergänzen." : "Ohne die jeweiligen Kapazitätsgrenzen ist dieser absolute Wert nicht automatisch bewertbar."}>{roomServerHealth.activeConnections === null ? "Nicht verfügbar" : `${roomServerHealth.activeConnections} / ${roomServerHealth.activeRooms ?? 0}`}</AdminMetricValue></li>
            <li><span>Offene Ranking-Partien</span><AdminMetricValue tone="neutral" recommendation="Offene Partien sind während des Spielbetriebs normal. Entscheidend ist der Anteil ungewöhnlich alter Partien.">{active.count ?? 0}</AdminMetricValue></li>
            <li><span>Davon älter als 2 Stunden</span><AdminMetricValue tone={lowerIsBetter(staleActiveCount, 1, 6)} recommendation={staleActiveCount >= 6 ? "Kritisch: Viele Ranking-Partien sind seit mehr als zwei Stunden offen. Bereinigung und Abschluss-Synchronisierung prüfen." : staleActiveCount > 0 ? "Beobachten: Einzelne Ranking-Partien sind ungewöhnlich lange offen. Ursachen stichprobenartig prüfen." : "Unauffällig: Keine Ranking-Partie ist länger als zwei Stunden offen."}>{staleActiveCount}</AdminMetricValue></li>
            <li><span>Akzeptierte / abgewiesene Verbindungen</span><AdminMetricValue tone={rejectionRate === null ? "neutral" : lowerIsBetter(rejectionRate, 1, 5)} recommendation={rejectionRate === null ? "Im gewählten Zeitraum wurden keine Verbindungsversuche erfasst." : rejectionRate >= 5 ? "Kritisch: Mehr als 5 % der Verbindungen wurden abgewiesen. Kapazität, Authentifizierung und Fehlermeldungen prüfen." : rejectionRate >= 1 ? "Beobachten: Die Ablehnungsquote liegt über 1 %. Ursachen in den Serverprotokollen prüfen." : "Unauffällig: Weniger als 1 % der Verbindungsversuche wurden abgewiesen."}>{acceptedConnections} / {rejectedConnections}</AdminMetricValue></li>
            <li><span>Letztes Messsignal</span><AdminMetricValue tone={latestSignalAgeMinutes === null ? "critical" : lowerIsBetter(latestSignalAgeMinutes, 5, 15)} recommendation={latestSignalAgeMinutes === null ? "Kritisch: Es liegt kein Messsignal vor. Telemetrie und Healthcheck prüfen." : latestSignalAgeMinutes >= 15 ? "Kritisch: Seit mehr als 15 Minuten fehlt ein aktuelles Signal. Server und Telemetrie prüfen." : latestSignalAgeMinutes >= 5 ? "Beobachten: Das letzte Signal ist älter als fünf Minuten." : "Unauffällig: Das letzte Messsignal ist aktuell."}>{latestSignal ? new Date(latestSignal).toLocaleString("de-DE") : "Keines"}</AdminMetricValue></li>
          </ul><p className={styles.muted}>Die Wiederholungswarteschlange für Ranking-Aktionen liegt absichtlich lokal im jeweiligen Browser. Zentral sichtbar sind deshalb die offenen Serverpartien und ungewöhnlich lange laufende Synchronisierungen.</p></section>
          <section className={`${styles.panel} ${styles.imageRankingPanel}`}><AdminSectionTitle icon={ScanSearch}><span className={styles.sectionTitleWithHelp}>Top 5 ausgespielte Bilder<AdminHelp title="Gezählte Bildausspielungen">Hier zählt jede erfolgreich geladene kompakte Spielbild-Anzeige im gewählten Zeitraum. Dazu können anonyme, lokale oder noch nicht abgeschlossene Partien gehören. Der Wert ist deshalb nicht mit den verifizierten Runden der automatischen Schwierigkeit vergleichbar. Automatisierte Responsive-Tests werden ab diesem Stand nicht mehr mitgezählt.</AdminHelp></span></AdminSectionTitle>
            {topImages.length ? <ol className={styles.topList}>{topImages.map(([locationId, value]) => {
              const location = locationsById.get(locationId);
              const imageFile = location ? imageFileNameForLicense(location) : undefined;
              const href = imageFile ? imageLicenseHref(imageFile) : location?.sourceUrl ?? location?.panoramaUrl;
              const dimensions = location?.imageWidth && location?.imageHeight ? `${location.imageWidth}×${location.imageHeight}` : "Maße fehlen";
              const captureYear = location?.imageCapturedAt ? new Date(location.imageCapturedAt).getUTCFullYear() : null;
              const details = location
                ? `${location.category} · ${location.difficulty} · ${dimensions}${captureYear ? ` · Aufnahme ${captureYear}` : ""}${Number.isFinite(location.imageQualityScore) ? ` · Score ${location.imageQualityScore}` : ""}`
                : locationId;
              return <li key={locationId}><span>{href ? <a className={styles.topListLink} href={href} target="_blank" rel="noreferrer"><strong>{location?.title ?? locationId}</strong><small>{details}</small><small>{imageFile ? "Einzelnachweis und Originaldatei öffnen" : "Bildquelle öffnen"}</small></a> : <><strong>{location?.title ?? locationId}</strong><small>{details}</small></>}</span><b>{value}×</b></li>;
            })}</ol> : <p className={styles.muted}>Im gewählten Zeitraum wurden noch keine erfolgreich angezeigten Spielbilder gemessen.</p>}
            <p className={styles.muted}>Gezählt wird eine erfolgreich geladene Anzeige je Aufgabe; technische Wiederholungen innerhalb derselben Runde werden unterdrückt. Derselbe Ort kann in mehreren Partien erneut vorkommen. Diese Auslieferungszahl ist kein Schwierigkeits-Sample.</p>
          </section>
          <section className={`${styles.panel} ${styles.imageDeliveryPanel}`}><AdminSectionTitle icon={ScanSearch}>{`Bildauslieferung · ${periodHeading}`}</AdminSectionTitle><ul className={styles.list}>
            <li><span>Gemessene Bildaufrufe</span><AdminMetricValue tone="neutral" recommendation={imageEvents.length < 20 ? "Die Stichprobe ist noch klein; Prozentwerte und Perzentile vorsichtig interpretieren." : "Die Stichprobe umfasst mindestens 20 Bildaufrufe."}>{imageEvents.length}</AdminMetricValue></li>
            <li><span>Typische Ladezeit (p50)</span><AdminMetricValue tone={lowerIsBetter(imageP50, 1_000, 2_500)} recommendation={imageP50 === null ? "Noch keine abgeschlossenen Bildabrufe für eine Bewertung vorhanden." : imageP50 >= 2_500 ? "Kritisch: Die typische Bildladung dauert mindestens 2,5 Sekunden. Quelle, Proxy und Bildgröße prüfen." : imageP50 >= 1_000 ? "Beobachten: Die typische Ladezeit liegt über einer Sekunde. Entwicklung im Blick behalten." : "Unauffällig: Mindestens die Hälfte der Bilder lädt in unter einer Sekunde."}>{formatDuration(imageP50)}</AdminMetricValue></li>
            <li><span>Langsame Ladezeit (p95)</span><AdminMetricValue tone={lowerIsBetter(imageP95, 2_000, 5_000)} recommendation={imageP95 === null ? "Noch keine abgeschlossenen Bildabrufe für eine Bewertung vorhanden." : imageP95 >= 5_000 ? "Kritisch: Langsame Bildabrufe dauern mindestens fünf Sekunden. Ausreißer und betroffene Quellen untersuchen." : imageP95 >= 2_000 ? "Beobachten: Die langsamsten Bildabrufe überschreiten zwei Sekunden." : "Unauffällig: 95 % der gemessenen Bildabrufe bleiben unter zwei Sekunden."}>{formatDuration(imageP95)}</AdminMetricValue></li>
            <li><span>Proxy-Fallbacks</span><AdminMetricValue tone={lowerIsBetter(imageFallbackRate, 10, 25)} recommendation={imageFallbackRate === null ? "Noch keine Bildabrufe im gewählten Zeitraum." : imageFallbackRate >= 25 ? "Kritisch: Mindestens jeder vierte Abruf benötigt den Fallback. Primärquellen und CORS-Verhalten prüfen." : imageFallbackRate >= 10 ? "Beobachten: Mehr als 10 % der Abrufe benötigen den Fallback." : "Unauffällig: Weniger als 10 % der Abrufe benötigen den Proxy-Fallback."}>{imageFallbacks}</AdminMetricValue></li>
            <li><span>Fehlgeschlagen</span><AdminMetricValue tone={lowerIsBetter(imageFailureRate, .1, 5)} recommendation={imageFailureRate === null ? "Noch keine Bildabrufe im gewählten Zeitraum." : imageFailureRate >= 5 ? "Kritisch: Mindestens 5 % der Bildabrufe schlagen vollständig fehl. Betroffene Orts-IDs und Quellen prüfen." : imageFailures > 0 ? "Beobachten: Mindestens ein Bildabruf ist fehlgeschlagen. Wiederholungen und betroffene Orts-IDs prüfen." : "Unauffällig: Kein gemessener Bildabruf ist vollständig fehlgeschlagen."}>{imageFailures}</AdminMetricValue></li>
            <li><span>Cache-Treffer</span><AdminMetricValue tone={higherIsBetter(imageCacheHitRate, 60, 30)} recommendation={imageCacheHitRate === null ? "Noch keine Bildabrufe im gewählten Zeitraum." : imageCacheHitRate < 30 ? "Kritisch: Weniger als 30 % Cache-Treffer. Cache-Schlüssel, Lebensdauer und Proxy-Antworten prüfen." : imageCacheHitRate < 60 ? "Beobachten: Die Cache-Trefferquote liegt unter 60 %. Optimierungspotenzial prüfen." : "Unauffällig: Mindestens 60 % der Bildabrufe werden aus dem Cache bedient."}>{imageCacheHitRate === null ? "Noch keine Daten" : `${imageCacheHitRate} %`}</AdminMetricValue></li>
          </ul><p className={styles.muted}>Anonyme Messung ohne Bild-URL oder Nutzerdaten. Die Orts-ID dient ausschließlich dazu, wiederholt defekte Bilder automatisch aus der Auswahl zu nehmen.</p></section>
          <section className={styles.panel}><AdminSectionTitle icon={Megaphone}>Werbung</AdminSectionTitle><ul className={styles.list}><li><span>AdSense eingebunden</span><AdminMetricValue tone={adConfig.enabled && adConfig.clientId ? "good" : "warning"} recommendation={adConfig.enabled && adConfig.clientId ? "Unauffällig: AdSense ist aktiviert und eine Client-ID ist hinterlegt." : "Beobachten: AdSense ist noch nicht vollständig aktiviert. Konfiguration und Freigabestatus prüfen, wenn Werbung ausgespielt werden soll."}>{adConfig.enabled && adConfig.clientId ? "Ja" : "Nein"}</AdminMetricValue></li><li><span>Testmodus</span><AdminMetricValue tone={adConfig.testMode ? "warning" : "good"} recommendation={adConfig.testMode ? "Beobachten: Der Testmodus ist aktiv. Vor dem produktiven Start deaktivieren." : "Unauffällig: Der Testmodus ist ausgeschaltet."}>{adConfig.testMode ? "Aktiv" : "Aus"}</AdminMetricValue></li><li><span>Konfigurierte Flächen</span><AdminMetricValue tone="neutral" recommendation="Die Anzahl allein ist keine Qualitätsaussage. Entscheidend sind später Auslieferung, Sichtbarkeit und Ertrag der einzelnen Flächen.">{Object.values(adConfig.slots).filter(Boolean).length}</AdminMetricValue></li></ul><p className={styles.muted}>Umsatz, Impressionen und RPM benötigen später eine autorisierte Google-AdSense-Reporting-Anbindung.</p></section>
        </div>
      </div></div>
      <RedesignFooter className={layoutStyles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
    </RedesignShell>
  </div></main>;
}
