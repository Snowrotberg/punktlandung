"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapAttributionBadge } from "@/components/MapAttributionBadge";
import {
  buildMunichJourneyKeyframes,
  buildResultCameraPlan,
  distanceBetweenCoordinatesKm,
  type CameraKeyframe,
  type GlobeCoordinates,
  RESULT_CAMERA_CONFIG,
  RESULT_CAMERA_SCENARIOS,
  routeLineCoordinates,
  sampleCameraTimeline,
  type ResultCameraPlan,
  type ResultCameraScenario
} from "@/lib/globeResultCamera";
import { PUNKTLANDUNG_TERRAIN_SOURCE_ID, punktlandungMapStyleUrl } from "@/lib/mapStyle";
import styles from "./GlobeMapLab.module.css";

type CameraPreset = { label: string; center: GlobeCoordinates; zoom: number; bearing: number; pitch: number };
type CameraSnapshot = { lng: number; lat: number; zoom: number; bearing: number; pitch: number };
type ScreenPoint = { x: number; y: number };
type ScreenBounds = { minX: number; minY: number; maxX: number; maxY: number };
type TerrainMode = "adaptive" | "on" | "off";
type TimelineMetrics = { completed: boolean; maxFrameGapMs: number; slowFrames: number; pendingTileSamples: number; tileSamples: number };
type GlobeMapLabProps = {
  resultScenario?: ResultCameraScenario;
  embedded?: boolean;
  autoPlay?: boolean;
  revealImmediately?: boolean;
  onAnimationComplete?: () => void;
  onUnavailable?: () => void;
};

export function prewarmGlobeResultMap(): void {
  if (typeof window === "undefined") return;
  // MapLibre normally creates its workers with the first visible map. Starting
  // them during the guessing phase removes that setup cost from the reveal.
  maplibregl.prewarm();
}

const CAMERA_PRESETS = {
  world: { label: "Welt", center: [8, 24], zoom: 1.35, bearing: 0, pitch: 0 },
  europe: { label: "Europa", center: [10.5, 50], zoom: 3.35, bearing: -8, pitch: 24 },
  munich: { label: "Alpen · München", center: [11.5761, 48.1372], zoom: 7.15, bearing: 24, pitch: 47 }
} satisfies Record<string, CameraPreset>;

const INITIAL_CAMERA: CameraSnapshot = {
  lng: CAMERA_PRESETS.world.center[0], lat: CAMERA_PRESETS.world.center[1], zoom: CAMERA_PRESETS.world.zoom,
  bearing: CAMERA_PRESETS.world.bearing, pitch: CAMERA_PRESETS.world.pitch
};
const TERRAIN_STRENGTHS = [1, 1.5, 2] as const;
const DEFAULT_TERRAIN_MODE: TerrainMode = "on";
const DEFAULT_TERRAIN_STRENGTH = RESULT_CAMERA_CONFIG.terrainExaggeration;

function pause(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 100 ? `${Math.round(distanceKm)} km` : `${Math.round(distanceKm / 10) * 10} km`;
}

function createResultMarker(kind: "guess" | "target", label: string): HTMLDivElement {
  const ringWidth = kind === "target" ? 58 : 46;
  const ringHeight = kind === "target" ? 18 : 14;
  const ringRadiusX = ringWidth / 2 - 1.25;
  const ringRadiusY = ringHeight / 2 - 1.25;
  const marker = document.createElement("div");
  marker.className = `${styles.resultMarker} ${kind === "guess" ? styles.guessMarker : styles.targetMarker}`;
  marker.dataset.visible = "false";
  if (kind === "target") marker.dataset.labelVisible = "false";
  marker.setAttribute("aria-label", label);
  if (kind === "target") {
    marker.dataset.hasInfo = "true";
    marker.tabIndex = 0;
    marker.setAttribute("role", "button");
    marker.setAttribute("aria-haspopup", "dialog");
  }
  marker.innerHTML = `
    <span class="${styles.markerVisual}" aria-hidden="true">
      <svg class="${styles.markerPin}" viewBox="0 0 32 42">
        <path class="${styles.markerPinOutline}" fill-rule="evenodd" d="M16 42C16 42 3 24 3 15C3 6.7 8.8 1 16 1C23.2 1 29 6.7 29 15C29 24 16 42 16 42ZM16 9.75A5.25 5.25 0 1 0 16 20.25A5.25 5.25 0 1 0 16 9.75Z"/>
        <path class="${styles.markerPinFill}" fill-rule="evenodd" d="M16 38C16 38 5 23 5 15C5 8.4 9.9 4 16 4C22.1 4 27 8.4 27 15C27 23 16 38 16 38ZM16 8A7 7 0 1 0 16 22A7 7 0 1 0 16 8Z"/>
        <circle class="${styles.markerPinCore}" cx="16" cy="15" r="7.15"/>
      </svg>
      <svg class="${styles.markerRings}" viewBox="0 0 ${ringWidth} ${ringHeight}">
        <ellipse class="${styles.markerRingOuter}" cx="${ringWidth / 2}" cy="${ringHeight / 2}" rx="${ringRadiusX}" ry="${ringRadiusY}"/>
        <ellipse class="${styles.markerRingMiddle}" cx="${ringWidth / 2}" cy="${ringHeight / 2}" rx="${ringRadiusX * 0.68}" ry="${ringRadiusY * 0.68}"/>
        <ellipse class="${styles.markerRingInner}" cx="${ringWidth / 2}" cy="${ringHeight / 2}" rx="${ringRadiusX * 0.38}" ry="${Math.max(ringRadiusY * 0.38, 0.9)}"/>
      </svg>
    </span>
    <span class="${styles.markerLabel} punktlandung-map-label ${kind === "guess" ? "punktlandung-map-label-player punktlandung-player-color-0" : "punktlandung-map-label-actual"}" data-marker-label>${label}</span>`;
  return marker;
}

function timelineProgress(progress: number): number {
  return 0.5 - Math.cos(Math.PI * progress) / 2;
}

function screenDistance(from: ScreenPoint, to: ScreenPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function trimScreenPolyline(points: ScreenPoint[], startGap: number, endGap: number): ScreenPoint[] {
  if (points.length < 2) return [];
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + screenDistance(points[index - 1], points[index]));
  }
  const total = cumulative.at(-1) ?? 0;
  const start = Math.min(startGap, Math.max(0, total - endGap - 1));
  const end = Math.max(start + 1, total - endGap);
  const interpolateAt = (distance: number): ScreenPoint => {
    const segment = cumulative.findIndex((value) => value >= distance);
    const endIndex = segment <= 0 ? 1 : segment;
    const segmentStart = cumulative[endIndex - 1];
    const segmentLength = Math.max(0.001, cumulative[endIndex] - segmentStart);
    const progress = Math.min(1, Math.max(0, (distance - segmentStart) / segmentLength));
    return {
      x: points[endIndex - 1].x + (points[endIndex].x - points[endIndex - 1].x) * progress,
      y: points[endIndex - 1].y + (points[endIndex].y - points[endIndex - 1].y) * progress
    };
  };
  const trimmed = [interpolateAt(start)];
  points.forEach((point, index) => {
    if (cumulative[index] > start && cumulative[index] < end) trimmed.push(point);
  });
  trimmed.push(interpolateAt(end));
  return trimmed;
}

function longestVisibleScreenSegment(points: ScreenPoint[], visibility: boolean[]): { points: ScreenPoint[]; startsRoute: boolean; endsRoute: boolean } {
  const segments: Array<{ points: ScreenPoint[]; startsRoute: boolean; endsRoute: boolean; length: number }> = [];
  let current: ScreenPoint[] = [];
  let startIndex = 0;
  const finish = (endIndex: number) => {
    if (current.length >= 2) {
      const length = current.slice(1).reduce((sum, point, index) => sum + screenDistance(current[index], point), 0);
      segments.push({ points: current, startsRoute: startIndex === 0, endsRoute: endIndex === points.length - 1, length });
    }
    current = [];
  };
  points.forEach((point, index) => {
    if (visibility[index]) {
      if (current.length === 0) startIndex = index;
      current.push(point);
    } else finish(index - 1);
  });
  finish(points.length - 1);
  return segments.sort((left, right) => right.length - left.length)[0] ?? { points: [], startsRoute: false, endsRoute: false };
}

function formatTimelineMetrics(metrics: TimelineMetrics): string {
  return `Frame-Lücke max. ${Math.round(metrics.maxFrameGapMs)} ms · lange Frames ${metrics.slowFrames} · Tiles offen ${metrics.pendingTileSamples}/${metrics.tileSamples}`;
}

export function GlobeMapLab({
  resultScenario,
  embedded = false,
  autoPlay = false,
  revealImmediately = false,
  onAnimationComplete,
  onUnavailable
}: GlobeMapLabProps = {}) {
  const initialScenario = resultScenario ?? RESULT_CAMERA_SCENARIOS[0];
  const availableScenarios = resultScenario ? [resultScenario] : RESULT_CAMERA_SCENARIOS;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const journeyRunRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const guessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const targetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const activeScenarioRef = useRef<ResultCameraScenario>(initialScenario);
  const routeOverlayRef = useRef<SVGSVGElement | null>(null);
  const routeShadowRef = useRef<SVGPathElement | null>(null);
  const routeLineRef = useRef<SVGPathElement | null>(null);
  const routeClipRef = useRef<SVGPathElement | null>(null);
  const routeGradientRef = useRef<SVGLinearGradientElement | null>(null);
  const routeBoundsRef = useRef<ScreenBounds | null>(null);
  const composedEndFrameRef = useRef<{ key: string; frame: CameraKeyframe } | null>(null);
  const routeVisibleRef = useRef(false);
  const terrainLevelRef = useRef<number | null>(null);
  const terrainPreparedRef = useRef<string | null>(null);
  const cameraPreparedRef = useRef<string | null>(null);
  const terrainModeRef = useRef<TerrainMode>(DEFAULT_TERRAIN_MODE);
  const terrainStrengthRef = useRef<number>(DEFAULT_TERRAIN_STRENGTH);
  const terrainAvailableRef = useRef(false);
  const routeProgressRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const lowPowerDeviceRef = useRef(false);
  const autoPlayKeyRef = useRef<string | null>(null);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onUnavailableRef = useRef(onUnavailable);
  const [camera, setCamera] = useState<CameraSnapshot>(INITIAL_CAMERA);
  const [mapReady, setMapReady] = useState(false);
  const [journeyRunning, setJourneyRunning] = useState(false);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  const [terrainMode, setTerrainMode] = useState<TerrainMode>(DEFAULT_TERRAIN_MODE);
  const [terrainStrength, setTerrainStrength] = useState<number>(DEFAULT_TERRAIN_STRENGTH);
  const [terrainPreparing, setTerrainPreparing] = useState(false);
  const [cameraPreparing, setCameraPreparing] = useState(false);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [terrainActive, setTerrainActive] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenario.id);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState<"standard" | "compact">("standard");
  const [status, setStatus] = useState("Globe und Kartendaten werden geladen …");

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
    onUnavailableRef.current = onUnavailable;
  }, [onAnimationComplete, onUnavailable]);

  const updateRouteOverlay = useCallback(() => {
    const map = mapRef.current;
    const overlay = routeOverlayRef.current;
    const route = routeLineRef.current;
    const shadow = routeShadowRef.current;
    const clip = routeClipRef.current;
    const gradient = routeGradientRef.current;
    if (!map || !overlay || !route || !shadow || !clip || !gradient) return;
    const scenario = activeScenarioRef.current;
    const coordinates = routeLineCoordinates(scenario.guess, scenario.target);
    const points = coordinates.map((coordinate) => map.project(coordinate));
    if (points.length < 2 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;
    const startCenter = map.project(scenario.guess);
    const endCenter = map.project(scenario.target);
    const startDirection = { x: points[1].x - startCenter.x, y: points[1].y - startCenter.y };
    const endDirection = { x: endCenter.x - points.at(-2)!.x, y: endCenter.y - points.at(-2)!.y };
    const normalize = (direction: { x: number; y: number }) => {
      const length = Math.max(0.001, Math.hypot(direction.x, direction.y));
      return { x: direction.x / length, y: direction.y / length };
    };
    const startUnit = normalize(startDirection);
    const endUnit = normalize(endDirection);
    const ellipseRadius = (unit: { x: number; y: number }, width: number, height: number) =>
      1 / Math.sqrt((unit.x ** 2) / ((width / 2) ** 2) + (unit.y ** 2) / ((height / 2) ** 2));
    const startGap = ellipseRadius(startUnit, 46, 14) + 10;
    const targetRing = targetMarkerRef.current?.getElement().querySelector<SVGElement>(`.${styles.markerRings}`);
    const targetRingRect = targetRing?.getBoundingClientRect();
    const targetWidth = targetRingRect?.width || 58;
    const targetHeight = targetRingRect?.height || 18;
    const endGap = ellipseRadius(endUnit, targetWidth, targetHeight) + 12;
    const visibility = coordinates.map((coordinate) => !map.transform.isLocationOccluded(
      new maplibregl.LngLat(coordinate[0], coordinate[1])
    ));
    const visibleSegment = longestVisibleScreenSegment(points, visibility);
    const clippedPoints = trimScreenPolyline(
      visibleSegment.points,
      visibleSegment.startsRoute ? startGap : 0,
      visibleSegment.endsRoute ? endGap : 0
    );
    const d = clippedPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    if (!d) {
      route.setAttribute("d", ""); shadow.setAttribute("d", ""); clip.setAttribute("d", "");
      routeBoundsRef.current = null;
      return;
    }
    route.setAttribute("d", d); shadow.setAttribute("d", d); clip.setAttribute("d", d);
    gradient.setAttribute("x1", String(clippedPoints[0].x)); gradient.setAttribute("y1", String(clippedPoints[0].y));
    gradient.setAttribute("x2", String(clippedPoints.at(-1)!.x)); gradient.setAttribute("y2", String(clippedPoints.at(-1)!.y));
    routeBoundsRef.current = clippedPoints.reduce<ScreenBounds>((bounds, point) => ({
      minX: Math.min(bounds.minX, point.x), minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x), maxY: Math.max(bounds.maxY, point.y)
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const length = route.getTotalLength();
    const drawn = Math.max(0.001, length * routeProgressRef.current);
    clip.setAttribute("stroke-dasharray", `${drawn} ${Math.max(0.001, length)}`);
    overlay.dataset.visible = routeVisibleRef.current ? "true" : "false";
    const mapWidth = map.getContainer().clientWidth;
    const mapHeight = map.getContainer().clientHeight;
    const compactExtremeGlobe = (mapWidth < 700 || mapHeight < 520)
      && distanceBetweenCoordinatesKm(scenario.guess, scenario.target) >= 12_500;
    const placeLabelAtEdge = (marker: maplibregl.Marker | null, centerX: number) => {
      const element = marker?.getElement();
      const label = element?.querySelector<HTMLElement>(`.${styles.markerLabel}`);
      if (!element || !label) return;
      const halfWidth = label.offsetWidth / 2;
      const edge = centerX < halfWidth + 16 ? "right" : centerX > mapWidth - halfWidth - 76 ? "left" : "center";
      element.setAttribute("data-label-edge", edge);
    };
    const guessElement = guessMarkerRef.current?.getElement();
    const targetElement = targetMarkerRef.current?.getElement();
    if (compactExtremeGlobe) {
      // On a narrow portrait map, near-antipodal anchors already occupy the
      // upper and lower globe rim. Keep their labels on the inside of that
      // composition; exterior labels would be clipped even when both actual
      // geographical anchors are correctly visible.
      guessElement?.setAttribute("data-label-edge", "center");
      targetElement?.setAttribute("data-label-edge", "center");
      guessElement?.setAttribute("data-label-vertical", "above");
      targetElement?.setAttribute("data-label-vertical", "below");
    } else {
      placeLabelAtEdge(guessMarkerRef.current, startCenter.x);
      placeLabelAtEdge(targetMarkerRef.current, endCenter.x);
      const guessIsHigherOnScreen = startCenter.y <= endCenter.y;
      guessElement?.setAttribute("data-label-vertical", guessIsHigherOnScreen ? "above" : "below");
      targetElement?.setAttribute("data-label-vertical", guessIsHigherOnScreen ? "below" : "above");
    }
  }, []);

  const setRouteDrawProgress = useCallback((progress: number) => {
    const nextProgress = Math.min(1, Math.max(0, progress));
    routeProgressRef.current = nextProgress;
    updateRouteOverlay();
  }, [updateRouteOverlay]);

  const setMarkerVisibility = useCallback((kind: "guess" | "target", visible: boolean) => {
    const marker = kind === "guess" ? guessMarkerRef.current : targetMarkerRef.current;
    marker?.getElement().setAttribute("data-visible", visible ? "true" : "false");
    if (kind === "target") {
      marker?.getElement().setAttribute("data-focus", visible ? "true" : "false");
      if (!visible) marker?.getElement().setAttribute("data-label-visible", "false");
    }
  }, []);

  const setTargetLabelVisibility = useCallback((visible: boolean) => {
    targetMarkerRef.current?.getElement().setAttribute("data-label-visible", visible ? "true" : "false");
  }, []);

  const setRouteVisibility = useCallback((visible: boolean) => {
    routeVisibleRef.current = visible;
    if (!visible) routeProgressRef.current = 0;
    updateRouteOverlay();
  }, [updateRouteOverlay]);

  const setTerrainLevel = useCallback((level: number | null) => {
    const map = mapRef.current;
    if (!map || !terrainAvailableRef.current || terrainLevelRef.current === level) return;
    try {
      map.setTerrain(level === null ? null : { source: PUNKTLANDUNG_TERRAIN_SOURCE_ID, exaggeration: level });
      terrainLevelRef.current = level;
      setTerrainActive(level !== null && level > 0.05);
    } catch (error) {
      console.warn("[Punktlandung globe] Terrain konnte nicht aktiviert werden", error);
      terrainAvailableRef.current = false;
      terrainLevelRef.current = null;
      setTerrainAvailable(false);
      setTerrainActive(false);
      setStatus("Terrain-Fallback aktiv · Hillshade bleibt sichtbar");
    }
  }, []);

  const setResultMarkerContent = useCallback((scenario: ResultCameraScenario) => {
    const distanceLabel = formatDistance(buildResultCameraPlan(scenario.guess, scenario.target).distanceKm);
    const guessElement = guessMarkerRef.current?.getElement();
    const targetElement = targetMarkerRef.current?.getElement();
    const guessLabel = guessElement?.querySelector<HTMLElement>("[data-marker-label]");
    const targetLabel = targetElement?.querySelector<HTMLElement>("[data-marker-label]");
    if (guessLabel) {
      guessLabel.textContent = scenario.playerName;
      const distance = document.createElement("span");
      distance.className = "punktlandung-map-label-distance";
      distance.textContent = ` · ${distanceLabel}`;
      guessLabel.append(distance);
    }
    if (targetLabel) targetLabel.textContent = scenario.targetName;
    guessElement?.setAttribute("aria-label", `${scenario.playerName}: ${distanceLabel} entfernt`);
    targetElement?.setAttribute("aria-label", `${scenario.targetName}: Zusatzinformationen anzeigen`);

    const popupContent = document.createElement("div");
    popupContent.className = styles.markerPopupContent;
    const popupTitle = document.createElement("strong");
    popupTitle.textContent = scenario.targetName;
    const popupDescription = document.createElement("span");
    popupDescription.textContent = scenario.targetDescription;
    popupContent.append(popupTitle, popupDescription);
    const opensBelowTarget = scenario.target[1] < scenario.guess[1];
    const popup = new maplibregl.Popup({
      anchor: opensBelowTarget ? "top" : "bottom",
      className: `kartenlabor-result-popup${opensBelowTarget ? " is-below-label" : ""}`,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "280px",
      offset: opensBelowTarget ? [0, 80] : [0, -112]
    }).setDOMContent(popupContent);
    popup.on("open", () => {
      const closeButton = popup.getElement()?.querySelector<HTMLButtonElement>(".maplibregl-popup-close-button");
      closeButton?.setAttribute("aria-label", "Zusatzinformation schließen");
      closeButton?.removeAttribute("title");
    });
    targetMarkerRef.current?.setPopup(popup);
  }, []);

  const preloadTerrain = useCallback(async (plan: ResultCameraPlan, run: number): Promise<boolean> => {
    const map = mapRef.current;
    if (!map || run !== journeyRunRef.current || !terrainAvailableRef.current) return false;
    const shouldUseTerrain = terrainModeRef.current === "on";
    const scenario = activeScenarioRef.current;
    const preparationKey = `${scenario.id}:${terrainModeRef.current}:${terrainStrengthRef.current}:${shouldUseTerrain}`;
    if (terrainPreparedRef.current === preparationKey) return shouldUseTerrain;
    if (!shouldUseTerrain) {
      setTerrainLevel(null);
      terrainPreparedRef.current = preparationKey;
      return false;
    }
    setTerrainPreparing(true);
    setTerrainLevel(terrainStrengthRef.current);
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        map.off("idle", finish);
        resolve();
      };
      const timeout = window.setTimeout(finish, embedded ? 750 : 1_500);
      map.once("idle", finish);
    });
    const ready = run === journeyRunRef.current;
    if (ready) { terrainPreparedRef.current = preparationKey; setTerrainPreparing(false); }
    return ready;
  }, [embedded, setTerrainLevel]);

  const composeResultEndFrame = useCallback(async (plan: ResultCameraPlan): Promise<CameraKeyframe> => {
    const map = mapRef.current;
    if (!map) return plan.keyframes.at(-1)!;
    const container = map.getContainer();
    const scenario = activeScenarioRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const key = `${scenario.guess.join(",")}:${scenario.target.join(",")}:${width}x${height}:${terrainModeRef.current}:${terrainStrengthRef.current}`;
    const end = plan.keyframes.at(-1)!;
    const frame: CameraKeyframe = { ...end, center: [...end.center] as GlobeCoordinates };
    const compact = width < 700 || height < 520;
    const extremeGlobe = plan.distanceClass === "long" && plan.distanceKm >= 12_500;
    if (extremeGlobe) {
      frame.pitch = compact ? 0 : Math.min(frame.pitch, 8);
      if (compact) frame.zoom = Math.max(frame.zoom, 2.48);
    }
    const safe = {
      left: compact ? 14 : 28,
      top: extremeGlobe && compact ? 14 : compact ? 72 : 32,
      right: width - (compact ? 14 : 86),
      bottom: height - (extremeGlobe && compact ? 14 : compact ? 72 : 48)
    };
    const minimumZoom = plan.distanceClass === "long"
      ? compact ? 0.2 : Math.max(1.15, end.zoom - 0.95)
      : plan.distanceClass === "medium" ? Math.max(4.1, end.zoom - 1.55) : Math.max(6.75, end.zoom - 2.05);

    for (let iteration = 0; iteration < 7; iteration += 1) {
      map.jumpTo(frame);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      updateRouteOverlay();
      const bounds: ScreenBounds[] = [];
      const routeBounds = routeBoundsRef.current;
      if (routeBounds) bounds.push(routeBounds);
      ([guessMarkerRef.current, targetMarkerRef.current] as const).forEach((marker) => {
        const element = marker?.getElement();
        const pin = element?.querySelector<SVGElement>(`.${styles.markerPin}`);
        const rings = element?.querySelector<SVGElement>(`.${styles.markerRings}`);
        const label = element?.querySelector<HTMLElement>(`.${styles.markerLabel}`);
        if (!element || !pin || !rings || !label) return;
        const containerRect = container.getBoundingClientRect();
        // The pin and rings intentionally overflow their marker wrapper. A
        // wrapper rect therefore misses exactly the clipped tip/ripple cases
        // seen on narrow result cards. Measure every visible part separately.
        [pin, rings, label].forEach((part) => {
          const rect = part.getBoundingClientRect();
          bounds.push({
            minX: rect.left - containerRect.left,
            minY: rect.top - containerRect.top,
            maxX: rect.right - containerRect.left,
            maxY: rect.bottom - containerRect.top
          });
        });
      });
      if (bounds.length === 0) break;
      const union = bounds.reduce<ScreenBounds>((result, value) => ({
        minX: Math.min(result.minX, value.minX), minY: Math.min(result.minY, value.minY),
        maxX: Math.max(result.maxX, value.maxX), maxY: Math.max(result.maxY, value.maxY)
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      const safeWidth = Math.max(1, safe.right - safe.left);
      const safeHeight = Math.max(1, safe.bottom - safe.top);
      const contentWidth = Math.max(1, union.maxX - union.minX);
      const contentHeight = Math.max(1, union.maxY - union.minY);
      let fitScale = Math.min(1, safeWidth / contentWidth, safeHeight / contentHeight);
      if (extremeGlobe) {
        // Near-antipodal results must keep their geographic midpoint fixed or
        // one endpoint crosses the horizon. Fit their hull around the visual
        // map centre instead of merely comparing width/height; this also
        // catches a pin tip that protrudes through one edge.
        const origin = { x: width / 2, y: height / 2 };
        const directionalScales = [
          union.minX < origin.x ? (origin.x - safe.left) / (origin.x - union.minX) : 1,
          union.maxX > origin.x ? (safe.right - origin.x) / (union.maxX - origin.x) : 1,
          union.minY < origin.y ? (origin.y - safe.top) / (origin.y - union.minY) : 1,
          union.maxY > origin.y ? (safe.bottom - origin.y) / (union.maxY - origin.y) : 1
        ];
        fitScale = Math.min(fitScale, ...directionalScales.map((value) => Math.min(1, value)));
      }
      if (fitScale < 0.99) frame.zoom = Math.max(minimumZoom, frame.zoom + Math.log2(Math.max(0.45, fitScale)));

      const contentCenter = { x: (union.minX + union.maxX) / 2, y: (union.minY + union.maxY) / 2 };
      const safeCenter = { x: (safe.left + safe.right) / 2, y: (safe.top + safe.bottom) / 2 };
      const shiftX = safeCenter.x - contentCenter.x;
      const shiftY = safeCenter.y - contentCenter.y;
      // With near-antipodal points the spherical midpoint is the only camera
      // center that guarantees both endpoints share the visible hemisphere.
      // Screen-space recentering can move that midpoint across the horizon, so
      // these extreme results are composed by zoom alone.
      if (!extremeGlobe && (Math.abs(shiftX) > 1 || Math.abs(shiftY) > 1)) {
        const centerPoint = map.project(map.getCenter());
        const shiftedCenter = map.unproject([centerPoint.x - shiftX, centerPoint.y - shiftY]);
        frame.center = [shiftedCenter.lng, shiftedCenter.lat];
      }
    }
    map.jumpTo(frame);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    updateRouteOverlay();
    Object.assign(end, frame);
    composedEndFrameRef.current = { key, frame: { ...frame, center: [...frame.center] as GlobeCoordinates } };
    return end;
  }, [updateRouteOverlay]);

  const preloadCameraViews = useCallback(async (plan: ResultCameraPlan, run: number): Promise<boolean> => {
    const map = mapRef.current;
    const scenario = activeScenarioRef.current;
    if (!map || run !== journeyRunRef.current) return false;
    const key = `${scenario.guess.join(",")}:${scenario.target.join(",")}:${map.getContainer().clientWidth}x${map.getContainer().clientHeight}:${terrainModeRef.current}:${terrainStrengthRef.current}`;
    await composeResultEndFrame(plan);
    if (cameraPreparedRef.current === key) return true;
    setCameraPreparing(true);
    const waitForTiles = (timeoutMs: number) => new Promise<void>((resolve) => {
      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeout);
        map.off("idle", finish);
        resolve();
      };
      const timeout = window.setTimeout(finish, timeoutMs);
      map.once("idle", finish);
    });
    const transit = plan.keyframes.reduce((lowest, frame) => frame.zoom < lowest.zoom ? frame : lowest);
    const end = plan.keyframes.at(-1)!;
    const preparationFrames = embedded ? [end] : [transit, end];
    const transitTimeout = embedded ? (plan.distanceClass === "long" ? 700 : 500) : 1_200;
    for (const frame of preparationFrames) {
      if (run !== journeyRunRef.current) return false;
      map.jumpTo(frame);
      await waitForTiles(transitTimeout);
    }
    const start = plan.keyframes[0];
    map.jumpTo(start);
    await waitForTiles(embedded ? 350 : 800);
    const ready = run === journeyRunRef.current;
    if (ready) { cameraPreparedRef.current = key; setCameraPreparing(false); }
    return ready;
  }, [composeResultEndFrame, embedded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    const updateMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
      setReducedMotion(motionQuery.matches);
    };
    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);
    lowPowerDeviceRef.current = (navigator.hardwareConcurrency || 8) <= 4 || (navigatorWithMemory.deviceMemory ?? 8) <= 4;
    setDeviceProfile(lowPowerDeviceRef.current ? "compact" : "standard");
    setSurfaceReady(false);

    const initialPlan = buildResultCameraPlan(initialScenario.guess, initialScenario.target, {
      compactViewport: container.clientWidth < 700
    });
    const initialFrame = revealImmediately ? initialPlan.keyframes.at(-1)! : initialPlan.keyframes[0];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container, style: punktlandungMapStyleUrl("globe"), center: initialFrame.center,
        zoom: initialFrame.zoom, bearing: initialFrame.bearing, pitch: initialFrame.pitch,
        maxPitch: 70, renderWorldCopies: false, attributionControl: false,
        dragRotate: true, touchPitch: true, scrollZoom: true, keyboard: true, boxZoom: false,
        canvasContextAttributes: { antialias: !lowPowerDeviceRef.current }, fadeDuration: lowPowerDeviceRef.current ? 0 : 180
      });
    } catch (error) {
      console.error("[Punktlandung globe] WebGL konnte nicht initialisiert werden", error);
      setStatus("3D-Karte auf diesem Gerät nicht verfügbar");
      onUnavailableRef.current?.();
      return;
    }
    mapRef.current = map;
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.scrollZoom.enable();
    map.boxZoom.disable();
    const navigationControl = new maplibregl.NavigationControl({ visualizePitch: true });
    map.addControl(navigationControl, "top-right");
    const localizeNavigationControl = () => {
      const labels = [
        [".maplibregl-ctrl-zoom-in", "Vergrößern"],
        [".maplibregl-ctrl-zoom-out", "Verkleinern"],
        [".maplibregl-ctrl-compass", "Karte drehen; klicken für Norden oben"]
      ] as const;
      labels.forEach(([selector, label]) => {
        const button = container.querySelector<HTMLButtonElement>(selector);
        if (!button) return;
        button.removeAttribute("title");
        button.setAttribute("aria-label", label);
        button.dataset.tooltip = label;
      });
    };
    localizeNavigationControl();

    const canvas = map.getCanvas();
    let shiftGesture: { pointerId: number; x: number; y: number; bearing: number; pitch: number; restorePan: boolean } | null = null;
    const finishShiftGesture = () => {
      if (!shiftGesture) return;
      if (shiftGesture.restorePan) map.dragPan.enable();
      shiftGesture = null;
    };
    const beginShiftGesture = (event: PointerEvent) => {
      if (event.button !== 0 || !event.shiftKey) return;
      event.preventDefault();
      map.stop();
      shiftGesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        restorePan: map.dragPan.isEnabled()
      };
      map.dragPan.disable();
      canvas.setPointerCapture?.(event.pointerId);
    };
    const updateShiftGesture = (event: PointerEvent) => {
      if (!shiftGesture || event.pointerId !== shiftGesture.pointerId) return;
      event.preventDefault();
      map.jumpTo({
        bearing: shiftGesture.bearing + (event.clientX - shiftGesture.x) * 0.32,
        pitch: Math.max(0, Math.min(70, shiftGesture.pitch - (event.clientY - shiftGesture.y) * 0.24))
      });
    };
    const endShiftGesture = (event: PointerEvent) => {
      if (!shiftGesture || event.pointerId !== shiftGesture.pointerId) return;
      finishShiftGesture();
    };
    canvas.addEventListener("pointerdown", beginShiftGesture, { capture: true });
    window.addEventListener("pointermove", updateShiftGesture, { capture: true });
    window.addEventListener("pointerup", endShiftGesture, { capture: true });
    window.addEventListener("pointercancel", endShiftGesture, { capture: true });

    let lastTelemetryUpdate = 0;
    const updateCamera = () => {
      const markerScale = Math.min(1, Math.max(0.68, 0.62 + map.getZoom() * 0.045));
      guessMarkerRef.current?.getElement().style.setProperty("--marker-scale", markerScale.toFixed(3));
      targetMarkerRef.current?.getElement().style.setProperty("--marker-scale", markerScale.toFixed(3));
      updateRouteOverlay();
      const now = performance.now();
      if (now - lastTelemetryUpdate < 100) return;
      lastTelemetryUpdate = now;
      const center = map.getCenter();
      setCamera({ lng: center.lng, lat: center.lat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    };
    const configureGlobe = () => {
      map.setProjection({ type: "globe" });
      const terrainSource = map.getStyle().sources[PUNKTLANDUNG_TERRAIN_SOURCE_ID];
      const canUseTerrain = terrainSource?.type === "raster-dem";
      terrainAvailableRef.current = canUseTerrain;
      setTerrainAvailable(canUseTerrain);
      terrainLevelRef.current = null;
      if (canUseTerrain) {
        map.setTerrain(null);
        setStatus("Globe bereit · adaptives Terrain · Hillshade bleibt aktiv");
      } else setStatus("Globe bereit · DEM-Quelle ist nicht terrainfähig");
    };
    const addResultOverlays = () => {
      guessMarkerRef.current = new maplibregl.Marker({
        element: createResultMarker("guess", "Dein Tipp"),
        anchor: "bottom",
        opacityWhenCovered: 0,
        subpixelPositioning: true
      })
        .setLngLat(initialScenario.guess).addTo(map);
      targetMarkerRef.current = new maplibregl.Marker({
        element: createResultMarker("target", "Ziel"),
        anchor: "bottom",
        opacityWhenCovered: 0,
        subpixelPositioning: true
      })
        .setLngLat(initialScenario.target).addTo(map);
      targetMarkerRef.current.getElement().addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        targetMarkerRef.current?.togglePopup();
      });
      setResultMarkerContent(initialScenario);
      map.jumpTo(revealImmediately ? initialPlan.keyframes.at(-1)! : initialPlan.keyframes[0]);
      setMarkerVisibility("guess", true);
      setMarkerVisibility("target", revealImmediately);
      setTargetLabelVisibility(revealImmediately);
      setRouteVisibility(revealImmediately);
      if (revealImmediately) setRouteDrawProgress(1);
    };
    let mapLoaded = false;
    const loadTimeout = window.setTimeout(() => {
      if (mapLoaded) return;
      console.warn("[Punktlandung globe] Kartenstart überschritt das Fallback-Zeitfenster");
      onUnavailableRef.current?.();
    }, embedded ? 8_000 : 12_000);
    const reportReady = () => {
      mapLoaded = true;
      window.clearTimeout(loadTimeout);
      addResultOverlays(); updateCamera();
      const scenario = initialScenario;
      const plan = initialPlan;
      const preparationRun = journeyRunRef.current;
      void (async () => {
        await preloadTerrain(plan, preparationRun);
        // Both the animated result and the static replay use the same measured
        // end composition. This keeps pins, labels and route inside the real
        // card footprint instead of relying on geographic bounds alone.
        await preloadCameraViews(plan, preparationRun);
        if (!mapRef.current || preparationRun !== journeyRunRef.current) return;
        map.jumpTo(revealImmediately ? plan.keyframes.at(-1)! : plan.keyframes[0]);
        setMarkerVisibility("guess", true);
        setMarkerVisibility("target", revealImmediately);
        setTargetLabelVisibility(revealImmediately);
        setRouteVisibility(revealImmediately);
        if (revealImmediately) setRouteDrawProgress(1);
        setSurfaceReady(true);
        setMapReady(true);
        setStatus(`${scenario.label} vorbereitet · Tipp sichtbar · ${formatDistance(plan.distanceKm)}`);
        if (revealImmediately) onAnimationCompleteRef.current?.();
      })();
    };
    const reportError = (event: maplibregl.ErrorEvent) => {
      console.error(`[Punktlandung globe] ${event.error.message}`, event.error);
      setStatus(`Kartenfehler: ${event.error.message}`);
    };

    map.on("style.load", configureGlobe); map.on("load", reportReady); map.on("move", updateCamera); map.on("error", reportError);
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      cameraPreparedRef.current = null;
      composedEndFrameRef.current = null;
    });
    resizeObserver.observe(container);
    return () => {
      journeyRunRef.current += 1;
      window.clearTimeout(loadTimeout);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      motionQuery.removeEventListener("change", updateMotionPreference);
      finishShiftGesture();
      canvas.removeEventListener("pointerdown", beginShiftGesture, { capture: true });
      window.removeEventListener("pointermove", updateShiftGesture, { capture: true });
      window.removeEventListener("pointerup", endShiftGesture, { capture: true });
      window.removeEventListener("pointercancel", endShiftGesture, { capture: true });
      resizeObserver.disconnect();
      map.off("style.load", configureGlobe); map.off("load", reportReady); map.off("move", updateCamera); map.off("error", reportError);
      guessMarkerRef.current?.remove(); targetMarkerRef.current?.remove(); map.remove(); mapRef.current = null;
    };
  }, [initialScenario, preloadCameraViews, preloadTerrain, revealImmediately, setMarkerVisibility, setResultMarkerContent, setRouteDrawProgress, setRouteVisibility, setTargetLabelVisibility, updateRouteOverlay]);

  const runTimeline = useCallback((keyframes: CameraKeyframe[], duration: number, run: number, onProgress?: (progress: number) => void): Promise<TimelineMetrics> => {
    const map = mapRef.current;
    if (!map || run !== journeyRunRef.current) return Promise.resolve({ completed: false, maxFrameGapMs: 0, slowFrames: 0, pendingTileSamples: 0, tileSamples: 0 });
    const start = performance.now();
    return new Promise((resolve) => {
      let previousFrame = start;
      let frameCount = 0;
      let maxFrameGapMs = 0;
      let slowFrames = 0;
      let pendingTileSamples = 0;
      let tileSamples = 0;
      const frame = (now: number) => {
        if (run !== journeyRunRef.current || !mapRef.current) {
          resolve({ completed: false, maxFrameGapMs, slowFrames, pendingTileSamples, tileSamples });
          return;
        }
        const frameGap = now - previousFrame;
        previousFrame = now;
        frameCount += 1;
        maxFrameGapMs = Math.max(maxFrameGapMs, frameGap);
        if (frameGap > 32) slowFrames += 1;
        if (frameCount % 6 === 0) {
          tileSamples += 1;
          if (!map.areTilesLoaded()) pendingTileSamples += 1;
        }
        const rawProgress = Math.min(1, (now - start) / duration);
        const progress = timelineProgress(rawProgress);
        map.jumpTo(sampleCameraTimeline(keyframes, progress));
        onProgress?.(progress);
        if (rawProgress < 1) animationFrameRef.current = requestAnimationFrame(frame);
        else {
          animationFrameRef.current = null;
          resolve({ completed: true, maxFrameGapMs, slowFrames, pendingTileSamples, tileSamples });
        }
      };
      animationFrameRef.current = requestAnimationFrame(frame);
    });
  }, []);

  const runNativeResultFlight = useCallback((
    plan: ResultCameraPlan,
    run: number,
    onProgress?: (progress: number) => void
  ): Promise<TimelineMetrics> => {
    const map = mapRef.current;
    if (!map || run !== journeyRunRef.current) {
      return Promise.resolve({ completed: false, maxFrameGapMs: 0, slowFrames: 0, pendingTileSamples: 0, tileSamples: 0 });
    }
    const start = performance.now();
    const end = plan.keyframes[plan.keyframes.length - 1];
    const minimumZoom = Math.min(...plan.keyframes.map((keyframe) => keyframe.zoom));
    const easing = (progress: number) => 0.5 - Math.cos(Math.PI * progress) / 2;

    map.flyTo({
      center: end.center,
      zoom: end.zoom,
      bearing: end.bearing,
      pitch: end.pitch,
      minZoom: minimumZoom,
      duration: plan.durationMs,
      easing,
      essential: false
    });

    return new Promise((resolve) => {
      let previousFrame = start;
      let frameCount = 0;
      let maxFrameGapMs = 0;
      let slowFrames = 0;
      let pendingTileSamples = 0;
      let tileSamples = 0;
      const monitor = (now: number) => {
        if (run !== journeyRunRef.current || !mapRef.current) {
          resolve({ completed: false, maxFrameGapMs, slowFrames, pendingTileSamples, tileSamples });
          return;
        }
        const frameGap = now - previousFrame;
        previousFrame = now;
        frameCount += 1;
        maxFrameGapMs = Math.max(maxFrameGapMs, frameGap);
        if (frameGap > 32) slowFrames += 1;
        if (frameCount % 6 === 0) {
          tileSamples += 1;
          if (!map.areTilesLoaded()) pendingTileSamples += 1;
        }
        const rawProgress = Math.min(1, (now - start) / plan.durationMs);
        onProgress?.(easing(rawProgress));
        if (rawProgress < 1) animationFrameRef.current = requestAnimationFrame(monitor);
        else {
          animationFrameRef.current = null;
          resolve({ completed: true, maxFrameGapMs, slowFrames, pendingTileSamples, tileSamples });
        }
      };
      animationFrameRef.current = requestAnimationFrame(monitor);
    });
  }, []);

  const stopCurrentJourney = useCallback(() => {
    journeyRunRef.current += 1;
    if (animationFrameRef.current !== null) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    mapRef.current?.stop(); setJourneyRunning(false); setCameraPreparing(false); setTerrainPreparing(false);
  }, []);

  const moveToPreset = useCallback((preset: CameraPreset) => {
    const map = mapRef.current;
    if (!map) return;
    stopCurrentJourney(); setMarkerVisibility("guess", false); setMarkerVisibility("target", false); setRouteVisibility(false);
    map.easeTo({ center: preset.center, zoom: preset.zoom, bearing: preset.bearing, pitch: preset.pitch,
      duration: reducedMotionRef.current ? 0 : 850, essential: false });
    setStatus(`${preset.label} · Kamerapreset`);
  }, [setMarkerVisibility, setRouteVisibility, stopCurrentJourney]);

  const runMunichJourney = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    stopCurrentJourney();
    const run = journeyRunRef.current + 1; journeyRunRef.current = run;
    setJourneyRunning(true); setMarkerVisibility("guess", false); setMarkerVisibility("target", false); setRouteVisibility(false);
    setTerrainLevel(terrainModeRef.current === "on" ? terrainStrengthRef.current : null);
    setStatus("Ein Flug: Welt → Europa → München · durchgehende Rechtskurve");
    try {
      if (reducedMotionRef.current) {
        map.easeTo({ center: CAMERA_PRESETS.munich.center, zoom: CAMERA_PRESETS.munich.zoom, bearing: CAMERA_PRESETS.munich.bearing,
          pitch: CAMERA_PRESETS.munich.pitch, duration: 320, essential: false });
        await pause(350);
      } else {
        const metrics = await runTimeline(buildMunichJourneyKeyframes(), lowPowerDeviceRef.current ? 2_650 : 3_000, run);
        if (run === journeyRunRef.current && metrics.completed) setStatus(`München erreicht · ohne Europa-Pause · ${formatTimelineMetrics(metrics)}`);
      }
      if (run === journeyRunRef.current && reducedMotionRef.current) setStatus("München erreicht · Reduced-Motion-Ease");
    } finally { if (run === journeyRunRef.current) setJourneyRunning(false); }
  }, [mapReady, runTimeline, setMarkerVisibility, setRouteVisibility, setTerrainLevel, stopCurrentJourney]);

  const updateResultGeometry = useCallback((scenario: ResultCameraScenario) => {
    activeScenarioRef.current = scenario;
    guessMarkerRef.current?.setLngLat(scenario.guess); targetMarkerRef.current?.setLngLat(scenario.target);
    setResultMarkerContent(scenario);
    updateRouteOverlay();
  }, [setResultMarkerContent, updateRouteOverlay]);

  const prepareScenario = useCallback(async (scenario: ResultCameraScenario) => {
    const map = mapRef.current;
    if (!map) return;
    stopCurrentJourney(); setSelectedScenarioId(scenario.id); updateResultGeometry(scenario);
    const plan = buildResultCameraPlan(scenario.guess, scenario.target, { compactViewport: (containerRef.current?.clientWidth ?? 800) < 700 });
    const start = plan.keyframes[0];
    map.jumpTo({ center: start.center, zoom: start.zoom, bearing: start.bearing, pitch: start.pitch });
    setMarkerVisibility("guess", true); setMarkerVisibility("target", false); setRouteVisibility(false);
    const run = journeyRunRef.current;
    setStatus(`${scenario.label} · Tipp gesetzt · 3D wird vor der Auflösung vorbereitet`);
    await preloadTerrain(plan, run);
    await preloadCameraViews(plan, run);
    if (run === journeyRunRef.current) setStatus(`${scenario.label} vorbereitet · Tipp sichtbar · ${formatDistance(plan.distanceKm)} · Klasse ${plan.distanceClass}`);
  }, [preloadCameraViews, preloadTerrain, setMarkerVisibility, setRouteVisibility, stopCurrentJourney, updateResultGeometry]);

  const runResultJourney = useCallback(async () => {
    const map = mapRef.current;
    const scenario = resultScenario ?? RESULT_CAMERA_SCENARIOS.find((candidate) => candidate.id === selectedScenarioId);
    if (!map || !scenario || !mapReady) return;
    stopCurrentJourney();
    const run = journeyRunRef.current + 1; journeyRunRef.current = run;
    const plan = buildResultCameraPlan(scenario.guess, scenario.target, {
      compactViewport: (containerRef.current?.clientWidth ?? 800) < 700, durationScale: lowPowerDeviceRef.current ? 0.86 : 1
    });
    let routeRevealed = false;
    let targetRevealed = false;
    let targetLabelRevealed = false;
    let lastRouteUpdate = 0;
    setJourneyRunning(true); updateResultGeometry(scenario); map.jumpTo(plan.keyframes[0]);
    setMarkerVisibility("guess", true); setMarkerVisibility("target", false); setRouteVisibility(false);
    await preloadTerrain(plan, run);
    await preloadCameraViews(plan, run);
    if (run !== journeyRunRef.current) return;
    setStatus(`Ergebnisflug ${plan.distanceClass} · ${formatDistance(plan.distanceKm)} · ${plan.durationMs / 1_000}s`);
    try {
      if (reducedMotionRef.current) {
        const end = plan.keyframes[plan.keyframes.length - 1];
        setRouteVisibility(true); setMarkerVisibility("target", true); setTargetLabelVisibility(true); setRouteDrawProgress(1);
        map.easeTo({ center: end.center, zoom: end.zoom, bearing: end.bearing, pitch: end.pitch, duration: 320, essential: false });
        await pause(350);
      } else {
        const updateReveal = (progress: number) => {
          if (!routeRevealed && progress >= plan.revealProgress) { routeRevealed = true; setRouteVisibility(true); }
          if (!targetRevealed && progress >= plan.targetRevealProgress) { targetRevealed = true; setMarkerVisibility("target", true); }
          if (!targetLabelRevealed && progress >= plan.targetLabelRevealProgress) { targetLabelRevealed = true; setTargetLabelVisibility(true); }
          if (routeRevealed && progress - lastRouteUpdate >= 0.025) {
            lastRouteUpdate = progress;
            setRouteDrawProgress((progress - plan.revealProgress) / Math.max(0.001, 1 - plan.revealProgress));
          }
        };
        const metrics = plan.distanceClass === "long"
          ? await runNativeResultFlight(plan, run, updateReveal)
          : await runTimeline(plan.keyframes, plan.durationMs, run, updateReveal);
        if (run === journeyRunRef.current && metrics.completed) {
          setStatus(`Ergebnis sichtbar · ${formatDistance(plan.distanceKm)} · Pitch ${plan.keyframes.at(-1)?.pitch ?? 0}° · Terrain ${terrainLevelRef.current && terrainLevelRef.current > 0.05 ? "aktiv" : "aus"} · ${formatTimelineMetrics(metrics)}`);
        }
      }
      if (run === journeyRunRef.current) {
        setRouteVisibility(true); setMarkerVisibility("target", true); setTargetLabelVisibility(true); setRouteDrawProgress(1);
        if (reducedMotionRef.current) setStatus(`Ergebnis sichtbar · ${formatDistance(plan.distanceKm)} · Reduced-Motion-Ease · Terrain ${terrainLevelRef.current && terrainLevelRef.current > 0.05 ? "aktiv" : "aus"}`);
        onAnimationCompleteRef.current?.();
      }
    } finally { if (run === journeyRunRef.current) setJourneyRunning(false); }
  }, [mapReady, preloadCameraViews, preloadTerrain, resultScenario, runNativeResultFlight, runTimeline, selectedScenarioId, setMarkerVisibility, setRouteDrawProgress, setRouteVisibility, setTargetLabelVisibility, stopCurrentJourney, updateResultGeometry]);

  useEffect(() => {
    if (!autoPlay || !mapReady || journeyRunning || terrainPreparing || cameraPreparing) return;
    const key = `${initialScenario.id}:${initialScenario.guess.join(",")}:${initialScenario.target.join(",")}`;
    if (autoPlayKeyRef.current === key) return;
    autoPlayKeyRef.current = key;
    void runResultJourney();
  }, [autoPlay, cameraPreparing, initialScenario, journeyRunning, mapReady, runResultJourney, terrainPreparing]);

  const changeTerrainMode = useCallback((mode: TerrainMode) => {
    terrainPreparedRef.current = null;
    cameraPreparedRef.current = null;
    composedEndFrameRef.current = null;
    terrainModeRef.current = mode; setTerrainMode(mode);
    if (mode === "on") setTerrainLevel(terrainStrengthRef.current);
    else setTerrainLevel(null);
    setStatus(mode === "adaptive" ? "Terrain adaptiv · flüssiger Hillshade-Default, echtes 3D nur im Vergleichsmodus An"
      : mode === "on" ? `Terrain dauerhaft ${terrainStrengthRef.current.toFixed(2)}× aktiviert` : "Terrain deaktiviert · Hillshade bleibt sichtbar");
  }, [setTerrainLevel]);

  const changeTerrainStrength = useCallback((strength: number) => {
    terrainPreparedRef.current = null;
    cameraPreparedRef.current = null;
    composedEndFrameRef.current = null;
    terrainStrengthRef.current = strength; setTerrainStrength(strength);
    terrainModeRef.current = "on"; setTerrainMode("on"); setTerrainLevel(strength);
    setStatus(`Terrain An · 3D-Stärke ${strength.toFixed(2)}× aktiv`);
  }, [setTerrainLevel]);

  const selectedScenario = availableScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? initialScenario;
  const selectedPlan = buildResultCameraPlan(selectedScenario.guess, selectedScenario.target);

  return (
    <section className={`${styles.lab}${embedded ? ` ${styles.embedded}` : ""}`} aria-label={embedded ? "Interaktive 3D-Ergebniskarte" : "Globe-Testansicht"}>
      {!embedded ? <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Durchgehender Referenzflug</span>
          <button className={styles.primaryButton} type="button" onClick={runMunichJourney} disabled={!mapReady || journeyRunning}>
            {journeyRunning ? "Animation läuft …" : "Welt → Europa → München"}
          </button>
        </div>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Ergebnisdistanz</span>
          <div className={styles.segmented}>
            {availableScenarios.map((scenario) => (
              <button key={scenario.id} type="button" aria-pressed={scenario.id === selectedScenarioId}
                onClick={() => prepareScenario(scenario)} disabled={!mapReady || journeyRunning}>
                {scenario.id === "short" ? "Kurz" : scenario.id === "medium" ? "Mittel" : "Groß"}
              </button>
            ))}
          </div>
          <button className={styles.resultButton} type="button" onClick={runResultJourney} disabled={!mapReady || journeyRunning || terrainPreparing || cameraPreparing}>
            {terrainPreparing || cameraPreparing ? "Kamerafahrt wird vorbereitet …" : "Ergebnisanimation starten"}
          </button>
        </div>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Terrain-Strategie · Standard: An</span>
          <div className={styles.segmented}>
            {(["adaptive", "on", "off"] as TerrainMode[]).map((mode) => (
              <button key={mode} type="button" aria-pressed={terrainMode === mode} onClick={() => changeTerrainMode(mode)}
                disabled={!mapReady || !terrainAvailable || journeyRunning}>
                {mode === "adaptive" ? "Adaptiv" : mode === "on" ? "An" : "Aus"}
              </button>
            ))}
          </div>
          <span className={styles.controlLabel}>3D-Stärke · Standard: 1,5×</span>
          <div className={styles.segmented}>
            {TERRAIN_STRENGTHS.map((strength) => (
              <button key={strength} type="button" aria-pressed={terrainStrength === strength}
                onClick={() => changeTerrainStrength(strength)} disabled={!mapReady || !terrainAvailable || journeyRunning}>
                {strength.toFixed(2).replace("1.00", "1.0")}×
              </button>
            ))}
          </div>
        </div>
      </div> : null}
      {!embedded ? <div className={styles.scenarioSummary}>
        <strong>{selectedScenario.label}</strong><span>{selectedScenario.description}</span>
        <span>{formatDistance(selectedPlan.distanceKm)} · {selectedPlan.durationMs / 1_000}s · End-Pitch {selectedPlan.keyframes.at(-1)?.pitch}°</span>
      </div> : null}
      <div
        className={styles.mapFrame}
        data-surface-ready={surfaceReady ? "true" : "false"}
        data-result-journey={journeyRunning ? "running" : "settled"}
      >
        <div ref={containerRef} className={styles.map} aria-label="Interaktiver Punktlandung-Globe" />
        {!embedded && (cameraPreparing || terrainPreparing) ? <div className={styles.preloadVeil}>Zielregion und Kartendaten werden vorbereitet …</div> : null}
        <svg ref={routeOverlayRef} className={styles.routeOverlay} aria-hidden="true">
          <defs>
            <linearGradient ref={routeGradientRef} id="kartenlabor-result-gradient" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f43f7a" /><stop offset="0.52" stopColor="#a78bfa" /><stop offset="1" stopColor="#5ee7bd" />
            </linearGradient>
            <mask id="kartenlabor-result-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
              <path ref={routeClipRef} className={styles.routeClip} />
            </mask>
          </defs>
          <path ref={routeShadowRef} className={styles.routeShadow} mask="url(#kartenlabor-result-reveal)" />
          <path ref={routeLineRef} className={styles.routeLine} mask="url(#kartenlabor-result-reveal)" />
        </svg>
        {!embedded ? <div className={styles.mapPresets} aria-label="Globe-Kamerapresets">
          {Object.values(CAMERA_PRESETS).map((preset) => (
            <button key={preset.label} type="button" onClick={() => moveToPreset(preset)} disabled={!mapReady || journeyRunning}>{preset.label}</button>
          ))}
        </div> : null}
        {!embedded ? <div className={styles.telemetry} aria-live="polite">
          <strong>{status}</strong><span>Center {camera.lat.toFixed(2)}°, {camera.lng.toFixed(2)}°</span>
          <span>Zoom {camera.zoom.toFixed(2)} · Bearing {camera.bearing.toFixed(1)}° · Pitch {camera.pitch.toFixed(1)}°</span>
          <span>{reducedMotion ? "Reduced Motion aktiv" : "Volle Bewegung"} · Gerätprofil {deviceProfile} · Terrain {terrainActive ? `${terrainStrength.toFixed(2)}×` : terrainMode}</span>
        </div> : null}
        <MapAttributionBadge />
      </div>
    </section>
  );
}

type GlobeResultMapProps = {
  scenario: ResultCameraScenario;
  animate?: boolean;
  onAnimationComplete?: () => void;
  onUnavailable?: () => void;
};

export function GlobeResultMap({ scenario, animate = true, onAnimationComplete, onUnavailable }: GlobeResultMapProps) {
  return (
    <GlobeMapLab
      resultScenario={scenario}
      embedded
      autoPlay={animate}
      revealImmediately={!animate}
      onAnimationComplete={onAnimationComplete}
      onUnavailable={onUnavailable}
    />
  );
}
