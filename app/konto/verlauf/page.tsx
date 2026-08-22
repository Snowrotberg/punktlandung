import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { calculateComparisonValue } from "@/lib/leaderboards";
import styles from "../dashboard.module.css";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { LegalLinks } from "@/components/LegalLinks";
import { SectionNavigation } from "@/components/SectionNavigation";
import { bestAveragePointsByCategory } from "@/lib/accountStatistics";
import { isAdminAccount } from "@/lib/adminAccess.server";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";

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

function gameStatusLabel(status: string): string | null {
  if (status === "verified") return null;
  if (status === "invalid") return "Gespeichert · nicht für Rankings gewertet";
  return "Im Konto gespeichert · noch nicht für Rankings verifiziert";
}

export default async function AccountHistoryPage() {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Fverlauf");
  const [admin, isAdmin] = [createSupabaseAdminClient(), await isAdminAccount(context.identity.account.accountId)];
  const { data: games } = await admin.from("ranked_games").select("game_id, category, score, completed_at, integrity_status, planned_rounds, completed_rounds, time_limit_sec, difficulty, no_zoom, total_response_time_ms").eq("account_id", context.identity.account.accountId).eq("status", "completed").order("completed_at", { ascending: false }).limit(50);
  const completedGames = games ?? [];
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
      <section className={`${styles.panel} ${styles.historyListPanel}`}><h2>Gespeicherte Partien</h2><p className={styles.panelMeta}>Deine abgeschlossenen Partien – neueste zuerst.</p>{completedGames.length === 0 ? <p className={styles.empty}>Noch keine gespeicherte Partie. Angemeldete Spieler speichern ihren Endstand automatisch.</p> : <ul className={styles.gameList}>{completedGames.map((game) => {
        const rounds = game.completed_rounds ?? game.planned_rounds ?? 0;
        const comparison = game.integrity_status === "verified" ? calculateComparisonValue({ score: game.score ?? 0, roundCount: rounds, timeLimitSec: game.time_limit_sec ?? undefined, difficulty: game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium", noZoom: Boolean(game.no_zoom) }) : null;
        const time = game.time_limit_sec === 0 ? "Ohne Zeitlimit" : `${game.time_limit_sec ?? 60} s`;
        const difficulty = difficultyLabel[game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium"];
        const status = gameStatusLabel(game.integrity_status);
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
      })}</ul>}</section>
    </div><RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter></RedesignShell></div></main>;
}
