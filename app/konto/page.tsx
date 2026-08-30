import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { SupabaseAccountProfileRepository } from "@/lib/supabase/accountProfileRepository.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { LegalLinks } from "@/components/LegalLinks";
import styles from "./dashboard.module.css";
import { SectionNavigation } from "@/components/SectionNavigation";
import { calculateComparisonValue, calculateLeaderboard, leaderboardPeriodKey, type LeaderboardGameResult } from "@/lib/leaderboards";
import { isAdminAccount } from "@/lib/adminAccess.server";
import { rankedRulesetId, rankedRulesetVersion, rankedScoringVersion } from "@/lib/rankedGame";
import type { LocationCategory } from "@/types/game";
import { buildPlayerInsight, gameMilestoneTargets, nextMilestone, pointMilestoneTargets } from "@/lib/accountProgress";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";
import { History, Medal, Settings2 } from "lucide-react";

export const metadata: Metadata = { title: "Mein Konto", robots: { index: false, follow: false } };

type AccountPageProps = { searchParams: Promise<{ error?: string; saved?: string }> };

async function dashboardStats(accountId: string) {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const [completedResult, verifiedResult, rankingResult] = await Promise.all([
    admin.from("ranked_games").select("game_id, completed_at", { count: "exact" }).eq("account_id", accountId).eq("status", "completed").order("completed_at", { ascending: true }).limit(500),
    admin.from("verified_ranked_results").select("game_id, score, category, completed_at, planned_rounds, time_limit_sec, difficulty, no_zoom").eq("account_id", accountId).order("completed_at", { ascending: true }).limit(500),
    admin.from("verified_ranked_results").select("game_id, account_id, handle, category, ruleset_id, ruleset_version, scoring_version, score, total_response_time_ms, completed_at, planned_rounds, time_limit_sec, difficulty, no_zoom").gte("completed_at", new Date(now - 370 * 24 * 60 * 60 * 1000).toISOString()).limit(5000)
  ]);
  if (completedResult.error || verifiedResult.error) return { count: 0, totalRounds: 0, bestComparison: 0, strongestCategory: null, verifiedCount: 0, verifiedPoints: 0, averageRoundScore: 0, dailyRanking: null, weeklyRanking: null, completedTimeline: [] as number[], verifiedTimeline: [] as Array<{ completedAt: number; score: number }> };
  const verified = verifiedResult.data ?? [];
  const totalScore = verified.reduce((sum, game) => sum + (game.score ?? 0), 0);
  const totalRounds = verified.reduce((sum, game) => sum + (game.planned_rounds ?? 0), 0);
  const bestComparison = Math.max(0, ...verified.map((game) => calculateComparisonValue({ score: game.score ?? 0, roundCount: game.planned_rounds ?? undefined, timeLimitSec: game.time_limit_sec ?? undefined, difficulty: game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium", noZoom: Boolean(game.no_zoom) })));
  const categoryValues = new Map<string, number[]>();
  for (const game of verified) {
    if (!game.category) continue;
    const value = calculateComparisonValue({ score: game.score ?? 0, roundCount: game.planned_rounds ?? undefined, timeLimitSec: game.time_limit_sec ?? undefined, difficulty: game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium", noZoom: Boolean(game.no_zoom) });
    categoryValues.set(game.category, [...(categoryValues.get(game.category) ?? []), value]);
  }
  const strongestCategory = [...categoryValues.entries()]
    .map(([category, values]) => ({ category, value: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), games: values.length }))
    .sort((left, right) => right.value - left.value)[0] ?? null;
  const leaderboardGames: LeaderboardGameResult[] = (rankingResult.data ?? []).flatMap((game) => {
    const completedAt = game.completed_at ? Date.parse(game.completed_at) : Number.NaN;
    if (!game.game_id || !game.account_id || !game.handle || !game.category || !game.ruleset_id || game.ruleset_version == null || !game.scoring_version || game.score == null || game.total_response_time_ms == null || !Number.isFinite(completedAt)) return [];
    return [{ gameId: game.game_id, accountId: game.account_id, publicHandle: game.handle, profileStatus: "active" as const, profileVisibility: "public" as const, category: game.category as LocationCategory, rulesetId: game.ruleset_id, rulesetVersion: game.ruleset_version, scoringVersion: game.scoring_version, integrityStatus: "verified" as const, score: game.score, totalResponseTimeMs: game.total_response_time_ms, roundCount: game.planned_rounds ?? undefined, timeLimitSec: game.time_limit_sec ?? undefined, roundDurationMs: game.time_limit_sec === 0 ? 600_000 : (game.time_limit_sec ?? 60) * 1000, difficulty: game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium", noZoom: Boolean(game.no_zoom), completedAt }];
  });
  const rankingEntries = (period: "daily" | "weekly") => rankingResult.error ? [] : calculateLeaderboard(leaderboardGames, {
    period,
    periodKey: leaderboardPeriodKey(now, period),
    category: "mixed",
    rulesetId: rankedRulesetId,
    rulesetVersion: rankedRulesetVersion,
    scoringVersion: rankedScoringVersion
  });
  const dailyEntries = rankingEntries("daily");
  const weeklyEntries = rankingEntries("weekly");
  const ownDailyEntry = dailyEntries.find((entry) => entry.accountId === accountId) ?? null;
  const ownWeeklyEntry = weeklyEntries.find((entry) => entry.accountId === accountId) ?? null;
  return {
    count: completedResult.count ?? completedResult.data?.length ?? 0,
    totalRounds,
    bestComparison,
    strongestCategory,
    verifiedCount: verified.length,
    verifiedPoints: totalScore,
    averageRoundScore: totalRounds ? Math.round(totalScore / totalRounds) : 0,
    dailyRanking: ownDailyEntry ? { rank: ownDailyEntry.rank, participants: dailyEntries.length, comparisonValue: ownDailyEntry.comparisonValue } : null,
    weeklyRanking: ownWeeklyEntry ? { rank: ownWeeklyEntry.rank, participants: weeklyEntries.length, comparisonValue: ownWeeklyEntry.comparisonValue } : null,
    completedTimeline: (completedResult.data ?? []).flatMap((game) => game.completed_at ? [Date.parse(game.completed_at)] : []).filter(Number.isFinite),
    verifiedTimeline: verified.flatMap((game) => game.completed_at ? [{ completedAt: Date.parse(game.completed_at), score: game.score ?? 0 }] : []).filter((game) => Number.isFinite(game.completedAt))
  };
}

function shortDate(value: number): string {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function categoryLabel(category: string): string {
  return ({ mixed: "Gemischte Kategorien", landmark: "Wahrzeichen", city: "Städte", landscape: "Landschaften", flag: "Flaggen", capital: "Hauptstädte" } as Record<string, string>)[category] ?? category;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden");
  const params = await searchParams;
  const profiles = new SupabaseAccountProfileRepository();
  const profile = await profiles.findByAccountId(context.identity.account.accountId);
  const [stats, isAdmin] = await Promise.all([dashboardStats(context.identity.account.accountId), isAdminAccount(context.identity.account.accountId)]);
  const milestoneSpecs = [
    { label: "Erste Partie gespeichert", kind: "games" as const, target: 1 },
    { label: "Erste gewertete Partie", kind: "verified" as const, target: 1 },
    { label: "5 Partien gespielt", kind: "games" as const, target: 5 },
    { label: "25.000 Ranking-Punkte", kind: "points" as const, target: 25_000 },
    { label: "10 Partien gespielt", kind: "games" as const, target: 10 },
    { label: "100.000 Ranking-Punkte", kind: "points" as const, target: 100_000 },
    { label: "25 Partien gespielt", kind: "games" as const, target: 25 },
    { label: "250.000 Ranking-Punkte", kind: "points" as const, target: 250_000 },
    { label: "50 Partien gespielt", kind: "games" as const, target: 50 },
    { label: "500.000 Ranking-Punkte", kind: "points" as const, target: 500_000 }
  ];
  const milestoneLadder = milestoneSpecs.map((milestone) => {
    const current = milestone.kind === "games" ? stats.count : milestone.kind === "verified" ? stats.verifiedCount : stats.verifiedPoints;
    let achievedAt: number | null = null;
    if (milestone.kind === "games") achievedAt = stats.completedTimeline[milestone.target - 1] ?? null;
    if (milestone.kind === "verified") achievedAt = stats.verifiedTimeline[milestone.target - 1]?.completedAt ?? null;
    if (milestone.kind === "points") {
      let sum = 0;
      achievedAt = stats.verifiedTimeline.find((game) => (sum += game.score) >= milestone.target)?.completedAt ?? null;
    }
    return { ...milestone, current, achievedAt, achieved: current >= milestone.target };
  });
  const recentMilestones = milestoneLadder.filter((milestone) => milestone.achieved && milestone.achievedAt).sort((left, right) => left.achievedAt! - right.achievedAt!).slice(-2);
  const nextGameMilestone = nextMilestone(stats.count, gameMilestoneTargets);
  const nextPointMilestone = nextMilestone(stats.verifiedPoints, pointMilestoneTargets);
  const playerInsight = buildPlayerInsight(context.identity.account.accountId, {
    ...stats,
    strongestCategory: stats.strongestCategory ? { ...stats.strongestCategory, category: categoryLabel(stats.strongestCategory.category) } : null
  });

  return (
    <main className={styles.page}>
      <div className={`${styles.frame} ${styles.frameNoAds}`}>
        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.topbar}>
            <RedesignBrand className={styles.brand} />
            <div className={styles.toplinks}>
              <RedesignButtonLink href="/solo-modus" tone="primary" className={styles.toplink}>Spielen</RedesignButtonLink>
              <AccountHeaderControls />
            </div>
          </RedesignHeader>
          <SectionNavigation section="account" admin={isAdmin} />
          <div className={styles.shell}>
            <section className={styles.hero}>
              <div>
                <h1>{profile ? `Hallo, ${profile.displayName}.` : "Dein Spielerkonto."}</h1>
                <p>{profile ? `@${profile.handle}` : "Richte dein Spielerprofil unter Einstellungen ein."}</p>
              </div>
            </section>
            <div className={styles.grid}>
              <section className={styles.overviewDashboard} aria-label="Übersicht deines Spielerkontos">
                <article className={`${styles.dashboardCard} ${styles.rankingSpotlight}`}>
                  <span className={styles.cardEyebrow}>Deine Rankings</span>
                  <strong>{stats.dailyRanking ? <>Heute Platz <b>#{stats.dailyRanking.rank}</b></> : "Heute noch ohne Platzierung"}</strong>
                  <div className={styles.rankingPreview}><span>{stats.dailyRanking ? <>{stats.dailyRanking.comparisonValue.toLocaleString("de-DE")} gewichtete Punkte/Runde</> : <>Starte deine erste gewertete Partie.</>}</span><span>{stats.weeklyRanking ? <>Diese Woche Platz <b>#{stats.weeklyRanking.rank}</b></> : <>Diese Woche noch ohne Platzierung</>}</span></div>
                </article>

                <article className={`${styles.dashboardCard} ${styles.playerInsight}`}>
                  <span className={styles.cardEyebrow}>{playerInsight.eyebrow}</span>
                  <strong>{playerInsight.title}</strong>
                  <p>{playerInsight.body}</p>
                </article>

                <article className={`${styles.dashboardCard} ${styles.overviewMilestones}`}>
                  <strong>Meilensteine</strong>
                  {recentMilestones.length ? <ul className={styles.achievementList}>{recentMilestones.map((milestone) => <li key={milestone.label}><span aria-hidden="true">✓</span><div><b>{milestone.label}</b><small>{shortDate(milestone.achievedAt!)}</small></div></li>)}</ul> : <p className={styles.milestoneEmpty}>Dein erster Meilenstein ist nur eine Partie entfernt.</p>}
                  <div className={styles.milestoneProgressList}>
                    <small>Als Nächstes</small>
                    {nextGameMilestone && <div className={styles.milestoneProgress}><b>{nextGameMilestone.target.toLocaleString("de-DE")} Partien gespielt</b><div className={styles.progressTrack} aria-label={`${nextGameMilestone.progress} Prozent erreicht`}><span style={{ width: `${nextGameMilestone.progress}%` }} /></div><em>{nextGameMilestone.current.toLocaleString("de-DE")} / {nextGameMilestone.target.toLocaleString("de-DE")}</em></div>}
                    {nextPointMilestone && <div className={styles.milestoneProgress}><b>{nextPointMilestone.target.toLocaleString("de-DE")} Ranking-Punkte</b><div className={styles.progressTrack} aria-label={`${nextPointMilestone.progress} Prozent erreicht`}><span style={{ width: `${nextPointMilestone.progress}%` }} /></div><em>{stats.verifiedPoints.toLocaleString("de-DE")} / {nextPointMilestone.target.toLocaleString("de-DE")}</em></div>}
                  </div>
                </article>

                <section className={styles.scoreStrip} aria-label="Deine Bilanz">
                  <div className={styles.scoreStripTitle}><div><span>Deine Bilanz</span><small>Ergebnisse werden technisch geprüft. Auffällige Partien können aus öffentlichen Rankings entfernt werden.</small></div><div className={styles.statSecondary}><b>{stats.verifiedPoints.toLocaleString("de-DE")}</b><em>Ranking-Punkte gesamt</em></div></div>
                  <div className={styles.compactStat}><div><strong>{stats.count}</strong><span>gespeicherte {stats.count === 1 ? "Partie" : "Partien"}</span></div><div className={styles.statSecondary}><b>{stats.verifiedCount}</b><em>davon gewertet</em><InlineInfoPopover align="right" className={styles.rankingInfo} ariaLabel="Warum werden nicht alle gespeicherten Partien gewertet?" title="Gespeichert oder gewertet?" href="/faq/rankings" hrefLabel="Ranking-Regeln ansehen">Öffentlich zählen vollständig abgeschlossene, technisch geprüfte Partien mit 15, 30 oder 60 Sekunden Zeitlimit. Freies Zeitlimit wird nicht öffentlich gewertet.</InlineInfoPopover></div></div>
                  <div className={styles.compactStat}><div><strong>{stats.totalRounds}</strong><span>gespielte Runden</span></div><div className={styles.statSecondary}><b>{stats.verifiedCount ? Math.round(stats.totalRounds / stats.verifiedCount) : "–"}</b><em>Ø Runden pro Partie</em></div></div>
                  <div className={styles.compactStat}><div><strong>{stats.averageRoundScore ? stats.averageRoundScore.toLocaleString("de-DE") : "–"}</strong><span>Ø Punkte pro Runde</span></div><div className={styles.statSecondary}><b>{stats.bestComparison ? stats.bestComparison.toLocaleString("de-DE") : "–"}</b><em>bester Ranking-Wert</em></div></div>
                </section>

                <nav className={styles.overviewNavigation} aria-label="Bereiche des Spielerkontos">
                  <Link href="/konto/verlauf" className={styles.accountOverviewCard}><strong><History aria-hidden="true" />Spielverlauf</strong><span>Partien und jede einzelne Runde ansehen.</span><i aria-hidden="true">›</i></Link>
                  <Link href="/rankings" className={styles.accountOverviewCard}><strong><Medal aria-hidden="true" />Rankings</strong><span>Platzierungen und Kategorien vergleichen.</span><i aria-hidden="true">›</i></Link>
                  <Link href="/konto/einstellungen" className={styles.accountOverviewCard}><strong><Settings2 aria-hidden="true" />Einstellungen</strong><span>Profil, Sichtbarkeit und Login verwalten.</span><i aria-hidden="true">›</i></Link>
                </nav>
              </section>
              {params.saved && <p className={`${styles.notice} ${styles.success}`} role="status">Profil gespeichert.</p>}
              {params.error && <p className={`${styles.notice} ${styles.error}`} role="alert">{params.error}</p>}
            </div>
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
      </div>
    </main>
  );
}
