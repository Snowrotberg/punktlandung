"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import { AdContainer } from "@/components/AdContainer";
import { LegalLinks } from "@/components/LegalLinks";
import {
  PlayerAvatar,
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

type HomeCategory = {
  id: string;
  title: string;
  short: string;
  disabled?: boolean;
};

type RedesignHomeViewProps = {
  playerName: string;
  serverStatus: ReactNode;
  betaBadge: ReactNode;
  mapPreview: ReactNode;
  modes: ReadonlyArray<HomeMode>;
  categories: ReadonlyArray<HomeCategory>;
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoin: () => void;
  onDirectPlay: () => void;
  onModeSelect: () => void;
};

function ModeGlyph({ mode }: { mode: HomeMode["id"] }) {
  if (mode === "solo") return <span aria-hidden="true">◎</span>;
  if (mode === "couch") return <span aria-hidden="true">◉◉</span>;
  return <span aria-hidden="true">◌</span>;
}

export function RedesignHomeView({
  playerName,
  serverStatus,
  betaBadge,
  mapPreview,
  modes,
  categories,
  joinCode,
  onJoinCodeChange,
  onJoin,
  onDirectPlay,
  onModeSelect
}: RedesignHomeViewProps) {
  const [joinVisible, setJoinVisible] = useState(false);
  const handleJoinKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && joinCode.trim()) onJoin();
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <AdContainer placement="home-left-rail" variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />

        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">⌖</span>
              <span>Punktlandung</span>
            </div>
            <div className={styles.topActions}>
              <span className={styles.status}>{serverStatus}</span>
              {betaBadge}
              <span className={styles.profile}>
                <PlayerAvatar name={playerName} size="2rem" />
                <span>{playerName}</span>
              </span>
            </div>
          </RedesignHeader>

          <div className={styles.content}>
            <section className={styles.hero} aria-labelledby="home-title">
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>Das Geo-Spiel für alle</span>
                <h1 id="home-title">Wie gut kennst du die Welt?</h1>
                <p>Orte, Städte und Wahrzeichen erraten. Allein, gemeinsam oder live im Raum.</p>
                <div className={styles.heroActions}>
                  <RedesignButton tone="primary" onClick={onDirectPlay}>Direkt spielen&nbsp; →</RedesignButton>
                  <RedesignButton tone="secondary" onClick={() => setJoinVisible((visible) => !visible)} aria-expanded={joinVisible}>
                    Raum beitreten
                  </RedesignButton>
                </div>
                {joinVisible && (
                  <div className={styles.joinPanel}>
                    <input
                      aria-label="Raumcode"
                      value={joinCode}
                      onChange={(event) => onJoinCodeChange(event.target.value)}
                      onKeyDown={handleJoinKeyDown}
                      maxLength={6}
                      placeholder="Raumcode"
                    />
                    <RedesignButton tone="primary" disabled={!joinCode.trim()} onClick={onJoin}>Beitreten</RedesignButton>
                  </div>
                )}
              </div>
              <div className={styles.heroMap} aria-hidden="true">{mapPreview}</div>
            </section>

            <AdContainer
              placement="home-mobile-tablet"
              variant="banner"
              adFormat="horizontal"
              label="Anzeige"
              className={styles.mobileAd}
              fullWidthResponsive
            />

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
                    <span className={styles.modeIcon}><ModeGlyph mode={mode.id} /></span>
                    <span>
                      <strong>{mode.title}</strong>
                      <small>{mode.text}</small>
                    </span>
                    <span className={styles.modeArrow} aria-hidden="true">→</span>
                  </RedesignButtonLink>
                ))}
              </div>
            </section>

            <section className={styles.categories} aria-label="Spielkategorien">
              {categories.map((category, index) => (
                <article key={category.id} className={styles.categoryCard} data-disabled={category.disabled || undefined}>
                  <span className={styles.categoryIcon} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{category.title}</strong>
                    <small>{category.short}</small>
                  </span>
                </article>
              ))}
            </section>
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
