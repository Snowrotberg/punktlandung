"use client";

import { Marker, Polyline, Popup, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { MapContainerProps } from "react-leaflet";
import { LeafletProvider, createLeafletContext } from "@react-leaflet/core";
import { Map as LeafletMapClass, divIcon, latLngBounds } from "leaflet";
import type { LatLngExpression, Map as LeafletMapInstance, Marker as LeafletMarkerInstance } from "leaflet";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GeoLocation, Guess, LatLng, Player, RoundResult, RoundSummary } from "@/types/game";
import { formatDistance, rankResults } from "@/lib/geo";
import { PLAYER_PALETTE, playerColorAt, playerColorForId } from "@/lib/playerPalette";
import { MapLibreBaseLayer } from "@/components/MapLibreBaseLayer";
import { MapAttributionBadge } from "@/components/MapAttributionBadge";

type LeafletMapProps = {
  mode: "guess" | "results";
  center?: LatLng;
  guess?: LatLng | null;
  players?: Player[];
  guesses?: Guess[];
  summary?: RoundSummary | null;
  disabled?: boolean;
  noPan?: boolean;
  noZoom?: boolean;
  showLabels?: boolean;
  /** Scales the result-map padding; values below 1 zoom the fitted view in. */
  resultPaddingScale?: number;
  /** Applies an exact zoom scale after the normal fitted result view. */
  resultZoomScale?: number;
  /** Uses specialized label anchors for decorative previews or compact account-history maps. */
  resultLabelLayout?: "auto" | "home-preview" | "account-history";
  /** Pulls home-preview badges one third of their width toward the map center. */
  resultLabelInset?: boolean;
  /** Keeps result pins and labels clear of the top-right zoom controls. */
  resultControlInset?: boolean;
  /** Defers the decorative result-connector animation until its poster is ready to fade. */
  animateResultConnector?: boolean;
  currentPlayerColor?: string;
  resizeSignal?: number | string | boolean;
  resetSignal?: number | string | boolean;
  onGuess?: (point: LatLng) => void;
  onBaseMapReady?: () => void;
};

const playerPaletteStyle = Object.fromEntries(
  PLAYER_PALETTE.map((color, index) => [`--player-color-${index}`, color])
) as CSSProperties;

type LabelPlacement = {
  offset: [number, number];
  size: { width: number; height: number };
};

type LabelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type PixelPoint = {
  x: number;
  y: number;
};

function isTerritoryHit(location: GeoLocation, result: RoundResult): boolean {
  return (
    result.countryCorrect &&
    (location.category === "flags" || location.category === "cities" || location.category === "capitals")
  );
}

function territoryHitLabel(location: GeoLocation): string {
  if (location.category === "cities") return "richtige Stadt";
  if (location.category === "capitals") return "richtige Hauptstadt";
  return "richtiges Land";
}

type PixelSegment = {
  a: PixelPoint;
  b: PixelPoint;
};

const PLAYER_ELLIPSE_SIZE = { width: 46, height: 14 };
const ACTUAL_ELLIPSE_SIZE = { width: 58, height: 18 };
const RESULT_MAX_ZOOM = 17;
const GUESS_WORLD_BOUNDS = latLngBounds([
  [-85, -180],
  [85, 180]
]);

function StrictSafeMapContainer({
  bounds,
  boundsOptions,
  center,
  children,
  className,
  id,
  placeholder,
  style,
  whenReady,
  zoom,
  ...options
}: MapContainerProps) {
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const [context, setContext] = useState<ReturnType<typeof createLeafletContext> | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node === null) {
      mapRef.current?.remove();
      mapRef.current = null;
      setContext(null);
      return;
    }

    if (mapRef.current) return;

    const map = new LeafletMapClass(node, options);
    mapRef.current = map;
    if (center != null && zoom != null) {
      map.setView(center, zoom);
    } else if (bounds != null) {
      map.fitBounds(bounds, boundsOptions);
    }
    if (whenReady != null) map.whenReady(whenReady);
    setContext(createLeafletContext(map));
    // Map options and the initial viewport intentionally match react-leaflet's
    // mount-only MapContainer behavior. Later viewport updates use map hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={className} id={id} style={style}>
      {context ? <LeafletProvider value={context}>{children}</LeafletProvider> : placeholder ?? null}
    </div>
  );
}

function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function lngNearestTo(lng: number, referenceLng: number): number {
  let next = normalizeLng(lng);
  while (next - referenceLng > 180) next -= 360;
  while (next - referenceLng < -180) next += 360;
  return next;
}

function displayPointsForShortestWorld(points: LatLng[]): LatLng[] {
  if (points.length <= 1) return points;

  const normalized = points.map((point) => normalizeLng(point.lng)).sort((a, b) => a - b);
  let largestGap = -1;
  let gapIndex = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index] ?? 0;
    const next = index === normalized.length - 1 ? (normalized[0] ?? 0) + 360 : normalized[index + 1] ?? 0;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      gapIndex = index;
    }
  }

  const arcStart = normalized[(gapIndex + 1) % normalized.length] ?? 0;
  return points.map((point) => ({ ...point, lng: lngNearestTo(point.lng, arcStart) }));
}

function pinIcon(color = playerColorAt(0), actual = false) {
  return divIcon({
    className: "punktlandung-pin-icon",
    html: `<div class="punktlandung-map-pin punktlandung-map-pin-vector${actual ? " punktlandung-map-pin-actual" : " punktlandung-map-pin-player"}" style="--pin-color:${color}"><svg viewBox="0 0 32 42" aria-hidden="true"><path class="punktlandung-map-pin-outline" fill-rule="evenodd" d="M16 42C16 42 3 24 3 15C3 6.7 8.8 1 16 1C23.2 1 29 6.7 29 15C29 24 16 42 16 42ZM16 9.75A5.25 5.25 0 1 0 16 20.25A5.25 5.25 0 1 0 16 9.75Z"/><path class="punktlandung-map-pin-fill" fill-rule="evenodd" d="M16 38C16 38 5 23 5 15C5 8.4 9.9 4 16 4C22.1 4 27 8.4 27 15C27 23 16 38 16 38ZM16 8A7 7 0 1 0 16 22A7 7 0 1 0 16 8Z"/><circle class="punktlandung-map-pin-core" cx="16" cy="15" r="7.15"/></svg></div>`,
    iconSize: [30, 42],
    // The player pin path is centered on x=16.  Its old x=15 anchor made
    // the pin sit one pixel to the right of its ellipse.  Keep the target's
    // established anchor unchanged.
    // Keep a small, deliberate air gap between the pin tip and its landing
    // rings, matching the elevated reference marker without looking detached.
    iconAnchor: [actual ? 15 : 16, actual ? 43 : 42],
    popupAnchor: [0, -38]
  });
}

function ellipseIcon(color = playerColorAt(0), actual = false) {
  const { width, height } = actual ? ACTUAL_ELLIPSE_SIZE : PLAYER_ELLIPSE_SIZE;
  const verticalAnchor = height / 2 - (actual ? 3 : 5);
  return divIcon({
    className: "punktlandung-pin-ellipse-icon",
    html: `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" style="--ellipse-color:${color}"><ellipse class="punktlandung-pin-ellipse-outer" cx="${width / 2}" cy="${height / 2}" rx="${width / 2 - 1.25}" ry="${height / 2 - 1.25}"></ellipse><ellipse class="punktlandung-pin-ellipse-middle" cx="${width / 2}" cy="${height / 2}" rx="${(width / 2 - 1.25) * 0.68}" ry="${(height / 2 - 1.25) * 0.68}"></ellipse><ellipse class="punktlandung-pin-ellipse-inner" cx="${width / 2}" cy="${height / 2}" rx="${(width / 2 - 1.25) * 0.38}" ry="${Math.max((height / 2 - 1.25) * 0.38, 0.9)}"></ellipse></svg>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, verticalAnchor]
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function labelIcon(
  label: string,
  className: string,
  placement: LabelPlacement,
  labelHtml?: string,
  edgeAnchor?: "left" | "right",
  insetEdgeAnchor = false,
  interactive = false
) {
  const [dx, dy] = placement.offset;
  const { width, height } = placement.size;
  const homeAnchorClass = className.includes("punktlandung-map-label-actual")
    ? " punktlandung-map-label-marker-actual"
    : className.includes("punktlandung-map-label-player")
      ? " punktlandung-map-label-marker-player"
      : "";
  // Leaflet's icon box is deliberately wider than the rendered badge. For
  // the home preview, an auto margin pins the requested *visible* badge edge
  // to the geographic marker point, independent of text length and viewport.
  const edgeAnchorStyles = [
    edgeAnchor === "right" ? "margin-left:auto" : edgeAnchor === "left" ? "margin-right:auto" : "",
    insetEdgeAnchor && edgeAnchor === "right"
      ? "transform:translateX(33.333%)"
      : insetEdgeAnchor && edgeAnchor === "left"
        ? "transform:translateX(-33.333%)"
        : ""
  ].filter(Boolean);
  const edgeAnchorStyle = edgeAnchorStyles.length ? ` style="${edgeAnchorStyles.join(";")}"` : "";
  return divIcon({
    className: `punktlandung-map-label-marker${homeAnchorClass}${interactive ? " is-interactive" : ""}`,
    html: `<span class="${className}"${edgeAnchorStyle}>${labelHtml ?? escapeHtml(label)}</span>`,
    iconSize: [width, height],
    iconAnchor: [width / 2 - dx, height / 2 - dy],
    // Interactive target labels own their information popover. Anchor the
    // popup to the rendered label center rather than to the geographic pin.
    // This keeps the speech-bubble pointer aligned even when the collision
    // solver moves the label away from the pin.
    popupAnchor: interactive ? [dx, dy] : [0, 0]
  });
}

const actualPinIcon = pinIcon("#5ee7bd", true);

function ClickHandler({ disabled, onGuess }: { disabled?: boolean; onGuess?: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      if (!disabled) onGuess?.({ lat: event.latlng.lat, lng: normalizeLng(event.latlng.lng) });
    }
  });
  return null;
}

function MapInteractionState({ noPan, noZoom }: { noPan?: boolean; noZoom?: boolean }) {
  const map = useMap();

  useEffect(() => {
    const setHandler = (handler: { enable: () => void; disable: () => void } | undefined, locked?: boolean) => {
      if (!handler) return;
      if (locked) handler.disable();
      else handler.enable();
    };

    setHandler(map.dragging, noPan);
    setHandler(map.scrollWheelZoom, noZoom);
    setHandler(map.doubleClickZoom, noZoom);
    setHandler(map.touchZoom, noZoom);
    setHandler(map.boxZoom, noZoom);
    setHandler(map.keyboard, noZoom);
  }, [map, noPan, noZoom]);

  return noZoom ? null : <ZoomControl position="topright" />;
}

function GuessViewportReset({
  center,
  zoom,
  resetSignal
}: {
  center: LatLng;
  zoom: number;
  resetSignal?: number | string | boolean;
}) {
  const map = useMap();

  useEffect(() => {
    try {
      map.setView([center.lat, center.lng], zoom, { animate: false });
      map.invalidateSize(false);
    } catch {
      // The map can be between layout states while the overlay grows or shrinks.
    }
  }, [map, center.lat, center.lng, zoom, resetSignal]);

  return null;
}

function playerColor(players: Player[] | undefined, playerId: string): string {
  return playerColorForId(players, playerId);
}

function guessColor(players: Player[] | undefined, guess?: LatLng | null, fallback = playerColorAt(0)): string {
  if (!guess || !("playerId" in guess) || typeof guess.playerId !== "string") return fallback;
  return playerColor(players, guess.playerId);
}

function playerName(players: Player[] | undefined, playerId: string): string {
  return players?.find((player) => player.id === playerId)?.name ?? "Spieler";
}

function playerColorIndex(players: Player[] | undefined, playerId: string): number {
  const index = players?.findIndex((player) => player.id === playerId) ?? -1;
  return index >= 0 ? index % 10 : 0;
}

function playerColorIndexByColor(color?: string): number {
  const index = PLAYER_PALETTE.findIndex((playerColor) => playerColor === color);
  return index >= 0 ? index % 10 : 0;
}

function MapResizer({ resizeSignal }: { resizeSignal?: number | string | boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame: number | null = null;
    let settleTimer: number | null = null;
    let lastWidth = 0;
    let lastHeight = 0;
    const invalidate = () => {
      try {
        map.invalidateSize(false);
      } catch {
        // Leaflet can briefly outlive its DOM node during mobile orientation changes.
      }
    };
    const schedule = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        invalidate();
      });
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        invalidate();
      }, 140);
    };
    schedule();
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      if (Math.abs(box.width - lastWidth) < 0.5 && Math.abs(box.height - lastHeight) < 0.5) return;
      lastWidth = box.width;
      lastHeight = box.height;
      schedule();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [map]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        map.invalidateSize(false);
      } catch {}
    });
    const settleTimer = window.setTimeout(() => {
      try {
        map.invalidateSize(false);
      } catch {}
    }, 180);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [map, resizeSignal]);

  return null;
}

function resultBoundsPadding(map: LeafletMapInstance, showLabels: boolean, paddingScale = 1): [number, number] {
  const container = map.getContainer();
  const width = container.clientWidth || 360;
  const height = container.clientHeight || 220;

  if (!showLabels) {
    return [
      Math.max(24, Math.max(74, Math.min(132, width * 0.22)) * paddingScale),
      Math.max(24, Math.max(70, Math.min(124, height * 0.28)) * paddingScale)
    ];
  }

  if (width <= 420) {
    return [
      Math.max(24, Math.max(88, Math.min(108, width * 0.27)) * paddingScale),
      Math.max(24, Math.max(98, Math.min(142, height * 0.27)) * paddingScale)
    ];
  }

  return [
    Math.max(24, Math.max(140, Math.min(244, width * 0.28)) * paddingScale),
    Math.max(24, Math.max(102, Math.min(168, height * 0.28)) * paddingScale)
  ];
}

function homePreviewPlacements(mapSize: { x: number; y: number }, locationTitle: string, playerLabel: string) {
  const compact = mapSize.x <= 520 && mapSize.y >= mapSize.x;
  const tv = mapSize.x >= 1000;
  const actualBadgeGap = tv ? 34 : 20;
  const playerBadgeGap = tv ? 72 : 48;
  const scaleForViewport = (size: { width: number; height: number }) => tv
    ? { width: Math.round(size.width * 1.5), height: Math.round(size.height * 1.45) }
    : size;
  const actualDimensions = scaleForViewport(labelSize(locationTitle, true, compact));
  const playerDimensions = scaleForViewport(labelSize(playerLabel, false, compact));
  return {
    actual: {
      // The target label sits below and to the left of the pin. Its visible
      // right edge ends exactly beneath the geographic pin tip.
      offset: [
        -actualDimensions.width / 2,
        actualDimensions.height / 2 + actualBadgeGap
      ] as [number, number],
      size: actualDimensions
    },
    player: {
      // The player label sits above and to the right of the pin. Its visible
      // left edge starts exactly above the pin tip; the remaining vertical
      // gap mirrors the target label's gap beneath the target ellipse.
      offset: [playerDimensions.width / 2, -playerDimensions.height / 2 - playerBadgeGap] as [number, number],
      size: playerDimensions
    }
  };
}

function centerHomePreviewVisuals(map: LeafletMapInstance, summary: RoundSummary, players?: Player[]) {
  const result = rankResults(summary.results).find((item) => item.guess);
  if (!result?.guess) return;

  const displayPoints = displayPointsForShortestWorld([summary.location, result.guess]);
  const displayLocation = displayPoints[0] ?? summary.location;
  const displayGuess = displayPoints[1] ?? result.guess;
  const mapSize = map.getSize();
  const hideDistance = isTerritoryHit(summary.location, result);
  const resultLabel = hideDistance ? territoryHitLabel(summary.location) : formatDistance(result.distanceKm);
  const playerLabel = `#1 ${playerName(players, result.playerId)} · ${resultLabel}`;
  const placements = homePreviewPlacements(mapSize, summary.location.title, playerLabel);
  const locationPoint = map.latLngToContainerPoint([displayLocation.lat, displayLocation.lng]);
  const guessPoint = map.latLngToContainerPoint([displayGuess.lat, displayGuess.lng]);
  const rects = mapSize.x <= 520
    ? [pinBlockRect(map, displayLocation), pinBlockRect(map, displayGuess)]
    : [
        labelRectFor(
          locationPoint,
          placements.actual.size.width,
          placements.actual.size.height,
          placements.actual.offset[0],
          placements.actual.offset[1]
        ),
        labelRectFor(
          guessPoint,
          placements.player.size.width,
          placements.player.size.height,
          placements.player.offset[0],
          placements.player.offset[1]
        ),
        pinBlockRect(map, displayLocation),
        pinBlockRect(map, displayGuess)
      ];
  const visualRect = rects.reduce((combined, rect) => ({
    left: Math.min(combined.left, rect.left),
    top: Math.min(combined.top, rect.top),
    right: Math.max(combined.right, rect.right),
    bottom: Math.max(combined.bottom, rect.bottom)
  }));
  const margin = mapSize.x <= 520 ? 14 : 22;
  const desiredX = mapSize.x / 2 - (visualRect.left + visualRect.right) / 2;
  const desiredY = mapSize.y / 2 - (visualRect.top + visualRect.bottom) / 2;
  const minX = margin - visualRect.left;
  const maxX = mapSize.x - margin - visualRect.right;
  const minY = margin - visualRect.top;
  const maxY = mapSize.y - margin - visualRect.bottom;
  const deltaX = minX <= maxX ? Math.max(minX, Math.min(maxX, desiredX)) : desiredX;
  const deltaY = minY <= maxY ? Math.max(minY, Math.min(maxY, desiredY)) : desiredY;

  map.panBy([-deltaX, -deltaY], { animate: false });
}

function HomePreviewSafeArea({ enabled, onSettled }: { enabled: boolean; onSettled?: () => void }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const container = map.getContainer();
    let timer: number | null = null;
    let activationTimer: number | null = null;
    let fontFallbackTimer: number | null = null;
    let cancelled = false;
    let active = false;
    let correctionAttempts = 0;
    let fitDelayElapsed = false;
    let fontsReady = document.fonts?.status === "loaded" || !document.fonts;

    const schedule = (delay = 0) => {
      // Do not let a stream of Android viewport resize notifications postpone
      // the pending correction forever.
      if (timer !== null) return;
      timer = window.setTimeout(enforce, delay);
    };

    const enforce = () => {
      timer = null;
      if (cancelled || !active) return;

      const containerRect = container.getBoundingClientRect();
      const visualElements = [
        ...container.querySelectorAll<HTMLElement>(".punktlandung-map-label"),
        ...container.querySelectorAll<HTMLElement>(".punktlandung-map-pin"),
        ...container.querySelectorAll<HTMLElement>(".punktlandung-pin-ellipse-icon svg")
      ].filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });

      if (visualElements.length < 6 || containerRect.width <= 0 || containerRect.height <= 0) {
        schedule(100);
        return;
      }
      const visualRect = visualElements
        .map((element) => element.getBoundingClientRect())
        .reduce<LabelRect>((combined, rect) => ({
          left: Math.min(combined.left, rect.left),
          top: Math.min(combined.top, rect.top),
          right: Math.max(combined.right, rect.right),
          bottom: Math.max(combined.bottom, rect.bottom)
        }), { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });
      const desiredInsetX = Math.max(16, Math.min(28, containerRect.width * 0.045));
      // Desktop preview cards are deliberately shallow. A proportional
      // vertical inset would leave less room than the fixed-height labels and
      // could therefore never converge, even at minimum zoom.
      const desiredInsetY = Math.max(12, Math.min(20, containerRect.height * 0.05));
      const visualWidth = visualRect.right - visualRect.left;
      const visualHeight = visualRect.bottom - visualRect.top;
      const atMinimumZoom = map.getZoom() <= map.getMinZoom() + 0.05;
      const insetX = atMinimumZoom
        ? Math.max(4, Math.min(desiredInsetX, (containerRect.width - visualWidth) / 2))
        : desiredInsetX;
      const insetY = atMinimumZoom
        ? Math.max(4, Math.min(desiredInsetY, (containerRect.height - visualHeight) / 2))
        : desiredInsetY;
      const safeWidth = containerRect.width - insetX * 2;
      const safeHeight = containerRect.height - insetY * 2;

      // Labels have device-dependent text metrics. Zoom based on their real
      // rendered bounds instead of assuming a fixed phone width or font size.
      if ((visualWidth > safeWidth + 0.5 || visualHeight > safeHeight + 0.5) && map.getZoom() > map.getMinZoom() + 0.05) {
        correctionAttempts += 1;
        const requiredScale = Math.min(safeWidth / visualWidth, safeHeight / visualHeight);
        const zoomStep = correctionAttempts >= 12
          ? map.getMinZoom() - map.getZoom()
          : Math.max(-0.45, Math.min(-0.08, Math.log2(Math.max(0.72, requiredScale))));
        map.setZoom(Math.max(map.getMinZoom(), map.getZoom() + zoomStep), { animate: false });
        schedule(100);
        return;
      }

      const safeLeft = containerRect.left + insetX;
      const safeRight = containerRect.right - insetX;
      const safeTop = containerRect.top + insetY;
      const safeBottom = containerRect.bottom - insetY;
      let translateX = 0;
      let translateY = 0;

      if (visualRect.left < safeLeft) translateX = safeLeft - visualRect.left;
      if (visualRect.right + translateX > safeRight) translateX += safeRight - (visualRect.right + translateX);
      if (visualRect.top < safeTop) translateY = safeTop - visualRect.top;
      if (visualRect.bottom + translateY > safeBottom) translateY += safeBottom - (visualRect.bottom + translateY);

      if (Math.abs(translateX) > 0.5 || Math.abs(translateY) > 0.5) {
        correctionAttempts += 1;
        map.panBy([-translateX, -translateY], { animate: false });
        schedule(100);
        return;
      }

      // No further camera operation is queued, so this measured frame is the
      // final one. The separate QA stability window verifies it stays fixed.
      active = false;
      onSettled?.();
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!active) return;
      schedule(100);
    });
    resizeObserver.observe(container);
    const activateWhenReady = () => {
      if (cancelled || active || !fitDelayElapsed || !fontsReady) return;
      active = true;
      schedule(0);
    };
    document.fonts?.ready.then(() => {
      fontsReady = true;
      activateWhenReady();
    }).catch(() => {});
    // ResultBounds performs its final compatibility fit at 980 ms. Start the
    // measured correction only after that sequence, never concurrently.
    activationTimer = window.setTimeout(() => {
      fitDelayElapsed = true;
      activateWhenReady();
    }, 1120);
    fontFallbackTimer = window.setTimeout(() => {
      fontsReady = true;
      activateWhenReady();
    }, 2000);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (activationTimer !== null) window.clearTimeout(activationTimer);
      if (fontFallbackTimer !== null) window.clearTimeout(fontFallbackTimer);
      resizeObserver.disconnect();
    };
  }, [enabled, map, onSettled]);

  return null;
}

function ResultBounds({
  summary,
  players,
  showLabels,
  resultPaddingScale,
  resultZoomScale,
  resizeSignal,
  resultLabelLayout,
  resultControlInset
}: {
  summary?: RoundSummary | null;
  players?: Player[];
  showLabels: boolean;
  resultPaddingScale?: number;
  resultZoomScale?: number;
  resizeSignal?: number | string | boolean;
  resultLabelLayout?: "auto" | "home-preview" | "account-history";
  resultControlInset?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!summary) return;
    const points = resultPoints(summary);
    if (points.length === 1) {
      try {
        map.setView(points[0], RESULT_MAX_ZOOM, { animate: false });
      } catch {}
      return;
    }
    const bounds = latLngBounds(points);
    const container = map.getContainer();
    let frame: number | null = null;
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    const fit = () => {
      try {
        // Do not let the delayed compatibility fits undo Leaflet's auto-pan
        // after a user has opened the location information popover.
        if (map.getContainer().querySelector(".punktlandung-location-info-popup")) return;
        map.invalidateSize(false);
        const previousZoomSnap = map.options.zoomSnap;
        map.options.zoomSnap = 1;
        const [paddingX, fittedPaddingY] = resultBoundsPadding(map, showLabels, resultPaddingScale);
        const paddingY = resultControlInset
          ? Math.max(fittedPaddingY, Math.min(104, container.clientHeight * 0.4))
          : fittedPaddingY;
        const controlInset = resultControlInset ? Math.min(76, Math.max(58, container.clientWidth * 0.22)) : 0;
        map.fitBounds(bounds, {
          animate: false,
          paddingTopLeft: [paddingX, paddingY],
          paddingBottomRight: [paddingX + controlInset, paddingY],
          maxZoom: RESULT_MAX_ZOOM
        });
        if (resultZoomScale && resultZoomScale !== 1) {
          const fittedZoom = map.getZoom();
          map.options.zoomSnap = 0.01;
          map.setZoom(fittedZoom + Math.log2(resultZoomScale), { animate: false });
        }
        map.options.zoomSnap = previousZoomSnap;
        if (resultLabelLayout === "home-preview") {
          centerHomePreviewVisuals(map, summary, players);
        }
      } catch {
        // Map can be mid-unmount while switching round/result layouts.
      }
    };
    const scheduleFit = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        fit();
      });
    };
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      if (Math.abs(box.width - lastWidth) < 0.5 && Math.abs(box.height - lastHeight) < 0.5) return;
      lastWidth = box.width;
      lastHeight = box.height;
      scheduleFit();
    });
    observer.observe(container);
    scheduleFit();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [map, summary, players, showLabels, resultPaddingScale, resultZoomScale, resizeSignal, resultLabelLayout, resultControlInset]);

  return null;
}

function resultPoints(summary?: RoundSummary | null): LatLngExpression[] {
  if (!summary) return [];
  const rawPoints: LatLng[] = [summary.location];
  for (const result of summary.results) {
    if (result.guess) rawPoints.push(result.guess);
  }
  if (summary.crewGuess) rawPoints.push(summary.crewGuess);
  return displayPointsForShortestWorld(rawPoints).map((point) => [point.lat, point.lng]);
}

function rectanglesOverlap(a: LabelRect, b: LabelRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function overlapArea(a: LabelRect, b: LabelRect) {
  if (!rectanglesOverlap(a, b)) return 0;
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return Math.max(0, width) * Math.max(0, height);
}

function labelSize(label: string, actual = false, compact = false) {
  const maxWidth = compact ? (actual ? 168 : 160) : actual ? 286 : 244;
  const minWidth = compact ? (actual ? 104 : 132) : actual ? 110 : 154;
  const width = Math.min(maxWidth, Math.max(minWidth, Math.round(label.length * (actual ? 9.4 : 8.2)) + 42));
  return { width, height: compact ? 40 : actual ? 46 : 44 };
}

function paddedRect(rect: LabelRect, padding: number): LabelRect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding
  };
}

function placementCandidates(
  width: number,
  height: number,
  actual = false,
  preferredVector?: PixelPoint,
  compact = false
): Array<{ dx: number; dy: number }> {
  const horizontal = width / 2 + (actual ? 6 : 9);
  const vertical = height / 2 + (actual ? 8 : 10);
  const rings = compact
    ? (actual ? [0, 8, 18, 30, 48, 68] : [0, 8, 18, 30, 44, 60, 80, 110])
    : actual ? [0, 5, 10, 20, 34] : [0, 6, 12, 20, 34, 52];
  const laneShifts = compact ? (actual ? [0, -8, 8, -16, 16] : [0, -8, 8, -18, 18]) : actual ? [0, -5, 5] : [0, -6, 6, -12, 12];
  const quadrants = [
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ];
  const all: Array<{ dx: number; dy: number }> = [];
  const seen = new Set<string>();

  for (const ring of rings) {
    for (const quadrant of quadrants) {
      for (const lane of laneShifts) {
        const dx = quadrant.x * (horizontal + ring) + lane;
        const dy = quadrant.y * (vertical + ring * 0.62);
        const key = `${Math.round(dx)}:${Math.round(dy)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({ dx, dy });
      }
    }

    if (compact) {
      const straight = [
        { dx: horizontal + ring, dy: 0 },
        { dx: -(horizontal + ring), dy: 0 },
        { dx: 0, dy: vertical + ring },
        { dx: 0, dy: -(vertical + ring) }
      ];
      for (const candidate of straight) {
        const key = `${Math.round(candidate.dx)}:${Math.round(candidate.dy)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(candidate);
      }
    }
  }

  if (!preferredVector || (preferredVector.x === 0 && preferredVector.y === 0)) return all;

  return all.sort((a, b) => {
    const dotA = a.dx * preferredVector.x + a.dy * preferredVector.y;
    const dotB = b.dx * preferredVector.x + b.dy * preferredVector.y;
    const distanceA = Math.hypot(a.dx, a.dy);
    const distanceB = Math.hypot(b.dx, b.dy);
    return dotB - dotA || distanceA - distanceB;
  });
}

function labelRectFor(point: { x: number; y: number }, width: number, height: number, dx: number, dy: number): LabelRect {
  const centerX = point.x + dx;
  const centerY = point.y + dy;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2
  };
}

function viewportOverflow(rect: LabelRect, width: number, height: number, margin = 10) {
  return (
    Math.max(0, margin - rect.left) +
    Math.max(0, rect.right - (width - margin)) +
    Math.max(0, margin - rect.top) +
    Math.max(0, rect.bottom - (height - margin))
  );
}

function clampLabelPlacementToViewport(
  anchor: PixelPoint,
  placement: LabelPlacement,
  viewportWidth: number,
  viewportHeight: number,
  margin = 30,
  rightMargin = margin
): { placement: LabelPlacement; rect: LabelRect } {
  const { width, height } = placement.size;
  const centerX = anchor.x + placement.offset[0];
  const centerY = anchor.y + placement.offset[1];
  const minCenterX = margin + width / 2;
  const maxCenterX = Math.max(minCenterX, viewportWidth - rightMargin - width / 2);
  const minCenterY = margin + height / 2;
  const maxCenterY = Math.max(minCenterY, viewportHeight - margin - height / 2);
  const clampedCenterX = Math.min(Math.max(centerX, minCenterX), maxCenterX);
  const clampedCenterY = Math.min(Math.max(centerY, minCenterY), maxCenterY);
  const nextPlacement = {
    offset: [clampedCenterX - anchor.x, clampedCenterY - anchor.y] as [number, number],
    size: placement.size
  };

  return {
    placement: nextPlacement,
    rect: labelRectFor(anchor, width, height, nextPlacement.offset[0], nextPlacement.offset[1])
  };
}

function pointInRect(point: PixelPoint, rect: LabelRect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function ccw(a: PixelPoint, b: PixelPoint, c: PixelPoint) {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: PixelPoint, b: PixelPoint, c: PixelPoint, d: PixelPoint) {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function segmentIntersectsRect(segment: PixelSegment, rect: LabelRect) {
  if (pointInRect(segment.a, rect) || pointInRect(segment.b, rect)) return true;

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomLeft = { x: rect.left, y: rect.bottom };
  const bottomRight = { x: rect.right, y: rect.bottom };

  return (
    segmentsIntersect(segment.a, segment.b, topLeft, topRight) ||
    segmentsIntersect(segment.a, segment.b, topRight, bottomRight) ||
    segmentsIntersect(segment.a, segment.b, bottomRight, bottomLeft) ||
    segmentsIntersect(segment.a, segment.b, bottomLeft, topLeft)
  );
}

function distancePointToSegment(point: PixelPoint, segment: PixelSegment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - segment.a.x, point.y - segment.a.y);

  const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared));
  const projectionX = segment.a.x + t * dx;
  const projectionY = segment.a.y + t * dy;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function trimSegment(segment: PixelSegment, trimStart = 0, trimEnd = 0): PixelSegment {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const length = Math.hypot(dx, dy);
  if (length <= trimStart + trimEnd || length === 0) return segment;
  const unitX = dx / length;
  const unitY = dy / length;
  return {
    a: { x: segment.a.x + unitX * trimStart, y: segment.a.y + unitY * trimStart },
    b: { x: segment.b.x - unitX * trimEnd, y: segment.b.y - unitY * trimEnd }
  };
}

function distancePointToRect(point: PixelPoint, rect: LabelRect) {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

function rectLinePenalty(rect: LabelRect, segment: PixelSegment) {
  if (segmentIntersectsRect(segment, rect)) return 22000;

  const samplePoints: PixelPoint[] = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.left, y: rect.bottom },
    { x: rect.right, y: rect.bottom },
    { x: (rect.left + rect.right) / 2, y: rect.top },
    { x: (rect.left + rect.right) / 2, y: rect.bottom },
    { x: rect.left, y: (rect.top + rect.bottom) / 2 },
    { x: rect.right, y: (rect.top + rect.bottom) / 2 },
    { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
  ];

  let minDistance = Math.min(distancePointToRect(segment.a, rect), distancePointToRect(segment.b, rect));
  for (const point of samplePoints) {
    minDistance = Math.min(minDistance, distancePointToSegment(point, segment));
  }

  if (minDistance >= 16) return 0;
  return (16 - minDistance) * 420;
}

function resultTooltipPlacement(
  map: LeafletMapInstance,
  point: LatLng,
  label: string,
  occupied: LabelRect[],
  blockedSegments: PixelSegment[],
  actual = false,
  preferredVector?: PixelPoint,
  controlInset = false,
  strictVerticalSide = false
): { placement: LabelPlacement; rect: LabelRect } {
  const pixel = map.latLngToContainerPoint([point.lat, point.lng]);
  const size = map.getSize();
  const compact = size.x <= 520 && size.y >= size.x;
  const dimensions = labelSize(label, actual, compact);
  const candidates = placementCandidates(dimensions.width, dimensions.height, actual, preferredVector, compact);
  const viewportMargin = compact ? 18 : 30;
  const pinRect: LabelRect = {
    left: pixel.x - 28,
    top: pixel.y - 56,
    right: pixel.x + 28,
    bottom: pixel.y + 20
  };

  let best:
    | {
        placement: LabelPlacement;
        rect: LabelRect;
        score: number;
      }
    | undefined;
  let bestClean:
    | {
        placement: LabelPlacement;
        rect: LabelRect;
        score: number;
      }
    | undefined;

  for (const [index, candidate] of candidates.entries()) {
    const { placement, rect } = clampLabelPlacementToViewport(
      pixel,
      { offset: [candidate.dx, candidate.dy], size: dimensions },
      size.x,
      size.y,
      viewportMargin,
      controlInset ? Math.min(82, Math.max(viewportMargin, size.x * 0.28)) : viewportMargin
    );
    const overflow = viewportOverflow(rect, size.x, size.y, viewportMargin);
    const overlap = occupied.reduce((sum, other) => sum + overlapArea(rect, other), 0);
    const pinOverlap = overlapArea(rect, pinRect);
    const linePenalty = blockedSegments.reduce((sum, segment) => sum + rectLinePenalty(rect, segment), 0);
    const anchorDistance = Math.hypot(placement.offset[0], placement.offset[1]);
    const preferredPenalty = preferredVector
      ? Math.max(0, -(placement.offset[0] * preferredVector.x + placement.offset[1] * preferredVector.y)) * (actual ? 6 : 10)
      : 0;
    const verticalSidePenalty = strictVerticalSide && preferredVector?.y
      ? Math.max(0, -(placement.offset[1] * preferredVector.y)) * 1200
      : 0;
    const hasHardConflict = overflow > 0 || overlap > 0 || pinOverlap > 0 || linePenalty > 0;
    const cleanNearBonus = !hasHardConflict && anchorDistance < (actual ? 96 : 112) ? -3600 : 0;
    const score =
      overflow * 42000 +
      overlap * 28000 +
      pinOverlap * 52000 +
      linePenalty +
      verticalSidePenalty +
      preferredPenalty * (actual ? 0.35 : 2.4) +
      anchorDistance * (actual ? 3.2 : 3.6) +
      (actual && placement.offset[1] > 0 ? placement.offset[1] * 0.38 : Math.abs(placement.offset[1]) * 0.12) +
      index * 2 +
      cleanNearBonus;

    if (!best || score < best.score) {
      best = {
        placement,
        rect,
        score
      };
    }

    if (!hasHardConflict && (!bestClean || score < bestClean.score)) {
      bestClean = { placement, rect, score };
    }
  }

  if (bestClean) return bestClean;
  return best ?? { placement: { offset: [0, 0], size: dimensions }, rect: pinRect };
}

function pinBlockRect(map: LeafletMapInstance, point: LatLng): LabelRect {
  const pixel = map.latLngToContainerPoint([point.lat, point.lng]);
  return {
    left: pixel.x - 28,
    top: pixel.y - 56,
    right: pixel.x + 28,
    bottom: pixel.y + 20
  };
}

function vectorAwayFrom(from: PixelPoint, to: PixelPoint): PixelPoint {
  const x = from.x - to.x;
  const y = from.y - to.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function blendedVector(vectors: Array<{ vector: PixelPoint; weight: number }>): PixelPoint {
  const combined = vectors.reduce(
    (sum, item) => ({
      x: sum.x + item.vector.x * item.weight,
      y: sum.y + item.vector.y * item.weight
    }),
    { x: 0, y: 0 }
  );
  const length = Math.hypot(combined.x, combined.y);
  if (length < 0.001) return { x: 1, y: -0.35 };
  return { x: combined.x / length, y: combined.y / length };
}

function ResultMarker({
  point,
  label,
  labelHtml,
  className,
  placement,
  edgeAnchor,
  insetEdgeAnchor,
  description,
  zIndexOffset = 0
}: {
  point: LatLng;
  label: string;
  labelHtml?: string;
  className: string;
  placement: LabelPlacement;
  edgeAnchor?: "left" | "right";
  insetEdgeAnchor?: boolean;
  description?: string;
  zIndexOffset?: number;
}) {
  const map = useMap();
  const markerRef = useRef<LeafletMarkerInstance | null>(null);
  const pinnedRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const mapSize = map.getSize();
  const compactPortraitPopup = mapSize.x <= 480 && mapSize.x <= mapSize.y;
  const compactLandscapePopup = mapSize.x <= 960 && mapSize.x > mapSize.y;
  const popupWidth = compactPortraitPopup
    ? Math.max(210, Math.min(252, mapSize.x - 72))
    : compactLandscapePopup
      ? 224
      : 260;
  const markerPixel = map.latLngToContainerPoint([point.lat, point.lng]);
  const labelCenterY = markerPixel.y + placement.offset[1];
  const estimatedPopupHeight = compactPortraitPopup ? 172 : 132;
  const openBelowLabel = labelCenterY - placement.size.height / 2 < estimatedPopupHeight + 28;
  const popupVerticalOffset = openBelowLabel
    ? placement.size.height / 2 + 14 + estimatedPopupHeight
    : -placement.size.height / 2 - 14;

  const cancelScheduledClose = () => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (!pinnedRef.current) markerRef.current?.closePopup();
    }, 180);
  };

  useEffect(() => {
    if (!description) return;
    const markerElement = markerRef.current?.getElement();
    const openOnFocus = () => {
      cancelScheduledClose();
      markerRef.current?.openPopup();
    };
    const closeOnBlur = scheduleClose;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pinnedRef.current = false;
      cancelScheduledClose();
      markerRef.current?.closePopup();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pinnedRef.current || !(event.target instanceof Element)) return;
      if (markerElement?.contains(event.target) || event.target.closest(".punktlandung-location-info-popup")) return;
      pinnedRef.current = false;
      cancelScheduledClose();
      markerRef.current?.closePopup();
    };
    markerElement?.addEventListener("focus", openOnFocus);
    markerElement?.addEventListener("blur", closeOnBlur);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      markerElement?.removeEventListener("focus", openOnFocus);
      markerElement?.removeEventListener("blur", closeOnBlur);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      cancelScheduledClose();
    };
  }, [description]);

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={labelIcon(label, className, placement, labelHtml, edgeAnchor, insetEdgeAnchor, Boolean(description))}
      interactive={Boolean(description)}
      keyboard={Boolean(description)}
      title={description ? `${label}: Zusatzinformationen anzeigen` : undefined}
      alt={description ? `${label}: Zusatzinformationen anzeigen` : label}
      eventHandlers={description ? {
        mouseover: () => {
          cancelScheduledClose();
          markerRef.current?.openPopup();
        },
        mouseout: scheduleClose,
        click: () => {
          cancelScheduledClose();
          pinnedRef.current = !pinnedRef.current;
          if (pinnedRef.current) markerRef.current?.openPopup();
          else markerRef.current?.closePopup();
        }
      } : undefined}
      zIndexOffset={zIndexOffset}
    >
      {description && (
        <Popup
          className={`punktlandung-location-info-popup${openBelowLabel ? " is-below-label" : ""}`}
          offset={[0, popupVerticalOffset]}
          minWidth={popupWidth}
          maxWidth={compactPortraitPopup || compactLandscapePopup ? popupWidth : 320}
          autoPan
          autoPanPadding={[32, 32]}
          keepInView
          closeButton
          eventHandlers={{
            mouseover: cancelScheduledClose,
            mouseout: scheduleClose
          }}
        >
          <strong>{label}</strong>
          <span>{description}</span>
        </Popup>
      )}
    </Marker>
  );
}

function ResultsMarkers({
  summary,
  players,
  guesses,
  showLabels,
  resultLabelLayout,
  resultLabelInset,
  resultControlInset,
  animateResultConnector = true,
  resizeSignal
}: {
  summary?: RoundSummary | null;
  players?: Player[];
  guesses: Guess[];
  showLabels: boolean;
  resultLabelLayout?: "auto" | "home-preview" | "account-history";
  resultLabelInset?: boolean;
  resultControlInset?: boolean;
  animateResultConnector?: boolean;
  resizeSignal?: number | string | boolean;
}) {
  const map = useMap();
  const [viewportVersion, setViewportVersion] = useState(0);
  const location = summary?.location;
  const rankedResults = useMemo(() => (summary ? rankResults(summary.results) : []), [summary]);
  const displayGeometry = useMemo(() => {
    if (!location) return null;
    const sourcePoints: LatLng[] = [location, ...rankedResults.flatMap((result) => (result.guess ? [result.guess] : [])), ...guesses];
    const displayPoints = displayPointsForShortestWorld(sourcePoints);
    let cursor = 0;
    const displayLocation = displayPoints[cursor++] ?? location;
    const resultGuesses = new Map<string, LatLng>();
    for (const result of rankedResults) {
      if (!result.guess) continue;
      resultGuesses.set(result.playerId, displayPoints[cursor++] ?? result.guess);
    }
    const displayGuesses = guesses.map((guess) => ({ ...guess, lng: displayPoints[cursor++]?.lng ?? guess.lng }));
    return { location: displayLocation, resultGuesses, guesses: displayGuesses };
  }, [location, rankedResults, guesses]);

  useMapEvents({
    moveend() {
      setViewportVersion((value) => value + 1);
    },
    zoomend() {
      setViewportVersion((value) => value + 1);
    },
    resize() {
      setViewportVersion((value) => value + 1);
    }
  });

  const placements = useMemo(() => {
    if (!showLabels || !location || !displayGeometry) {
      return { actual: null as LabelPlacement | null, players: new Map<string, LabelPlacement>() };
    }

    const occupied: LabelRect[] = [];
    const playerPlacements = new Map<string, LabelPlacement>();
    const mapSize = map.getSize();
    const mapCenter = { x: mapSize.x / 2, y: mapSize.y / 2 };
    const displayLocation = displayGeometry.location;
    const locationPoint = map.latLngToContainerPoint([displayLocation.lat, displayLocation.lng]);
    const accountHistoryLayout = resultLabelLayout === "account-history";
    const firstGuess = rankedResults[0]
      ? displayGeometry.resultGuesses.get(rankedResults[0].playerId)
      : undefined;
    const firstGuessPoint = firstGuess
      ? map.latLngToContainerPoint([firstGuess.lat, firstGuess.lng])
      : null;
    const blockedSegments: PixelSegment[] = rankedResults.flatMap((result) => {
      const displayGuess = displayGeometry.resultGuesses.get(result.playerId);
      if (!result.guess || !displayGuess) return [];
      if (isTerritoryHit(location, result)) return [];
      const guessPoint = map.latLngToContainerPoint([displayGuess.lat, displayGuess.lng]);
      return [{ a: { x: guessPoint.x, y: guessPoint.y }, b: { x: locationPoint.x, y: locationPoint.y } }];
    });

    if (resultControlInset) {
      occupied.push({
        left: Math.max(0, mapSize.x - 82),
        top: 0,
        right: mapSize.x,
        bottom: Math.min(mapSize.y, 132)
      });
    }

    for (const result of rankedResults) {
      const displayGuess = displayGeometry.resultGuesses.get(result.playerId);
      if (displayGuess) occupied.push(paddedRect(pinBlockRect(map, displayGuess), 8));
    }

    const homePlacements = homePreviewPlacements(
      mapSize,
      location.title,
      rankedResults[0]
        ? `#1 ${playerName(players, rankedResults[0].playerId)} · ${
            isTerritoryHit(location, rankedResults[0])
              ? territoryHitLabel(location)
              : formatDistance(rankedResults[0].distanceKm)
          }`
        : ""
    );
    const actualDimensions = homePlacements.actual.size;
    const actualPlacement = resultLabelLayout === "home-preview"
      ? {
          placement: homePlacements.actual,
          rect: labelRectFor(
            locationPoint,
            actualDimensions.width,
            actualDimensions.height,
            homePlacements.actual.offset[0],
            homePlacements.actual.offset[1]
          )
        }
      : resultTooltipPlacement(
      map,
      displayLocation,
      location.title,
      occupied,
      blockedSegments.map((segment) => trimSegment(segment, 0, 54)),
      true,
      accountHistoryLayout && firstGuessPoint
        ? { x: 0, y: locationPoint.y <= firstGuessPoint.y ? -1 : 1 }
        : undefined,
      resultControlInset,
      accountHistoryLayout
    );
    occupied.push(paddedRect(actualPlacement.rect, 12));
    occupied.push(paddedRect(pinBlockRect(map, displayLocation), 8));

    for (const [index, result] of rankedResults.entries()) {
      const displayGuess = displayGeometry.resultGuesses.get(result.playerId);
      if (!result.guess || !displayGuess) continue;
      const guessPoint = map.latLngToContainerPoint([displayGuess.lat, displayGuess.lng]);
      const hideDistance = isTerritoryHit(location, result);
      const resultLabel = hideDistance ? territoryHitLabel(location) : formatDistance(result.distanceKm);
      const label = `#${index + 1} ${playerName(players, result.playerId)} · ${resultLabel}`;
      const outwardVector = vectorAwayFrom(guessPoint, mapCenter);
      const targetVector = vectorAwayFrom(guessPoint, locationPoint);
      const preferredVector = accountHistoryLayout
        ? { x: 0, y: guessPoint.y <= locationPoint.y ? -1 : 1 }
        : blendedVector([
            { vector: outwardVector, weight: 1.85 },
            { vector: targetVector, weight: 1.15 }
          ]);
      const playerDimensions = labelSize(label, false, mapSize.x <= 520 && mapSize.y >= mapSize.x);
      const placement = resultLabelLayout === "home-preview"
        ? {
            placement: homePlacements.player,
            rect: labelRectFor(
              guessPoint,
              playerDimensions.width,
              playerDimensions.height,
              homePlacements.player.offset[0],
              homePlacements.player.offset[1]
            )
          }
        : resultTooltipPlacement(
        map,
        displayGuess,
        label,
        occupied,
        blockedSegments,
        false,
        preferredVector,
        resultControlInset,
        accountHistoryLayout
      );
      occupied.push(paddedRect(placement.rect, 12));
      playerPlacements.set(result.playerId, placement.placement);
    }

    return { actual: actualPlacement.placement, players: playerPlacements };
  }, [showLabels, location, rankedResults, map, players, viewportVersion, resizeSignal, displayGeometry, resultLabelLayout, resultLabelInset, resultControlInset]);

  return (
    <>
      {location &&
        rankedResults.map((result, index) => {
          const point = displayGeometry?.resultGuesses.get(result.playerId) ?? result.guess;
          if (!point) return null;
          const color = playerColor(players, result.playerId);
          const colorIndex = playerColorIndex(players, result.playerId);
          const hideDistance = isTerritoryHit(location, result);
          const resultLabel = hideDistance ? territoryHitLabel(location) : formatDistance(result.distanceKm);
          const playerLabelPrefix = `#${index + 1} ${playerName(players, result.playerId)}`;
          const playerLabel = `${playerLabelPrefix} · ${resultLabel}`;
          const playerLabelHtml = `${escapeHtml(playerLabelPrefix)}<span class="punktlandung-map-label-distance"> · ${escapeHtml(resultLabel)}</span>`;
          const placement = placements.players.get(result.playerId);

          return (
            <Fragment key={result.playerId}>
              {!hideDistance && (
                <FlowingResultConnector
                  color={color}
                  animate={animateResultConnector}
                  positions={[
                    [point.lat, point.lng],
                    [displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]
                  ]}
                />
              )}
              {showLabels && placement ? (
                <>
                  <Marker position={[point.lat, point.lng]} icon={pinIcon(color)} />
                  <ResultMarker
                    point={point}
                    label={playerLabel}
                    labelHtml={playerLabelHtml}
                    className={`punktlandung-map-label punktlandung-map-label-player punktlandung-player-color-${colorIndex}`}
                    placement={placement}
                    edgeAnchor={resultLabelLayout === "home-preview" ? "left" : undefined}
                    insetEdgeAnchor={resultLabelInset}
                  />
                </>
              ) : (
                <Marker position={[point.lat, point.lng]} icon={pinIcon(color)} />
              )}
            </Fragment>
          );
        })}

      {(displayGeometry?.guesses ?? guesses).map((point) => {
        const color = playerColor(players, point.playerId);
        return (
          <Marker
            key={`${point.playerId}-${point.createdAt}`}
            position={[point.lat, point.lng]}
            icon={ellipseIcon(color)}
            interactive={false}
            zIndexOffset={-1000}
          />
        );
      })}

      {location &&
        (showLabels && placements.actual ? (
          <>
            <Marker
              position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]}
              icon={ellipseIcon("#5ee7bd", true)}
              interactive={false}
              zIndexOffset={-900}
            />
            <Marker position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]} icon={actualPinIcon} zIndexOffset={1000} />
            <ResultMarker
              point={displayGeometry?.location ?? location}
              label={location.title}
              className="punktlandung-map-label punktlandung-map-label-actual"
              placement={placements.actual}
              edgeAnchor={resultLabelLayout === "home-preview" ? "right" : undefined}
              insetEdgeAnchor={resultLabelInset}
              description={resultLabelLayout === "home-preview" ? undefined : location.shortDescription}
              zIndexOffset={1000}
            />
          </>
        ) : (
          <>
            <Marker
              position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]}
              icon={ellipseIcon("#5ee7bd", true)}
              interactive={false}
              zIndexOffset={-900}
            />
            <Marker position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]} icon={actualPinIcon} zIndexOffset={1000} />
          </>
        ))}
    </>
  );
}

type FlowingResultConnectorProps = {
  color: string;
  animate?: boolean;
  positions: [LatLngExpression, LatLngExpression];
};

function FlowingResultConnector({ color, animate = true, positions }: FlowingResultConnectorProps) {
  const map = useMap();
  const [playerPosition, targetPosition] = positions;
  const playerAnchor = map.latLngToContainerPoint(playerPosition);
  const targetAnchor = map.latLngToContainerPoint(targetPosition);
  const playerEllipseCenter = {
    x: playerAnchor.x,
    y: playerAnchor.y + 5
  };
  const targetEllipseCenter = {
    x: targetAnchor.x,
    y: targetAnchor.y + 3
  };
  const direction = {
    x: targetEllipseCenter.x - playerEllipseCenter.x,
    y: targetEllipseCenter.y - playerEllipseCenter.y
  };
  const directionLength = Math.hypot(direction.x, direction.y);
  const unitDirection =
    directionLength > 0
      ? { x: direction.x / directionLength, y: direction.y / directionLength }
      : { x: 0, y: 0 };
  const playerEllipseRadius =
    directionLength > 0
      ? 1 /
        Math.sqrt(
          (unitDirection.x * unitDirection.x) / Math.pow(PLAYER_ELLIPSE_SIZE.width / 2, 2) +
            (unitDirection.y * unitDirection.y) / Math.pow(PLAYER_ELLIPSE_SIZE.height / 2, 2)
        )
      : 0;
  const targetEllipseRadius =
    directionLength > 0
      ? 1 /
        Math.sqrt(
          (unitDirection.x * unitDirection.x) / Math.pow(ACTUAL_ELLIPSE_SIZE.width / 2, 2) +
            (unitDirection.y * unitDirection.y) / Math.pow(ACTUAL_ELLIPSE_SIZE.height / 2, 2)
        )
      : 0;
  // Keep the animated connector visibly clear of both pin ellipses.  The
  // previous 3px gap made the dash endpoints look cramped on result and
  // replay maps, especially at laptop/TV scales.
  const connectorGap = 10;
  const visiblePlayer = map.containerPointToLatLng([
    playerEllipseCenter.x + unitDirection.x * (playerEllipseRadius + connectorGap),
    playerEllipseCenter.y + unitDirection.y * (playerEllipseRadius + connectorGap)
  ]);
  const visibleTarget = map.containerPointToLatLng([
    targetEllipseCenter.x - unitDirection.x * (targetEllipseRadius + connectorGap),
    targetEllipseCenter.y - unitDirection.y * (targetEllipseRadius + connectorGap)
  ]);
  const requiredLength = playerEllipseRadius + targetEllipseRadius + connectorGap * 2;
  const visiblePositions: LatLngExpression[] = directionLength > requiredLength ? [visiblePlayer, visibleTarget] : [];

  return (
    <Polyline
      className={`punktlandung-result-connector${animate ? " is-flowing" : ""}`}
      positions={visiblePositions}
      interactive={false}
      pathOptions={{
        color,
        opacity: 0.82,
        weight: 1.375,
        dashArray: "6 9",
        lineCap: "round"
      }}
    />
  );
}

export function LeafletMap({
  mode,
  center = { lat: 20, lng: 0 },
  guess,
  players,
  guesses = [],
  summary,
  disabled,
  noPan,
  noZoom,
  showLabels = true,
  resultPaddingScale,
  resultZoomScale,
  resultLabelLayout,
  resultLabelInset,
  resultControlInset,
  animateResultConnector = true,
  currentPlayerColor,
  resizeSignal,
  resetSignal,
  onGuess,
  onBaseMapReady
}: LeafletMapProps) {
  const mapCenter: LatLngExpression = [center.lat, center.lng];
  const initialResultPoints = mode === "results" ? resultPoints(summary) : [];
  const initialBounds = initialResultPoints.length > 1 ? latLngBounds(initialResultPoints) : null;
  const maxZoom = mode === "results" ? RESULT_MAX_ZOOM : 14;
  const guessOverviewZoom = 2;
  const guessColorIndex = playerColorIndexByColor(currentPlayerColor);
  const restrictToSingleWorld = mode === "guess";

  return (
    <div className="punktlandung-map-shell" style={playerPaletteStyle}>
      <StrictSafeMapContainer
      {...(initialBounds
        ? { bounds: initialBounds, boundsOptions: { padding: [56, 56], maxZoom } }
        : { center: mapCenter, zoom: mode === "results" ? 10 : guessOverviewZoom })}
      minZoom={1}
      maxZoom={maxZoom}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      dragging={false}
      maxBounds={restrictToSingleWorld ? GUESS_WORLD_BOUNDS : undefined}
      maxBoundsViscosity={restrictToSingleWorld ? 1 : 0}
      worldCopyJump={!restrictToSingleWorld}
      >
      <MapInteractionState noPan={noPan} noZoom={noZoom} />
      <MapResizer resizeSignal={resizeSignal} />
      {mode === "guess" && <GuessViewportReset center={center} zoom={guessOverviewZoom} resetSignal={resetSignal} />}
      {mode === "results" && (
        <ResultBounds
          summary={summary}
          players={players}
          showLabels={showLabels}
          resultPaddingScale={resultPaddingScale}
          resultZoomScale={resultZoomScale}
          resizeSignal={resizeSignal}
          resultLabelLayout={resultLabelLayout}
          resultControlInset={resultControlInset}
        />
      )}
      <MapLibreBaseLayer renderWorldCopies={!restrictToSingleWorld} onReady={onBaseMapReady} />
      {mode === "guess" && <ClickHandler disabled={disabled} onGuess={onGuess} />}
      {guess && (
        <Marker position={[guess.lat, guess.lng]} icon={pinIcon(guessColor(players, guess, currentPlayerColor))}>
          {showLabels && (
            <Tooltip
              permanent
              direction="right"
              offset={[18, -18]}
              className={`punktlandung-map-label punktlandung-map-label-guess punktlandung-player-color-${guessColorIndex}`}
            >
              Dein Tipp
            </Tooltip>
          )}
        </Marker>
      )}
      {mode === "results" && (
        <ResultsMarkers
          summary={summary}
          players={players}
          guesses={guesses}
          showLabels={showLabels}
          resultLabelLayout={resultLabelLayout}
          resultLabelInset={resultLabelInset}
          resultControlInset={resultControlInset}
          animateResultConnector={animateResultConnector}
          resizeSignal={resizeSignal}
        />
      )}
      </StrictSafeMapContainer>
      <MapAttributionBadge locationInfoSourceUrl={mode === "results" ? summary?.location.descriptionSourceUrl : undefined} />
    </div>
  );
}
