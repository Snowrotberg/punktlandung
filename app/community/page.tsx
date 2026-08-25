import type { Metadata } from "next";
import Link from "next/link";
import { AdContainer } from "@/components/AdContainer";
import { ArrowBigUp, CalendarCheck2, CheckCircle2, Clock3, Lightbulb, MessageSquareText, ShieldCheck } from "lucide-react";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { ContributionPaths } from "@/components/ContributionPaths";
import { LegalLinks } from "@/components/LegalLinks";
import { SectionNavigation } from "@/components/SectionNavigation";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { communityPublicMetrics, communityPublicStatuses, communityStatusLabels, type CommunitySort, type CommunityStatus } from "@/lib/community";
import { readCommunitySuggestions, sortCommunitySuggestions, type CommunityReadResult } from "@/lib/communityRepository.server";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { toggleCommunityVote } from "./actions";
import { CommunitySuggestionForm } from "./CommunitySuggestionForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Community & Roadmap",
  description: "Schlage neue Funktionen für Punktlandung vor, stimme für Ideen ab und verfolge die öffentliche Roadmap.",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams: Promise<{ sort?: string; status?: string; error?: string; submitted?: string }>;
};

const sorts: Array<{ value: CommunitySort; label: string }> = [
  { value: "trending", label: "Im Trend" },
  { value: "top", label: "Meiste Stimmen" },
  { value: "new", label: "Neu" }
];

const filters: Array<{ value: "all" | CommunityStatus; label: string }> = [
  { value: "all", label: "Alle Ideen" },
  { value: "planned", label: "Geplant" },
  { value: "in_progress", label: "In Arbeit" },
  { value: "completed", label: "Umgesetzt" }
];

function queryHref(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/community?${query}` : "/community";
}

function statusIcon(status: CommunityStatus) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" />;
  if (status === "in_progress") return <Clock3 aria-hidden="true" />;
  return <ShieldCheck aria-hidden="true" />;
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const params = await searchParams;
  const context = await getSupabaseAccountContext();
  const viewerAccountId = context?.identity.account.accountId ?? null;
  const sort = sorts.some((item) => item.value === params.sort) ? params.sort as CommunitySort : "trending";
  const status = filters.some((item) => item.value === params.status) ? params.status as CommunityStatus | "all" : "all";
  let result: CommunityReadResult = { available: false, suggestions: [] };
  let relatedSource: CommunityReadResult = { available: false, suggestions: [] };
  try {
    relatedSource = await readCommunitySuggestions({ viewerAccountId, sort: "top" });
    result = {
      available: relatedSource.available,
      suggestions: sortCommunitySuggestions(
        status === "all"
          ? relatedSource.suggestions
          : relatedSource.suggestions.filter((suggestion) => suggestion.status === status),
        sort
      )
    };
  } catch (error) {
    console.error("Community page could not load suggestions", error instanceof Error ? error.message : "unknown error");
  }
  const metrics = communityPublicMetrics(relatedSource.suggestions);

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <AdContainer placement="home-left-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <RedesignBrand />
            <div className={styles.headerActions}>
              <RedesignButtonLink href="/solo-modus" tone="primary" className={styles.playLink}>Spielen</RedesignButtonLink>
              <AccountHeaderControls authenticated={Boolean(context)} />
            </div>
          </RedesignHeader>
          <SectionNavigation section="community" />

          <div className={styles.body}>
            <section className={styles.hero}>
              <div>
                <span className={styles.eyebrow}>Gemeinsam weiterentwickeln</span>
                <h1>Ideen für Punktlandung</h1>
                <p>Schlage Funktionen vor, stimme für gute Ideen ab und sieh, woran als Nächstes gearbeitet wird.</p>
              </div>
              <div className={styles.process} id="ablauf">
                <span><Lightbulb aria-hidden="true" /><b>{metrics.ideasInVoting}</b> {metrics.ideasInVoting === 1 ? "Idee im Voting" : "Ideen im Voting"}</span>
                <span><CalendarCheck2 aria-hidden="true" /><b>{metrics.plannedIdeas}</b> Geplant</span>
                <span><ArrowBigUp aria-hidden="true" /><b>{metrics.votesCast}</b> {metrics.votesCast === 1 ? "Stimme abgegeben" : "Stimmen abgegeben"}</span>
              </div>
            </section>

            <section className={styles.composer} id="vorschlagen" aria-labelledby="suggestion-heading">
              <div className={styles.composerIntro}>
                <div className={styles.composerIcon}><MessageSquareText aria-hidden="true" /></div>
                <div><h2 id="suggestion-heading">Idee vorschlagen</h2><p>Was würdest du bei Punktlandung ergänzen oder verbessern? Beschreibe deinen Vorschlag kurz.</p></div>
              </div>
              {params.submitted === "1" && <p className={styles.success} role="status">Danke! Deine Idee ist gespeichert und wartet jetzt auf die Prüfung.</p>}
              {params.error && <p className={styles.error} role="alert">{params.error}</p>}
              <CommunitySuggestionForm candidates={relatedSource.suggestions.map(({ suggestionId, title, details, voteCount }) => ({ suggestionId, title, details, voteCount }))} />
              {!context && <div className={styles.signInPrompt}><p>Du kannst eine Idee ohne Konto einreichen. Zum Abstimmen und für deine persönliche Vorschlagsliste brauchst du ein Spielerkonto.</p><Link href="/anmelden?returnTo=%2Fcommunity%23vorschlagen">Anmelden</Link></div>}
            </section>

            <section className={styles.ideas} aria-labelledby="ideas-heading">
              <div className={styles.ideasHeader}>
                <div><span className={styles.eyebrow}>Feature Voting</span><h2 id="ideas-heading">Ideen & Roadmap</h2></div>
                <div className={styles.resultCount}>{result.suggestions.length} {result.suggestions.length === 1 ? "Idee" : "Ideen"}</div>
              </div>
              <div className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                  <span>Status</span>
                  <nav aria-label="Ideen nach Status filtern" className={styles.filterGroup}>
                    {filters.map((filter) => <Link key={filter.value} href={queryHref({ sort, status: filter.value === "all" ? undefined : filter.value })} aria-current={status === filter.value ? "page" : undefined}>{filter.label}</Link>)}
                  </nav>
                </div>
                <div className={`${styles.toolbarGroup} ${styles.sortToolbarGroup}`}>
                  <span>Sortieren nach</span>
                  <nav aria-label="Ideen sortieren" className={styles.sortGroup}>
                    {sorts.map((item) => <Link key={item.value} href={queryHref({ sort: item.value === "trending" ? undefined : item.value, status: status === "all" ? undefined : status })} aria-current={sort === item.value ? "page" : undefined}>{item.label}</Link>)}
                  </nav>
                </div>
              </div>

              {!result.available ? (
                <div className={styles.emptyState}><ShieldCheck aria-hidden="true" /><h3>Der Community-Bereich wird vorbereitet</h3><p>Die Oberfläche ist bereit. Nach Anwendung der Datenbankmigration können Ideen gespeichert und abgestimmt werden.</p></div>
              ) : result.suggestions.length === 0 ? (
                <div className={styles.emptyState}><Lightbulb aria-hidden="true" /><h3>Hier ist noch Platz für die erste Idee</h3><p>Reiche oben einen Vorschlag ein und gestalte Punktlandung mit.</p></div>
              ) : (
                <ol className={styles.ideaList}>
                  {result.suggestions.map((suggestion) => (
                    <li key={suggestion.suggestionId} className={styles.ideaCard}>
                      <div className={styles.ideaContent}>
                        <div className={styles.ideaMeta}><span className={`${styles.status} ${styles[`status_${suggestion.status}`]}`}>{statusIcon(suggestion.status)}{communityStatusLabels[suggestion.status]}</span><span>von {suggestion.authorLabel}</span><time dateTime={suggestion.createdAt}>{new Date(suggestion.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</time></div>
                        <h3>{suggestion.title}</h3>
                        <p>{suggestion.details}</p>
                      </div>
                      {communityPublicStatuses.includes(suggestion.status as typeof communityPublicStatuses[number]) && (
                        <form action={toggleCommunityVote} className={styles.voteForm}>
                          <input type="hidden" name="suggestionId" value={suggestion.suggestionId} />
                          <button type="submit" className={suggestion.votedByViewer ? styles.voted : ""} aria-label={`${suggestion.votedByViewer ? "Stimme entfernen" : "Für Idee stimmen"}: ${suggestion.title}`} aria-pressed={suggestion.votedByViewer}>
                            <ArrowBigUp aria-hidden="true" /><strong>{suggestion.voteCount}</strong><span>{suggestion.voteCount === 1 ? "Stimme" : "Stimmen"}</span>
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <ContributionPaths mode="feedback" />
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
        <AdContainer placement="home-right-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
      </div>
    </main>
  );
}
