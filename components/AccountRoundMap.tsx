"use client";

import { GuessMap } from "@/components/GuessMap";
import {
  ACCOUNT_ROUND_MAP_ROOT_MARGIN,
  accountRoundMapMounts,
  buildAccountRoundReplayMap,
  type AccountRoundReplayMap
} from "@/lib/accountRoundReplayMap";
import type { GeoLocation, RoundResult } from "@/types/game";
import { Navigation } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./AccountRoundVisual.module.css";

type AccountRoundMapProps = {
  location: GeoLocation;
  result: RoundResult;
  resolvedAt: number | null;
  playerName: string;
};

export function AccountRoundMap({ location, result, resolvedAt, playerName }: AccountRoundMapProps) {
  const [maximized, setMaximized] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  const replayMap = useMemo(
    () => buildAccountRoundReplayMap({ location, result, resolvedAt, playerName }),
    [location, playerName, resolvedAt, result]
  );
  const mounts = accountRoundMapMounts({ nearViewport, maximized });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry?.isIntersecting ?? false),
      { rootMargin: ACCOUNT_ROUND_MAP_ROOT_MARGIN }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!maximized) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [maximized]);

  return (
    <>
      <section
        ref={sectionRef}
        className={`account-round-map ${styles.resultMapTheme}`}
        data-account-round-map={replayMap.kind}
        data-map-mounted={mounts.embedded ? "true" : "false"}
      >
        <div className={styles.visualHeader}><span>Karte dieser Runde</span><button type="button" onClick={() => setMaximized(true)}>Maximieren</button></div>
        <div className={styles.mapSurface}>
          {mounts.embedded
            ? <ReplayMap replayMap={replayMap} />
            : <div className={styles.mapDeferred} aria-hidden="true" />}
        </div>
      </section>
      {maximized && <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Karte zu ${location.title}`} onMouseDown={(event) => event.target === event.currentTarget && setMaximized(false)}>
        <div className={styles.modalPanel}>
          <div className={styles.modalHeader}><strong>{location.title} · Karte</strong><button type="button" onClick={() => setMaximized(false)} aria-label="Karte schließen">×</button></div>
          <div className={styles.modalMap}>
            {mounts.modal && <ReplayMap replayMap={replayMap} />}
          </div>
        </div>
      </div>}
    </>
  );
}

function ReplayMap({
  replayMap
}: {
  replayMap: AccountRoundReplayMap;
}) {
  const [mapReadyVersion, setMapReadyVersion] = useState(0);

  return (
    <div className={styles.replayMapShell}>
      <GuessMap
        mode="results"
        summary={replayMap.summary}
        players={replayMap.players}
        noPan={false}
        noZoom={false}
        resultControlInset
        resultLabelLayout="account-history"
        animateResultConnector
        resizeSignal={mapReadyVersion}
        onBaseMapReady={() => setMapReadyVersion((version) => version + 1)}
      />
      <button
        type="button"
        className={styles.northControl}
        aria-label="Karte nach Norden ausrichten und Ergebnis einpassen"
        data-tooltip="Nach Norden ausrichten"
        onClick={() => setMapReadyVersion((version) => version + 1)}
      >
        <Navigation aria-hidden="true" />
      </button>
    </div>
  );
}
