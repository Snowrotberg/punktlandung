"use client";

import { GuessMap } from "@/components/GuessMap";
import type { GeoLocation, Guess, Player, RoundResult } from "@/types/game";
import { playerColorAt } from "@/lib/playerPalette";
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
  const summary = {
    roundNumber: 1,
    location,
    results: [result],
    crewGuess: null,
    crewDistanceKm: null,
    duel: [],
    completedAt: resolvedAt ?? Date.now()
  };
  const players: Player[] = [{
    id: result.playerId,
    name: playerName,
    color: playerColorAt(0),
    score: result.points,
    connected: false,
    isHost: true,
    team: "aurora",
    status: "active",
    cosmetic: "none"
  }];

  return (
    <>
      <section className={`account-round-map ${styles.resultMapTheme}`}>
        <div className={styles.visualHeader}><span>Karte dieser Runde</span><button type="button" onClick={() => setMaximized(true)}>Maximieren</button></div>
        <GuessMap mode="results" summary={summary} guesses={guess ? [guess as Guess] : []} players={players} showLabels resultPaddingScale={1} resultZoomScale={1} resultLabelInset noPan={false} noZoom={false} />
      </section>
      {maximized && <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Karte zu ${location.title}`} onMouseDown={(event) => event.target === event.currentTarget && setMaximized(false)}>
        <div className={styles.modalPanel}>
          <div className={styles.modalHeader}><strong>{location.title} · Karte</strong><button type="button" onClick={() => setMaximized(false)} aria-label="Karte schließen">×</button></div>
          <div className={`${styles.modalMap} ${styles.resultMapTheme}`}><GuessMap mode="results" summary={summary} guesses={guess ? [guess as Guess] : []} players={players} showLabels resultPaddingScale={1} resultZoomScale={1} resultLabelInset noPan={false} noZoom={false} /></div>
        </div>
      </div>}
    </>
  );
}
