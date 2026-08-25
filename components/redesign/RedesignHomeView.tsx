"use client";

import { Globe2, UserRound, UsersRound } from "lucide-react";
import type { MouseEvent } from "react";
import { AdContainer } from "@/components/AdContainer";
import { LegalLinks } from "@/components/LegalLinks";
import { TriangleIcon } from "@/components/TriangleIcon";
import {
  RedesignButtonLink,
  RedesignBrand,
  RedesignFooter,
  RedesignHeader,
  RedesignShell,
  RedesignStatusControls
} from "@/components/redesign";
import styles from "./RedesignHomeView.module.css";

type HomeMode = {
  id: "solo" | "couch" | "online";
  title: string;
  text: string;
  href: string;
};

type RedesignHomeViewProps = {
  playerName: string;
  connectionStatus: "connecting" | "open" | "closed";
  soundEnabled: boolean;
  accountHref?: string;
  accountAuthenticated?: boolean;
  mapPreview: React.ReactNode;
  modes: ReadonlyArray<HomeMode>;
  onDirectPlay: (event: MouseEvent<HTMLAnchorElement>) => void;
  onModeSelect: (href: string) => void;
  onSoundToggle: () => void;
};

function ModeIcon({ mode }: { mode: HomeMode["id"] }) {
  if (mode === "solo") return <UserRound aria-hidden="true" />;
  if (mode === "couch") return <UsersRound aria-hidden="true" />;
  return <Globe2 aria-hidden="true" />;
}

export function RedesignHomeView({
  playerName,
  connectionStatus,
  soundEnabled,
  accountHref,
  accountAuthenticated,
  mapPreview,
  modes,
  onDirectPlay,
  onModeSelect,
  onSoundToggle
}: RedesignHomeViewProps) {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <AdContainer placement="home-left-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />

        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <RedesignBrand />
            <RedesignStatusControls connectionStatus={connectionStatus} soundEnabled={soundEnabled} playerName={playerName} accountHref={accountHref} accountAuthenticated={accountAuthenticated} onSoundToggle={onSoundToggle} />
          </RedesignHeader>

          <div className={styles.content}>
            <section className={styles.hero} aria-labelledby="home-title">
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>Das Geo-Spiel für alle</span>
                <h1 id="home-title">
                  Wie gut<br className={styles.titleBreakCompact} /> kennst<br className={styles.titleBreakLandscape} /> du<br className={styles.titleBreakWide} /> die Welt?
                </h1>
                <p><span>Errate Orte, Städte, Wahrzeichen &amp; mehr.</span><span>Spiel für dich, gemeinsam mit Freunden oder online.</span></p>
                <div className={styles.heroActions}>
                    <RedesignButtonLink
                      href="/solo-modus/direct?rounds=15&time=60&difficulty=medium&category=mixed"
                      tone="primary"
                      className={`${styles.directButton} punktlandung-optical-arrow-right`}
                    onClick={onDirectPlay}
                  >
                    <span>Direkt spielen</span>
                    <TriangleIcon direction="right" />
                  </RedesignButtonLink>
                </div>
              </div>
              <div className={styles.heroMap} role="region" aria-label="Beispiel einer Spielauflösung">{mapPreview}</div>
            </section>

            <section className={styles.modeSection} aria-labelledby="mode-title">
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionLabel}>Spielweise</span>
                  <h2 id="mode-title">Wie möchtest du spielen?</h2>
                </div>
              </div>
              <div className={styles.modeGrid}>
                {modes.map((mode) => (
                  <RedesignButtonLink
                    key={mode.id}
                    href={mode.href}
                    tone="secondary"
                    className={styles.modeCard}
                    onClick={() => onModeSelect(mode.href)}
                  >
                    <span className={styles.modeIcon}><ModeIcon mode={mode.id} /></span>
                    <span className={styles.modeCopy}>
                      <strong>{mode.title}</strong>
                      <small>{mode.text}</small>
                    </span>
                    <TriangleIcon direction="right" className={styles.modeArrow} />
                  </RedesignButtonLink>
                ))}
              </div>
            </section>

            <AdContainer
              placement="home-mobile-tablet"
              variant="banner"
              adFormat="horizontal"
              label="Anzeige"
              className={styles.mobileAd}
              fullWidthResponsive
            />
          </div>

          <RedesignFooter className={styles.footerSlot}>
            <LegalLinks includeInfos align="end" />
          </RedesignFooter>
        </RedesignShell>

        <AdContainer placement="home-right-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
      </div>
    </main>
  );
}
