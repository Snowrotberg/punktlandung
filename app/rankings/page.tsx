import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { calculateLeaderboard, leaderboardPeriodKey, toPublicLeaderboard, type LeaderboardCategory, type LeaderboardPeriod } from "@/lib/leaderboards";
import { buildLeaderboardDisplayEntries } from "@/lib/leaderboardDisplay";
import { toLeaderboardGameResults, verifiedRankedResultsSelect, type VerifiedRankedResultRow } from "@/lib/verifiedRankedResults";
import { rankedRulesetId, rankedRulesetVersion, rankedScoringVersion } from "@/lib/rankedGame";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell, RedesignBrand } from "@/components/redesign";
import { LegalLinks } from "@/components/LegalLinks";
import layoutStyles from "@/app/konto/dashboard.module.css";
import styles from "./page.module.css";
import { SectionNavigation } from "@/components/SectionNavigation";
import { isAdminAccount } from "@/lib/adminAccess.server";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";

export const metadata: Metadata = { title: "Rankings", robots: { index: false, follow: false } };

const categories = [["all", "Gesamt"], ["mixed", "Gemischte Kategorien"], ["landmarks", "Wahrzeichen"], ["cities", "Städte"], ["landscapes", "Landschaften"], ["flags", "Flaggen"], ["capitals", "Hauptstädte"]] as const satisfies ReadonlyArray<readonly [LeaderboardCategory, string]>;
const periodLabels: Record<LeaderboardPeriod, string> = { daily: "Heute", weekly: "Diese Woche", monthly: "Diesen Monat", yearly: "Dieses Jahr" };
const rankingTitles: Record<LeaderboardPeriod, string> = { daily: "Tagesranking", weekly: "Wochenranking", monthly: "Monatsranking", yearly: "Jahresranking" };
function validPeriod(value: string | undefined): LeaderboardPeriod { return value === "weekly" || value === "monthly" || value === "yearly" ? value : "daily"; }

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ period?: string; category?: string }> }) {
  const params = await searchParams;
  const period = validPeriod(params.period);
  const category: LeaderboardCategory = categories.find(([value]) => value === params.category)?.[0] ?? "mixed";
  const accountContext = await getSupabaseAccountContext();
  const isAdmin = accountContext ? await isAdminAccount(accountContext.identity.account.accountId) : false;
  const now = Date.now();
  const query = { period, periodKey: leaderboardPeriodKey(now, period), category, rulesetId: rankedRulesetId, rulesetVersion: rankedRulesetVersion, scoringVersion: rankedScoringVersion };
  let verifiedGames: VerifiedRankedResultRow[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim()) {
    try {
      const admin = createSupabaseAdminClient();
      const result = await admin.from("verified_ranked_results").select(verifiedRankedResultsSelect).gte("completed_at", new Date(now - 370 * 24 * 60 * 60 * 1000).toISOString()).limit(5000);
      if (!result.error) verifiedGames = result.data ?? [];
      else console.error("Rankings could not load verified games", result.error.message);
    } catch (error) {
      console.error("Rankings are unavailable", error instanceof Error ? error.message : "unknown error");
    }
  }
  const leaderboardGames = toLeaderboardGameResults(verifiedGames);
  const allEntries = calculateLeaderboard(leaderboardGames, query);
  const ownAccountId = accountContext?.identity.account.accountId ?? null;
  const ownEntry = ownAccountId ? allEntries.find((entry) => entry.accountId === ownAccountId) ?? null : null;
  const displayContext = { category: query.category, period: query.period, periodKey: query.periodKey, now };
  const entries = buildLeaderboardDisplayEntries(toPublicLeaderboard(allEntries), displayContext);
  const displayedOwnEntry = ownEntry ? entries.find((entry) => !entry.isExample && entry.publicHandle === ownEntry.publicHandle) ?? null : null;
  const difficultyLabel = { easy: "Leicht", medium: "Mittel", hard: "Schwer" } as const;
  return <main className={layoutStyles.page}><div className={`${layoutStyles.frame} ${layoutStyles.frameNoAds}`}><RedesignShell className={layoutStyles.app}>
    <RedesignHeader className={layoutStyles.topbar}><RedesignBrand className={layoutStyles.brand} /><div className={layoutStyles.toplinks}><RedesignButtonLink href="/solo-modus" tone="primary" className={layoutStyles.toplink}>Spielen</RedesignButtonLink><AccountHeaderControls authenticated={Boolean(accountContext)} /></div></RedesignHeader>
    <SectionNavigation section="account" admin={isAdmin} /><div className={styles.shell}><div className={styles.content}><h1>Rankings</h1><p className={styles.intro}>Vergleiche die besten gewerteten Partien nach Zeitraum, Kategorie oder über alle Kategorien hinweg.</p>
      <nav className={styles.filters} aria-label="Ranking-Filter">{(["daily", "weekly", "monthly", "yearly"] as const).map((value) => <Link key={value} href={`/rankings?period=${value}&category=${category}`} data-active={period === value}>{periodLabels[value]}</Link>)}</nav>
      <div className={styles.categories}>{categories.map(([value, label]) => <Link key={value} href={`/rankings?period=${period}&category=${value}`} data-active={category === value}>{label}</Link>)}</div>
      <section className={styles.panel} aria-live="polite"><div className={styles.panelHead}><h2>{rankingTitles[period]}</h2><span>{categories.find(([value]) => value === category)?.[1]}</span></div>
        <>
          {displayedOwnEntry && <div className={styles.ownSummary}><strong>Deine Platzierung: #{displayedOwnEntry.rank}</strong><span>Bestwert {(displayedOwnEntry.comparisonValue ?? displayedOwnEntry.score).toLocaleString("de-DE")} Punkte/Runde</span></div>}
          {entries.some((entry) => entry.isExample) && <p className={styles.exampleNote}>In der Aufbauphase wird das Starterfeld systemseitig ergänzt und fortlaufend durch echte Platzierungen ersetzt.</p>}
          <ol className={styles.list}>{entries.map((entry, index) => { const previous = entries[index - 1]; const separated = previous && entry.rank > previous.rank + 1; const timeLimit = entry.timeLimitSec ?? Math.round((entry.roundDurationMs ?? 60_000) / 1000); return <span key={`${entry.isExample ? "starter" : "real"}-${entry.rank}-${entry.publicHandle}`} className={styles.rowWrap}>{separated && <span className={styles.gap} aria-hidden="true">···</span>}<li data-own={!entry.isExample && displayedOwnEntry?.rank === entry.rank && displayedOwnEntry?.publicHandle === entry.publicHandle}><b>#{entry.rank}</b><span><strong>{entry.publicHandle}</strong><small>{entry.roundsPlayed ?? 0} Runden · {timeLimit === 0 ? "frei" : `${timeLimit} s`} · {difficultyLabel[entry.difficulty ?? "medium"]}{entry.noZoom ? " · Einschränkung" : ""}</small></span><strong>{(entry.comparisonValue ?? entry.score).toLocaleString("de-DE")}</strong></li></span>; })}</ol>
          <div className={styles.listLegend}><span>Punkte pro Runde</span><span>Je höher, desto besser.</span></div></>
        <InlineInfoPopover align="right" className={styles.rankingHelp} ariaLabel="Wie funktionieren Ranking-Punkte?" title="Faire Ranking-Punkte" href="/faq/rankings" hrefLabel="Ranking-Regeln ansehen">Öffentlich zählen abgeschlossene, technisch geprüfte Partien mit 15, 30 oder 60 Sekunden Zeitlimit. Auffällige Ergebnisse können nachträglich entfernt werden.</InlineInfoPopover>
      </section><details className={styles.formulaNote}><summary id="ranking-berechnung">Berechnung der Punkte</summary><div><p>Im gewählten Zeitraum zählt pro Spieler {category === "all" ? "über alle Kategorien hinweg" : "in der gewählten Kategorie"} nur die Partie mit dem höchsten Wert. Die Basis bilden die durchschnittlichen Punkte pro Runde. Damit unterschiedliche Einstellungen fair vergleichbar bleiben, werden sie gewichtet: Für das Zeitlimit gelten 60 Sekunden = 1,00, 30 Sekunden = 1,10 und 15 Sekunden = 1,25. Für die Schwierigkeit gelten Leicht = 1,00, Mittel = 1,05 und Schwer = 1,15. Eine aktive Einschränkung erhält zusätzlich den Faktor 1,10. Die Rechnung lautet: Punkte pro Runde × Zeitfaktor × Schwierigkeitsfaktor × Einschränkungsfaktor. Partien mit freiem Zeitlimit werden nicht in diese Rankings aufgenommen.</p><p>Ergebnisse werden technisch geprüft. Auffällige Partien können aus öffentlichen Rankings entfernt werden.</p></div></details>
    </div></div><RedesignFooter className={layoutStyles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter></RedesignShell></div></main>;
}
