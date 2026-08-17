"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/types/game";
import type { PublicRankedGame, PublicResolvedRankedRound } from "@/lib/rankedGame";
import { browserUuid } from "@/lib/browserUuid";
import { useSound } from "./SoundProvider";
import { GuessMap } from "./GuessMap";
import {
  RedesignBrand,
  RedesignButton,
  RedesignButtonLink,
  RedesignFooter,
  RedesignHeader,
  RedesignRoot,
  RedesignShell,
  RedesignStatusControls,
  Surface
} from "./redesign";
import styles from "./RankedSoloGame.module.css";

type ApiResponse = { data?: PublicRankedGame; error?: { message?: string } };

function errorMessage(response: Response, payload: ApiResponse): string {
  return payload.error?.message ?? (response.ok ? "Die Partie konnte nicht geladen werden." : `Die Partie konnte nicht geladen werden (${response.status}).`);
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

export function RankedSoloGame() {
  const { enabled: soundEnabled, toggle: toggleSound } = useSound();
  const [game, setGame] = useState<PublicRankedGame | null>(null);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [promptRetry, setPromptRetry] = useState(0);
  const [promptFailed, setPromptFailed] = useState(false);
  const startRequestRef = useRef(false);

  const request = useCallback(async (url: string, init?: RequestInit): Promise<PublicRankedGame> => {
    const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
    const payload = (await response.json()) as ApiResponse;
    if (!response.ok || !payload.data) throw new Error(errorMessage(response, payload));
    return payload.data;
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await request("/api/v1/ranked-games", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ranked-defer-start": "true" },
        body: JSON.stringify({ requestId: browserUuid(), rulesetId: "daily-five" })
      });
      setGame(next);
      setGuess(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die gewertete Partie konnte nicht gestartet werden.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (startRequestRef.current) return;
    startRequestRef.current = true;
    void start();
  }, [start]);

  const activeRound = game?.activeRound ?? null;
  const promptUrl = activeRound ? `${activeRound.assetUrl}${activeRound.assetUrl.includes("?") ? "&" : "?"}retry=${promptRetry}` : "";
  const lastResolvedRound: PublicResolvedRankedRound | null = useMemo(
    () => game?.resolvedRounds.at(-1) ?? null,
    [game]
  );

  const expire = useCallback(async () => {
    if (!game?.activeRound || submitting) return;
    setSubmitting(true);
    try {
      const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/expire`, { method: "POST" });
      setGame(next);
      setGuess(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Runde konnte nicht abgeschlossen werden.");
    } finally {
      setSubmitting(false);
    }
  }, [game, request, submitting]);

  useEffect(() => {
    setPromptRetry(0);
    setPromptFailed(false);
  }, [activeRound?.roundId]);

  useEffect(() => {
    if (!activeRound) {
      setSecondsLeft(null);
      return;
    }
    if (activeRound.deadlineAt === null) {
      setSecondsLeft(null);
      return;
    }
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((activeRound.deadlineAt! - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(() => {
      update();
      if (activeRound.deadlineAt !== null && activeRound.deadlineAt <= Date.now()) void expire();
    }, 250);
    return () => window.clearInterval(timer);
  }, [activeRound, expire]);

  const submitGuess = async () => {
    if (!game || !activeRound || !guess || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/guess`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roundId: activeRound.roundId,
          guessId: browserUuid(),
          lat: guess.lat,
          lng: guess.lng
        })
      });
      setGame(next);
      setGuess(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Tipp konnte nicht abgegeben werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const readyPrompt = async () => {
    if (!game || !activeRound || activeRound.startedAt !== null) return;
    try {
      const next = await request(`/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/rounds/${encodeURIComponent(activeRound.roundId)}/ready`, { method: "POST" });
      setGame(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Runde konnte nicht gestartet werden.");
    }
  };

  const headline = loading ? "Gewertete Partie wird vorbereitet" : game?.status === "completed" ? "Partie abgeschlossen" : "Dein Tipp";
  const description = loading
    ? "Die Aufgabe wird sicher vom Spielserver ausgewählt."
    : game?.status === "completed"
      ? "Dein Ergebnis wurde serverseitig berechnet und deinem Konto zugeordnet."
      : "Setze deinen Pin auf der Karte. Aufgabe, Zeit und Punkte werden serverseitig geprüft.";

  return (
    <RedesignRoot className={styles.root}>
      <RedesignShell>
        <RedesignHeader>
          <RedesignBrand />
          <RedesignStatusControls
            connectionStatus="open"
            soundEnabled={soundEnabled}
            accountHref="/konto"
            accountAuthenticated
            onSoundToggle={toggleSound}
          />
        </RedesignHeader>
        <main className={styles.content}>
          <Surface className={styles.promptPanel}>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--pl-mint)]">{activeRound ? `Runde ${activeRound.roundNumber}/${activeRound.totalRounds}` : "Server-Ranking"}</p>
              <h1 className="mt-2 text-3xl font-black">{headline}</h1>
              <p className={`mt-2 text-sm leading-6 ${styles.muted}`}>{description}</p>
            </div>
            {activeRound && !promptFailed ? (
              <img key={promptUrl} className={styles.promptImage} src={promptUrl} alt="Aktuelle Geo-Aufgabe" onLoad={() => void readyPrompt()} onError={() => {
                if (promptRetry < 2) {
                  setPromptRetry((value) => value + 1);
                } else {
                  setPromptFailed(true);
                  setError("Das Bild konnte gerade nicht geladen werden. Bitte versuche es erneut.");
                }
              }} />
            ) : activeRound && promptFailed ? (
              <div className="rounded-[var(--pl-radius-surface)] border border-[var(--pl-red)]/60 bg-[var(--pl-red)]/10 p-6 text-center">
                <p className="font-black">Das Bild konnte nicht geladen werden.</p>
                <RedesignButton tone="secondary" className="mt-4" onClick={() => { setPromptFailed(false); setError(null); setPromptRetry((value) => value + 1); }}>Erneut versuchen</RedesignButton>
              </div>
            ) : lastResolvedRound ? (
              <div className={styles.result}>
                <strong>{lastResolvedRound.location.title}</strong>
                <span className={styles.muted}>{lastResolvedRound.location.countryName} · {formatDistance(lastResolvedRound.result.distanceKm)} entfernt</span>
                <strong>{lastResolvedRound.result.points.toLocaleString("de-DE")} Punkte</strong>
              </div>
            ) : null}
            {activeRound && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-[var(--pl-violet)]">{secondsLeft ?? "–"} s</span>
                <RedesignButton tone="primary" disabled={!guess || submitting} onClick={submitGuess}>
                  {submitting ? "Wird geprüft …" : "Tipp abgeben"}
                </RedesignButton>
              </div>
            )}
            {game?.status === "completed" && <RedesignButtonLink href="/konto/rankings" tone="secondary">Zum Ranking</RedesignButtonLink>}
            {error && <p role="alert" className="rounded-[var(--pl-radius-control)] border border-[var(--pl-red)]/60 bg-[var(--pl-red)]/10 p-3 text-sm text-[var(--pl-text)]">{error}</p>}
          </Surface>
          <Surface className={styles.mapPanel} padded={false}>
            <div className={styles.map}>
              <GuessMap center={{ lat: 20, lng: 0 }} guess={guess} noPan={false} noZoom={false} onGuess={setGuess} />
            </div>
          </Surface>
        </main>
        <RedesignFooter>
          <RedesignButtonLink href="/" tone="text">Zur Startseite</RedesignButtonLink>
          <RedesignButtonLink href="/konto" tone="text">Spielerkonto</RedesignButtonLink>
        </RedesignFooter>
      </RedesignShell>
    </RedesignRoot>
  );
}
