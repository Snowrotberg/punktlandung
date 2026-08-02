"use client";

import "@fontsource-variable/inter";
import { ArrowRight, CircleDot, Globe2, MapPin, Radio, UserRound, UsersRound, Volume2, VolumeX } from "lucide-react";
import { AdContainer } from "@/components/AdContainer";
import { LegalLinks } from "@/components/LegalLinks";
import { TriangleIcon } from "@/components/TriangleIcon";
import {
  RedesignButton,
  RedesignButtonLink,
  RedesignFooter,
  RedesignHeader,
  RedesignShell
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
  mapPreview: React.ReactNode;
  modes: ReadonlyArray<HomeMode>;
  onDirectPlay: () => void;
  onModeSelect: () => void;
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
  mapPreview,
  modes,
  onDirectPlay,
  onModeSelect,
  onSoundToggle
}: RedesignHomeViewProps) {
  const serverOnline = connectionStatus === "open";
  const serverLabel = serverOnline ? "Server online" : connectionStatus === "connecting" ? "Server wird verbunden" : "Server offline";

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <AdContainer placement="home-left-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />

        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <a href="/" className={styles.brand} aria-label="Punktlandung Startseite">
              <span className={styles.brandMark}><MapPin aria-hidden="true" /></span>
              <span>Punktlandung</span>
            </a>
            <div className={styles.topActions}>
              <span className={styles.serverStatus} data-online={serverOnline || undefined} title={serverLabel} role="status">
                <Radio aria-hidden="true" />
                <span>{serverLabel}</span>
              </span>
              <button
                type="button"
                className={styles.iconButton}
                onClick={onSoundToggle}
                aria-label={soundEnabled ? "Sound ausschalten" : "Sound einschalten"}
                title={soundEnabled ? "Sound an" : "Sound aus"}
                aria-pressed={soundEnabled}
              >
                {soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
              </button>
              <a className={styles.betaBadge} href="/feedback">
                <CircleDot aria-hidden="true" />
                <span>Öffentliche Beta</span>
              </a>
              <button type="button" className={styles.iconButton} aria-label={`Account von ${playerName}`} title={`Account · ${playerName}`}>
                <UserRound aria-hidden="true" />
              </button>
            </div>
          </RedesignHeader>

          <div className={styles.content}>
            <section className={styles.hero} aria-labelledby="home-title">
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>Das Geo-Spiel für alle</span>
                <h1 id="home-title">Wie gut kennst du die Welt?</h1>
                <p>Orte, Städte und Wahrzeichen erraten. Allein, zusammen oder live im Raum.</p>
                <div className={styles.heroActions}>
                  <RedesignButton tone="primary" className={styles.directButton} onClick={onDirectPlay}>
                    <span>Direkt spielen</span>
                    <TriangleIcon direction="right" />
                  </RedesignButton>
                </div>
              </div>
              <div className={styles.heroMap} aria-hidden="true">{mapPreview}</div>
            </section>

            <section className={styles.modeSection} aria-labelledby="mode-title">
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionLabel}>Spielweise</span>
                  <h2 id="mode-title">Wähle deinen Modus</h2>
                </div>
              </div>
              <div className={styles.modeGrid}>
                {modes.map((mode) => (
                  <RedesignButtonLink key={mode.id} href={mode.href} tone="secondary" className={styles.modeCard} onClick={onModeSelect}>
                    <span className={styles.modeIcon}><ModeIcon mode={mode.id} /></span>
                    <span className={styles.modeCopy}>
                      <strong>{mode.title}</strong>
                      <small>{mode.text}</small>
                    </span>
                    <ArrowRight className={styles.modeArrow} aria-hidden="true" />
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
