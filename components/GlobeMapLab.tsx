"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapAttributionBadge } from "@/components/MapAttributionBadge";
import {
  buildMunichJourneyKeyframes,
  buildResultCameraPlan,
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
    const endGap = ellipseRadius(endUnit, targetWidth, targetHeight) + 6;
    const clippedPoints = points.map((point, index) => {
      if (index === 0) return { x: startCenter.x + startUnit.x * startGap, y: startCenter.y + startUnit.y * startGap };
      if (index === points.length - 1) return { x: endCenter.x - endUnit.x * endGap, y: endCenter.y - endUnit.y * endGap };
      return point;
    });
    const visibility = coordinates.map((coordinate) => !map.transform.isLocationOccluded(
      new maplibregl.LngLat(coordinate[0], coordinate[1])
    ));
    let drawing = false;
    const commands: string[] = [];
    clippedPoints.forEach((point, index) => {
      if (!visibility[index]) {
        drawing = false;
        return;
      }
      commands.push(`${drawing ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
      drawing = true;
    });
    const d = commands.join(" ");
    if (!d) {
      route.setAttribute("d", ""); shadow.setAttribute("d", ""); clip.setAttribute("d", "");
      return;
    }
    route.setAttribute("d", d); shadow.setAttribute("d", d); clip.setAttribute("d", d);
    gradient.setAttribute("x1", String(clippedPoints[0].x)); gradient.setAttribute("y1", String(clippedPoints[0].y));
    gradient.setAttribute("x2", String(clippedPoints.at(-1)!.x)); gradient.setAttribute("y2", String(clippedPoints.at(-1)!.y));
    const length = route.getTotalLength();
    const drawn = Math.max(0.001, length * routeProgressRef.current);
    clip.setAttribute("stroke-dasharray", `${drawn} ${Math.max(0.001, length)}`);
    overlay.dataset.visible = routeVisibleRef.current ? "true" : "false";
    const mapWidth = map.getContainer().clientWidth;
    const placeLabelAtEdge = (marker: maplibregl.Marker | null, centerX: number) => {
      const element = marker?.getElement();
      const label = element?.querySelector<HTMLElement>(`.${styles.markerLabel}`);
      if (!element || !label) return;
      const halfWidth = label.offsetWidth / 2;
      const edge = centerX < halfWidth + 12 ? "right" : centerX > mapWidth - halfWidth - 12 ? "left" : "center";
      element.setAttribute("data-label-edge", edge);
    };
    placeLabelAtEdge(guessMarkerRef.current, startCenter.x);
    placeLabelAtEdge(targetMarkerRef.current, endCenter.x);
    const guessIsNorth = scenario.guess[1] >= scenario.target[1];
    guessMarkerRef.current?.getElement().setAttribute("data-label-vertical", guessIsNorth ? "above" : "below");
    targetMarkerRef.current?.getElement().setAttribute("data-label-vertical", guessIsNorth ? "below" : "above");
  }, []);

  const setRouteDrawProgress = useCallback((progress: number) => {
    const nextProgress = Math.min(1, Math.max(0, progress));
    routeProgressRef.current = nextProgress;
    updateRouteOverlay();
  }, [updateRouteOverlay]);

  const setMarkerVisibility = useCallback((kind: "guess" | "target", visible: boolean) => {
    const marker = kind === "guess" ? guessMarkerRef.current : targetMarkerRef.current;
    marker?.getElement().setAttribute("data-visible", visible ? "true" : "false");
    if (kind === "target") marker?.getElement().setAttribute("data-focus", visible ? "true" : "false");
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
    targetMarkerRef.current?.setPopup(new maplibregl.Popup({
      anchor: opensBelowTarget ? "top" : "bottom",
      className: `kartenlabor-result-popup${opensBelowTarget ? " is-below-label" : ""}`,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "280px",
      offset: opensBelowTarget ? [0, 80] : [0, -112]
    }).setDOMContent(popupContent));
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

  const preloadCameraViews = useCallback(async (plan: ResultCameraPlan, run: number): Promise<boolean> => {
    const map = mapRef.current;
    const scenario = activeScenarioRef.current;
    if (!map || run !== journeyRunRef.current) return false;
    const key = `${scenario.id}:${map.getContainer().clientWidth}:${terrainModeRef.current}:${terrainStrengthRef.current}`;
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
  }, [embedded]);

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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

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
        // A static replay is constructed at its final camera already. Repeating
        // the animated end-view warm-up only delays the visible replay map.
        if (!revealImmediately) await preloadCameraViews(plan, preparationRun);
        if (!mapRef.current || preparationRun !== journeyRunRef.current) return;
        map.jumpTo(revealImmediately ? plan.keyframes.at(-1)! : plan.keyframes[0]);
        setMarkerVisibility("guess", true);
        setMarkerVisibility("target", revealImmediately);
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
    const resizeObserver = new ResizeObserver(() => map.resize());
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
  }, [initialScenario, preloadCameraViews, preloadTerrain, revealImmediately, setMarkerVisibility, setResultMarkerContent, setRouteDrawProgress, setRouteVisibility, updateRouteOverlay]);

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
        setRouteVisibility(true); setMarkerVisibility("target", true); setRouteDrawProgress(1);
        map.easeTo({ center: end.center, zoom: end.zoom, bearing: end.bearing, pitch: end.pitch, duration: 320, essential: false });
        await pause(350);
      } else {
        const metrics = await runNativeResultFlight(plan, run, (progress) => {
          if (!routeRevealed && progress >= plan.revealProgress) { routeRevealed = true; setRouteVisibility(true); }
          if (!targetRevealed && progress >= plan.targetRevealProgress) { targetRevealed = true; setMarkerVisibility("target", true); }
          if (routeRevealed && progress - lastRouteUpdate >= 0.025) {
            lastRouteUpdate = progress;
            setRouteDrawProgress((progress - plan.revealProgress) / Math.max(0.001, 1 - plan.revealProgress));
          }
        });
        if (run === journeyRunRef.current && metrics.completed) {
          setStatus(`Ergebnis sichtbar · ${formatDistance(plan.distanceKm)} · Pitch ${plan.keyframes.at(-1)?.pitch ?? 0}° · Terrain ${terrainLevelRef.current && terrainLevelRef.current > 0.05 ? "aktiv" : "aus"} · ${formatTimelineMetrics(metrics)}`);
        }
      }
      if (run === journeyRunRef.current) {
        setRouteVisibility(true); setMarkerVisibility("target", true); setRouteDrawProgress(1);
        if (reducedMotionRef.current) setStatus(`Ergebnis sichtbar · ${formatDistance(plan.distanceKm)} · Reduced-Motion-Ease · Terrain ${terrainLevelRef.current && terrainLevelRef.current > 0.05 ? "aktiv" : "aus"}`);
        onAnimationCompleteRef.current?.();
      }
    } finally { if (run === journeyRunRef.current) setJourneyRunning(false); }
  }, [mapReady, preloadCameraViews, preloadTerrain, resultScenario, runNativeResultFlight, selectedScenarioId, setMarkerVisibility, setRouteDrawProgress, setRouteVisibility, stopCurrentJourney, updateResultGeometry]);

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
      <div className={styles.mapFrame} data-surface-ready={surfaceReady ? "true" : "false"}>
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
