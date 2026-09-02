"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { MapAttributionBadge } from "@/components/MapAttributionBadge";
import {
  resultMarkerGraphicMarkup,
  resultMarkerRootClassName,
  resultRouteLineClassName
} from "@/components/ResultMapPrimitives";
import {
  buildMunichJourneyKeyframes,
  buildResultCameraPlan,
  type CameraKeyframe,
  type GlobeCoordinates,
  RESULT_CAMERA_CONFIG,
  RESULT_CAMERA_SCENARIOS,
  routeLineCoordinates,
  sampleCameraTimeline,
  RESULT_MAP_MIN_ZOOM,
  withResultCameraEndFrame,
  type ResultCameraPlan,
  type ResultCameraScenario
} from "@/lib/globeResultCamera";
import {
  expandResultRect,
  RESULT_MAP_CONTROL_LABELS,
  RESULT_ROUTE_DASH_GAP_PX,
  resultLabelHorizontalPlacement,
  resultLabelPairVerticalPlacement,
  resultMarkerCollisionOffsets,
  resultFitAdjustment,
  resultSafeRect,
  shouldRestoreResultTriggerFocus,
  trimProjectedRoute,
  unionResultRects,
  usesCenteredResultInfoOverlay,
  type ResultScreenRect
} from "@/lib/globeResultLayout";
import {
  RESULT_REVEAL_TIMING,
  remainingResultRevealWaits,
  type ResultRevealPhase
} from "@/lib/globeResultAnimation";
import { PUNKTLANDUNG_TERRAIN_SOURCE_ID, punktlandungMapStyleUrl } from "@/lib/mapStyle";
import styles from "./GlobeMapLab.module.css";

type CameraPreset = { label: string; center: GlobeCoordinates; zoom: number; bearing: number; pitch: number };
type CameraSnapshot = { lng: number; lat: number; zoom: number; bearing: number; pitch: number };
type TerrainMode = "adaptive" | "on" | "off";
type TimelineMetrics = { completed: boolean; maxFrameGapMs: number; slowFrames: number; pendingTileSamples: number; tileSamples: number };
type GlobeMapLabProps = {
  resultScenario?: ResultCameraScenario;
  embedded?: boolean;
  autoPlay?: boolean;
  revealImmediately?: boolean;
  previewMode?: boolean;
  targetInfoIndicator?: "i" | "?";
  animateTargetMarker?: boolean;
  terrainExaggeration?: number;
  onSurfaceReady?: () => void;
  onAnimationComplete?: () => void;
  onUnavailable?: () => void;
};

export function prewarmGlobeResultMap(): void {
  if (typeof window === "undefined") return;
  // MapLibre normally creates its workers with the first visible map. Starting
  // them during the guessing phase removes that setup cost from the reveal.
  maplibregl.prewarm();
}

function markResultMilestone(name: "punktlandung-result-surface" | "punktlandung-result-motion", measureName: string): void {
  performance.clearMarks(name);
  performance.mark(name);
  if (!performance.getEntriesByName("punktlandung-result-submit", "mark").length) return;
  performance.clearMeasures(measureName);
  performance.measure(measureName, "punktlandung-result-submit", name);
  if (name === "punktlandung-result-motion" && performance.getEntriesByName("punktlandung-result-surface", "mark").length) {
    performance.clearMeasures("punktlandung-result-visible-to-motion");
    performance.measure("punktlandung-result-visible-to-motion", "punktlandung-result-surface", name);
  }
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

function pause(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 100 ? `${Math.round(distanceKm)} km` : `${Math.round(distanceKm / 10) * 10} km`;
}

function createResultMarker(kind: "guess" | "target", label: string, targetInfoIndicator: "i" | "?" = "i"): HTMLDivElement {
  const marker = document.createElement("div");
  marker.className = `${styles.resultMarker} ${kind === "guess" ? styles.guessMarker : styles.targetMarker} ${resultMarkerRootClassName(kind)}`;
  marker.dataset.resultMarkerKind = kind;
  marker.dataset.visible = "false";
  marker.dataset.labelVisible = "false";
  if (kind === "target") marker.dataset.landing = "false";
  marker.setAttribute("aria-label", label);
  if (kind === "target") {
    marker.dataset.hasInfo = "true";
    marker.tabIndex = 0;
    marker.setAttribute("role", "button");
    marker.setAttribute("aria-haspopup", "dialog");
  }
  marker.innerHTML = `
    <span class="${styles.markerVisual}" aria-hidden="true">
      ${resultMarkerGraphicMarkup(kind, { pin: styles.markerPin, rings: styles.markerRings })}
    </span>
    <span class="${styles.markerLabel} punktlandung-map-label ${kind === "guess" ? "punktlandung-map-label-player punktlandung-player-color-0" : "punktlandung-map-label-actual"}"${kind === "target" ? ` data-info-indicator="${targetInfoIndicator}"` : ""} data-marker-label>${kind === "target" ? `<span class="${styles.targetLabelText}" data-marker-label-text>${label}</span>` : label}</span>`;
  return marker;
}

function timelineProgress(progress: number): number {
  return 0.5 - Math.cos(Math.PI * progress) / 2;
}

function formatTimelineMetrics(metrics: TimelineMetrics): string {
  return `Frame-Lücke max. ${Math.round(metrics.maxFrameGapMs)} ms · lange Frames ${metrics.slowFrames} · Tiles offen ${metrics.pendingTileSamples}/${metrics.tileSamples}`;
}

function activeResultSafeRect(width: number, height: number, previewMode: boolean): ResultScreenRect {
  const safeRect = resultSafeRect(width, height);
  if (!previewMode) {
    const compactShortFrame = width <= 440 && height <= 240;
    return compactShortFrame
      ? { ...safeRect, top: 22, bottom: Math.max(22, height - 16) }
      : { ...safeRect, top: safeRect.top + 2 };
  }

  return {
    ...safeRect,
    // The homepage card has no result header above the map. Give its floating
    // player label a little more breathing room without changing gameplay maps.
    top: Math.max(safeRect.top, Math.min(44, height * 0.15))
  };
}

export function GlobeMapLab({
  resultScenario,
  embedded = false,
  autoPlay = false,
  revealImmediately = false,
  previewMode = false,
  targetInfoIndicator = "i",
  animateTargetMarker = true,
  terrainExaggeration = RESULT_CAMERA_CONFIG.terrainExaggeration.result,
  onSurfaceReady,
  onAnimationComplete,
  onUnavailable
}: GlobeMapLabProps = {}) {
  const overlayId = useId().replace(/:/g, "");
  const routeGradientId = `kartenlabor-result-gradient-${overlayId}`;
  const routeRevealId = `kartenlabor-result-reveal-${overlayId}`;
  const initialScenario = resultScenario ?? RESULT_CAMERA_SCENARIOS[0];
  const availableScenarios = resultScenario ? [resultScenario] : RESULT_CAMERA_SCENARIOS;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const journeyRunRef = useRef(0);
  const compositionRunRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const guessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const targetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const targetPopupRef = useRef<maplibregl.Popup | null>(null);
  const activeScenarioRef = useRef<ResultCameraScenario>(initialScenario);
  const routeOverlayRef = useRef<SVGSVGElement | null>(null);
  const routeShadowRef = useRef<SVGPathElement | null>(null);
  const routeLineRef = useRef<SVGPathElement | null>(null);
  const routeClipRef = useRef<SVGPathElement | null>(null);
  const routeGradientRef = useRef<SVGLinearGradientElement | null>(null);
  const routeVisibleRef = useRef(false);
  const terrainLevelRef = useRef<number | null>(null);
  const terrainPreparedRef = useRef<string | null>(null);
  const cameraPreparedRef = useRef<string | null>(null);
  const preparedEndCameraRef = useRef<{ key: string; frame: Omit<CameraKeyframe, "at"> } | null>(null);
  const terrainModeRef = useRef<TerrainMode>(DEFAULT_TERRAIN_MODE);
  const terrainStrengthRef = useRef<number>(terrainExaggeration);
  const terrainAvailableRef = useRef(false);
  const routeProgressRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const lowPowerDeviceRef = useRef(false);
  const autoPlayKeyRef = useRef<string | null>(null);
  const autoPlayRef = useRef(autoPlay);
  const runResultJourneyRef = useRef<() => Promise<void>>(async () => undefined);
  const onSurfaceReadyRef = useRef(onSurfaceReady);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onUnavailableRef = useRef(onUnavailable);
  const mobileInfoDialogRef = useRef<HTMLDivElement | null>(null);
  const targetInfoInputModeRef = useRef<"keyboard" | "pointer">("pointer");
  const restoredViewRef = useRef<{ bearing: number; pitch: number } | null>(null);
  const [camera, setCamera] = useState<CameraSnapshot>(INITIAL_CAMERA);
  const [mapReady, setMapReady] = useState(false);
  const [journeyRunning, setJourneyRunning] = useState(false);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  const [terrainMode, setTerrainMode] = useState<TerrainMode>(DEFAULT_TERRAIN_MODE);
  const [terrainStrength, setTerrainStrength] = useState<number>(terrainExaggeration);
  const [terrainPreparing, setTerrainPreparing] = useState(false);
  const [cameraPreparing, setCameraPreparing] = useState(false);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const surfaceReadyRef = useRef(false);
  const [terrainActive, setTerrainActive] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenario.id);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState<"standard" | "compact">("standard");
  const [status, setStatus] = useState("Globe und Kartendaten werden geladen …");
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [previewInfoAnchorX, setPreviewInfoAnchorX] = useState<number | null>(null);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
    onSurfaceReadyRef.current = onSurfaceReady;
    onAnimationCompleteRef.current = onAnimationComplete;
    onUnavailableRef.current = onUnavailable;
  }, [autoPlay, onAnimationComplete, onSurfaceReady, onUnavailable]);

  useEffect(() => {
    if (!mobileInfoOpen) return;
    if (shouldRestoreResultTriggerFocus(targetInfoInputModeRef.current)) {
      mobileInfoDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      targetInfoInputModeRef.current = "keyboard";
      setMobileInfoOpen(false);
      targetMarkerRef.current?.getElement().focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileInfoOpen]);

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
    let points: Array<{ x: number; y: number }> = coordinates.map((coordinate) => {
      const point = map.project(coordinate);
      return { x: point.x, y: point.y };
    });
    if (points.length < 2 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;
    const rawProjectedGuess = map.project(scenario.guess);
    const rawProjectedTarget = map.project(scenario.target);
    const projectedGuess = { x: rawProjectedGuess.x, y: rawProjectedGuess.y };
    const projectedTarget = { x: rawProjectedTarget.x, y: rawProjectedTarget.y };
    const markerOffsets = resultMarkerCollisionOffsets(projectedGuess, projectedTarget);
    guessMarkerRef.current?.setOffset([markerOffsets.guess.x, markerOffsets.guess.y]);
    targetMarkerRef.current?.setOffset([markerOffsets.target.x, markerOffsets.target.y]);
    const startCenter = {
      x: projectedGuess.x + markerOffsets.guess.x,
      y: projectedGuess.y + markerOffsets.guess.y
    };
    const endCenter = {
      x: projectedTarget.x + markerOffsets.target.x,
      y: projectedTarget.y + markerOffsets.target.y
    };
    if (markerOffsets.active) {
      points = [startCenter, endCenter];
    } else {
      points[0] = startCenter;
      points[points.length - 1] = endCenter;
    }
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
    const guessRing = guessMarkerRef.current?.getElement().querySelector<SVGElement>("[data-result-marker-rings]");
    const guessRingRect = guessRing?.getBoundingClientRect();
    const startGap = ellipseRadius(startUnit, guessRingRect?.width || 46, guessRingRect?.height || 14) + RESULT_ROUTE_DASH_GAP_PX;
    const targetRing = targetMarkerRef.current?.getElement().querySelector<SVGElement>("[data-result-marker-rings]");
    const targetRingRect = targetRing?.getBoundingClientRect();
    const targetWidth = targetRingRect?.width || 58;
    const targetHeight = targetRingRect?.height || 18;
    const endGap = ellipseRadius(endUnit, targetWidth, targetHeight) + RESULT_ROUTE_DASH_GAP_PX;
    const visibility = markerOffsets.active
      ? [scenario.guess, scenario.target].map((coordinate) => !map.transform.isLocationOccluded(new maplibregl.LngLat(coordinate[0], coordinate[1])))
      : coordinates.map((coordinate) => !map.transform.isLocationOccluded(new maplibregl.LngLat(coordinate[0], coordinate[1])));
    const visibleSegments: Array<{ points: { x: number; y: number }[]; startsAtRouteStart: boolean; endsAtRouteEnd: boolean }> = [];
    let currentSegment: { x: number; y: number }[] = [];
    let segmentStartIndex = 0;
    const finishSegment = (endIndex: number) => {
      if (currentSegment.length >= 2) {
        visibleSegments.push({
          points: currentSegment,
          startsAtRouteStart: segmentStartIndex === 0,
          endsAtRouteEnd: endIndex === points.length - 1
        });
      }
      currentSegment = [];
    };
    const maximumProjectedStep = Math.max(180, Math.max(overlay.clientWidth, overlay.clientHeight) * 0.65);
    points.forEach((point, index) => {
      if (!visibility[index]) {
        finishSegment(index - 1);
        return;
      }
      const previousPoint = currentSegment.at(-1);
      if (previousPoint && Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) > maximumProjectedStep) {
        finishSegment(index - 1);
      }
      if (!currentSegment.length) segmentStartIndex = index;
      currentSegment.push(point);
    });
    finishSegment(points.length - 1);
    const endpointSegments = visibleSegments.filter((segment) => segment.startsAtRouteStart || segment.endsAtRouteEnd);
    const drawableSegments = endpointSegments.length > 0 ? endpointSegments : visibleSegments;
    const trimmedSegments = drawableSegments
      .map((segment) => trimProjectedRoute(
        segment.points,
        segment.startsAtRouteStart ? startGap : 0,
        segment.endsAtRouteEnd ? endGap : 0
      ))
      .filter((segment) => segment.length >= 2);
    const commands: string[] = [];
    trimmedSegments.forEach((segment) => {
      segment.forEach((point, index) => {
        commands.push(`${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
      });
    });
    const d = commands.join(" ");
    if (!d) {
      route.setAttribute("d", ""); shadow.setAttribute("d", ""); clip.setAttribute("d", "");
      return;
    }
    route.setAttribute("d", d); shadow.setAttribute("d", d); clip.setAttribute("d", d);
    const firstRoutePoint = trimmedSegments[0][0];
    const lastRoutePoint = trimmedSegments.at(-1)!.at(-1)!;
    gradient.setAttribute("x1", String(firstRoutePoint.x)); gradient.setAttribute("y1", String(firstRoutePoint.y));
    gradient.setAttribute("x2", String(lastRoutePoint.x)); gradient.setAttribute("y2", String(lastRoutePoint.y));
    const length = route.getTotalLength();
    const drawn = Math.max(0.001, length * routeProgressRef.current);
    clip.setAttribute("stroke-dasharray", `${drawn} ${Math.max(0.001, length)}`);
    overlay.dataset.visible = routeVisibleRef.current ? "true" : "false";
    const mapContainer = map.getContainer();
    const safeRect = activeResultSafeRect(mapContainer.clientWidth, mapContainer.clientHeight, previewMode);
    const placeLabelAtEdge = (marker: maplibregl.Marker | null, centerX: number) => {
      const element = marker?.getElement();
      const label = element?.querySelector<HTMLElement>(`.${styles.markerLabel}`);
      if (!element || !label) return;
      const edge = resultLabelHorizontalPlacement(centerX, label.offsetWidth, safeRect);
      element.setAttribute("data-label-edge", edge);
    };
    placeLabelAtEdge(guessMarkerRef.current, startCenter.x);
    placeLabelAtEdge(targetMarkerRef.current, endCenter.x);
    const guessElement = guessMarkerRef.current?.getElement();
    const targetElement = targetMarkerRef.current?.getElement();
    if (!guessElement || !targetElement) return;
    const verticalPlacement = resultLabelPairVerticalPlacement(
      startCenter,
      endCenter,
      scenario.guess,
      scenario.target
    );
    guessElement.dataset.labelVertical = verticalPlacement.first;
    targetElement.dataset.labelVertical = verticalPlacement.second;
  }, [previewMode]);

  const stabilizeResultComposition = useCallback(async (maxAttempts = 24) => {
    const map = mapRef.current;
    const container = map?.getContainer();
    if (!map || !container) return;
    container.dataset.resultComposition = "pending";
    const run = compositionRunRef.current + 1;
    compositionRunRef.current = run;
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (run !== compositionRunRef.current || !mapRef.current) return;
      updateRouteOverlay();
      await nextFrame();
      const containerRect = container.getBoundingClientRect();
      const targetOnlyEndComposition = buildResultCameraPlan(
        activeScenarioRef.current.guess,
        activeScenarioRef.current.target
      ).targetOnlyEndComposition;
      const visualElements = [
        ...container.querySelectorAll<HTMLElement>(`[data-visible="true"] [data-result-marker-pin], [data-visible="true"] [data-result-marker-rings], [data-visible="true"] .${styles.markerLabel}`),
        ...(routeVisibleRef.current && routeLineRef.current && !targetOnlyEndComposition ? [routeLineRef.current] : [])
      ];
      const visualRects = visualElements
        .map((element): ResultScreenRect => {
          const rect = element.getBoundingClientRect();
          const relativeRect = {
            left: rect.left - containerRect.left,
            top: rect.top - containerRect.top,
            right: rect.right - containerRect.left,
            bottom: rect.bottom - containerRect.top
          };
          if (element.matches("[data-result-marker-rings]") && element.closest(`.${styles.targetMarker}`)) {
            return expandResultRect(relativeRect, {
              left: rect.width / 2,
              top: rect.height / 2,
              right: rect.width / 2,
              bottom: rect.height / 2
            });
          }
          if (element.matches("[data-result-marker-pin]") && element.closest(`.${styles.targetMarker}`)) {
            return expandResultRect(relativeRect, { top: 12 });
          }
          return relativeRect;
        })
        .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
      const bounds = unionResultRects(visualRects);
      if (!bounds) return;
      const adjustment = resultFitAdjustment(
        bounds,
        activeResultSafeRect(container.clientWidth, container.clientHeight, previewMode)
      );
      if (adjustment.fits) break;
      const minimumZoom = map.getMinZoom();
      const nextZoom = Math.max(minimumZoom, map.getZoom() + adjustment.zoomDelta);
      if (adjustment.zoomDelta < 0 && nextZoom < map.getZoom() - 0.001) {
        map.jumpTo({ zoom: nextZoom });
      } else {
        const centerPoint = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
        map.jumpTo({
          center: map.unproject([
            centerPoint.x - adjustment.shiftX,
            centerPoint.y - adjustment.shiftY
          ])
        });
      }
      await nextFrame();
    }
    if (embedded) {
      map.setMinZoom(RESULT_MAP_MIN_ZOOM);
      if (map.getZoom() < RESULT_MAP_MIN_ZOOM) map.jumpTo({ zoom: RESULT_MAP_MIN_ZOOM });
    }
    updateRouteOverlay();
    const center = map.getCenter();
    setCamera({
      lng: center.lng,
      lat: center.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch()
    });
    container.dataset.resultComposition = "ready";
  }, [embedded, previewMode, updateRouteOverlay]);

  const targetFitsResultSafeArea = useCallback(() => {
    const map = mapRef.current;
    const container = map?.getContainer();
    const targetElement = targetMarkerRef.current?.getElement();
    if (!map || !container || !targetElement) return false;
    updateRouteOverlay();
    const containerRect = container.getBoundingClientRect();
    const visualRects = [
      targetElement.querySelector<SVGElement>("[data-result-marker-pin]"),
      targetElement.querySelector<SVGElement>("[data-result-marker-rings]"),
      targetElement.querySelector<HTMLElement>(`.${styles.markerLabel}`)
    ].filter((element): element is SVGElement | HTMLElement => Boolean(element)).map((element): ResultScreenRect => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        right: rect.right - containerRect.left,
        bottom: rect.bottom - containerRect.top
      };
    });
    const bounds = unionResultRects(visualRects);
    return Boolean(bounds && resultFitAdjustment(
      bounds,
      activeResultSafeRect(container.clientWidth, container.clientHeight, previewMode)
    ).fits);
  }, [previewMode, updateRouteOverlay]);

  const setRouteDrawProgress = useCallback((progress: number) => {
    const nextProgress = Math.min(1, Math.max(0, progress));
    routeProgressRef.current = nextProgress;
    updateRouteOverlay();
  }, [updateRouteOverlay]);

  const setMarkerVisibility = useCallback((kind: "guess" | "target", visible: boolean) => {
    const marker = kind === "guess" ? guessMarkerRef.current : targetMarkerRef.current;
    marker?.getElement().setAttribute("data-visible", visible ? "true" : "false");
    if (kind === "target" && !visible) marker?.getElement().setAttribute("data-landing", "false");
  }, []);

  const setMarkerLabelVisibility = useCallback((kind: "guess" | "target", visible: boolean) => {
    const marker = kind === "guess" ? guessMarkerRef.current : targetMarkerRef.current;
    marker?.getElement().setAttribute("data-label-visible", visible ? "true" : "false");
  }, []);

  const setTargetLanding = useCallback((active: boolean) => {
    targetMarkerRef.current?.getElement().setAttribute("data-landing", active && animateTargetMarker ? "true" : "false");
  }, [animateTargetMarker]);

  const setRouteSettled = useCallback((settled: boolean) => {
    routeOverlayRef.current?.setAttribute("data-settled", settled ? "true" : "false");
  }, []);

  const setResultRevealPhase = useCallback((phase: ResultRevealPhase) => {
    const container = mapRef.current?.getContainer();
    if (container) container.dataset.resultRevealPhase = phase;
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
    setMobileInfoOpen(false);
    const scenarioPlan = buildResultCameraPlan(scenario.guess, scenario.target);
    const distanceLabel = formatDistance(scenarioPlan.distanceKm);
    if (routeShadowRef.current) {
      routeShadowRef.current.dataset.targetOnlyEnd = String(scenarioPlan.targetOnlyEndComposition);
    }
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
    const targetLabelText = targetLabel?.querySelector<HTMLElement>("[data-marker-label-text]");
    if (targetLabelText) targetLabelText.textContent = scenario.targetName;
    else if (targetLabel) targetLabel.textContent = scenario.targetName;
    guessElement?.setAttribute("aria-label", `${scenario.playerName}: ${distanceLabel} entfernt`);
    targetElement?.setAttribute("aria-label", `${scenario.targetName}: Zusatzinformationen anzeigen`);

    const popupContent = document.createElement("div");
    popupContent.className = styles.markerPopupContent;
    const popupTitle = document.createElement("strong");
    popupTitle.textContent = scenario.targetName;
    const popupDescription = document.createElement("span");
    popupDescription.textContent = scenario.targetDescription;
    popupContent.append(popupTitle, popupDescription);
    targetPopupRef.current?.remove();
    targetPopupRef.current = new maplibregl.Popup({
      className: "kartenlabor-result-popup",
      ...(previewMode ? { anchor: "bottom" as const } : {}),
      closeButton: true,
      closeOnClick: true,
      focusAfterOpen: false,
      maxWidth: "min(19rem, calc(100vw - 6rem))",
      // Let MapLibre choose the side from actual screen space. A single radial
      // offset keeps pin and label activation on the same placement contract.
      offset: 68
    }).setDOMContent(popupContent);
    targetPopupRef.current.on("close", () => {
      if (previewMode) setMarkerLabelVisibility("guess", true);
      const trigger = targetMarkerRef.current?.getElement();
      if (shouldRestoreResultTriggerFocus(targetInfoInputModeRef.current)) trigger?.focus();
      else trigger?.blur();
    });
  }, [previewMode]);

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

  const preloadCameraViews = useCallback(async (plan: ResultCameraPlan, run: number, fast = false): Promise<ResultCameraPlan | null> => {
    const map = mapRef.current;
    const scenario = activeScenarioRef.current;
    if (!map || run !== journeyRunRef.current) return null;
    const container = map.getContainer();
    const key = `${scenario.id}:${scenario.guess.join(",")}:${scenario.target.join(",")}:${container.clientWidth}:${container.clientHeight}:${terrainModeRef.current}:${terrainStrengthRef.current}`;
    if (cameraPreparedRef.current === key && preparedEndCameraRef.current?.key === key) {
      return withResultCameraEndFrame(plan, preparedEndCameraRef.current.frame);
    }
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
    const preparationFrames = fast ? [end] : embedded ? [end] : [transit, end];
    const transitTimeout = embedded ? (plan.distanceClass === "long" ? 700 : 500) : 1_200;
    for (const frame of preparationFrames) {
      if (run !== journeyRunRef.current) return null;
      map.jumpTo(frame);
      if (!fast) await waitForTiles(transitTimeout);
    }
    const guessWasVisible = guessMarkerRef.current?.getElement().dataset.visible === "true";
    const targetWasVisible = targetMarkerRef.current?.getElement().dataset.visible === "true";
    const guessLabelWasVisible = guessMarkerRef.current?.getElement().dataset.labelVisible === "true";
    const targetLabelWasVisible = targetMarkerRef.current?.getElement().dataset.labelVisible === "true";
    const routeWasVisible = routeVisibleRef.current;
    const routeProgress = routeProgressRef.current;
    const compositionState = container.dataset.resultComposition;
    setMarkerVisibility("guess", !plan.targetOnlyEndComposition && !scenario.targetOnly);
    setMarkerVisibility("target", true);
    // Measure the final, untransformed label boxes. Hidden reveal labels use a
    // small entrance transform and would otherwise understate the safe area.
    setMarkerLabelVisibility("guess", !plan.targetOnlyEndComposition && !scenario.targetOnly);
    setMarkerLabelVisibility("target", true);
    setRouteVisibility(!plan.targetOnlyEndComposition && !scenario.targetOnly);
    setRouteDrawProgress(1);
    await pause(reducedMotionRef.current ? 20 : 300);
    await stabilizeResultComposition(fast ? 6 : 12);
    if (compositionState === undefined) delete container.dataset.resultComposition;
    else container.dataset.resultComposition = compositionState;
    if (run !== journeyRunRef.current) return null;
    const center = map.getCenter();
    const preparedEndCamera = {
      center: [center.lng, center.lat] as GlobeCoordinates,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch()
    };
    preparedEndCameraRef.current = { key, frame: preparedEndCamera };
    const preparedPlan = withResultCameraEndFrame(plan, preparedEndCamera);
    setMarkerVisibility("guess", guessWasVisible);
    setMarkerVisibility("target", targetWasVisible);
    setMarkerLabelVisibility("guess", guessLabelWasVisible);
    setMarkerLabelVisibility("target", targetLabelWasVisible);
    setRouteVisibility(routeWasVisible);
    if (routeWasVisible) setRouteDrawProgress(routeProgress);
    const start = plan.keyframes[0];
    map.jumpTo(start);
    // The preview poster is removed as soon as surface-ready is reported. Even
    // in the fast path, wait for the returned start camera to be painted again;
    // otherwise the crossfade can reveal the blank frame left by the warm-up.
    await waitForTiles(fast ? (embedded ? 300 : 1_200) : embedded ? 350 : 800);
    const ready = run === journeyRunRef.current;
    if (ready) { cameraPreparedRef.current = key; setCameraPreparing(false); }
    return ready ? preparedPlan : null;
  }, [embedded, setMarkerLabelVisibility, setMarkerVisibility, setRouteDrawProgress, setRouteVisibility, stabilizeResultComposition]);

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
    terrainStrengthRef.current = terrainExaggeration;
    setTerrainStrength(terrainExaggeration);
    setSurfaceReady(false);
    surfaceReadyRef.current = false;

    const initialPlan = buildResultCameraPlan(initialScenario.guess, initialScenario.target, {
      compactViewport: container.clientWidth < 700,
      homePreviewDesktop: previewMode && container.clientWidth >= 700
    });
    const initialFrame = revealImmediately ? initialPlan.keyframes.at(-1)! : initialPlan.keyframes[0];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container, style: punktlandungMapStyleUrl("globe"), center: initialFrame.center,
        zoom: initialFrame.zoom, bearing: initialFrame.bearing, pitch: initialFrame.pitch,
        ...(embedded ? { minZoom: RESULT_MAP_MIN_ZOOM } : {}),
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
    if (previewMode) {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.touchZoomRotate.disable();
      map.touchPitch.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
    } else {
      map.dragRotate.enable();
      map.touchPitch.enable();
      map.scrollZoom.enable();
    }
    map.boxZoom.disable();
    if (!previewMode) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    let compassButton: HTMLButtonElement | null = null;
    let toggleCompass: ((event: MouseEvent) => void) | null = null;
    const touchTooltipButtons: HTMLButtonElement[] = [];
    const dismissTouchControlTooltip = (event: PointerEvent) => {
      const button = event.currentTarget as HTMLButtonElement;
      const touchInput = event.pointerType !== "mouse";
      if (!touchInput) return;
      button.dataset.touchInput = "true";
      window.setTimeout(() => {
        button.blur();
      }, 0);
    };
    const restoreKeyboardControlTooltip = (event: KeyboardEvent) => {
      const button = event.currentTarget as HTMLButtonElement;
      delete button.dataset.touchInput;
    };
    const makeControlTouchSafe = (button: HTMLButtonElement) => {
      button.addEventListener("pointerdown", dismissTouchControlTooltip, { capture: true });
      button.addEventListener("keydown", restoreKeyboardControlTooltip, { capture: true });
      touchTooltipButtons.push(button);
    };
    const decorateNavigationControl = () => {
      const controls = [
        [".maplibregl-ctrl-zoom-in", RESULT_MAP_CONTROL_LABELS.zoomIn],
        [".maplibregl-ctrl-zoom-out", RESULT_MAP_CONTROL_LABELS.zoomOut]
      ] as const;
      for (const [selector, label] of controls) {
        const button = container.querySelector<HTMLButtonElement>(selector);
        if (!button) continue;
        button.setAttribute("aria-label", label);
        button.removeAttribute("title");
        button.dataset.tooltip = label;
        makeControlTouchSafe(button);
      }
      compassButton = container.querySelector<HTMLButtonElement>(".maplibregl-ctrl-compass");
      if (compassButton) {
        const updateCompassLabel = () => {
          const atNorth = Math.abs(map.getBearing()) < 0.5 && Math.abs(map.getPitch()) < 0.5;
          const label = atNorth && restoredViewRef.current
            ? RESULT_MAP_CONTROL_LABELS.compassRestore
            : RESULT_MAP_CONTROL_LABELS.compassNorth;
          compassButton?.setAttribute("aria-label", label);
          compassButton?.setAttribute("data-tooltip", label);
          compassButton?.removeAttribute("title");
        };
        toggleCompass = (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const atNorth = Math.abs(map.getBearing()) < 0.5 && Math.abs(map.getPitch()) < 0.5;
          if (atNorth && restoredViewRef.current) {
            map.easeTo({ ...restoredViewRef.current, duration: 520, essential: true });
          } else {
            restoredViewRef.current = { bearing: map.getBearing(), pitch: map.getPitch() };
            map.easeTo({ bearing: 0, pitch: 0, duration: 520, essential: true });
          }
          window.setTimeout(updateCompassLabel, 560);
        };
        compassButton.addEventListener("click", toggleCompass, { capture: true });
        makeControlTouchSafe(compassButton);
        updateCompassLabel();
      }
    };
    decorateNavigationControl();

    const canvas = map.getCanvas();
    let shiftGesture: { pointerId: number; x: number; y: number; bearing: number; pitch: number; restorePan: boolean } | null = null;
    const finishShiftGesture = () => {
      if (!shiftGesture) return;
      if (shiftGesture.restorePan) map.dragPan.enable();
      shiftGesture = null;
    };
    const beginShiftGesture = (event: PointerEvent) => {
      if (previewMode) return;
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
      // Keep QA/diagnostic camera attributes synchronized with the actual
      // rendered frame. React telemetry below remains throttled deliberately.
      const center = map.getCenter();
      container.dataset.currentZoom = map.getZoom().toFixed(4);
      container.dataset.currentLng = center.lng.toFixed(6);
      container.dataset.currentLat = center.lat.toFixed(6);
      container.dataset.currentBearing = map.getBearing().toFixed(4);
      container.dataset.currentPitch = map.getPitch().toFixed(4);
      const now = performance.now();
      if (now - lastTelemetryUpdate < 100) return;
      lastTelemetryUpdate = now;
      setCamera({ lng: center.lng, lat: center.lat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    };
    const enforceEmbeddedZoomFloor = () => {
      if (!embedded) return;
      map.setMinZoom(RESULT_MAP_MIN_ZOOM);
      if (map.getZoom() < RESULT_MAP_MIN_ZOOM) map.jumpTo({ zoom: RESULT_MAP_MIN_ZOOM });
      const center = map.getCenter();
      setCamera({
        lng: center.lng,
        lat: center.lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      });
    };
    const configureGlobe = () => {
      map.setProjection({ type: "globe" });
      enforceEmbeddedZoomFloor();
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
    let activateTargetInformation: ((event?: Event) => void) | null = null;
    let activateTargetInformationByKeyboard: ((event: KeyboardEvent) => void) | null = null;
    const rememberPointerInput = () => {
      targetInfoInputModeRef.current = "pointer";
    };
    const addResultOverlays = () => {
      guessMarkerRef.current = new maplibregl.Marker({
        element: createResultMarker("guess", "Dein Tipp", targetInfoIndicator),
        anchor: "bottom",
        // Result markers are already-revealed answer information. Keep them
        // legible at the globe horizon; the camera, not occlusion fading,
        // decides whether they belong to the final composition.
        opacityWhenCovered: 1,
        subpixelPositioning: true
      })
        .setLngLat(initialScenario.guess).addTo(map);
      targetMarkerRef.current = new maplibregl.Marker({
        element: createResultMarker("target", "Ziel", targetInfoIndicator),
        anchor: "bottom",
        opacityWhenCovered: 1,
        subpixelPositioning: true
      })
        .setLngLat(initialScenario.target).addTo(map);
      activateTargetInformation = (event) => {
        event?.preventDefault();
        event?.stopPropagation();
        const mapSize = map.getContainer();
        if (usesCenteredResultInfoOverlay(mapSize.clientWidth, mapSize.clientHeight)) {
          targetPopupRef.current?.remove();
          if (previewMode && mapSize.clientWidth >= 700) {
            const labelRect = targetMarkerRef.current?.getElement().querySelector<HTMLElement>("[data-marker-label]")?.getBoundingClientRect();
            const mapRect = mapSize.getBoundingClientRect();
            setPreviewInfoAnchorX(labelRect ? (labelRect.left + labelRect.right) / 2 - mapRect.left - 16 : null);
            setMarkerLabelVisibility("guess", false);
          }
          setMobileInfoOpen(true);
          return;
        }
        setMobileInfoOpen(false);
        const popup = targetPopupRef.current;
        if (!popup) return;
        if (popup.isOpen()) popup.remove();
        else {
          if (previewMode) setMarkerLabelVisibility("guess", false);
          popup.setLngLat(activeScenarioRef.current.target).addTo(map);
          if (previewMode) {
            const popupElement = popup.getElement();
            const targetLabel = targetMarkerRef.current?.getElement().querySelector<HTMLElement>("[data-marker-label]");
            const popupRect = popupElement.getBoundingClientRect();
            const labelRect = targetLabel?.getBoundingClientRect();
            const mapRect = container.getBoundingClientRect();
            if (labelRect) {
              const desiredShift = (labelRect.left + labelRect.right - popupRect.left - popupRect.right) / 2;
              const minShift = mapRect.left + 3 - popupRect.left;
              const maxShift = mapRect.right - 3 - popupRect.right;
              popupElement.style.marginLeft = `${Math.max(minShift, Math.min(maxShift, desiredShift)).toFixed(2)}px`;
            }
          }
          requestAnimationFrame(() => {
            const closeButton = container.querySelector<HTMLButtonElement>(".kartenlabor-result-popup .maplibregl-popup-close-button");
            closeButton?.setAttribute("aria-label", "Zusatzinformationen schließen");
            closeButton?.removeAttribute("title");
            if (shouldRestoreResultTriggerFocus(targetInfoInputModeRef.current)) closeButton?.focus();
            else closeButton?.blur();
          });
        }
      };
      activateTargetInformationByKeyboard = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        targetInfoInputModeRef.current = "keyboard";
        activateTargetInformation?.(event);
      };
      container.addEventListener("pointerdown", rememberPointerInput, { capture: true });
      targetMarkerRef.current.getElement().addEventListener("click", activateTargetInformation);
      targetMarkerRef.current.getElement().addEventListener("keydown", activateTargetInformationByKeyboard);
      setResultMarkerContent(initialScenario);
      map.jumpTo(revealImmediately ? initialPlan.keyframes.at(-1)! : initialPlan.keyframes[0]);
      setMarkerVisibility("guess", true);
      setMarkerLabelVisibility("guess", true);
      setMarkerVisibility("target", revealImmediately);
      setMarkerLabelVisibility("target", revealImmediately);
      setTargetLanding(false);
      setRouteVisibility(revealImmediately);
      setRouteSettled(revealImmediately);
      setResultRevealPhase(revealImmediately ? "settled" : "prepared");
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
        // The home-page preview is a fixed, lightweight demonstration. Its end
        // composition is measured behind the poster without waiting for tile
        // idles, then the real start frame is revealed. This keeps the first
        // frame quick while preventing a visible end-of-flight correction.
        await preloadTerrain(plan, preparationRun);
        // A static replay is constructed at its final camera already. Repeating
        // the animated end-view warm-up only delays the visible replay map.
        const preparedPlan = !revealImmediately ? await preloadCameraViews(plan, preparationRun, previewMode || embedded) : plan;
        if (!mapRef.current || preparationRun !== journeyRunRef.current) return;
        if (!preparedPlan) return;
        map.resize();
        const finalContainerPlan = buildResultCameraPlan(scenario.guess, scenario.target, {
          compactViewport: container.clientWidth < 700,
          homePreviewDesktop: previewMode && container.clientWidth >= 700
        });
        map.jumpTo(revealImmediately ? preparedPlan.keyframes.at(-1)! : finalContainerPlan.keyframes[0]);
        setMarkerVisibility("guess", revealImmediately ? !preparedPlan.targetOnlyEndComposition && !scenario.targetOnly : !scenario.targetOnly);
        setMarkerLabelVisibility("guess", revealImmediately ? !preparedPlan.targetOnlyEndComposition && !scenario.targetOnly : !scenario.targetOnly);
        setMarkerVisibility("target", revealImmediately);
        setMarkerLabelVisibility("target", revealImmediately);
        setTargetLanding(false);
        setRouteVisibility(revealImmediately && !scenario.targetOnly);
        setRouteSettled(revealImmediately);
        setResultRevealPhase(revealImmediately ? "settled" : "prepared");
        if (revealImmediately) setRouteDrawProgress(1);
        if (revealImmediately) await stabilizeResultComposition(36);
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
        surfaceReadyRef.current = true;
        container.dataset.resultSurfaceReady = "true";
        setSurfaceReady(true);
        setMapReady(true);
        markResultMilestone("punktlandung-result-surface", "punktlandung-submit-to-result-surface");
        onSurfaceReadyRef.current?.();
        setStatus(`${scenario.label} vorbereitet · Tipp sichtbar · ${formatDistance(plan.distanceKm)}`);
        if (autoPlayRef.current && !revealImmediately) {
          const autoPlayKey = `${scenario.id}:${scenario.guess.join(",")}:${scenario.target.join(",")}`;
          if (autoPlayKeyRef.current !== autoPlayKey) {
            autoPlayKeyRef.current = autoPlayKey;
            window.requestAnimationFrame(() => void runResultJourneyRef.current());
          }
        }
        if (revealImmediately) {
          // Embedded result/replay cards can receive their final height only
          // after the live surface replaces its placeholder. Refit once in
          // that settled layout so labels do not oscillate across the short
          // frame's top and bottom safe areas.
          await pause(120);
          if (!mapRef.current || preparationRun !== journeyRunRef.current) return;
          map.resize();
          await stabilizeResultComposition(24);
          onAnimationCompleteRef.current?.();
          const settledMap = map;
          window.setTimeout(() => {
            if (mapRef.current !== settledMap || preparationRun !== journeyRunRef.current) return;
            settledMap.resize();
            void stabilizeResultComposition(24);
          }, 120);
        }
      })();
    };
    const reportError = (event: maplibregl.ErrorEvent) => {
      const sourceId = (event as maplibregl.ErrorEvent & { sourceId?: string }).sourceId ?? "";
      const message = event.error.message;
      const terrainFailure = sourceId === PUNKTLANDUNG_TERRAIN_SOURCE_ID
        || message.includes(PUNKTLANDUNG_TERRAIN_SOURCE_ID)
        || message.toLowerCase().includes("mapterhorn");
      if (terrainFailure) {
        try { map.setTerrain(null); } catch { /* Base map remains usable without DEM. */ }
        terrainAvailableRef.current = false;
        terrainLevelRef.current = null;
        terrainPreparedRef.current = null;
        setTerrainAvailable(false);
        setTerrainActive(false);
        setTerrainPreparing(false);
        setStatus("Terrain-Fallback aktiv · flache Globe-Darstellung bleibt verfügbar");
        console.warn("[Punktlandung globe] Terrainquelle ausgefallen; flacher Globe bleibt aktiv");
        return;
      }
      console.error(`[Punktlandung globe] ${event.error.message}`, event.error);
      setStatus(`Kartenfehler: ${event.error.message}`);
    };

    map.on("style.load", configureGlobe); map.on("load", reportReady); map.on("move", updateCamera); map.on("error", reportError);
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      if (previewMode && surfaceReadyRef.current && map.getContainer().dataset.resultRevealPhase === "prepared") {
        const currentPlan = buildResultCameraPlan(initialScenario.guess, initialScenario.target, {
          compactViewport: container.clientWidth < 700,
          homePreviewDesktop: previewMode && container.clientWidth >= 700
        });
        map.jumpTo(currentPlan.keyframes[0]);
        updateRouteOverlay();
      }
      enforceEmbeddedZoomFloor();
      if (routeVisibleRef.current) void stabilizeResultComposition();
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
      if (compassButton && toggleCompass) compassButton.removeEventListener("click", toggleCompass, { capture: true });
      for (const button of touchTooltipButtons) {
        button.removeEventListener("pointerdown", dismissTouchControlTooltip, { capture: true });
        button.removeEventListener("keydown", restoreKeyboardControlTooltip, { capture: true });
      }
      resizeObserver.disconnect();
      surfaceReadyRef.current = false;
      map.off("style.load", configureGlobe); map.off("load", reportReady); map.off("move", updateCamera); map.off("error", reportError);
      if (activateTargetInformation) targetMarkerRef.current?.getElement().removeEventListener("click", activateTargetInformation);
      if (activateTargetInformationByKeyboard) targetMarkerRef.current?.getElement().removeEventListener("keydown", activateTargetInformationByKeyboard);
      container.removeEventListener("pointerdown", rememberPointerInput, { capture: true });
      targetPopupRef.current?.remove();
      guessMarkerRef.current?.remove(); targetMarkerRef.current?.remove(); map.remove(); mapRef.current = null;
    };
  }, [embedded, initialScenario, preloadCameraViews, preloadTerrain, previewMode, revealImmediately, setMarkerLabelVisibility, setMarkerVisibility, setResultMarkerContent, setResultRevealPhase, setRouteDrawProgress, setRouteSettled, setRouteVisibility, setTargetLanding, stabilizeResultComposition, targetInfoIndicator, terrainExaggeration, updateRouteOverlay]);

  const runTimeline = useCallback((keyframes: CameraKeyframe[], duration: number, run: number, onProgress?: (progress: number) => void, initialHoldProgress = 0): Promise<TimelineMetrics> => {
    const map = mapRef.current;
    if (!map || run !== journeyRunRef.current) return Promise.resolve({ completed: false, maxFrameGapMs: 0, slowFrames: 0, pendingTileSamples: 0, tileSamples: 0 });
    const start = performance.now();
    return new Promise((resolve) => {
      let previousFrame = start;
      // Kick the Home journey by a sub-pixel 0.3% step on the same commit that
      // starts it. This prevents a busy MapLibre repaint from reading as a
      // second static hold, while remaining below a visible handoff jump.
      let timelineElapsed = previewMode ? duration * 0.003 : 0;
      if (previewMode) map.jumpTo(sampleCameraTimeline(keyframes, 0.003));
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
        // A busy first mobile frame must not turn the poster handoff into a
        // visible camera leap. The preview clock advances only by a paintable
        // frame slice; result and replay timing retain their production clock.
        timelineElapsed += previewMode ? Math.min(frameGap, 34) : frameGap;
        frameCount += 1;
        maxFrameGapMs = Math.max(maxFrameGapMs, frameGap);
        if (frameGap > 32) slowFrames += 1;
        if (frameCount % 6 === 0) {
          tileSamples += 1;
          if (!map.areTilesLoaded()) pendingTileSamples += 1;
        }
        const rawProgress = Math.min(1, timelineElapsed / duration);
        const movingProgress = rawProgress <= initialHoldProgress
          ? 0
          : (rawProgress - initialHoldProgress) / Math.max(0.001, 1 - initialHoldProgress);
        const progress = previewMode ? movingProgress : timelineProgress(movingProgress);
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
  }, [previewMode]);

  const stopCurrentJourney = useCallback(() => {
    journeyRunRef.current += 1;
    if (animationFrameRef.current !== null) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    mapRef.current?.stop(); setJourneyRunning(false); setCameraPreparing(false); setTerrainPreparing(false);
  }, []);

  const moveToPreset = useCallback((preset: CameraPreset) => {
    const map = mapRef.current;
    if (!map) return;
    stopCurrentJourney(); setMarkerVisibility("guess", false); setMarkerVisibility("target", false);
    setMarkerLabelVisibility("guess", false); setMarkerLabelVisibility("target", false);
    setTargetLanding(false); setRouteVisibility(false); setRouteSettled(true);
    map.easeTo({ center: preset.center, zoom: preset.zoom, bearing: preset.bearing, pitch: preset.pitch,
      duration: reducedMotionRef.current ? 0 : 850, essential: false });
    setStatus(`${preset.label} · Kamerapreset`);
  }, [setMarkerLabelVisibility, setMarkerVisibility, setRouteSettled, setRouteVisibility, setTargetLanding, stopCurrentJourney]);

  const runMunichJourney = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    stopCurrentJourney();
    const run = journeyRunRef.current + 1; journeyRunRef.current = run;
    setJourneyRunning(true); setMarkerVisibility("guess", false); setMarkerVisibility("target", false);
    setMarkerLabelVisibility("guess", false); setMarkerLabelVisibility("target", false);
    setTargetLanding(false); setRouteVisibility(false); setRouteSettled(true);
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
  }, [mapReady, runTimeline, setMarkerLabelVisibility, setMarkerVisibility, setRouteSettled, setRouteVisibility, setTargetLanding, setTerrainLevel, stopCurrentJourney]);

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
    setMarkerVisibility("guess", !scenario.targetOnly); setMarkerLabelVisibility("guess", !scenario.targetOnly);
    setMarkerVisibility("target", false); setMarkerLabelVisibility("target", false);
    setTargetLanding(false); setRouteVisibility(false); setRouteSettled(false); setResultRevealPhase("prepared");
    const run = journeyRunRef.current;
    setStatus(`${scenario.label} · Tipp gesetzt · 3D wird vor der Auflösung vorbereitet`);
    await preloadTerrain(plan, run);
    await preloadCameraViews(plan, run);
    if (run === journeyRunRef.current) setStatus(`${scenario.label} vorbereitet · Tipp sichtbar · ${formatDistance(plan.distanceKm)} · Klasse ${plan.distanceClass}`);
  }, [preloadCameraViews, preloadTerrain, setMarkerLabelVisibility, setMarkerVisibility, setResultRevealPhase, setRouteSettled, setRouteVisibility, setTargetLanding, stopCurrentJourney, updateResultGeometry]);

  const runResultJourney = useCallback(async () => {
    const map = mapRef.current;
    const scenario = resultScenario ?? RESULT_CAMERA_SCENARIOS.find((candidate) => candidate.id === selectedScenarioId);
    if (!map || !scenario || !surfaceReadyRef.current) return;
    stopCurrentJourney();
    const run = journeyRunRef.current + 1; journeyRunRef.current = run;
    let plan = buildResultCameraPlan(scenario.guess, scenario.target, {
      compactViewport: (containerRef.current?.clientWidth ?? 800) < 700,
      durationScale: lowPowerDeviceRef.current ? 0.86 : 1,
      homePreviewDesktop: previewMode && (containerRef.current?.clientWidth ?? 800) >= 700
    });
    const targetOnly = scenario.targetOnly === true;
    let routeRevealed = false;
    let targetRevealed = false;
    let targetLabelRevealed = false;
    let guessHiddenForTargetEnd = false;
    let targetRevealedAt: number | null = null;
    let targetLabelTimer: number | undefined;
    let lastRouteUpdate = 0;
    map.getContainer().dataset.resultComposition = "pending";
    setJourneyRunning(true); updateResultGeometry(scenario);
    // The prepared Home surface is already painted at this exact start frame.
    // Re-jumping there invalidates tiles and can stall the first visible move.
    if (!previewMode) map.jumpTo(plan.keyframes[0]);
    setMarkerVisibility("guess", !targetOnly); setMarkerLabelVisibility("guess", !targetOnly);
    setMarkerVisibility("target", false); setMarkerLabelVisibility("target", false);
    setTargetLanding(false); setRouteVisibility(false); setRouteSettled(false); setResultRevealPhase("prepared");
    // The preview surface has already completed terrain preparation before the
    // poster is removed. Repeating that wait here caused up to 750ms of dead
    // time after the handoff without improving the visible map.
    if (!previewMode) await preloadTerrain(plan, run);
    const preparedPlan = previewMode
      ? (preparedEndCameraRef.current ? withResultCameraEndFrame(plan, preparedEndCameraRef.current.frame) : plan)
      : await preloadCameraViews(plan, run, false);
    if (run !== journeyRunRef.current || !preparedPlan) return;
    plan = preparedPlan;
    map.getContainer().dataset.resultComposition = "pending";
    setStatus(`Ergebnisflug ${plan.distanceClass} · ${formatDistance(plan.distanceKm)} · ${plan.durationMs / 1_000}s`);
    const revealRoute = () => {
      if (routeRevealed) return;
      routeRevealed = true;
      if (targetOnly) {
        setRouteVisibility(false);
        setRouteSettled(true);
        return;
      }
      setRouteVisibility(true);
      setRouteSettled(false);
      setResultRevealPhase("route");
    };
    const revealTargetLabel = () => {
      if (targetLabelRevealed) return;
      targetLabelRevealed = true;
      setMarkerLabelVisibility("target", true);
      setResultRevealPhase("labels");
    };
    const revealTarget = () => {
      if (targetRevealed) return;
      targetRevealed = true;
      targetRevealedAt = performance.now();
      setMarkerVisibility("target", true);
      setMarkerLabelVisibility("target", false);
      setTargetLanding(true);
      setResultRevealPhase("landing");
      targetLabelTimer = window.setTimeout(() => {
        if (run === journeyRunRef.current) revealTargetLabel();
      }, RESULT_REVEAL_TIMING.targetLabelAfterRevealMs);
    };
    try {
      map.getContainer().dataset.resultMotionStarted = "true";
      markResultMilestone("punktlandung-result-motion", "punktlandung-submit-to-result-motion");
      if (reducedMotionRef.current) {
        const end = plan.keyframes[plan.keyframes.length - 1];
        revealRoute(); setRouteDrawProgress(1);
        map.easeTo({ center: end.center, zoom: end.zoom, bearing: end.bearing, pitch: end.pitch, duration: 320, essential: false });
        await pause(350);
        if (run !== journeyRunRef.current) return;
        if (plan.targetOnlyEndComposition || targetOnly) {
          setMarkerVisibility("guess", false);
          setMarkerLabelVisibility("guess", false);
          setRouteVisibility(!targetOnly);
        }
        setMarkerVisibility("target", true); setMarkerLabelVisibility("target", true); setTargetLanding(false);
        setRouteSettled(true); setResultRevealPhase("reduced-settled");
      } else {
        const metrics = await runTimeline(plan.keyframes, plan.durationMs, run, (progress) => {
          if (!routeRevealed && progress >= plan.revealProgress) revealRoute();
          if (!targetRevealed && progress >= plan.targetRevealProgress && targetFitsResultSafeArea()) {
            revealTarget();
          }
          if (!guessHiddenForTargetEnd && plan.guessHideProgress !== null && progress >= plan.guessHideProgress) {
            guessHiddenForTargetEnd = true;
            setMarkerVisibility("guess", false);
            setMarkerLabelVisibility("guess", false);
            setRouteVisibility(true);
          }
          if (routeRevealed && progress - lastRouteUpdate >= 0.025) {
            lastRouteUpdate = progress;
            setRouteDrawProgress((progress - plan.revealProgress) / Math.max(0.001, 1 - plan.revealProgress));
          }
        }, 0);
        if (run === journeyRunRef.current && metrics.completed) {
          setStatus(`Ergebnis sichtbar · ${formatDistance(plan.distanceKm)} · Pitch ${plan.keyframes.at(-1)?.pitch ?? 0}° · Terrain ${terrainLevelRef.current && terrainLevelRef.current > 0.05 ? "aktiv" : "aus"} · ${formatTimelineMetrics(metrics)}`);
        }
        if (run !== journeyRunRef.current) return;
        revealRoute(); setRouteDrawProgress(1);
        if (!targetRevealed) revealTarget();
        const revealWaits = remainingResultRevealWaits(targetRevealedAt ?? performance.now(), performance.now());
        if (!targetLabelRevealed && revealWaits.labelMs === 0) revealTargetLabel();
        if (revealWaits.landingMs > 0) await pause(revealWaits.landingMs);
        if (run !== journeyRunRef.current) return;
        if (targetLabelTimer !== undefined) window.clearTimeout(targetLabelTimer);
        setTargetLanding(false);
        setResultRevealPhase("landed");
        revealTargetLabel();
        setRouteSettled(true);
        await pause(RESULT_REVEAL_TIMING.finalStillnessMs);
        if (run !== journeyRunRef.current) return;
        setResultRevealPhase("settled");
      }
      if (run === journeyRunRef.current) {
        setRouteVisibility(!targetOnly); setRouteSettled(true); setRouteDrawProgress(1);
        setMarkerVisibility("guess", !plan.targetOnlyEndComposition && !targetOnly);
        setMarkerLabelVisibility("guess", !plan.targetOnlyEndComposition && !targetOnly);
        setMarkerVisibility("target", true); setMarkerLabelVisibility("target", true); setTargetLanding(false);
        if (!reducedMotionRef.current) setResultRevealPhase("settled");
        await pause(20);
        if (run !== journeyRunRef.current) return;
        // preloadCameraViews has already measured and fitted this exact final
        // composition behind the initial surface. A second visible refit here
        // causes the end-frame camera jump on wide result cards.
        updateResultGeometry(scenario);
        map.getContainer().dataset.resultComposition = "ready";
        if (reducedMotionRef.current) setStatus(`Ergebnis sichtbar · ${formatDistance(plan.distanceKm)} · Reduced-Motion-Ease · Terrain ${terrainLevelRef.current && terrainLevelRef.current > 0.05 ? "aktiv" : "aus"}`);
        onAnimationCompleteRef.current?.();
      }
    } finally {
      if (targetLabelTimer !== undefined) window.clearTimeout(targetLabelTimer);
      if (run === journeyRunRef.current) setJourneyRunning(false);
    }
  }, [mapReady, preloadCameraViews, preloadTerrain, previewMode, resultScenario, runTimeline, selectedScenarioId, setMarkerLabelVisibility, setMarkerVisibility, setResultRevealPhase, setRouteDrawProgress, setRouteSettled, setRouteVisibility, setTargetLanding, stopCurrentJourney, targetFitsResultSafeArea, updateResultGeometry]);

  runResultJourneyRef.current = runResultJourney;

  useLayoutEffect(() => {
    if (!autoPlay || !mapReady || journeyRunning || (!previewMode && (terrainPreparing || cameraPreparing))) return;
    const key = `${initialScenario.id}:${initialScenario.guess.join(",")}:${initialScenario.target.join(",")}`;
    if (autoPlayKeyRef.current === key) return;
    autoPlayKeyRef.current = key;
    void runResultJourney();
  }, [autoPlay, cameraPreparing, initialScenario, journeyRunning, mapReady, previewMode, runResultJourney, terrainPreparing]);

  const changeTerrainMode = useCallback((mode: TerrainMode) => {
    terrainPreparedRef.current = null;
    cameraPreparedRef.current = null;
    terrainModeRef.current = mode; setTerrainMode(mode);
    if (mode === "on") setTerrainLevel(terrainStrengthRef.current);
    else setTerrainLevel(null);
    setStatus(mode === "adaptive" ? "Terrain adaptiv · flüssiger Hillshade-Default, echtes 3D nur im Vergleichsmodus An"
      : mode === "on" ? `Terrain dauerhaft ${terrainStrengthRef.current.toFixed(2)}× aktiviert` : "Terrain deaktiviert · Hillshade bleibt sichtbar");
  }, [setTerrainLevel]);

  const changeTerrainStrength = useCallback((strength: number) => {
    terrainPreparedRef.current = null;
    cameraPreparedRef.current = null;
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
                {scenario.id === "short" ? "Kurz" : scenario.id === "medium" ? "Mittel" : scenario.kind === "experiment" ? "15.000 km · Experiment" : "Groß"}
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
        <strong>{selectedScenario.label}</strong>
        {selectedScenario.kind === "experiment" ? <em className={styles.experimentBadge}>Experiment</em> : <em className={styles.productionBadge}>Produktion</em>}
        <span>{selectedScenario.description}</span>
        <span>{formatDistance(selectedPlan.distanceKm)} · {selectedPlan.durationMs / 1_000}s · End-Pitch {selectedPlan.keyframes.at(-1)?.pitch}°</span>
      </div> : null}
      <div
        className={styles.mapFrame}
        style={{ "--target-landing-duration": `${RESULT_REVEAL_TIMING.targetLandingDurationMs}ms` } as CSSProperties}
        data-current-zoom={(embedded ? Math.max(camera.zoom, RESULT_MAP_MIN_ZOOM) : camera.zoom).toFixed(2)}
        data-current-lng={camera.lng.toFixed(5)}
        data-current-lat={camera.lat.toFixed(5)}
        data-current-bearing={camera.bearing.toFixed(2)}
        data-current-pitch={camera.pitch.toFixed(2)}
        data-preview-mode={previewMode ? "true" : "false"}
        data-min-zoom={embedded ? RESULT_MAP_MIN_ZOOM.toFixed(2) : undefined}
        data-surface-ready={surfaceReady ? "true" : "false"}
        data-terrain-active={terrainActive ? "true" : "false"}
        data-terrain-exaggeration={terrainActive ? terrainStrength.toFixed(2) : "0"}
        data-target-landing-duration-ms={RESULT_REVEAL_TIMING.targetLandingDurationMs}
        data-target-label-delay-ms={RESULT_REVEAL_TIMING.targetLabelAfterRevealMs}
      >
        <div ref={containerRef} className={styles.map} aria-label="Interaktiver Punktlandung-Globe" />
        {!embedded && (cameraPreparing || terrainPreparing) ? <div className={styles.preloadVeil}>Zielregion und Kartendaten werden vorbereitet …</div> : null}
        <svg ref={routeOverlayRef} className={styles.routeOverlay} aria-hidden="true">
          <defs>
            <linearGradient ref={routeGradientRef} id={routeGradientId} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f43f7a" /><stop offset="0.52" stopColor="#a78bfa" /><stop offset="1" stopColor="#5ee7bd" />
            </linearGradient>
            <mask id={routeRevealId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
              <path ref={routeClipRef} className={styles.routeClip} />
            </mask>
          </defs>
            <path ref={routeShadowRef} className={styles.routeShadow} mask={`url(#${routeRevealId})`} />
            <path ref={routeLineRef} className={`${styles.routeLine} ${resultRouteLineClassName}`} data-result-route="connection" mask={`url(#${routeRevealId})`} style={{ stroke: `url(#${routeGradientId})` }} />
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
        {mobileInfoOpen ? (
          <div
            className={styles.mobileInfoLayer}
            data-target-label-vertical={targetMarkerRef.current?.getElement().dataset.labelVertical ?? "below"}
            data-preview-align-target={previewMode && previewInfoAnchorX !== null ? "true" : "false"}
            style={previewInfoAnchorX !== null ? { "--preview-info-anchor-x": `${previewInfoAnchorX}px` } as CSSProperties : undefined}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              ref={mobileInfoDialogRef}
              className={`${styles.mobileInfoDialog} punktlandung-globe-info-overlay`}
              role="dialog"
              aria-label={`Zusatzinformationen zu ${activeScenarioRef.current.targetName}`}
              tabIndex={-1}
            >
              <strong>{activeScenarioRef.current.targetName}</strong>
              <span>{activeScenarioRef.current.targetDescription}</span>
              <button
                className={styles.mobileInfoClose}
                type="button"
                aria-label="Zusatzinformationen schließen"
                onPointerDown={() => {
                  targetInfoInputModeRef.current = "pointer";
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") targetInfoInputModeRef.current = "keyboard";
                }}
                onClick={() => {
                  setMobileInfoOpen(false);
                  if (previewMode) setMarkerLabelVisibility("guess", true);
                  const trigger = targetMarkerRef.current?.getElement();
                  if (shouldRestoreResultTriggerFocus(targetInfoInputModeRef.current)) trigger?.focus();
                  else trigger?.blur();
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
        ) : null}
        <MapAttributionBadge />
      </div>
    </section>
  );
}

type GlobeResultMapProps = {
  scenario: ResultCameraScenario;
  animate?: boolean;
  startPaused?: boolean;
  initialView?: "start" | "end";
  previewMode?: boolean;
  targetInfoIndicator?: "i" | "?";
  terrainExaggeration?: number;
  onSurfaceReady?: () => void;
  onAnimationComplete?: () => void;
  onUnavailable?: () => void;
};

export function GlobeResultMap({
  scenario,
  animate = true,
  startPaused = false,
  initialView = "end",
  previewMode = false,
  targetInfoIndicator = "i",
  terrainExaggeration = RESULT_CAMERA_CONFIG.terrainExaggeration.result,
  onSurfaceReady,
  onAnimationComplete,
  onUnavailable
}: GlobeResultMapProps) {
  return (
    <GlobeMapLab
      resultScenario={scenario}
      embedded
      autoPlay={animate && !startPaused}
      revealImmediately={!animate && initialView === "end"}
      previewMode={previewMode}
      targetInfoIndicator={targetInfoIndicator}
      animateTargetMarker={animate}
      terrainExaggeration={terrainExaggeration}
      onSurfaceReady={onSurfaceReady}
      onAnimationComplete={onAnimationComplete}
      onUnavailable={onUnavailable}
    />
  );
}
