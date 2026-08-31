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
import { resultWorldMinimumZoom } from "@/lib/resultMapViewport";
import { RESULT_LABEL_VISUAL_GAP_PX, RESULT_ROUTE_DASH_GAP_PX, RESULT_ROUTE_DASH_LENGTH_PX } from "@/lib/globeResultLayout";

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
export const GUESS_OVERVIEW_ZOOM = 1.5;
export const GUESS_ZOOM_STEP = 0.5;
const SINGLE_WORLD_BOUNDS = latLngBounds([
  [-85, -180],
  [85, 180]
]);
const GUESS_PAN_BOUNDS = latLngBounds([
  [-85, -360],
  [85, 360]
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

function displayPointsForSingleWorld(points: LatLng[]): LatLng[] {
  return points.map((point) => ({ ...point, lng: normalizeLng(point.lng) }));
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
    html: `<span class="${className}"${edgeAnchorStyle}>${labelHtml ?? escapeHtml(label)}${interactive ? '<span class="punktlandung-map-label-info" aria-hidden="true">i</span>' : ""}</span>`,
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

function ResultWorldLimits({ accountHistory = false }: { accountHistory?: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame: number | null = null;
    const applyLimits = () => {
      try {
        const width = Math.max(1, map.getSize().x);
        // At zoom 0 Leaflet's projected world is 256 CSS pixels wide. Keep
        // one world at least as wide as the result map so zooming out never
        // reveals repeated copies or empty space beside it.
        const minZoom = resultWorldMinimumZoom(width, accountHistory);
        map.setMinZoom(minZoom);
        if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
      } catch {
        // The result map can be between responsive layouts while it resizes.
      }
    };
    const scheduleLimits = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyLimits();
      });
    };
    const observer = new ResizeObserver(scheduleLimits);
    observer.observe(container);
    scheduleLimits();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [accountHistory, map]);

  return null;
}

function GuessMarker({
  guess,
  players,
  currentPlayerColor,
  showLabels,
  colorIndex
}: {
  guess: LatLng;
  players?: Player[];
  currentPlayerColor?: string;
  showLabels: boolean;
  colorIndex: number;
}) {
  const map = useMap();
  const nearestLng = useCallback(
    () => lngNearestTo(guess.lng, map.getCenter().lng),
    [guess.lng, map]
  );
  const [displayLng, setDisplayLng] = useState(nearestLng);

  useEffect(() => {
    const updateWorldCopy = () => setDisplayLng(nearestLng());
    updateWorldCopy();
    map.on("moveend", updateWorldCopy);
    return () => {
      map.off("moveend", updateWorldCopy);
    };
  }, [map, nearestLng]);

  return (
    <Marker position={[guess.lat, displayLng]} icon={pinIcon(guessColor(players, guess, currentPlayerColor))}>
      {showLabels && (
        <Tooltip
          permanent
          direction="right"
          offset={[18, -18]}
          className={`punktlandung-map-label punktlandung-map-label-guess punktlandung-player-color-${colorIndex}`}
        >
          Dein Tipp
        </Tooltip>
      )}
    </Marker>
  );
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
  const scaleForViewport = (size: { width: number; height: number }) => tv
    ? { width: Math.round(size.width * 1.5), height: Math.round(size.height * 1.45) }
    : size;
  const actualDimensions = scaleForViewport(labelSize(locationTitle, true, compact));
  const playerDimensions = scaleForViewport(labelSize(playerLabel, false, compact));
  return {
    actual: {
      // Prefer the same centred visual lane as production result maps.
      offset: [
        0,
        actualDimensions.height / 2 + 12 + RESULT_LABEL_VISUAL_GAP_PX
      ] as [number, number],
      size: actualDimensions
    },
    player: {
      offset: [0, -playerDimensions.height / 2 - 42 - RESULT_LABEL_VISUAL_GAP_PX] as [number, number],
      size: playerDimensions
    }
  };
}

function centerHomePreviewVisuals(map: LeafletMapInstance, summary: RoundSummary, players?: Player[]) {
  const result = rankResults(summary.results).find((item) => item.guess);
  if (!result?.guess) return;

  const displayPoints = displayPointsForSingleWorld([summary.location, result.guess]);
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
        const reserveDesktopPopup = showLabels
          && resultLabelLayout !== "home-preview"
          && resultLabelLayout !== "account-history"
          && container.clientWidth >= 900
          && container.clientHeight >= 480;
        const firstGuess = summary.results.find((result) => result.guess)?.guess;
        const actualPoint = map.latLngToContainerPoint([summary.location.lat, summary.location.lng]);
        const firstGuessPoint = firstGuess ? map.latLngToContainerPoint([firstGuess.lat, firstGuess.lng]) : null;
        const actualBelowPlayer = Boolean(firstGuessPoint && actualPoint.y > firstGuessPoint.y);
        const popupReserve = reserveDesktopPopup ? Math.min(178, Math.max(126, container.clientHeight * 0.18)) : 0;
        const controlInset = resultControlInset ? Math.min(76, Math.max(58, container.clientWidth * 0.22)) : 0;
        map.fitBounds(bounds, {
          animate: false,
          paddingTopLeft: [paddingX, paddingY + (actualBelowPlayer ? 0 : popupReserve)],
          paddingBottomRight: [paddingX + controlInset, paddingY + (actualBelowPlayer ? popupReserve : 0)],
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
  return displayPointsForSingleWorld(rawPoints).map((point) => [point.lat, point.lng]);
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
  if (preferredVector?.y) {
    const visualExtent = actual
      ? preferredVector.y > 0 ? 12 : 52
      : preferredVector.y < 0 ? 42 : 20;
    candidates.unshift({
      dx: 0,
      dy: Math.sign(preferredVector.y) * (dimensions.height / 2 + visualExtent + RESULT_LABEL_VISUAL_GAP_PX)
    });
  }
  const verticalCandidates = strictVerticalSide && preferredVector?.y
    ? candidates.filter((candidate) => Math.sign(candidate.dy) === Math.sign(preferredVector.y))
    : candidates;
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

  for (const [index, candidate] of verticalCandidates.entries()) {
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
    // Include the visible pin and its landing rings. Labels must never use
    // the narrow gap between two nearby markers as an apparent free lane.
    left: pixel.x - 34,
    top: pixel.y - 64,
    right: pixel.x + 34,
    bottom: pixel.y + 28
  };
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
  popupDirection,
  popupFitPoints,
  renderTargetPin = false,
  resultControlInset = false,
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
  popupDirection?: "above" | "below";
  popupFitPoints?: LatLng[];
  renderTargetPin?: boolean;
  resultControlInset?: boolean;
  zIndexOffset?: number;
}) {
  const map = useMap();
  const markerRef = useRef<LeafletMarkerInstance | null>(null);
  const targetPinRef = useRef<LeafletMarkerInstance | null>(null);
  const pinnedRef = useRef(false);
  const [popupPinned, setPopupPinned] = useState(false);
  const fitFrameRef = useRef<number | null>(null);
  const fitTimerRef = useRef<number | null>(null);
  const mapSize = map.getSize();
  const compactPortraitPopup = mapSize.x <= 480 && mapSize.x <= mapSize.y;
  const compactLandscapePopup = mapSize.x <= 960 && mapSize.x > mapSize.y;
  const popupWidth = compactPortraitPopup
    ? Math.max(210, Math.min(252, mapSize.x - 72))
    : compactLandscapePopup
      ? 224
      : 260;
  const openBelowLabel = popupDirection === "below";
  const estimatedPopupHeight = compactPortraitPopup ? 172 : 132;
  const popupAboveAdjustment = compactPortraitPopup ? 7 : compactLandscapePopup ? 30 : 56;
  const popupBelowAdjustment = compactLandscapePopup ? 1 : -14;
  const popupTranslateRef = useRef(0);
  const popupVerticalOffset = openBelowLabel
    ? placement.offset[1] + placement.size.height / 2 + popupBelowAdjustment + estimatedPopupHeight
    : placement.offset[1] - placement.size.height / 2 + popupAboveAdjustment;

  const schedulePopupSafeArea = (attempt = 0) => {
    if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = null;
      if (!pinnedRef.current) return;
      const container = map.getContainer();
      const containerRect = container.getBoundingClientRect();
      const popupElement = container.querySelector<HTMLElement>(".punktlandung-location-info-popup");
      const popupTipElement = popupElement?.querySelector<HTMLElement>(".leaflet-popup-tip");
      const targetLabelElement = markerRef.current?.getElement()?.querySelector<HTMLElement>(".punktlandung-map-label-actual");
      if (popupElement && popupTipElement && targetLabelElement) {
        const popupTipRect = popupTipElement.getBoundingClientRect();
        const targetLabelRect = targetLabelElement.getBoundingClientRect();
        const labelPopupGap = 10;
        const alignmentDelta = openBelowLabel
          ? targetLabelRect.bottom + labelPopupGap - popupTipRect.top
          : targetLabelRect.top - labelPopupGap - popupTipRect.bottom;
        if (Math.abs(alignmentDelta) > 0.5) {
          popupTranslateRef.current += alignmentDelta;
          popupElement.style.translate = `0 ${popupTranslateRef.current}px`;
        }
      }
      const visuals = [
        ...container.querySelectorAll<HTMLElement>(".punktlandung-map-label"),
        ...container.querySelectorAll<HTMLElement>(".punktlandung-map-pin"),
        ...container.querySelectorAll<HTMLElement>(".punktlandung-location-info-popup")
      ].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      if (!visuals.length || containerRect.width <= 0 || containerRect.height <= 0) return;
      const visualRect = visuals
        .map((element) => element.getBoundingClientRect())
        .reduce<LabelRect>((combined, rect) => ({
          left: Math.min(combined.left, rect.left),
          top: Math.min(combined.top, rect.top),
          right: Math.max(combined.right, rect.right),
          bottom: Math.max(combined.bottom, rect.bottom)
        }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      const margin = compactPortraitPopup ? 8 : 12;
      const safeWidth = containerRect.width - margin * 2;
      const safeHeight = containerRect.height - margin * 2;
      const visualWidth = visualRect.right - visualRect.left;
      const visualHeight = visualRect.bottom - visualRect.top;

      if (
        attempt < 12 &&
        (visualWidth > safeWidth + 0.5 || visualHeight > safeHeight + 0.5) &&
        map.getZoom() > map.getMinZoom() + 0.05
      ) {
        const requiredScale = Math.min(safeWidth / visualWidth, safeHeight / visualHeight);
        const zoomStep = Math.max(-0.5, Math.min(-0.12, Math.log2(Math.max(0.68, requiredScale))));
        map.setZoom(Math.max(map.getMinZoom(), map.getZoom() + zoomStep), { animate: false });
        schedulePopupSafeArea(attempt + 1);
        return;
      }

      let translateX = 0;
      let translateY = 0;
      const safeLeft = containerRect.left + margin;
      const safeRight = containerRect.right - margin;
      const safeTop = containerRect.top + margin;
      const safeBottom = containerRect.bottom - margin;
      if (visualRect.left < safeLeft) translateX = safeLeft - visualRect.left;
      if (visualRect.right + translateX > safeRight) translateX += safeRight - (visualRect.right + translateX);
      if (visualRect.top < safeTop) translateY = safeTop - visualRect.top;
      if (visualRect.bottom + translateY > safeBottom) translateY += safeBottom - (visualRect.bottom + translateY);
      if (Math.abs(translateX) > 0.5 || Math.abs(translateY) > 0.5) {
        map.panBy([-translateX, -translateY], { animate: false });
        if (attempt < 18) schedulePopupSafeArea(attempt + 1);
      }
    }, 40);
  };

  const fitPinnedPopup = () => {
    if (!popupFitPoints || popupFitPoints.length < 2) return;
    if (fitFrameRef.current !== null) window.cancelAnimationFrame(fitFrameRef.current);
    fitFrameRef.current = window.requestAnimationFrame(() => {
      fitFrameRef.current = null;
      if (!pinnedRef.current) return;
      try {
        map.invalidateSize(false);
        const size = map.getSize();
        if (size.x >= 900 && size.y >= 480) {
          schedulePopupSafeArea();
          return;
        }
        const popupElement = map.getContainer().querySelector<HTMLElement>(".punktlandung-location-info-popup");
        const measuredPopupHeight = popupElement?.getBoundingClientRect().height ?? estimatedPopupHeight;
        const horizontalPadding = Math.min(
          Math.max(56, size.x * 0.28),
          Math.max(popupWidth / 2 + 24, placement.size.width / 2 + 24)
        );
        const quietSidePadding = Math.min(92, Math.max(56, size.y * 0.2));
        const popupSidePadding = Math.min(
          Math.max(quietSidePadding, size.y - quietSidePadding - 28),
          measuredPopupHeight + placement.size.height + 52
        );
        const controlInset = resultControlInset ? Math.min(76, Math.max(58, size.x * 0.22)) : 0;
        const previousZoomSnap = map.options.zoomSnap;
        map.options.zoomSnap = 1;
        map.fitBounds(latLngBounds(popupFitPoints.map((fitPoint) => [fitPoint.lat, fitPoint.lng])), {
          animate: false,
          paddingTopLeft: [horizontalPadding, openBelowLabel ? quietSidePadding : popupSidePadding],
          paddingBottomRight: [horizontalPadding + controlInset, openBelowLabel ? popupSidePadding : quietSidePadding],
          maxZoom: Math.min(RESULT_MAX_ZOOM, map.getZoom())
        });
        map.options.zoomSnap = previousZoomSnap;
        schedulePopupSafeArea();
      } catch {
        // The result map may unmount while the popup is being opened.
      }
    });
  };

  const togglePinnedPopup = () => {
    pinnedRef.current = !pinnedRef.current;
    setPopupPinned(pinnedRef.current);
    if (!pinnedRef.current) {
      popupTranslateRef.current = 0;
      markerRef.current?.closePopup();
      return;
    }
    popupTranslateRef.current = 0;
    markerRef.current?.openPopup();
    fitPinnedPopup();
  };

  useEffect(() => {
    if (!description) return;
    const markerElement = markerRef.current?.getElement();
    const targetPinElement = targetPinRef.current?.getElement();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pinnedRef.current = false;
      setPopupPinned(false);
      markerRef.current?.closePopup();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pinnedRef.current || !(event.target instanceof Element)) return;
      if (
        markerElement?.contains(event.target) ||
        targetPinElement?.contains(event.target) ||
        event.target.closest(".punktlandung-location-info-popup")
      ) return;
      pinnedRef.current = false;
      setPopupPinned(false);
      markerRef.current?.closePopup();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      if (fitFrameRef.current !== null) window.cancelAnimationFrame(fitFrameRef.current);
      if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
    };
  }, [description]);

  return (
    <>
      {renderTargetPin && (
        <Marker
          ref={targetPinRef}
          position={[point.lat, point.lng]}
          icon={actualPinIcon}
          interactive={Boolean(description)}
          keyboard={Boolean(description)}
          alt={description ? `${label}: Zusatzinformationen anzeigen` : label}
          bubblingMouseEvents={false}
          eventHandlers={description ? { click: togglePinnedPopup } : undefined}
          zIndexOffset={zIndexOffset}
        >
          {description && !popupPinned && (
            <Tooltip
              direction={openBelowLabel ? "bottom" : "top"}
              offset={[0, openBelowLabel ? 48 : -48]}
              opacity={1}
              className="punktlandung-map-action-tooltip"
            >
              Zusatzinformationen anzeigen
            </Tooltip>
          )}
        </Marker>
      )}
      <Marker
        ref={markerRef}
        position={[point.lat, point.lng]}
        icon={labelIcon(label, className, placement, labelHtml, edgeAnchor, insetEdgeAnchor, Boolean(description))}
        interactive={Boolean(description)}
        keyboard={Boolean(description)}
        alt={description ? `${label}: Zusatzinformationen anzeigen` : label}
        bubblingMouseEvents={false}
        eventHandlers={description ? { click: togglePinnedPopup } : undefined}
        zIndexOffset={zIndexOffset}
      >
        {description && (
          <>
            {!popupPinned && <Tooltip
              direction={openBelowLabel ? "bottom" : "top"}
              offset={[
                placement.offset[0],
                placement.offset[1] + (openBelowLabel ? placement.size.height / 2 + 8 : -placement.size.height / 2 - 8)
              ]}
              opacity={1}
              className="punktlandung-map-action-tooltip"
            >
              Zusatzinformationen anzeigen
            </Tooltip>}
            <Popup
              className={`punktlandung-location-info-popup${openBelowLabel ? " is-below-label" : ""}`}
              offset={[0, popupVerticalOffset]}
              minWidth={popupWidth}
              maxWidth={compactPortraitPopup || compactLandscapePopup ? popupWidth : 320}
              autoPan={false}
              keepInView={false}
              closeOnClick={false}
              closeButton
              eventHandlers={{
                remove: () => {
                  pinnedRef.current = false;
                  setPopupPinned(false);
                }
              }}
            >
              <strong>{label}</strong>
              <span>{description}</span>
            </Popup>
          </>
        )}
      </Marker>
    </>
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
    const displayPoints = displayPointsForSingleWorld(sourcePoints);
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
      return {
        actual: null as LabelPlacement | null,
        actualPopupDirection: "above" as const,
        players: new Map<string, LabelPlacement>()
      };
    }

    const occupied: LabelRect[] = [];
    const playerPlacements = new Map<string, LabelPlacement>();
    const mapSize = map.getSize();
    const displayLocation = displayGeometry.location;
    const locationPoint = map.latLngToContainerPoint([displayLocation.lat, displayLocation.lng]);
    const accountHistoryLayout = resultLabelLayout === "account-history";
    const firstGuess = rankedResults[0]
      ? displayGeometry.resultGuesses.get(rankedResults[0].playerId)
      : undefined;
    const firstGuessPoint = firstGuess
      ? map.latLngToContainerPoint([firstGuess.lat, firstGuess.lng])
      : null;
    const actualPopupDirection: "above" | "below" = firstGuessPoint && locationPoint.y > firstGuessPoint.y
      ? "below"
      : "above";
    const compactResultLayout = mapSize.x <= 520 && mapSize.y >= mapSize.x;
    const nearSameLatitude = firstGuessPoint
      ? Math.abs(firstGuessPoint.y - locationPoint.y) <= (compactResultLayout ? 16 : 8)
      : false;
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
      firstGuessPoint
        ? {
            x: 0,
            y: nearSameLatitude ? -1 : locationPoint.y < firstGuessPoint.y ? -1 : 1
          }
        : undefined,
      resultControlInset,
      true
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
      // Keep the two semantic labels on opposite vertical sides. A small
      // tolerance prevents sub-pixel projection differences from flipping
      // the layout when both pins are effectively on the same latitude.
      const playerNearSameLatitude = Math.abs(guessPoint.y - locationPoint.y) <= (compactResultLayout ? 16 : 8);
      const preferredVector = {
        x: 0,
        y: playerNearSameLatitude ? 1 : guessPoint.y < locationPoint.y ? -1 : 1
      };
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
        true
      );
      occupied.push(paddedRect(placement.rect, 12));
      playerPlacements.set(result.playerId, placement.placement);
    }

    return { actual: actualPlacement.placement, actualPopupDirection, players: playerPlacements };
  }, [showLabels, location, rankedResults, map, players, viewportVersion, resizeSignal, displayGeometry, resultLabelLayout, resultLabelInset, resultControlInset]);

  const popupFitPoints = useMemo(() => {
    if (!displayGeometry) return [];
    return [
      displayGeometry.location,
      ...rankedResults.flatMap((result) => {
        const point = displayGeometry.resultGuesses.get(result.playerId);
        return point ? [point] : [];
      })
    ];
  }, [displayGeometry, rankedResults]);

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
            <ResultMarker
              point={displayGeometry?.location ?? location}
              label={location.title}
              className="punktlandung-map-label punktlandung-map-label-actual"
              placement={placements.actual}
              edgeAnchor={resultLabelLayout === "home-preview" ? "right" : undefined}
              insetEdgeAnchor={resultLabelInset}
              description={resultLabelLayout === "home-preview" ? undefined : location.shortDescription}
              popupDirection={placements.actualPopupDirection}
              popupFitPoints={popupFitPoints}
              renderTargetPin
              resultControlInset={resultControlInset}
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
  // Match the endpoint clearance to the normal gap of the shared 6/9 route
  // pattern in both the Leaflet fallback and the production Globe.
  const connectorGap = RESULT_ROUTE_DASH_GAP_PX;
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
  const visibleLength = Math.max(0, directionLength - requiredLength);
  const endpointDash = Math.min(RESULT_ROUTE_DASH_LENGTH_PX, visibleLength / 2);
  const visiblePlayerDashEnd = map.containerPointToLatLng([
    playerEllipseCenter.x + unitDirection.x * (playerEllipseRadius + connectorGap + endpointDash),
    playerEllipseCenter.y + unitDirection.y * (playerEllipseRadius + connectorGap + endpointDash)
  ]);
  const visibleTargetDashStart = map.containerPointToLatLng([
    targetEllipseCenter.x - unitDirection.x * (targetEllipseRadius + connectorGap + endpointDash),
    targetEllipseCenter.y - unitDirection.y * (targetEllipseRadius + connectorGap + endpointDash)
  ]);

  return (
    <>
      <Polyline
        className={`punktlandung-result-connector${animate ? " is-flowing" : ""}`}
        positions={visiblePositions}
        interactive={false}
        pathOptions={{ color, opacity: 0.82, weight: 1.375, dashArray: "6 9", lineCap: "round" }}
      />
      {visiblePositions.length ? <>
        <Polyline className="punktlandung-result-connector-endpoint" positions={[visiblePlayer, visiblePlayerDashEnd]} interactive={false}
          pathOptions={{ color, opacity: 0.82, weight: 1.375, lineCap: "round" }} />
        <Polyline className="punktlandung-result-connector-endpoint" positions={[visibleTargetDashStart, visibleTarget]} interactive={false}
          pathOptions={{ color, opacity: 0.82, weight: 1.375, lineCap: "round" }} />
      </> : null}
    </>
  );
}

function GuessViewportTelemetry() {
  const map = useMap();

  useEffect(() => {
    const update = () => {
      const container = map.getContainer();
      const center = map.getCenter();
      container.dataset.currentZoom = map.getZoom().toFixed(2);
      container.dataset.currentLat = center.lat.toFixed(4);
      container.dataset.currentLng = center.lng.toFixed(4);
      container.dataset.zoomSnap = String(map.options.zoomSnap ?? 1);
      container.dataset.zoomDelta = String(map.options.zoomDelta ?? 1);
    };
    update();
    map.on("zoomend moveend", update);
    return () => {
      map.off("zoomend moveend", update);
    };
  }, [map]);

  return null;
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
  const guessOverviewZoom = GUESS_OVERVIEW_ZOOM;
  const guessColorIndex = playerColorIndexByColor(currentPlayerColor);
  const isGuessMap = mode === "guess";

  return (
    <div className="punktlandung-map-shell" style={playerPaletteStyle}>
      <StrictSafeMapContainer
      {...(initialBounds
        ? { bounds: initialBounds, boundsOptions: { padding: [56, 56], maxZoom } }
        : { center: mapCenter, zoom: mode === "results" ? 10 : guessOverviewZoom })}
      minZoom={mode === "results" && resultLabelLayout === "account-history" ? 0 : 1}
      maxZoom={maxZoom}
      zoomSnap={isGuessMap ? GUESS_ZOOM_STEP : 1}
      zoomDelta={isGuessMap ? GUESS_ZOOM_STEP : 1}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      dragging={false}
      maxBounds={isGuessMap ? GUESS_PAN_BOUNDS : SINGLE_WORLD_BOUNDS}
      maxBoundsViscosity={1}
      worldCopyJump={false}
      >
      <MapInteractionState noPan={noPan} noZoom={noZoom} />
      {mode === "guess" && <GuessViewportTelemetry />}
      <MapResizer resizeSignal={resizeSignal} />
      {mode === "guess" && <GuessViewportReset center={center} zoom={guessOverviewZoom} resetSignal={resetSignal} />}
      {mode === "results" && (
        <>
          <ResultWorldLimits accountHistory={resultLabelLayout === "account-history"} />
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
        </>
      )}
      <MapLibreBaseLayer renderWorldCopies={isGuessMap} styleVariant="mercator" onReady={onBaseMapReady} />
      {mode === "guess" && <ClickHandler disabled={disabled} onGuess={onGuess} />}
      {guess && (
        <GuessMarker
          guess={guess}
          players={players}
          currentPlayerColor={currentPlayerColor}
          showLabels={showLabels}
          colorIndex={guessColorIndex}
        />
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
