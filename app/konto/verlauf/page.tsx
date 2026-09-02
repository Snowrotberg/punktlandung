import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import {
  accountHistoryComparisonValue,
  filterAndSortAccountHistory,
  parseAccountHistoryCategory,
  parseAccountHistorySort,
  type AccountHistoryCategory,
  type AccountHistoryGame,
  type AccountHistorySort
} from "@/lib/accountHistory";
import styles from "../dashboard.module.css";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { LegalLinks } from "@/components/LegalLinks";
import { SectionNavigation } from "@/components/SectionNavigation";
import { bestAveragePointsByCategory } from "@/lib/accountStatistics";
import { isAdminAccount } from "@/lib/adminAccess.server";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";
import { ResponsiveRouteSelect } from "@/components/ResponsiveRouteSelect";

export const metadata: Metadata = { title: "Spielverlauf", robots: { index: false, follow: false } };

const categoryLabels: Record<string, string> = {
  mixed: "Gemischte Kategorien",
  landmarks: "Wahrzeichen",
  capitals: "Hauptstädte",
  flags: "Flaggen",
  cities: "Städte",
  landscapes: "Landschaften",
  streetview: "Straßenansichten"
};

const historyCategoryFilters: Array<[AccountHistoryCategory, string]> = [
  ["all", "Alle"],
  ["mixed", "Gemischte Kategorien"],
  ["landmarks", "Wahrzeichen"],
  ["cities", "Städte"],
  ["landscapes", "Landschaften"],
  ["flags", "Flaggen"],
  ["capitals", "Hauptstädte"]
];

const historySortOptions: Array<[AccountHistorySort, string]> = [
  ["latest", "Neueste"],
  ["average", "Bester Partiedurchschnitt"],
  ["score", "Höchste Gesamtpunktzahl"]
];

function gameStatusLabel(status: string, reasons: string[] | null | undefined): string | null {
  if (status === "verified") return null;
  if (status === "invalid") return "Gespeichert · nicht für Rankings gewertet";
  if (reasons?.includes("local_client_result")) return "Gespeichert · nicht serverseitig verifiziert";
  return "Im Konto gespeichert · noch nicht für Rankings verifiziert";
}

export default async function AccountHistoryPage({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string }> }) {
  const params = await searchParams;
  const selectedCategory = parseAccountHistoryCategory(params.category);
  const selectedSort = parseAccountHistorySort(params.sort);
  const context = await getSupabaseAccountContext();
  if (!context) redirect(`/anmelden?returnTo=${encodeURIComponent(`/konto/verlauf?category=${selectedCategory}&sort=${selectedSort}`)}`);
  const [admin, isAdmin] = [createSupabaseAdminClient(), await isAdminAccount(context.identity.account.accountId)];
  const { data: games } = await admin.from("ranked_games").select("game_id, category, score, completed_at, integrity_status, integrity_reasons, planned_rounds, completed_rounds, time_limit_sec, difficulty, no_zoom, total_response_time_ms").eq("account_id", context.identity.account.accountId).eq("status", "completed").order("completed_at", { ascending: false }).limit(500);
  const completedGames = (games ?? []) as AccountHistoryGame[];
  const visibleGames = filterAndSortAccountHistory(completedGames, selectedCategory, selectedSort);
  const verifiedCount = completedGames.filter((game) => game.integrity_status === "verified").length;
  const totalScore = completedGames.reduce((sum, game) => sum + (game.score ?? 0), 0);
  const totalRounds = completedGames.reduce((sum, game) => sum + (game.completed_rounds ?? game.planned_rounds ?? 0), 0);
  const categoryBest = bestAveragePointsByCategory(completedGames);
  const difficultyLabel = { easy: "Leicht", medium: "Mittel", hard: "Schwer" } as const;

  return <main className={styles.page}><div className={`${styles.frame} ${styles.frameNoAds}`}><RedesignShell className={styles.app}>
    <RedesignHeader className={styles.subpageTop}><RedesignBrand className={styles.brand} /><div className={styles.toplinks}><RedesignButtonLink href="/solo-modus" tone="primary" className={styles.toplink}>Spielen</RedesignButtonLink><AccountHeaderControls /></div></RedesignHeader><SectionNavigation section="account" admin={isAdmin} />
    <div className={styles.narrowShell}><h1 className={styles.subpageTitle}>Spielverlauf</h1><p className={styles.panelIntro}>Deine abgeschlossenen Partien mit Punkten, Einstellungen und Ranglistenstatus.</p>
      <div className={`${styles.statsGrid} ${styles.historyStats}`} aria-label="Verlaufsstatistik"><div className={styles.stat}><strong>{completedGames.length}</strong><span>gespeicherte Partien</span></div><div className={styles.stat}><strong>{verifiedCount}</strong><span className={styles.statLabelWithHelp}>für Rankings gewertet<InlineInfoPopover align="right" className={styles.historyInfo} ariaLabel="Welche Partien werden für Rankings gewertet?" title="Für Rankings gewertet" href="/faq/rankings" hrefLabel="Ranking-Regeln ansehen">Öffentlich zählen vollständig abgeschlossene, technisch geprüfte Partien mit festem Zeitlimit von 15, 30 oder 60 Sekunden. Auffällige Ergebnisse können nachträglich entfernt werden.</InlineInfoPopover></span></div><div className={styles.stat}><strong>{totalRounds ? Math.round(totalScore / totalRounds).toLocaleString("de-DE") : "–"}</strong><span>Ø Punkte/Runde</span></div><div className={styles.stat}><strong>{totalScore.toLocaleString("de-DE")}</strong><span>Punkte im Verlauf</span></div></div>
      {categoryBest.length > 0 && <section className={`${styles.panel} ${styles.categoryBestPanel}`}><h2>Beste Ø-Punkte nach Kategorie</h2><p className={styles.panelMeta}>Der beste Rundendurchschnitt je gespeicherter Kategorie – unabhängig von der Partielänge.</p><ul className={styles.insightList}>{categoryBest.map(([category, score]) => <li key={category}><span>{categoryLabels[category] ?? category}</span><strong>{score.toLocaleString("de-DE")} / Runde</strong></li>)}</ul></section>}
      <section className={`${styles.panel} ${styles.historyListPanel}`}><h2>Gespeicherte Partien</h2><p className={styles.panelMeta}>Filtere deine abgeschlossenen Partien nach Kategorie. „Bester Partiedurchschnitt“ vergleicht die durchschnittlichen Punkte pro Runde einer vollständigen Partie, nicht die beste Einzelrunde.</p>
        <div className={styles.historyControls}>
          <nav className={styles.historyControlGroup} aria-label="Partien nach Kategorie filtern"><span className={styles.historyControlLabel}>Kategorie</span><div className={styles.historyFilterLinks}>{historyCategoryFilters.map(([value, label]) => <Link key={value} href={`/konto/verlauf?category=${value}&sort=${selectedSort}`} data-active={selectedCategory === value}>{label}</Link>)}</div></nav>
          <nav className={styles.historyControlGroup} aria-label="Partien sortieren"><span className={styles.historyControlLabel}>Sortierung</span><div className={styles.historyFilterLinks}>{historySortOptions.map(([value, label]) => <Link key={value} href={`/konto/verlauf?category=${selectedCategory}&sort=${value}`} data-active={selectedSort === value}>{label}</Link>)}</div></nav>
        </div>
        <div className={styles.mobileHistoryControls} aria-label="Partien filtern und sortieren">
          <ResponsiveRouteSelect label="Kategorie" value={selectedCategory} options={historyCategoryFilters.map(([value, label]) => ({ value, label, href: `/konto/verlauf?category=${value}&sort=${selectedSort}` }))} />
          <ResponsiveRouteSelect label="Sortierung" value={selectedSort} options={historySortOptions.map(([value, label]) => ({ value, label, href: `/konto/verlauf?category=${selectedCategory}&sort=${value}` }))} />
        </div>
        {completedGames.length === 0 ? <p className={styles.empty}>Noch keine gespeicherte Partie. Angemeldete Spieler speichern ihren Endstand automatisch.</p> : visibleGames.length === 0 ? <p className={styles.empty}>In dieser Kategorie hast du noch keine gespeicherte Partie.</p> : <><p className={styles.historyResultMeta}>{visibleGames.length} {visibleGames.length === 1 ? "Partie" : "Partien"}</p><ul className={styles.gameList}>{visibleGames.map((game) => {
        const rounds = game.completed_rounds ?? game.planned_rounds ?? 0;
        const comparison = accountHistoryComparisonValue(game);
        const time = game.time_limit_sec === 0 ? "Ohne Zeitlimit" : `${game.time_limit_sec ?? 60} s`;
        const difficulty = difficultyLabel[game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium"];
        const status = gameStatusLabel(game.integrity_status, game.integrity_reasons);
        return <li key={game.game_id} className={styles.game}><Link href={`/konto/verlauf/${encodeURIComponent(game.game_id)}`} className={styles.gameLink}>
          <strong className={styles.gameScore}>{(game.score ?? 0).toLocaleString("de-DE")} <span>Punkte</span></strong>
          <span className={styles.gameFacts}>
            <span className={styles.gameCategory}>{categoryLabels[game.category] ?? game.category}</span>
            <span>{rounds} Runden</span>
            <span>{time}</span>
            <span>{difficulty}</span>
            {game.no_zoom && <span>Ohne Bildzoom</span>}
          </span>
          <span className={styles.gameRanking} title="Für faire Ranglisten aus Punkten pro Runde und den gewählten Spieleinstellungen berechnet.">
            {comparison !== null ? <><strong>{comparison.toLocaleString("de-DE")}</strong> gewichtete Pkt./Runde</> : status}
          </span>
          <time className={styles.gameDate} dateTime={game.completed_at ?? undefined}>{game.completed_at ? new Date(game.completed_at).toLocaleDateString("de-DE") : ""}</time>
          <i className={styles.gameArrow} aria-hidden="true">›</i>
        </Link></li>;
      })}</ul></>}</section>
    </div><RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter></RedesignShell></div></main>;
}
