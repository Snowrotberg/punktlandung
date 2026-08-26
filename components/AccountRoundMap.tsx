"use client";

import { GlobeResultMap } from "@/components/GlobeMapLab";
import type { ResultCameraScenario } from "@/lib/globeResultCamera";
import type { GeoLocation, RoundResult } from "@/types/game";
import { useEffect, useState } from "react";
import styles from "./AccountRoundVisual.module.css";

type AccountRoundMapProps = {
  location: GeoLocation;
  result: RoundResult;
  resolvedAt: number | null;
  playerName: string;
};

export function AccountRoundMap({ location, result, resolvedAt, playerName }: AccountRoundMapProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!maximized) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [maximized]);
  const guess = result.guess;
  const scenario: ResultCameraScenario | null = guess ? {
    id: `account-${location.id}-${resolvedAt ?? "open"}-${result.playerId}`,
    label: `${playerName} → ${location.title}`,
    description: "Gespeicherte Tipp- und Zielkoordinaten dieser Runde",
    playerName: `#1 ${playerName}`,
    targetName: location.title,
    targetDescription: location.shortDescription ?? `${location.countryName} · ${location.continent}`,
    guess: [guess.lng, guess.lat],
    target: [location.lng, location.lat]
  } : null;

  return (
    <>
      <section className={`account-round-map ${styles.resultMapTheme}`}>
        <div className={styles.visualHeader}><span>Karte dieser Runde</span><button type="button" onClick={() => setMaximized(true)}>Maximieren</button></div>
        <div className={styles.mapSurface}>
          {scenario ? <GlobeResultMap scenario={scenario} animate={false} targetInfoIndicator="i" /> : <p className={styles.mapUnavailable}>Für diese Runde wurde kein Tipp gespeichert.</p>}
        </div>
      </section>
      {maximized && <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Karte zu ${location.title}`} onMouseDown={(event) => event.target === event.currentTarget && setMaximized(false)}>
        <div className={styles.modalPanel}>
          <div className={styles.modalHeader}><strong>{location.title} · Karte</strong><button type="button" onClick={() => setMaximized(false)} aria-label="Karte schließen">×</button></div>
          <div className={styles.modalMap}>{scenario ? <GlobeResultMap scenario={scenario} animate={false} targetInfoIndicator="i" /> : <p className={styles.mapUnavailable}>Für diese Runde wurde kein Tipp gespeichert.</p>}</div>
        </div>
      </div>}
    </>
  );
}
