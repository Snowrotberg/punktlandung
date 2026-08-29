"use client";

import dynamic from "next/dynamic";
import { RESULT_CAMERA_CONFIG, type ResultCameraScenario } from "@/lib/globeResultCamera";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { playerColorAt } from "@/lib/playerPalette";
import { MapAttributionBadge } from "./MapAttributionBadge";
import { HomeMapPoster } from "./HomeMapPoster";

const HomeGlobeResultMap = dynamic(
  () => import("./GlobeMapLab").then((module) => module.GlobeResultMap),
  { ssr: false, loading: () => null }
);

const previewDistanceKm = 2;
const previewGuess = { lat: 52.5147, lng: 13.3501 };
const homeResultScenario: ResultCameraScenario = {
  id: "home-tiergarten-brandenburger-tor",
  label: "Startseite · Tiergarten → Brandenburger Tor",
  description: "Kurze Vorschau der Punktlandung-Ergebnisanimation",
  playerName: "#1 Dein Tipp",
  targetName: "Brandenburger Tor",
  targetDescription: "Das Brandenburger Tor ist eines der bekanntesten Wahrzeichen Berlins.",
  guess: [previewGuess.lng, previewGuess.lat],
  target: [13.3777, 52.5163]
};
function PreviewPin({ actual = false }: { actual?: boolean }) {
  const color = actual ? "#5ee7bd" : playerColorAt(0);
  return (
    <div
      className={`punktlandung-home-map-static-pin ${actual ? "is-actual" : "is-player"}`}
      style={{ "--pin-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 42">
        <path className="punktlandung-map-pin-outline" fillRule="evenodd" d="M16 42C16 42 3 24 3 15C3 6.7 8.8 1 16 1C23.2 1 29 6.7 29 15C29 24 16 42 16 42ZM16 9.75A5.25 5.25 0 1 0 16 20.25A5.25 5.25 0 1 0 16 9.75Z" />
        <path className="punktlandung-map-pin-fill" fillRule="evenodd" d="M16 38C16 38 5 23 5 15C5 8.4 9.9 4 16 4C22.1 4 27 8.4 27 15C27 23 16 38 16 38ZM16 8A7 7 0 1 0 16 22A7 7 0 1 0 16 8Z" />
        <circle className="punktlandung-map-pin-core" cx="16" cy="15" r="7.15" />
      </svg>
    </div>
  );
}

function PreviewEllipse({ actual = false }: { actual?: boolean }) {
  const color = actual ? "#5ee7bd" : playerColorAt(0);
  return (
    <svg
      className={`punktlandung-home-map-static-ellipse ${actual ? "is-actual" : "is-player"}`}
      viewBox="0 0 58 16"
      style={{ "--ellipse-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <ellipse className="punktlandung-pin-ellipse-outer" cx="29" cy="8" rx="27.75" ry="6.75" />
      <ellipse className="punktlandung-pin-ellipse-middle" cx="29" cy="8" rx="18.87" ry="4.59" />
      <ellipse className="punktlandung-pin-ellipse-inner" cx="29" cy="8" rx="10.55" ry="2.57" />
    </svg>
  );
}

function PreviewMapBase({ legacy = false }: { legacy?: boolean }) {
  const assetVariant = legacy ? "" : "-tiergarten";
  const assetVersion = legacy ? "20260818" : "20260826";
  const asset = (profile: string, density: string) => `/home-map-base${assetVariant}-${profile}-${density}.webp?v=${assetVersion}`;
  return (
    <picture className="punktlandung-home-map-base" aria-hidden="true">
      <source media="(min-width: 3000px)" srcSet={asset("tv-4k", "2x")} />
      <source media="(min-width: 1800px) and (max-width: 2999px) and (min-aspect-ratio: 19/10)" srcSet={asset("monitor-short", "2x")} />
      <source media="(min-width: 1800px)" srcSet={asset("monitor", "2x")} />
      <source media="(min-width: 1200px)" srcSet={asset("laptop", "2x")} />
      <source media="(orientation: landscape) and (min-width: 640px) and (max-width: 1279px) and (max-height: 640px)" srcSet={asset("phone-landscape", legacy ? "3x" : "2x")} />
      <source media="(max-width: 400px)" srcSet={asset("phone-small", legacy ? "3x" : "2x")} />
      <img src={asset("phone-large", legacy ? "3x" : "2x")} alt="" loading="eager" decoding="sync" fetchPriority="high" />
    </picture>
  );
}

function HomeMapSourcePreview() {
  const [mapReady, setMapReady] = useState(false);
  return (
    <div className={`punktlandung-home-map-preview${mapReady ? " is-map-ready" : ""}`} data-render-mode="globe-poster-source">
      <HomeGlobeResultMap
        scenario={homeResultScenario}
        animate={false}
        initialView="start"
        previewMode
        targetInfoIndicator="?"
        terrainExaggeration={RESULT_CAMERA_CONFIG.terrainExaggeration.homePreview}
        onSurfaceReady={() => setMapReady(true)}
      />
      <HomeMapPoster ready={mapReady} />
    </div>
  );
}

export function HomeMapPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const [previewMode, setPreviewMode] = useState<"animated" | "static" | "legacy" | "source">("animated");
  const [liveSurfaceReady, setLiveSurfaceReady] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [animationStarted, setAnimationStarted] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get("renderHomeMapSource") === "1") setPreviewMode("source");
    else if (parameters.get("homeMap") === "legacy") setPreviewMode("legacy");
    else if (parameters.get("homeMap") === "static") setPreviewMode("static");
    else setPreviewMode("animated");
  }, []);

  useEffect(() => {
    if (!liveSurfaceReady || liveUnavailable || previewMode !== "animated") return;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let settleTimer: number | undefined;
    const settleLayout = async () => {
      if (document.fonts) await document.fonts.ready;
      if (cancelled) return;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          settleTimer = window.setTimeout(() => {
            if (!cancelled) setLiveReady(true);
          }, 120);
        });
      });
    };
    void settleLayout();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    };
  }, [liveSurfaceReady, liveUnavailable, previewMode]);

  useEffect(() => {
    if (!liveReady || liveUnavailable || previewMode !== "animated") return;
    const pictures = previewRef.current?.querySelector<HTMLElement>(".punktlandung-home-map-pictures");
    const posters = pictures
      ? Array.from(pictures.querySelectorAll<HTMLElement>(".punktlandung-home-map-poster"))
      : [];
    const visiblePoster = posters.find((poster) => getComputedStyle(poster).display !== "none");
    if (!visiblePoster) return;

    // Wait for the actual, currently selected poster to finish fading. A short
    // settled frame after transitionend keeps the first camera movement clearly
    // separated from the handoff; the timeout also covers Reduced Motion.
    let settledTimer: number | undefined;
    let fallbackTimer: number | undefined;
    let finished = false;
    const beginAfterSettledFrame = () => {
      if (finished) return;
      finished = true;
      settledTimer = window.setTimeout(() => setAnimationStarted(true), 600);
    };
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === visiblePoster && event.propertyName === "opacity") beginAfterSettledFrame();
    };
    visiblePoster.addEventListener("transitionend", handleTransitionEnd);
    const style = getComputedStyle(visiblePoster);
    const durations = style.transitionDuration.split(",").map((value) => Number.parseFloat(value) * (value.includes("ms") ? 1 : 1_000));
    const delays = style.transitionDelay.split(",").map((value) => Number.parseFloat(value) * (value.includes("ms") ? 1 : 1_000));
    const transitionMs = Math.max(0, ...durations.map((duration, index) => duration + (delays[index] ?? delays[0] ?? 0)));
    fallbackTimer = window.setTimeout(beginAfterSettledFrame, transitionMs + 80);
    return () => {
      visiblePoster.removeEventListener("transitionend", handleTransitionEnd);
      if (settledTimer !== undefined) window.clearTimeout(settledTimer);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, [liveReady, liveUnavailable, previewMode]);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    const connector = connectorRef.current;
    if (!preview || !connector) return;

    const positionConnector = () => {
      const previewBox = preview.getBoundingClientRect();
      const player = preview.querySelector<SVGSVGElement>(".punktlandung-home-map-static-ellipse.is-player");
      const target = preview.querySelector<SVGSVGElement>(".punktlandung-home-map-static-ellipse.is-actual");
      if (!previewBox.width || !previewBox.height || !player || !target) return;

      const playerBox = player.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      const playerCenter = { x: playerBox.left - previewBox.left + playerBox.width / 2, y: playerBox.top - previewBox.top + playerBox.height / 2 };
      const targetCenter = { x: targetBox.left - previewBox.left + targetBox.width / 2, y: targetBox.top - previewBox.top + targetBox.height / 2 };
      const dx = targetCenter.x - playerCenter.x;
      const dy = targetCenter.y - playerCenter.y;
      const distance = Math.hypot(dx, dy);
      if (!distance) return;

      const ux = dx / distance;
      const uy = dy / distance;
      const ellipseRadius = (box: DOMRect) => {
        const rx = box.width * (27.75 / 58);
        const ry = box.height * (6.75 / 16);
        return 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry));
      };
      const dashGap = 9;
      const startInset = ellipseRadius(playerBox) + dashGap;
      const endInset = ellipseRadius(targetBox) + dashGap;

      connector.setAttribute("x1", String(playerCenter.x + ux * startInset));
      connector.setAttribute("y1", String(playerCenter.y + uy * startInset));
      connector.setAttribute("x2", String(targetCenter.x - ux * endInset));
      connector.setAttribute("y2", String(targetCenter.y - uy * endInset));
      connector.dataset.ready = "true";
    };

    positionConnector();
    const observer = new ResizeObserver(positionConnector);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  if (previewMode === "source") return <HomeMapSourcePreview />;

  const liveActive = previewMode === "animated" && !liveUnavailable;
  const showCompleteFallback = !liveActive;
  const previewReady = !liveActive || liveReady;
  const renderMode = liveActive ? "animated-live" : previewMode === "legacy" ? "legacy-static" : "static-overlay";

  return (
    <div
      ref={previewRef}
      className={`punktlandung-home-map-preview uses-tiergarten-fallback${previewMode === "legacy" ? " uses-legacy-fallback" : ""}${previewReady ? " is-map-ready" : ""}`}
      data-render-mode={renderMode}
      data-animation-started={animationStarted ? "true" : "false"}
      data-animation-complete={animationComplete ? "true" : "false"}
      aria-label="Kartenvorschau: Dein Tipp liegt zwei Kilometer vom Brandenburger Tor entfernt."
    >
      {!liveActive ? <div className="punktlandung-home-map-static-layer" data-home-map-fallback="true">
        <PreviewMapBase legacy={previewMode === "legacy"} />
        {showCompleteFallback ? (
          <svg className="punktlandung-home-map-static-connector" aria-hidden="true">
            <line ref={connectorRef} className="punktlandung-result-connector is-flowing" />
          </svg>
        ) : null}
        {showCompleteFallback ? <PreviewEllipse actual /> : null}
        <PreviewEllipse />
        {showCompleteFallback ? <PreviewPin actual /> : null}
        <PreviewPin />
        <span className="punktlandung-map-label punktlandung-map-label-player punktlandung-home-map-static-label is-player">
          #1 Dein Tipp<span className="punktlandung-map-label-distance"> · {previewDistanceKm} km</span>
        </span>
        {showCompleteFallback ? (
          <span className="punktlandung-map-label punktlandung-map-label-actual punktlandung-home-map-static-label is-actual">Brandenburger Tor</span>
        ) : null}
        <MapAttributionBadge />
      </div> : null}
      {liveActive ? (
        <div className={`punktlandung-home-map-live-layer${liveReady ? " is-ready" : ""}`}>
          <HomeGlobeResultMap
            scenario={homeResultScenario}
            startPaused={!animationStarted}
            previewMode
            targetInfoIndicator="?"
            terrainExaggeration={RESULT_CAMERA_CONFIG.terrainExaggeration.homePreview}
            onSurfaceReady={() => setLiveSurfaceReady(true)}
            onAnimationComplete={() => setAnimationComplete(true)}
            onUnavailable={() => setLiveUnavailable(true)}
          />
        </div>
      ) : null}
      {liveActive ? <HomeMapPoster ready={liveReady} /> : null}
    </div>
  );
}
