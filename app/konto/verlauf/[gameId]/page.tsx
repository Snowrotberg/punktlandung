import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { AccountRoundMap } from "@/components/AccountRoundMap";
import { AccountRoundImage } from "@/components/AccountRoundImage";
import { LegalLinks } from "@/components/LegalLinks";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { SectionNavigation } from "@/components/SectionNavigation";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { SupabaseRankedGameRepository } from "@/lib/supabase/rankedGameRepository.server";
import { SupabaseAccountProfileRepository } from "@/lib/supabase/accountProfileRepository.server";
import { calculateFlagAccuracy } from "@/lib/accountStatistics";
import { formatDistance } from "@/lib/geo";
import { isAdminAccount } from "@/lib/adminAccess.server";
import { InlineInfoPopover } from "@/components/InlineInfoPopover";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Partiedetails", robots: { index: false, follow: false } };

function formatDate(value: number | null): string {
  if (!value) return "Unbekanntes Datum";
  return new Date(value).toLocaleDateString("de-DE", { dateStyle: "long" });
}

function formatTime(responseTimeMs: number | undefined): string {
  if (typeof responseTimeMs !== "number" || !Number.isFinite(responseTimeMs)) return "–";
  return `${(responseTimeMs / 1000).toFixed(1).replace(".", ",")} s`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(3).replace(".", ",");
}

const categoryLabels: Record<string, string> = {
  mixed: "Gemischte Kategorien",
  landmarks: "Wahrzeichen",
  capitals: "Hauptstädte",
  flags: "Flaggen",
  cities: "Städte",
  landscapes: "Landschaften",
  streetview: "Straßenansichten"
};

function gameStatusLabel(status: string, reasons: string[]): string {
  if (status === "verified") return "Abgeschlossen und verifiziert";
  if (status === "invalid") return "Gespeichert · nicht für Rankings gewertet";
  if (reasons.includes("local_client_result")) return "Gespeichert · nicht serverseitig verifiziert";
  return "Im Konto gespeichert · noch nicht für Rankings verifiziert";
}

export default async function AccountGameDetailPage({ params }: { params: Promise<{ gameId: string }> }) {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Fverlauf");

  const { gameId } = await params;
  const [game, profile, isAdmin] = await Promise.all([
    new SupabaseRankedGameRepository().findById(gameId),
    new SupabaseAccountProfileRepository().findByAccountId(context.identity.account.accountId),
    isAdminAccount(context.identity.account.accountId)
  ]);
  if (!game || game.accountId !== context.identity.account.accountId || game.status !== "completed") notFound();

  const resolvedRounds = game.rounds.filter((round) => round.status === "resolved");
  const categories = Array.from(new Set(game.rounds.map((round) => round.location.category)));
  const categoryLabel = categories.length === 0 ? "Gemischte Kategorien" : categories.map((category) => categoryLabels[category] ?? category).join(" · ");
  const roundsWithResults = resolvedRounds.filter((round) => round.result);
  const averagePoints = roundsWithResults.length
    ? Math.round(roundsWithResults.reduce((sum, round) => sum + (round.result?.points ?? 0), 0) / roundsWithResults.length)
    : null;
  const averageDistance = roundsWithResults.length
    ? roundsWithResults.reduce((sum, round) => sum + (round.result?.distanceKm ?? 0), 0) / roundsWithResults.length
    : null;
  const flagAccuracy = calculateFlagAccuracy(game.rounds);
  const bestRound = roundsWithResults.reduce((best, round) => (round.result!.points > (best?.result?.points ?? -1) ? round : best), roundsWithResults[0]);

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
            <div className={styles.shellInner}>
            <div className={styles.headerRow}>
              <div>
                <Link href="/konto/verlauf" className={styles.backLink}>← Spielverlauf</Link>
                <h1>Partiedetails</h1>
                <p>{formatDate(game.completedAt)} · {game.rounds.length} Runden · {categoryLabel}</p>
              </div>
              <div className={styles.scoreCard}>
                <span>Gesamtpunktzahl</span>
                <strong>{game.score.toLocaleString("de-DE")}</strong>
              </div>
            </div>

            <div className={styles.metaGrid} aria-label="Partieübersicht">
              <div><span>Status</span><strong>{gameStatusLabel(game.integrityStatus, game.integrityReasons)}</strong><InlineInfoPopover align="right" className={styles.statusInfo} ariaLabel="Was bedeutet der Partiestatus?" title="Partiestatus" href="/faq/rankings" hrefLabel="Ranking-Regeln ansehen">Gespeichert bleibt die Partie immer. Öffentlich zählt sie nur vollständig abgeschlossen, serverseitig geprüft und mit 15, 30 oder 60 Sekunden Zeitlimit.</InlineInfoPopover></div>
              <div><span>Spielzeit</span><strong>{(game.totalResponseTimeMs / 1000).toFixed(1).replace(".", ",")} s</strong></div>
              <div><span>Zeitlimit</span><strong>{game.timeLimitSec === 0 ? "Frei" : `${game.timeLimitSec ?? 60} s`}</strong></div>
              <div><span>Schwierigkeit</span><strong>{game.difficulty === "easy" ? "Leicht" : game.difficulty === "hard" ? "Schwer" : "Mittel"}</strong></div>
            </div>

            <section className={styles.learningPanel} aria-label="Persönliche Lernstatistik">
              <div className={styles.panelHeading}><div><h2>Deine Rundenauswertung</h2><p>Die wichtigsten Hinweise aus dieser Partie auf einen Blick.</p></div></div>
              <div className={styles.learningGrid}>
                <div><strong>{averagePoints?.toLocaleString("de-DE") ?? "–"}</strong><span>Ø Punkte pro ausgewerteter Runde</span></div>
                <div><strong>{averageDistance !== null ? formatDistance(averageDistance) : "–"}</strong><span>Ø Entfernung zum Ziel</span></div>
                <div><strong>{flagAccuracy.percentage === null ? "–" : `${flagAccuracy.percentage} %`}</strong><span>{flagAccuracy.total ? `Flaggen richtig erkannt · ${flagAccuracy.hits}/${flagAccuracy.total}` : "Keine Flaggenrunde gespielt"}</span></div>
                <div><strong>{bestRound?.result?.points.toLocaleString("de-DE") ?? "–"}</strong><span>Beste Runde{bestRound ? ` · Runde ${bestRound.roundNumber}` : ""}</span></div>
              </div>
            </section>

            <section className={styles.roundsPanel}>
              <div className={styles.panelHeading}>
                <div><h2>Rundenverlauf</h2><p>Jede Runde zeigt dir, wo dein Tipp lag und wie die Wertung entstanden ist.</p></div>
                <span>{resolvedRounds.length} / {game.rounds.length} ausgewertet</span>
              </div>
              {resolvedRounds.length === 0 ? (
                <p className={styles.empty}>Für diese Partie sind noch keine aufgelösten Rundendaten verfügbar.</p>
              ) : (
                <ol className={styles.roundList}>
                  {resolvedRounds.map((round) => {
                    const result = round.result;
                    const guess = round.guess;
                    const imageUrl = round.location.panoramaUrls?.[0] ?? round.location.panoramaUrl;
                    return (
                      <li key={round.roundId} className={styles.roundCard}>
                        <div className={styles.roundNumber}>Runde {round.roundNumber}</div>
                        <div className={styles.roundMain}>
                          <h3>{round.location.title}</h3>
                          <p>{round.location.countryName} · {round.location.continent}</p>
                          {result ? <div className={styles.roundFacts}>
                            <span><b>{result.points.toLocaleString("de-DE")}</b> Punkte</span>
                            <span><b>{formatDistance(result.distanceKm)}</b> entfernt</span>
                            <span><b>{formatTime(guess?.responseTimeMs)}</b> Antwortzeit</span>
                          </div> : <p className={styles.missingResult}>Ergebnisdetails dieser älteren Partie wurden nicht mitgespeichert.</p>}
                        </div>
                        <div className={styles.roundResult}>
                          <strong>{result?.badge ?? "Keine Rundendaten"}</strong>
                          <span>{result ? (round.location.category === "flags" ? (result.countryCorrect ? "Flagge richtig erkannt" : "Flagge nicht erkannt") : "Nach Entfernung gewertet") : "Nur der Zielort ist vorhanden"}</span>
                          {guess && <small>Tipp: {formatCoordinate(guess.lat)}, {formatCoordinate(guess.lng)}</small>}
                        </div>
                        <div className={styles.roundVisuals}>
                          {imageUrl && <AccountRoundImage src={imageUrl} title={round.location.title} />}
                          {result && <div className={styles.roundMap}><AccountRoundMap location={round.location} result={result} resolvedAt={round.resolvedAt} playerName={profile?.displayName ?? "Du"} /></div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
            </div>
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
      </div>
    </main>
  );
}
