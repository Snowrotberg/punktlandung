"use client";

import type { Guess, RoundSummary } from "@/types/game";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { playerColorAt } from "@/lib/playerPalette";
import { GuessMap } from "./GuessMap";
import { MapAttributionBadge } from "./MapAttributionBadge";
import { HomeMapPoster } from "./HomeMapPoster";

const previewDistanceKm = 2;
const previewGuess: Guess = { lat: 52.5163, lng: 13.4105, playerId: "home-preview-player", createdAt: 0 };
const previewSummary: RoundSummary = {
  roundNumber: 1,
  location: {
    id: "home-preview-brandenburger-tor",
    title: "Brandenburger Tor",
    lat: 52.5163,
    lng: 13.3777,
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    panoramaUrl: "",
    attribution: "OpenStreetMap",
    source: "wikimedia",
    category: "landmarks"
  },
  results: [{
    playerId: "home-preview-player",
    distanceKm: previewDistanceKm,
    points: 0,
    badge: "",
    eliminated: false,
    guess: previewGuess,
    countryCorrect: false
  }],
  crewGuess: null,
  crewDistanceKm: null,
  duel: [],
  completedAt: 0
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

function PreviewMapBase() {
  return (
    <picture className="punktlandung-home-map-base" aria-hidden="true">
      <source media="(min-width: 3000px)" srcSet="/home-map-base-tv-4k-2x.webp?v=20260818" />
      <source media="(min-width: 1800px) and (max-width: 2999px) and (min-aspect-ratio: 19/10)" srcSet="/home-map-base-monitor-short-2x.webp?v=20260818" />
      <source media="(min-width: 1800px)" srcSet="/home-map-base-monitor-2x.webp?v=20260818" />
      <source media="(min-width: 1200px)" srcSet="/home-map-base-laptop-2x.webp?v=20260818" />
      <source media="(orientation: landscape) and (min-width: 640px) and (max-width: 1279px) and (max-height: 640px)" srcSet="/home-map-base-phone-landscape-3x.webp?v=20260818" />
      <source media="(max-width: 400px)" srcSet="/home-map-base-phone-small-3x.webp?v=20260818" />
      <img src="/home-map-base-phone-large-3x.webp?v=20260818" alt="" loading="eager" decoding="sync" fetchPriority="high" />
    </picture>
  );
}

function HomeMapSourcePreview() {
  const [mapReady, setMapReady] = useState(false);
  return (
    <div className={`punktlandung-home-map-preview${mapReady ? " is-map-ready" : ""}`} data-render-mode="live-map">
      <GuessMap
        mode="results"
        summary={previewSummary}
        guesses={[previewGuess]}
        players={[{
          id: "home-preview-player",
          name: "Dein Tipp",
          color: "#ff4775",
          score: 0,
          connected: true,
          isHost: true,
          team: "aurora",
          status: "active",
          cosmetic: "none"
        }]}
        showLabels
        resultLabelLayout="home-preview"
        resultLabelInset
        resultControlInset
        resultPaddingScale={0.88}
        resultZoomScale={1.2}
        noPan
        noZoom
        onBaseMapReady={() => setMapReady(true)}
      />
      <HomeMapPoster ready={mapReady} />
    </div>
  );
}

export function HomeMapPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const [renderSource, setRenderSource] = useState(false);

  useEffect(() => {
    setRenderSource(new URLSearchParams(window.location.search).get("renderHomeMapSource") === "1");
  }, []);

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

  if (renderSource) return <HomeMapSourcePreview />;

  return (
    <div
      ref={previewRef}
      className="punktlandung-home-map-preview is-map-ready"
      data-render-mode="static-overlay"
      aria-label="Kartenvorschau: Dein Tipp liegt zwei Kilometer vom Brandenburger Tor entfernt."
    >
      <PreviewMapBase />
      <svg className="punktlandung-home-map-static-connector" aria-hidden="true">
        <line ref={connectorRef} className="punktlandung-result-connector is-flowing" />
      </svg>
      <PreviewEllipse actual />
      <PreviewEllipse />
      <PreviewPin actual />
      <PreviewPin />
      <span className="punktlandung-map-label punktlandung-map-label-player punktlandung-home-map-static-label is-player">
        #1 Dein Tipp<span className="punktlandung-map-label-distance"> · {previewDistanceKm} km</span>
      </span>
      <span className="punktlandung-map-label punktlandung-map-label-actual punktlandung-home-map-static-label is-actual">Brandenburger Tor</span>
      <MapAttributionBadge />
    </div>
  );
}
