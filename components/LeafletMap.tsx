"use client";

import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import type { LatLngExpression, Map as LeafletMapInstance } from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Guess, LatLng, Player, RoundSummary } from "@/types/game";
import { formatDistance, rankResults } from "@/lib/geo";

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
  currentPlayerColor?: string;
  resizeSignal?: number | string | boolean;
  resetSignal?: number | string | boolean;
  onGuess?: (point: LatLng) => void;
};

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

type PixelSegment = {
  a: PixelPoint;
  b: PixelPoint;
};

const PLAYER_ELLIPSE_SIZE = { width: 28, height: 8 };
const ACTUAL_ELLIPSE_SIZE = { width: 50, height: 14 };
const RESULT_MAX_ZOOM = 17;

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

function pinIcon(color = "#f43f5e", actual = false) {
  return divIcon({
    className: "punktlandung-pin-icon",
    html: `<div class="punktlandung-map-pin${actual ? " punktlandung-map-pin-actual" : " punktlandung-map-pin-player"}" style="--pin-color:${color}"><span></span></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 38],
    popupAnchor: [0, -38]
  });
}

function ellipseIcon(color = "#2563eb", actual = false) {
  const { width, height } = actual ? ACTUAL_ELLIPSE_SIZE : PLAYER_ELLIPSE_SIZE;
  const verticalAnchor = height / 2 - (actual ? 3 : 2.5);
  return divIcon({
    className: "punktlandung-pin-ellipse-icon",
    html: `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" style="--ellipse-color:${color}"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2 - 1.25}" ry="${height / 2 - 1.25}"></ellipse></svg>`,
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

function labelIcon(label: string, className: string, placement: LabelPlacement) {
  const [dx, dy] = placement.offset;
  const { width, height } = placement.size;
  return divIcon({
    className: "punktlandung-map-label-marker",
    html: `<span class="${className}">${escapeHtml(label)}</span>`,
    iconSize: [width, height],
    iconAnchor: [width / 2 - dx, height / 2 - dy]
  });
}

const actualPinIcon = pinIcon("#34d399", true);

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

  return noZoom ? null : <ZoomControl position="topleft" />;
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
  return players?.find((player) => player.id === playerId)?.color ?? "#ef4444";
}

function guessColor(players: Player[] | undefined, guess?: LatLng | null, fallback = "#f43f5e"): string {
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

function playerColorIndexByColor(players: Player[] | undefined, color?: string): number {
  const index = players?.findIndex((player) => player.color === color) ?? -1;
  return index >= 0 ? index % 10 : 0;
}

function MapResizer({ resizeSignal }: { resizeSignal?: number | string | boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const timers: number[] = [];
    const invalidate = () => {
      try {
        map.invalidateSize(false);
      } catch {
        // Leaflet can briefly outlive its DOM node during mobile orientation changes.
      }
    };
    const resize = () => {
      timers.push(window.setTimeout(invalidate, 40));
      timers.push(window.setTimeout(invalidate, 260));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [map]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => {
        try {
          map.invalidateSize(false);
        } catch {}
      }, 40),
      window.setTimeout(() => {
        try {
          map.invalidateSize(false);
        } catch {}
      }, 320)
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [map, resizeSignal]);

  return null;
}

function resultBoundsPadding(map: LeafletMapInstance, showLabels: boolean): [number, number] {
  const container = map.getContainer();
  const width = container.clientWidth || 360;
  const height = container.clientHeight || 220;

  if (!showLabels) {
    return [Math.max(74, Math.min(132, width * 0.22)), Math.max(70, Math.min(124, height * 0.28))];
  }

  return [Math.max(140, Math.min(244, width * 0.28)), Math.max(102, Math.min(168, height * 0.28))];
}

function ResultBounds({
  summary,
  players,
  showLabels
}: {
  summary?: RoundSummary | null;
  players?: Player[];
  showLabels: boolean;
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
    const fit = () => {
      try {
        map.invalidateSize(false);
        map.fitBounds(bounds, {
          animate: false,
          padding: resultBoundsPadding(map, showLabels),
          maxZoom: RESULT_MAX_ZOOM
        });
      } catch {
        // Map can be mid-unmount while switching round/result layouts.
      }
    };
    fit();
    const timers = [window.setTimeout(fit, 90), window.setTimeout(fit, 320), window.setTimeout(fit, 700)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [map, summary, players?.length, showLabels]);

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

function labelSize(label: string, actual = false) {
  const width = Math.min(actual ? 286 : 244, Math.max(actual ? 110 : 154, Math.round(label.length * (actual ? 9.4 : 8.2)) + 42));
  return { width, height: actual ? 46 : 44 };
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
  preferredVector?: PixelPoint
): Array<{ dx: number; dy: number }> {
  const horizontal = width / 2 + (actual ? 6 : 9);
  const vertical = height / 2 + (actual ? 8 : 10);
  const rings = actual ? [0, 5, 10] : [0, 6, 12, 20];
  const laneShifts = actual ? [0, -5, 5] : [0, -6, 6, -12, 12];
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
  preferredVector?: PixelPoint
): { placement: LabelPlacement; rect: LabelRect } {
  const pixel = map.latLngToContainerPoint([point.lat, point.lng]);
  const size = map.getSize();
  const dimensions = labelSize(label, actual);
  const candidates = placementCandidates(dimensions.width, dimensions.height, actual, preferredVector);
  const pinRect: LabelRect = {
    left: pixel.x - 18,
    top: pixel.y - 44,
    right: pixel.x + 18,
    bottom: pixel.y + 14
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
    const rect = labelRectFor(pixel, dimensions.width, dimensions.height, candidate.dx, candidate.dy);
    const overflow = viewportOverflow(rect, size.x, size.y, 30);
    const overlap = occupied.reduce((sum, other) => sum + overlapArea(rect, other), 0);
    const pinOverlap = overlapArea(rect, pinRect);
    const linePenalty = blockedSegments.reduce((sum, segment) => sum + rectLinePenalty(rect, segment), 0);
    const anchorDistance = Math.hypot(candidate.dx, candidate.dy);
    const preferredPenalty = preferredVector
      ? Math.max(0, -(candidate.dx * preferredVector.x + candidate.dy * preferredVector.y)) * (actual ? 6 : 10)
      : 0;
    const hasHardConflict = overflow > 0 || overlap > 0 || pinOverlap > 0 || linePenalty > 0;
    const cleanNearBonus = !hasHardConflict && anchorDistance < (actual ? 96 : 112) ? -3600 : 0;
    const score =
      overflow * 42000 +
      overlap * 28000 +
      pinOverlap * 52000 +
      linePenalty +
      preferredPenalty * (actual ? 0.35 : 2.4) +
      anchorDistance * (actual ? 3.2 : 3.6) +
      (actual && candidate.dy > 0 ? candidate.dy * 0.38 : Math.abs(candidate.dy) * 0.12) +
      index * 2 +
      cleanNearBonus;
    const placement = { offset: [candidate.dx, candidate.dy] as [number, number], size: dimensions };

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
    left: pixel.x - 20,
    top: pixel.y - 48,
    right: pixel.x + 20,
    bottom: pixel.y + 18
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
  className,
  placement,
  zIndexOffset = 0
}: {
  point: LatLng;
  label: string;
  className: string;
  placement: LabelPlacement;
  zIndexOffset?: number;
}) {
  return (
    <Marker position={[point.lat, point.lng]} icon={labelIcon(label, className, placement)} interactive={false} zIndexOffset={zIndexOffset} />
  );
}

function ResultsMarkers({
  summary,
  players,
  guesses,
  showLabels,
  resizeSignal
}: {
  summary?: RoundSummary | null;
  players?: Player[];
  guesses: Guess[];
  showLabels: boolean;
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
    const blockedSegments: PixelSegment[] = rankedResults.flatMap((result) => {
      const displayGuess = displayGeometry.resultGuesses.get(result.playerId);
      if (!result.guess || !displayGuess) return [];
      if (location.category === "flags" && result.countryCorrect) return [];
      const guessPoint = map.latLngToContainerPoint([displayGuess.lat, displayGuess.lng]);
      return [{ a: { x: guessPoint.x, y: guessPoint.y }, b: { x: locationPoint.x, y: locationPoint.y } }];
    });

    for (const result of rankedResults) {
      const displayGuess = displayGeometry.resultGuesses.get(result.playerId);
      if (displayGuess) occupied.push(pinBlockRect(map, displayGuess));
    }

    const actualPlacement = resultTooltipPlacement(
      map,
      displayLocation,
      location.title,
      occupied,
      blockedSegments.map((segment) => trimSegment(segment, 0, 54)),
      true,
      undefined
    );
    occupied.push(paddedRect(actualPlacement.rect, 12));
    occupied.push(pinBlockRect(map, displayLocation));

    for (const [index, result] of rankedResults.entries()) {
      const displayGuess = displayGeometry.resultGuesses.get(result.playerId);
      if (!result.guess || !displayGuess) continue;
      const guessPoint = map.latLngToContainerPoint([displayGuess.lat, displayGuess.lng]);
      const hideDistance = location.category === "flags" && result.countryCorrect;
      const resultLabel = hideDistance ? "richtiges Land" : formatDistance(result.distanceKm);
      const label = `#${index + 1} ${playerName(players, result.playerId)} - ${resultLabel}`;
      const outwardVector = vectorAwayFrom(guessPoint, mapCenter);
      const targetVector = vectorAwayFrom(guessPoint, locationPoint);
      const placement = resultTooltipPlacement(
        map,
        displayGuess,
        label,
        occupied,
        blockedSegments,
        false,
        blendedVector([
          { vector: outwardVector, weight: 1.85 },
          { vector: targetVector, weight: 1.15 }
        ])
      );
      occupied.push(paddedRect(placement.rect, 12));
      playerPlacements.set(result.playerId, placement.placement);
    }

    return { actual: actualPlacement.placement, players: playerPlacements };
  }, [showLabels, location, rankedResults, map, players, viewportVersion, resizeSignal, displayGeometry]);

  return (
    <>
      {location &&
        rankedResults.map((result, index) => {
          const point = displayGeometry?.resultGuesses.get(result.playerId) ?? result.guess;
          if (!point) return null;
          const color = playerColor(players, result.playerId);
          const colorIndex = playerColorIndex(players, result.playerId);
          const hideDistance = location.category === "flags" && result.countryCorrect;
          const resultLabel = hideDistance ? "richtiges Land" : formatDistance(result.distanceKm);
          const playerLabel = `#${index + 1} ${playerName(players, result.playerId)} - ${resultLabel}`;
          const placement = placements.players.get(result.playerId);

          return (
            <Fragment key={result.playerId}>
              {!hideDistance && (
                <Polyline
                  positions={[
                    [point.lat, point.lng],
                    [displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]
                  ]}
                  pathOptions={{ color, opacity: 0.74, weight: 4, dashArray: "8 10" }}
                />
              )}
              {showLabels && placement ? (
                <>
                  <Marker position={[point.lat, point.lng]} icon={pinIcon(color)} />
                  <ResultMarker
                    point={point}
                    label={playerLabel}
                    className={`punktlandung-map-label punktlandung-map-label-player punktlandung-player-color-${colorIndex}`}
                    placement={placement}
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
              icon={ellipseIcon("#34d399", true)}
              interactive={false}
              zIndexOffset={-900}
            />
            <Marker position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]} icon={actualPinIcon} zIndexOffset={1000} />
            <ResultMarker
              point={displayGeometry?.location ?? location}
              label={location.title}
              className="punktlandung-map-label punktlandung-map-label-actual"
              placement={placements.actual}
              zIndexOffset={1000}
            />
          </>
        ) : (
          <>
            <Marker
              position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]}
              icon={ellipseIcon("#34d399", true)}
              interactive={false}
              zIndexOffset={-900}
            />
            <Marker position={[displayGeometry?.location.lat ?? location.lat, displayGeometry?.location.lng ?? location.lng]} icon={actualPinIcon} zIndexOffset={1000} />
          </>
        ))}
    </>
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
  currentPlayerColor,
  resizeSignal,
  resetSignal,
  onGuess
}: LeafletMapProps) {
  const mapCenter: LatLngExpression = [center.lat, center.lng];
  const initialResultPoints = mode === "results" ? resultPoints(summary) : [];
  const initialBounds = initialResultPoints.length > 1 ? latLngBounds(initialResultPoints) : null;
  const maxZoom = mode === "results" ? RESULT_MAX_ZOOM : 13;
  const guessOverviewZoom = 2;
  const guessColorIndex = playerColorIndexByColor(players, currentPlayerColor);

  return (
    <MapContainer
      {...(initialBounds
        ? { bounds: initialBounds, boundsOptions: { padding: [56, 56], maxZoom } }
        : { center: mapCenter, zoom: mode === "results" ? 10 : guessOverviewZoom })}
      minZoom={1}
      maxZoom={maxZoom}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      dragging={false}
      worldCopyJump
    >
      <MapInteractionState noPan={noPan} noZoom={noZoom} />
      <MapResizer resizeSignal={resizeSignal} />
      {mode === "guess" && <GuessViewportReset center={center} zoom={guessOverviewZoom} resetSignal={resetSignal} />}
      {mode === "results" && <ResultBounds summary={summary} players={players} showLabels={showLabels} />}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Tiles: <a href="https://www.openstreetmap.de/">OSM Deutschland</a>'
        url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
      />
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
        <ResultsMarkers summary={summary} players={players} guesses={guesses} showLabels={showLabels} resizeSignal={resizeSignal} />
      )}
    </MapContainer>
  );
}
