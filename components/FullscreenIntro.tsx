"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./FullscreenIntro.module.css";

export const INTRO_SESSION_KEY = "punktlandung-fullscreen-intro-v3";

// Keep the completed intro available, but do not mount it in the live app.
// Set this to true when work on the intro resumes.
export const ENABLE_FULLSCREEN_INTRO = false;

// During development, set this to true to replay the intro after every reload.
export const FORCE_FULLSCREEN_INTRO = false;

export const INTRO_TIMING = {
  target: 2060,
  player: 2500,
  impact: 2700,
  success: 2860,
  curtain: 3260,
  curtainDuration: 240,
  reducedHold: 800
} as const;

const INTRO_PRELOAD_GRACE = 60;

export const INTRO_MARKERS = {
  target: { x: 50.55, y: 50.1 },
  player: { x: 48.7, y: 47.55 }
} as const;

const INTRO_FRAMES = [
  { src: "/intro-cinematic/world.jpg", focus: { x: 52, y: 28 }, align: { x: 0, y: 0 }, scale: 1.02 },
  { src: "/intro-cinematic/europe.jpg", focus: { x: 52, y: 45 }, align: { x: -2.3, y: 5.8 }, scale: 1.15 },
  { src: "/intro-cinematic/germany.jpg", focus: { x: 58, y: 37 }, align: { x: -10.6, y: 17.2 }, scale: 1.32 },
  { src: "/intro-cinematic/berlin-region.jpg", focus: { x: 52, y: 49 }, align: { x: -2.2, y: 1.1 }, scale: 1.1 },
  { src: "/intro-cinematic/berlin.jpg", focus: { x: 56, y: 50 }, align: { x: -6.9, y: 0 }, scale: 1.15 },
  { src: "/intro-cinematic/gate.jpg", focus: { x: 55, y: 50 }, align: { x: -5.6, y: 0 }, scale: 1.12 },
  { src: "/intro-cinematic/gate-close.jpg", focus: { x: 51, y: 47 }, align: { x: -1.1, y: 3.2 }, scale: 1.08 }
] as const;

const LEGACY_SESSION_KEYS = [
  "punktlandung-home-map-intro-v1",
  "punktlandung-fullscreen-intro-v1",
  "punktlandung-fullscreen-intro-v2"
];

type IntroMode = "checking" | "preloading" | "playing" | "hidden";
type IntroPhase = "camera" | "target" | "player" | "impact" | "success" | "curtain";

function abortableDelay(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, duration);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function preloadFrames(signal: AbortSignal) {
  return Promise.all(
    INTRO_FRAMES.map(
      ({ src }) =>
        new Promise<void>((resolve, reject) => {
          const image = new Image();
          const cancel = () => reject(new DOMException("Aborted", "AbortError"));
          image.onload = () => {
            signal.removeEventListener("abort", cancel);
            resolve();
          };
          image.onerror = () => {
            signal.removeEventListener("abort", cancel);
            reject(new Error(`Intro frame could not be loaded: ${src}`));
          };
          signal.addEventListener("abort", cancel, { once: true });
          image.src = src;
        })
    )
  );
}

export function FullscreenIntro() {
  const [mode, setMode] = useState<IntroMode>("checking");
  const [phase, setPhase] = useState<IntroPhase>("camera");
  const [reducedMotion, setReducedMotion] = useState(false);
  const sequenceRef = useRef<AbortController | null>(null);

  const finishIntro = useCallback(() => {
    sequenceRef.current?.abort();
    setMode("hidden");
  }, []);

  useLayoutEffect(() => {
    const forceIntro = process.env.NODE_ENV === "development" && FORCE_FULLSCREEN_INTRO;
    try {
      LEGACY_SESSION_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
      if (!forceIntro && window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1") {
        setMode("hidden");
        return;
      }
      window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    } catch {
      // The intro remains usable if sessionStorage is unavailable.
    }
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMode("preloading");
  }, []);

  useEffect(() => {
    if (mode === "hidden") return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "preloading") return;
    sequenceRef.current?.abort();
    const controller = new AbortController();
    sequenceRef.current = controller;
    const { signal } = controller;

    const run = async () => {
      try {
        await Promise.race([
          preloadFrames(signal),
          abortableDelay(INTRO_PRELOAD_GRACE, signal)
        ]);
        if (signal.aborted) return;
        setMode("playing");

        if (reducedMotion) {
          setPhase("success");
          await abortableDelay(INTRO_TIMING.reducedHold, signal);
          setPhase("curtain");
          await abortableDelay(INTRO_TIMING.curtainDuration, signal);
          setMode("hidden");
          return;
        }

        await abortableDelay(INTRO_TIMING.target, signal);
        setPhase("target");
        await abortableDelay(INTRO_TIMING.player - INTRO_TIMING.target, signal);
        setPhase("player");
        await abortableDelay(INTRO_TIMING.impact - INTRO_TIMING.player, signal);
        setPhase("impact");
        await abortableDelay(INTRO_TIMING.success - INTRO_TIMING.impact, signal);
        setPhase("success");
        await abortableDelay(INTRO_TIMING.curtain - INTRO_TIMING.success, signal);
        setPhase("curtain");
        await abortableDelay(INTRO_TIMING.curtainDuration, signal);
        setMode("hidden");
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setMode("hidden");
      }
    };

    void run();
  }, [mode, reducedMotion]);

  useEffect(() => {
    if (mode === "hidden") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishIntro();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finishIntro, mode]);

  if (mode === "hidden") return null;

  const showTarget = phase !== "camera";
  const showPlayer = phase === "player" || phase === "impact" || phase === "success" || phase === "curtain";
  const showImpact = phase === "impact" || phase === "success";
  const showSuccess = phase === "success" || phase === "curtain";

  return (
    <div
      className={`${styles.intro} ${mode === "playing" ? styles.playing : ""} ${styles[phase]} ${
        reducedMotion ? styles.reduced : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Punktlandung-Intro"
    >
      <div className={styles.loadingScene} aria-hidden="true">
        <span className={`${styles.loadingMarker} punktlandung-map-pin punktlandung-map-pin-actual`}><span /></span>
        <span className={styles.loadingWordmark}>Punktlandung</span>
      </div>

      <div className={styles.mapFilm} aria-hidden="true">
        {INTRO_FRAMES.map((frame, index) => (
          <div
            key={frame.src}
            className={`${styles.mapFrame} ${styles[`frame${index}`]}`}
            style={{
              "--frame-image": `url(${frame.src})`,
              "--focus-x": `${frame.focus.x}%`,
              "--focus-y": `${frame.focus.y}%`,
              "--align-x": `${frame.align.x}%`,
              "--align-y": `${frame.align.y}%`,
              "--frame-scale": frame.scale
            } as CSSProperties}
          />
        ))}
      </div>

      <div className={styles.worldMask} aria-hidden="true" />
      <div className={styles.cinematicShade} aria-hidden="true" />
      <div className={styles.techGrid} aria-hidden="true" />

      <div className={styles.markerLayer} aria-hidden="true">
        <span
          className={`${styles.markerAnchor} ${styles.targetAnchor}`}
          style={{ left: `${INTRO_MARKERS.target.x}%`, top: `${INTRO_MARKERS.target.y}%` }}
        >
          {showTarget && (
            <span
              className={`punktlandung-map-pin punktlandung-map-pin-player ${styles.mapPin}`}
              style={{ "--pin-color": "#f43f5e" } as CSSProperties}
            ><span /></span>
          )}
        </span>
        <span
          className={`${styles.markerAnchor} ${styles.playerAnchor}`}
          style={{ left: `${INTRO_MARKERS.player.x}%`, top: `${INTRO_MARKERS.player.y}%` }}
        >
          {showPlayer && <span className={`punktlandung-map-pin punktlandung-map-pin-actual ${styles.mapPin}`}><span /></span>}
        </span>
        <span
          className={styles.connection}
          style={{
            left: `${INTRO_MARKERS.player.x}%`,
            top: `${INTRO_MARKERS.player.y}%`,
            "--connection-x": `${INTRO_MARKERS.target.x - INTRO_MARKERS.player.x}vw`,
            "--connection-y": `${INTRO_MARKERS.target.y - INTRO_MARKERS.player.y}vh`
          } as CSSProperties}
        />
        <span
          className={styles.impactAnchor}
          style={{ left: `${INTRO_MARKERS.player.x}%`, top: `${INTRO_MARKERS.player.y}%` }}
        >
          {showImpact && <>
            <span className={styles.impactFlash} />
            <span className={styles.impactRing} />
            <span className={styles.impactRing} />
            <span className={styles.impactRing} />
          </>}
        </span>
      </div>

      {showSuccess && (
        <div className={styles.successScene} aria-live="polite">
          <div className={styles.successSweep} aria-hidden="true" />
          <div className={styles.successAura} aria-hidden="true" />
          <div className={styles.successRing} aria-hidden="true" />
          <div className={`${styles.successRing} ${styles.successRingDelay}`} aria-hidden="true" />
          <span className={styles.heroMarker} aria-hidden="true">
            <span className="punktlandung-map-pin punktlandung-map-pin-actual"><span /></span>
          </span>
          <div className={styles.successCopy}>
            <p>Richtiges Wahrzeichen</p>
            <h2>Punktlandung!</h2>
          </div>
        </div>
      )}

      <div className={styles.attribution}>
        Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap-Mitwirkende</a>
        {" · "}Grafik <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noreferrer">CC BY-SA</a>
      </div>
    </div>
  );
}
