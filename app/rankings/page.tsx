import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { calculateLeaderboard, leaderboardPeriodKey, toPublicLeaderboard, type LeaderboardGameResult, type LeaderboardPeriod } from "@/lib/leaderboards";
import { rankedRulesetId, rankedRulesetVersion, rankedScoringVersion } from "@/lib/rankedGame";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import type { LocationCategory } from "@/types/game";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell, RedesignBrand } from "@/components/redesign";
import { LegalLinks } from "@/components/LegalLinks";
import layoutStyles from "@/app/konto/dashboard.module.css";
import styles from "./page.module.css";
import { SectionNavigation } from "@/components/SectionNavigation";
import { isAdminAccount } from "@/lib/adminAccess.server";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";

export const metadata: Metadata = { title: "Rankings", robots: { index: false, follow: false } };

const categories = [["mixed", "Gemischte Kategorien"], ["landmarks", "Wahrzeichen"], ["cities", "Städte"], ["landscapes", "Landschaften"], ["flags", "Flaggen"], ["capitals", "Hauptstädte"]] as const;
const periodLabels: Record<LeaderboardPeriod, string> = { daily: "Heute", weekly: "Diese Woche", monthly: "Diesen Monat", yearly: "Dieses Jahr" };
const rankingTitles: Record<LeaderboardPeriod, string> = { daily: "Tagesranking", weekly: "Wochenranking", monthly: "Monatsranking", yearly: "Jahresranking" };
function validPeriod(value: string | undefined): LeaderboardPeriod { return value === "weekly" || value === "monthly" || value === "yearly" ? value : "daily"; }

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ period?: string; category?: string }> }) {
  const params = await searchParams;
  const period = validPeriod(params.period);
  const category = categories.some(([value]) => value === params.category) ? params.category! : "mixed";
  const accountContext = await getSupabaseAccountContext();
  const isAdmin = accountContext ? await isAdminAccount(accountContext.identity.account.accountId) : false;
  const now = Date.now();
  const query = { period, periodKey: leaderboardPeriodKey(now, period), category: category as LocationCategory, rulesetId: rankedRulesetId, rulesetVersion: rankedRulesetVersion, scoringVersion: rankedScoringVersion };
  const admin = createSupabaseAdminClient();
  const { data: verifiedGames } = await admin.from("verified_ranked_results").select("game_id, account_id, handle, category, ruleset_id, ruleset_version, scoring_version, score, total_response_time_ms, completed_at, planned_rounds, time_limit_sec, difficulty, no_zoom").gte("completed_at", new Date(now - 370 * 24 * 60 * 60 * 1000).toISOString()).limit(5000);
  const leaderboardGames: LeaderboardGameResult[] = (verifiedGames ?? []).flatMap((game) => {
    const completedAt = game.completed_at ? Date.parse(game.completed_at) : Number.NaN;
    if (!game.game_id || !game.account_id || !game.handle || !game.category || !game.ruleset_id || game.ruleset_version == null || !game.scoring_version || game.score == null || game.total_response_time_ms == null || !Number.isFinite(completedAt)) return [];
    return [{ gameId: game.game_id, accountId: game.account_id, publicHandle: game.handle, profileStatus: "active" as const, profileVisibility: "public" as const, category: game.category as LocationCategory, rulesetId: game.ruleset_id, rulesetVersion: game.ruleset_version, scoringVersion: game.scoring_version, integrityStatus: "verified" as const, score: game.score, totalResponseTimeMs: game.total_response_time_ms, roundCount: game.planned_rounds ?? undefined, timeLimitSec: game.time_limit_sec ?? undefined, roundDurationMs: game.time_limit_sec === 0 ? 600_000 : (game.time_limit_sec ?? 60) * 1000, difficulty: game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium", noZoom: Boolean(game.no_zoom), completedAt }];
  });
  const allEntries = calculateLeaderboard(leaderboardGames, query);
  const ownAccountId = accountContext?.identity.account.accountId ?? null;
  const ownEntry = ownAccountId ? allEntries.find((entry) => entry.accountId === ownAccountId) ?? null : null;
  const visibleEntries = ownEntry ? allEntries.filter((entry, index) => index < 15 || Math.abs(entry.rank - ownEntry.rank) <= 2) : allEntries.slice(0, 15);
  const entries = toPublicLeaderboard(visibleEntries);
  const difficultyLabel = { easy: "Leicht", medium: "Mittel", hard: "Schwer" } as const;
  return <main className={layoutStyles.page}><div className={`${layoutStyles.frame} ${layoutStyles.frameNoAds}`}><RedesignShell className={layoutStyles.app}>
    <RedesignHeader className={layoutStyles.topbar}><RedesignBrand className={layoutStyles.brand} /><div className={layoutStyles.toplinks}><RedesignButtonLink href="/solo-modus" tone="primary" className={layoutStyles.toplink}>Spielen</RedesignButtonLink><AccountHeaderControls authenticated={Boolean(accountContext)} /></div></RedesignHeader>
    <SectionNavigation section="account" admin={isAdmin} /><div className={styles.shell}><div className={styles.content}><h1>Rankings</h1><p className={styles.intro}>Vergleiche deine besten gewerteten Partien nach Zeitraum und Kategorie.</p>
      <nav className={styles.filters} aria-label="Ranking-Filter">{(["daily", "weekly", "monthly", "yearly"] as const).map((value) => <Link key={value} href={`/rankings?period=${value}&category=${category}`} data-active={period === value}>{periodLabels[value]}</Link>)}</nav>
      <div className={styles.categories}>{categories.map(([value, label]) => <Link key={value} href={`/rankings?period=${period}&category=${value}`} data-active={category === value}>{label}</Link>)}</div>
      <section className={styles.panel} aria-live="polite"><div className={styles.panelHead}><h2>{rankingTitles[period]}</h2><span>{categories.find(([value]) => value === category)?.[1]} · {allEntries.length} Teilnehmer</span></div>
        {entries.length === 0 ? <div className={styles.empty}><strong>Noch keine ranglistenfähigen Ergebnisse</strong><p>Hier erscheinen ausschließlich Partien, deren Aufgabe, Zeit und Punkte vollständig vom Spielserver geprüft wurden.</p></div> : <>
          {ownEntry && <div className={styles.ownSummary}><strong>Deine Platzierung: #{ownEntry.rank}</strong><span>{allEntries.length} Teilnehmer · Bestwert {ownEntry.comparisonValue.toLocaleString("de-DE")} gewichtete Punkte/Runde</span></div>}
          <ol className={styles.list}>{entries.map((entry, index) => { const previous = entries[index - 1]; const separated = previous && entry.rank > previous.rank + 1; const timeLimit = entry.timeLimitSec ?? Math.round((entry.roundDurationMs ?? 60_000) / 1000); return <span key={`${entry.rank}-${entry.publicHandle}`} className={styles.rowWrap}>{separated && <span className={styles.gap} aria-hidden="true">···</span>}<li data-own={ownEntry?.rank === entry.rank && ownEntry?.publicHandle === entry.publicHandle}><b>#{entry.rank}</b><span><strong>{entry.publicHandle}</strong><small>Ø {(entry.averagePointsPerRound ?? 0).toLocaleString("de-DE")} Punkte/Runde · {entry.roundsPlayed ?? 0} Runden · {timeLimit === 0 ? "frei" : `${timeLimit} s`} · {difficultyLabel[entry.difficulty ?? "medium"]}{entry.noZoom ? " · Einschränkung" : ""}</small></span><strong>{(entry.comparisonValue ?? entry.score).toLocaleString("de-DE")}</strong></li></span>; })}</ol>
          <div className={styles.listLegend}><span>Gewichtete Punkte/Runde</span><span>Ø Rohpunkte/Runde</span><span>Je höher, desto besser.</span></div></>}
        <InlineInfoPopover align="right" className={styles.rankingHelp} ariaLabel="Wie funktionieren gewichtete Ranking-Werte?" title="Faire Ranking-Werte" href="/faq/rankings" hrefLabel="Ranking-Regeln ansehen">Öffentlich zählen abgeschlossene, technisch geprüfte Partien mit 15, 30 oder 60 Sekunden Zeitlimit. Auffällige Ergebnisse können nachträglich entfernt werden.</InlineInfoPopover>
      </section><details className={styles.formulaNote}><summary id="ranking-berechnung">Berechnung der gewichteten Punkte</summary><div><p>Im gewählten Zeitraum zählt pro Spieler nur die Partie mit dem höchsten gewichteten Wert. Die Basis bilden die durchschnittlichen Punkte pro Runde. Für das Zeitlimit gelten feste Faktoren: 60 Sekunden = 1,00, 30 Sekunden = 1,10 und 15 Sekunden = 1,25. Für die Schwierigkeit gelten: Leicht = 1,00, Mittel = 1,05 und Schwer = 1,15. Eine aktive Einschränkung erhält zusätzlich den Faktor 1,10. Die Rechnung lautet: Punkte pro Runde × Zeitfaktor × Schwierigkeitsfaktor × Einschränkungsfaktor. Partien mit freiem Zeitlimit werden nicht in diese Rankings aufgenommen.</p><p>Ergebnisse werden technisch geprüft. Auffällige Partien können aus öffentlichen Rankings entfernt werden.</p></div></details>
    </div></div><RedesignFooter className={layoutStyles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter></RedesignShell></div></main>;
}
