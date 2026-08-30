import type { ReactNode } from "react";
import { AdContainer } from "@/components/AdContainer";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { SectionNavigation } from "@/components/SectionNavigation";
import { LegalLinks } from "@/components/LegalLinks";
import styles from "./InfoPageShell.module.css";

type InfoPageShellProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  showImportantPages?: boolean;
  contentClassName?: string;
  fillDesktop?: boolean;
  compact?: boolean;
  plainContent?: boolean;
  showSectionNavigation?: boolean;
};

export async function InfoPageShell({
  eyebrow,
  title,
  intro,
  children,
  contentClassName = "",
  fillDesktop = false,
  compact = false,
  plainContent = false,
  showSectionNavigation = true
}: InfoPageShellProps) {
  const accountContext = await getSupabaseAccountContext();
  return (
    <main className={`${styles.page} ${fillDesktop ? styles.fillDesktop : ""}`}>
      <div className={styles.frame}>
        <AdContainer placement="home-left-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
        <RedesignShell className={`${styles.app} ${compact ? styles.compact : ""}`}>
          <RedesignHeader className={styles.header}>
            <RedesignBrand />
            <div className={styles.headerActions}>
              <RedesignButtonLink href="/solo-modus" tone="primary" className={styles.playLink}>Spielen</RedesignButtonLink>
              <AccountHeaderControls authenticated={Boolean(accountContext)} />
            </div>
          </RedesignHeader>
          {showSectionNavigation && <SectionNavigation />}

          <div className={styles.body}>
          <section className={styles.titlePanel}>
            <div className="min-w-0">
              {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
              <h1 className="mt-1 break-words text-3xl font-black leading-tight text-white md:text-4xl">{title}</h1>
              {intro && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{intro}</p>}
            </div>
          </section>

          <div className={styles.contentGrid}>
        <article className={`${plainContent ? styles.plainArticle : styles.article} punktlandung-info-content ${contentClassName}`}>
              {children}
            </article>
          </div>
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
        <AdContainer placement="home-right-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
      </div>
    </main>
  );
}
