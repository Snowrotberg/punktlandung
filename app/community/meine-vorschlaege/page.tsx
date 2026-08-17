import type { Metadata } from "next";
import Link from "next/link";
import { AdContainer } from "@/components/AdContainer";
import { CheckCircle2, Clock3, Lightbulb, ShieldCheck } from "lucide-react";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { LegalLinks } from "@/components/LegalLinks";
import { SectionNavigation } from "@/components/SectionNavigation";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { communityUserStatusLabels, type CommunityStatus } from "@/lib/community";
import { readCommunitySuggestions, type CommunityReadResult } from "@/lib/communityRepository.server";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import styles from "../page.module.css";

export const metadata: Metadata = { title: "Meine Community-Vorschläge", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function statusIcon(status: CommunityStatus) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" />;
  if (status === "in_progress") return <Clock3 aria-hidden="true" />;
  return <ShieldCheck aria-hidden="true" />;
}

export default async function MyCommunitySuggestionsPage() {
  const context = await getSupabaseAccountContext();
  const viewerAccountId = context?.identity.account.accountId ?? null;
  let result: CommunityReadResult = { available: false, suggestions: [] };
  if (viewerAccountId) {
    try {
      result = await readCommunitySuggestions({ viewerAccountId, ownOnly: true, sort: "new" });
    } catch (error) {
      console.error("Own community suggestions could not be loaded", error instanceof Error ? error.message : "unknown error");
    }
  }

  return <main className={styles.page}><div className={styles.frame}><AdContainer placement="home-left-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive /><RedesignShell className={styles.app}>
    <RedesignHeader className={styles.header}><RedesignBrand /><div className={styles.headerActions}><RedesignButtonLink href="/solo-modus" tone="primary" className={styles.playLink}>Spielen</RedesignButtonLink><AccountHeaderControls authenticated={Boolean(context)} /></div></RedesignHeader>
    <SectionNavigation section="community" />
    <div className={styles.body}>
      <section className={styles.mineHero}>
        <div><span className={styles.eyebrow}>Deine Beteiligung</span><h1>Meine Vorschläge</h1><p>Hier siehst du alle deine Ideen – auch solange sie noch geprüft werden.</p></div>
        {context && <Link href="/community#vorschlagen">Neue Idee vorschlagen</Link>}
      </section>
      {!context ? <section className={styles.ideas}><div className={styles.emptyState}><ShieldCheck aria-hidden="true" /><h3>Melde dich für deine Vorschlagsliste an</h3><p>Deine eingereichten Ideen und Hinweise aus der Prüfung sind nur in deinem Spielerkonto sichtbar.</p><Link className={styles.emptyAction} href="/anmelden?returnTo=%2Fcommunity%2Fmeine-vorschlaege">Anmelden</Link></div></section>
      : !result.available ? <section className={styles.ideas}><div className={styles.emptyState}><ShieldCheck aria-hidden="true" /><h3>Der Community-Bereich wird vorbereitet</h3><p>Nach Anwendung der Datenbankmigration ist deine persönliche Vorschlagsliste verfügbar.</p></div></section>
      : result.suggestions.length === 0 ? <section className={styles.ideas}><div className={styles.emptyState}><Lightbulb aria-hidden="true" /><h3>Du hast noch keine Idee eingereicht</h3><p>Dein erster Vorschlag erscheint nach dem Absenden hier.</p><Link className={styles.emptyAction} href="/community#vorschlagen">Erste Idee vorschlagen</Link></div></section>
      : <section className={styles.ideas} aria-labelledby="own-ideas-heading"><div className={styles.ideasHeader}><div><span className={styles.eyebrow}>Persönliche Übersicht</span><h2 id="own-ideas-heading">Alle Einreichungen</h2></div><div className={styles.resultCount}>{result.suggestions.length} {result.suggestions.length === 1 ? "Vorschlag" : "Vorschläge"}</div></div><ol className={styles.ideaList}>{result.suggestions.map((suggestion) => <li key={suggestion.suggestionId} className={styles.ideaCard}><div className={styles.ideaContent}><div className={styles.ideaMeta}><span className={`${styles.status} ${styles[`status_${suggestion.status}`]}`}>{statusIcon(suggestion.status)}{communityUserStatusLabels[suggestion.status]}</span><time dateTime={suggestion.createdAt}>{new Date(suggestion.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</time></div><h3>{suggestion.title}</h3><p>{suggestion.details}</p></div><div className={styles.ownVoteCount}><strong>{suggestion.voteCount}</strong><span>{suggestion.voteCount === 1 ? "Stimme" : "Stimmen"}</span></div></li>)}</ol></section>}
    </div>
    <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
  </RedesignShell><AdContainer placement="home-right-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive /></div></main>;
}
