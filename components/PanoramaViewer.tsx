"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { directImageFallbackDelayMs, gameplayImageWidth, normalizeEffectiveConnectionType } from "@/lib/imageDelivery";
import { isPreparedImageUrl } from "@/lib/imagePreload.client";
import type { GeoLocation, GameSettings } from "@/types/game";

type PanoramaViewerProps = {
  location: GeoLocation;
  settings: GameSettings;
  isHost: boolean;
  onSkipLocation: (locationId: string) => void | Promise<void>;
  onImageReady?: (locationId: string, ready: boolean) => void;
  chromeHidden?: boolean;
  onViewportTap?: () => void;
  sourceVariant?: "compact" | "detail";
};

const imageLoadTimeoutMs: Record<GeoLocation["category"], number> = {
  mixed: 6500,
  landmarks: 6500,
  cities: 6500,
  landscapes: 6500,
  flags: 4500,
  capitals: 6500,
  streetview: 6500
};

const slowLoadHintMs = 7000;
const manualSkipHintMs = 8000;
const locationLoadDeadlineMs = 12000;
const replayLoadOverlayDelayMs = 450;
const defaultProxyWidth = 1400;
const previewImageWidth = 160;
const acceptedImageUrls = new Set<string>();
const acceptedImageUrlByLocation = new Map<string, string>();

function imageCacheKeys(locationId: string): string[] {
  const roundId = locationId.split("@", 1)[0];
  return roundId === locationId ? [locationId] : [locationId, roundId];
}

function acceptedImageUrlFor(locationId: string): string | null {
  for (const key of imageCacheKeys(locationId)) {
    const cachedUrl = acceptedImageUrlByLocation.get(key);
    if (cachedUrl) return cachedUrl;
  }
  return null;
}

function rememberAcceptedImageUrl(locationId: string, imageUrl: string) {
  for (const key of imageCacheKeys(locationId)) acceptedImageUrlByLocation.set(key, imageUrl);
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractWikimediaFileTitle(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (url.hostname === "commons.wikimedia.org") {
      const filePathPrefix = "/wiki/Special:FilePath/";
      const redirectPrefix = "/wiki/Special:Redirect/file/";

      if (url.pathname.startsWith(filePathPrefix)) {
        return safeDecodeURIComponent(url.pathname.slice(filePathPrefix.length));
      }

      if (url.pathname.startsWith(redirectPrefix)) {
        return safeDecodeURIComponent(url.pathname.slice(redirectPrefix.length));
      }
    }

    if (url.hostname === "upload.wikimedia.org") {
      const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
      return lastSegment ? safeDecodeURIComponent(lastSegment) : null;
    }
  } catch {
    return null;
  }

  return null;
}

function wikimediaSizedImageUrl(rawUrl: string, width: number) {
  const fileTitle = extractWikimediaFileTitle(rawUrl);
  if (!fileTitle) return rawUrl;

  const thumbnailUrl = new URL(`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileTitle)}`);
  thumbnailUrl.searchParams.set("width", String(width));
  return thumbnailUrl.toString();
}

function wikimediaFilePageUrl(rawUrl: string) {
  const fileTitle = extractWikimediaFileTitle(rawUrl);
  if (!fileTitle) return rawUrl;

  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle).replace(/%20/g, "_")}`;
}

function estimateResponsiveImageWidth(element?: HTMLElement | null) {
  if (typeof window === "undefined") return defaultProxyWidth;

  const rect = element?.getBoundingClientRect();
  const cssWidth = rect?.width && rect.width > 0 ? rect.width : window.innerWidth;
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return gameplayImageWidth(cssWidth, window.devicePixelRatio, connection);
}

function isImageLargeEnough(width: number, height: number, category: GeoLocation["category"]) {
  if (!width || !height) return true;
  if (category === "flags") return width >= 240 && height >= 120;
  return width >= 760 && height >= 420 && width * height >= 420000;
}

function countProminentSeams(values: number[], size: number) {
  if (values.length < 8) return 0;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(26, mean + stdDev * 2.2);
  const margin = Math.floor(size * 0.1);

  let seamCount = 0;
  let index = 0;

  while (index < values.length) {
    if (values[index] < threshold) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < values.length && values[index] >= threshold) {
      index += 1;
    }
    const end = index - 1;
    const midpoint = Math.round((start + end) / 2);
    const width = end - start + 1;

    if (midpoint > margin && midpoint < values.length - margin && width <= Math.max(8, Math.floor(size * 0.08))) {
      seamCount += 1;
    }
  }

  return seamCount;
}

function isLikelyImageCollage(image: HTMLImageElement, category: GeoLocation["category"]) {
  if (category === "flags" || image.naturalWidth < 320 || image.naturalHeight < 220) return false;

  try {
    const width = 144;
    const height = Math.max(96, Math.round((image.naturalHeight / image.naturalWidth) * width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;

    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    const luminance = new Float32Array(width * height);

    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      luminance[index] = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    }

    const verticalDiffs = new Array<number>(width - 1).fill(0);
    for (let x = 0; x < width - 1; x += 1) {
      let sum = 0;
      for (let y = 0; y < height; y += 1) {
        const index = y * width + x;
        sum += Math.abs(luminance[index] - luminance[index + 1]);
      }
      verticalDiffs[x] = sum / height;
    }

    const horizontalDiffs = new Array<number>(height - 1).fill(0);
    for (let y = 0; y < height - 1; y += 1) {
      let sum = 0;
      const rowOffset = y * width;
      const nextRowOffset = (y + 1) * width;
      for (let x = 0; x < width; x += 1) {
        sum += Math.abs(luminance[rowOffset + x] - luminance[nextRowOffset + x]);
      }
      horizontalDiffs[y] = sum / width;
    }

    const verticalSeams = countProminentSeams(verticalDiffs, width);
    const horizontalSeams = countProminentSeams(horizontalDiffs, height);

    return verticalSeams >= 2 || horizontalSeams >= 2 || (verticalSeams >= 1 && horizontalSeams >= 1);
  } catch {
    return false;
  }
}

export function PanoramaViewer({ location, settings, isHost, onSkipLocation, onImageReady, chromeHidden = false, onViewportTap, sourceVariant = "compact" }: PanoramaViewerProps) {
  const initiallyPreparedUrl = acceptedImageUrlFor(location.id)
    ?? (isPreparedImageUrl(location.deliveryUrl) ? location.deliveryUrl! : null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(initiallyPreparedUrl);
  const [preferredImageUrl, setPreferredImageUrl] = useState<string | null>(initiallyPreparedUrl);
  const [rankedPromptAttempt, setRankedPromptAttempt] = useState(0);
  // The replay normally reuses the image that was visible during the round.
  // Keep its loading artwork hidden for the short browser-cache handover so
  // "Bild nochmal ansehen" does not look like a fresh image search.
  const [showLoadOverlay, setShowLoadOverlay] = useState(sourceVariant !== "detail" && !initiallyPreparedUrl);
  const [showSlowLoadHint, setShowSlowLoadHint] = useState(false);
  const [showManualSkip, setShowManualSkip] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [skipPending, setSkipPending] = useState(false);
  const viewportRef = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; pan: { x: number; y: number }; zoom: number } | null>(null);
  const lastTap = useRef({ time: 0, x: 0, y: 0, pointerType: "" });
  const singleTapTimer = useRef<number | null>(null);
  const touchDoubleTapHandledUntil = useRef(0);
  const tapGesture = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const skippedLocationIds = useRef(new Set<string>());
  const loadedImageUrlRef = useRef<string | null>(null);
  const fallbackTrackedLocationIds = useRef(new Set<string>());
  const failureTrackedLocationIds = useRef(new Set<string>());
  const rankedRetryTimerRef = useRef<number | null>(null);
  const skipResetTimerRef = useRef<number | null>(null);
  const loadStartedAtRef = useRef(0);
  const loadStartedFromCacheRef = useRef(false);
  const reportedLocationIdRef = useRef<string | null>(null);
  const [proxyWidth, setProxyWidth] = useState(() => estimateResponsiveImageWidth());

  const imageUrls = useMemo(() => {
    const urls = location.panoramaUrls?.length ? location.panoramaUrls : [location.panoramaUrl];
    return Array.from(new Set(urls.filter(Boolean)));
  }, [location.panoramaUrl, location.panoramaUrls]);

  const currentImageUrl = imageUrls[imageIndex] ?? location.panoramaUrl;
  const sourceHref = location.sourceUrl ?? (location.source === "wikimedia" ? wikimediaFilePageUrl(currentImageUrl) : currentImageUrl);
  const sourceName = location.source === "wikimedia" ? "Wikimedia Commons" : location.attribution || location.source;
  const requestImageWidth = proxyWidth;
  const directImageUrl = imageIndex === 0 && location.deliveryUrl
    ? location.deliveryUrl
    : wikimediaSizedImageUrl(currentImageUrl, requestImageWidth);
  const rankedPromptImage = currentImageUrl.startsWith("/api/v1/ranked-games/");
  const rankedPromptUrl = rankedPromptImage && rankedPromptAttempt > 0
    ? `${currentImageUrl}${currentImageUrl.includes("?") ? "&" : "?"}attempt=${rankedPromptAttempt}`
    : currentImageUrl;
  const imageProxyDisabled = process.env.NEXT_PUBLIC_DISABLE_IMAGE_PROXY === "true";
  const proxyImageUrl = `/api/image?src=${encodeURIComponent(currentImageUrl)}&w=${requestImageWidth}`;
  // Ordinary games can load the sized Wikimedia asset directly. Routing every
  // image through our server first doubled the transfer and forced the browser
  // to wait until the complete remote file had been buffered. Ranked prompts
  // remain server-proxied so their private answer source is not exposed.
  const primaryImageUrl = rankedPromptImage ? rankedPromptUrl : directImageUrl;
  const fallbackImageUrl = rankedPromptImage || imageProxyDisabled || directImageUrl.startsWith("/") ? null : proxyImageUrl;
  const displayedImageUrl = preferredImageUrl ?? primaryImageUrl;
  const previewImageUrl = rankedPromptImage || location.deliveryUrl ? null : wikimediaSizedImageUrl(currentImageUrl, previewImageWidth);
  const imageLoaded = loadedImageUrl === displayedImageUrl || acceptedImageUrls.has(displayedImageUrl);

  const reportImageDelivery = (outcome: "loaded" | "fallback" | "failed", deliveredUrl = displayedImageUrl) => {
    if (sourceVariant !== "compact" || reportedLocationIdRef.current === location.id) return;
    reportedLocationIdRef.current = location.id;
    const durationMs = Math.max(0, Math.min(120_000, Math.round(performance.now() - loadStartedAtRef.current)));
    const delivery = rankedPromptImage ? "ranked" : deliveredUrl.startsWith("/api/image") ? "proxy" : "direct";
    const effectiveType = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
    const connectionType = normalizeEffectiveConnectionType(effectiveType);
    trackAnalyticsEvent("image_delivery_complete", {
      category: location.category,
      duration_ms: durationMs,
      outcome,
      delivery,
      cache_hit: loadStartedFromCacheRef.current,
      connection_type: connectionType
    });
    void fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "image_delivery",
        category: location.category,
        durationMs,
        outcome,
        delivery,
        cacheHit: loadStartedFromCacheRef.current,
        connectionType,
        locationId: location.id
      }),
      keepalive: true
    }).catch(() => undefined);
  };

  useEffect(() => {
    loadedImageUrlRef.current = loadedImageUrl;
  }, [loadedImageUrl]);

  useEffect(() => {
    const updateProxyWidth = () => {
      const nextWidth = estimateResponsiveImageWidth(viewportRef.current);
      setProxyWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };

    updateProxyWidth();
    window.addEventListener("resize", updateProxyWidth);

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateProxyWidth);
    if (viewportRef.current) observer?.observe(viewportRef.current);

    return () => {
      window.removeEventListener("resize", updateProxyWidth);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const cachedImageUrl = acceptedImageUrlFor(location.id)
      ?? (isPreparedImageUrl(location.deliveryUrl) ? location.deliveryUrl! : null);
    loadStartedAtRef.current = performance.now();
    loadStartedFromCacheRef.current = Boolean(cachedImageUrl);
    reportedLocationIdRef.current = null;
    onImageReady?.(location.id, Boolean(cachedImageUrl));
    if (rankedRetryTimerRef.current !== null) window.clearTimeout(rankedRetryTimerRef.current);
    rankedRetryTimerRef.current = null;
    setRankedPromptAttempt(0);
    setZoom(100);
    setPan({ x: 0, y: 0 });
    setImageIndex(0);
    setImageFailed(false);
    setLoadedImageUrl(cachedImageUrl);
    loadedImageUrlRef.current = cachedImageUrl;
    setPreferredImageUrl(cachedImageUrl);
    // The catalog selection and image preparation happen before the round is
    // opened. Keep the fallback artwork out of the normal hand-off so a
    // prepared image can appear immediately without a loader flash.
    setShowLoadOverlay(sourceVariant !== "detail" && !cachedImageUrl);
    setShowSlowLoadHint(false);
    setShowManualSkip(false);
    setPreviewLoaded(false);
    setSkipPending(false);
    if (skipResetTimerRef.current !== null) window.clearTimeout(skipResetTimerRef.current);
    skipResetTimerRef.current = null;
  }, [location.id, sourceVariant]);

  useEffect(() => () => {
    if (rankedRetryTimerRef.current !== null) window.clearTimeout(rankedRetryTimerRef.current);
    if (skipResetTimerRef.current !== null) window.clearTimeout(skipResetTimerRef.current);
  }, []);

  // A broken or throttled remote asset must never trap the round indefinitely.
  // This deadline spans direct loading, the proxy fallback and ranked retries.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (loadedImageUrlRef.current) return;
      if (rankedRetryTimerRef.current !== null) window.clearTimeout(rankedRetryTimerRef.current);
      rankedRetryTimerRef.current = null;
      onImageReady?.(location.id, false);
      setShowLoadOverlay(true);
      setShowSlowLoadHint(true);
      setShowManualSkip(true);
      setImageFailed(true);
    }, locationLoadDeadlineMs);

    return () => window.clearTimeout(timer);
  }, [location.id]);

  useEffect(() => {
    const cachedImageUrl = imageIndex === 0
      ? acceptedImageUrlFor(location.id) ?? (isPreparedImageUrl(location.deliveryUrl) ? location.deliveryUrl! : null)
      : null;
    onImageReady?.(location.id, Boolean(cachedImageUrl));
    setImageFailed(false);
    setPreferredImageUrl(cachedImageUrl);
    setLoadedImageUrl(cachedImageUrl);
    loadedImageUrlRef.current = cachedImageUrl;
    setShowLoadOverlay(sourceVariant !== "detail" && !cachedImageUrl);
    setShowSlowLoadHint(false);
    setShowManualSkip(false);
    setPreviewLoaded(false);
  }, [location.id, imageIndex, sourceVariant]);

  useEffect(() => {
    if (sourceVariant !== "detail" || imageLoaded || imageFailed) return;
    const timer = window.setTimeout(() => setShowLoadOverlay(true), replayLoadOverlayDelayMs);
    return () => window.clearTimeout(timer);
  }, [imageFailed, imageLoaded, location.id, sourceVariant]);

  useEffect(() => {
    if (!acceptedImageUrls.has(displayedImageUrl)) return;
    setLoadedImageUrl(displayedImageUrl);
    setImageFailed(false);
    setShowLoadOverlay(false);
    setShowSlowLoadHint(false);
    setShowManualSkip(false);
    onImageReady?.(location.id, true);
  }, [displayedImageUrl]);

  const tryNextImageCandidate = () => {
    if (imageIndex < imageUrls.length - 1) {
      setPreferredImageUrl(null);
      setLoadedImageUrl(null);
      loadedImageUrlRef.current = null;
      setImageIndex((value) => value + 1);
    } else {
      setImageFailed(true);
    }
  };

  useEffect(() => {
    if (imageLoaded) return;
    const canUseFallback = Boolean(fallbackImageUrl) && !preferredImageUrl;
    const effectiveType = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
    const delayMs = canUseFallback
      ? directImageFallbackDelayMs(effectiveType)
      : imageLoadTimeoutMs[location.category] ?? 6500;
    const timer = window.setTimeout(() => {
      if (canUseFallback && fallbackImageUrl) {
        if (!fallbackTrackedLocationIds.current.has(location.id)) {
          fallbackTrackedLocationIds.current.add(location.id);
          trackAnalyticsEvent("image_delivery_fallback", { category: location.category, reason: "proxy_timeout" });
        }
        setPreferredImageUrl(fallbackImageUrl);
        setLoadedImageUrl(acceptedImageUrls.has(fallbackImageUrl) ? fallbackImageUrl : null);
        return;
      }
      tryNextImageCandidate();
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [displayedImageUrl, fallbackImageUrl, imageIndex, imageLoaded, imageUrls.length, location.category, location.id, preferredImageUrl]);

  useEffect(() => {
    if (imageLoaded) return;
    const hintTimer = window.setTimeout(() => setShowSlowLoadHint(true), slowLoadHintMs);
    const manualSkipTimer = window.setTimeout(() => setShowManualSkip(true), manualSkipHintMs);
    return () => {
      window.clearTimeout(hintTimer);
      window.clearTimeout(manualSkipTimer);
    };
  }, [imageLoaded, location.id]);

  useEffect(() => {
    if (!imageFailed) return;
    setShowLoadOverlay(true);
    if (failureTrackedLocationIds.current.has(location.id)) return;
    failureTrackedLocationIds.current.add(location.id);
    trackAnalyticsEvent("image_delivery_failed", { category: location.category });
    reportImageDelivery("failed");
  }, [imageFailed, location.category, location.id]);

  const skipCurrentLocation = async () => {
    if (skipPending) return;
    skippedLocationIds.current.add(location.id);
    setSkipPending(true);
    try {
      await onSkipLocation(location.id);
    } catch {
      // The caller owns the user-facing error state. Re-enable the action
      // immediately when the replacement request itself fails.
    } finally {
      // onSkipLocation now resolves only after the next image has been
      // prepared (or rejects), so a fixed timeout cannot unlock this button
      // while a replacement is still in flight.
      setSkipPending(false);
    }
  };

  const scale = zoom / 100;
  const canPanImage = !settings.noPan && zoom > 100;
  const clampZoom = (value: number) => Math.max(100, Math.min(220, value));

  const clampPan = (nextPan: { x: number; y: number }, nextZoom = zoom) => {
    const viewport = viewportRef.current;
    const nextScale = nextZoom / 100;
    if (!viewport || nextScale <= 1) return { x: 0, y: 0 };

    const maxX = (viewport.clientWidth * (nextScale - 1)) / 2;
    const maxY = (viewport.clientHeight * (nextScale - 1)) / 2;

    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y))
    };
  };

  const toggleZoom = () => {
    if (settings.noZoom) return;

    if (zoom > 100) {
      resetView();
      return;
    }

    const nextZoom = 180;
    setZoom(nextZoom);
    setPan((currentPan) => clampPan(currentPan, nextZoom));
  };

  const style = useMemo(
    () => ({
      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`
    }),
    [pan.x, pan.y, scale]
  );

  const resetView = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    dragging.current = false;
    activePointers.current.clear();
    pinchStart.current = null;
    setIsDragging(false);
  };

  const stopDragging = () => {
    dragging.current = false;
    setIsDragging(false);
  };

  const pointerDistance = (points: { x: number; y: number }[]) => {
    const [first, second] = points;
    if (!first || !second) return 0;
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const clearPendingSingleTap = () => {
    if (singleTapTimer.current === null) return;
    window.clearTimeout(singleTapTimer.current);
    singleTapTimer.current = null;
  };

  useEffect(() => {
    clearPendingSingleTap();
    lastTap.current = { time: 0, x: 0, y: 0, pointerType: "" };
    return clearPendingSingleTap;
  }, [location.id]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const point = { x: event.clientX, y: event.clientY };
    tapGesture.current = { pointerId: event.pointerId, ...point, moved: false };

    activePointers.current.set(event.pointerId, point);
    if (event.pointerType === "touch" && event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const points = Array.from(activePointers.current.values());
    if (points.length >= 2 && !settings.noZoom) {
      tapGesture.current = null;
      event.preventDefault();
      event.currentTarget.focus();
      stopDragging();
      pinchStart.current = {
        distance: pointerDistance(points),
        pan,
        zoom
      };
      return;
    }

    if (!canPanImage) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    setIsDragging(true);
    lastPointer.current = point;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = tapGesture.current;
    if (gesture?.pointerId === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) {
      gesture.moved = true;
    }
    if (activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const points = Array.from(activePointers.current.values());
    if (pinchStart.current && points.length >= 2 && !settings.noZoom) {
      event.preventDefault();
      const startDistance = Math.max(1, pinchStart.current.distance);
      const nextZoom = clampZoom(pinchStart.current.zoom * (pointerDistance(points) / startDistance));
      setZoom(nextZoom);
      setPan(clampPan(pinchStart.current.pan, nextZoom));
      return;
    }

    if (!dragging.current || !canPanImage) return;
    event.preventDefault();
    const deltaX = event.clientX - lastPointer.current.x;
    const deltaY = event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setPan((value) => clampPan({ x: value.x + deltaX, y: value.y + deltaY }));
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLElement>, canceled = false) => {
    const gesture = tapGesture.current;
    const target = event.target instanceof Element ? event.target : null;
    const shouldHandleTap =
      !canceled &&
      gesture?.pointerId === event.pointerId &&
      !gesture.moved &&
      activePointers.current.size <= 1 &&
      !target?.closest("a, button, input, select, textarea");
    activePointers.current.delete(event.pointerId);
    pinchStart.current = null;
    stopDragging();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    tapGesture.current = null;
    if (!shouldHandleTap) return;

    if (event.pointerType === "mouse") {
      onViewportTap?.();
      return;
    }

    const now = window.performance.now();
    const previousTap = lastTap.current;
    const isDoubleTap =
      previousTap.pointerType === event.pointerType &&
      now - previousTap.time < 320 &&
      Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) < 24;

    if (isDoubleTap && !settings.noZoom) {
      event.preventDefault();
      clearPendingSingleTap();
      lastTap.current = { time: 0, x: 0, y: 0, pointerType: "" };
      touchDoubleTapHandledUntil.current = now + 500;
      toggleZoom();
      return;
    }

    lastTap.current = {
      time: now,
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType
    };
    clearPendingSingleTap();
    singleTapTimer.current = window.setTimeout(() => {
      singleTapTimer.current = null;
      lastTap.current = { time: 0, x: 0, y: 0, pointerType: "" };
      onViewportTap?.();
    }, 320);
  };

  return (
    <section
      ref={viewportRef}
      tabIndex={0}
      className={`punktlandung-panorama-viewport absolute inset-0 overflow-hidden bg-slate-950 outline-none ${canPanImage ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={(event) => handlePointerEnd(event, true)}
      onDoubleClick={(event) => {
        if (settings.noZoom) return;
        if (window.performance.now() < touchDoubleTapHandledUntil.current) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        toggleZoom();
      }}
      onKeyDown={(event) => {
        if (!canPanImage) return;
        const step = event.shiftKey ? 80 : 40;
        const keyDelta: Record<string, { x: number; y: number }> = {
          ArrowLeft: { x: step, y: 0 },
          ArrowRight: { x: -step, y: 0 },
          ArrowUp: { x: 0, y: step },
          ArrowDown: { x: 0, y: -step }
        };
        const delta = keyDelta[event.key];
        if (!delta) return;
        event.preventDefault();
        setPan((value) => clampPan({ x: value.x + delta.x, y: value.y + delta.y }));
      }}
      onWheel={(event) => {
        if (settings.noZoom) return;
        event.preventDefault();
        setZoom((value) => {
          const nextZoom = clampZoom(value + event.deltaY * -0.04);
          setPan((currentPan) => clampPan(currentPan, nextZoom));
          return nextZoom;
        });
      }}
    >
      {previewImageUrl && !imageLoaded && (
        <img
          src={previewImageUrl}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute inset-[-4%] h-[108%] w-[108%] select-none object-cover blur-xl transition-opacity duration-300 ${previewLoaded ? "opacity-55" : "opacity-0"}`}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onLoad={() => setPreviewLoaded(true)}
        />
      )}
      {!imageFailed && (
        <div
          className={`absolute inset-0 transition-[opacity,transform] ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${isDragging ? "duration-0" : "duration-150"}`}
          style={style}
        >
          <img
            key={`${location.id}-${imageIndex}`}
            src={displayedImageUrl}
            alt="Ort zum Erraten"
            className="absolute inset-0 h-full w-full select-none object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (!isImageLargeEnough(image.naturalWidth, image.naturalHeight, location.category)) {
                onImageReady?.(location.id, false);
                setLoadedImageUrl(null);
                tryNextImageCandidate();
                return;
              }
              acceptedImageUrls.add(displayedImageUrl);
              rememberAcceptedImageUrl(location.id, displayedImageUrl);
              loadedImageUrlRef.current = displayedImageUrl;
              setLoadedImageUrl(displayedImageUrl);
              setShowLoadOverlay(false);
              setShowSlowLoadHint(false);
              setShowManualSkip(false);
              onImageReady?.(location.id, true);
              const usedReactiveFallback = displayedImageUrl.startsWith("/api/image")
                && location.deliveryUrl !== displayedImageUrl;
              reportImageDelivery(usedReactiveFallback ? "fallback" : "loaded", displayedImageUrl);
            }}
            onError={() => {
              if (rankedPromptImage && rankedPromptAttempt < 1) {
                loadedImageUrlRef.current = null;
                onImageReady?.(location.id, false);
                setLoadedImageUrl(null);
                setShowLoadOverlay(true);
                if (rankedRetryTimerRef.current !== null) window.clearTimeout(rankedRetryTimerRef.current);
                rankedRetryTimerRef.current = window.setTimeout(() => {
                  rankedRetryTimerRef.current = null;
                  setRankedPromptAttempt((attempt) => attempt + 1);
                }, 800 * (rankedPromptAttempt + 1));
                return;
              }
              if (fallbackImageUrl && !preferredImageUrl) {
                if (!fallbackTrackedLocationIds.current.has(location.id)) {
                  fallbackTrackedLocationIds.current.add(location.id);
                  trackAnalyticsEvent("image_delivery_fallback", { category: location.category, reason: "proxy_error" });
                }
                setPreferredImageUrl(fallbackImageUrl);
                setLoadedImageUrl(acceptedImageUrls.has(fallbackImageUrl) ? fallbackImageUrl : null);
                loadedImageUrlRef.current = acceptedImageUrls.has(fallbackImageUrl) ? fallbackImageUrl : null;
                if (acceptedImageUrls.has(fallbackImageUrl)) onImageReady?.(location.id, true);
                return;
              }
              loadedImageUrlRef.current = null;
              onImageReady?.(location.id, false);
              setLoadedImageUrl(null);
              tryNextImageCandidate();
            }}
          />
          {!chromeHidden && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.04)_44%,rgba(2,6,23,0.18)_68%,rgba(2,6,23,0.42)_86%,rgba(2,6,23,0.64)_100%)]" />}
        </div>
      )}

      {!imageLoaded && (showLoadOverlay || imageFailed) && (
        <div className={`pointer-events-none absolute inset-0 z-20 grid place-items-center p-6 text-center backdrop-blur-[2px] ${previewLoaded ? "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.10),rgba(2,6,23,0.48)_62%,rgba(2,6,23,0.76)_100%)]" : "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),rgba(2,6,23,0.72)_58%,rgba(2,6,23,0.9)_100%)]"}`}>
          <div
            className="punktlandung-image-loader pointer-events-auto h-56 w-56 bg-transparent p-0 shadow-none ring-0"
          >
            <div className="punktlandung-loader-mark mx-auto">
              <svg className="punktlandung-loader-ellipses" viewBox="0 0 128 96" aria-hidden="true">
                <ellipse className="punktlandung-loader-ellipse punktlandung-loader-ellipse-base punktlandung-loader-ellipse-base-outer" cx="64" cy="78" rx="38.5" ry="12" />
                <ellipse className="punktlandung-loader-ellipse punktlandung-loader-ellipse-base punktlandung-loader-ellipse-base-inner" cx="64" cy="78" rx="22.5" ry="6.5" />
                <ellipse className="punktlandung-loader-ellipse punktlandung-loader-ellipse-highlight punktlandung-loader-ellipse-highlight-outer" cx="64" cy="78" rx="38.5" ry="12" pathLength="100" />
                <ellipse className="punktlandung-loader-ellipse punktlandung-loader-ellipse-highlight punktlandung-loader-ellipse-highlight-inner" cx="64" cy="78" rx="22.5" ry="6.5" pathLength="100" />
              </svg>
              <span className="punktlandung-loader-beam-orbit">
                <span className="punktlandung-loader-beam" />
                <span className="punktlandung-loader-core-beam" />
              </span>
              <span className="punktlandung-loader-pin" />
            </div>
            {showSlowLoadHint && (
              <>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.26em] text-emerald-200">
                  "Das Bild braucht gerade ungewöhnlich lange"
                </p>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">
                  "Das kann an der Verbindung liegen. Du kannst einen anderen Ort nehmen."
                </p>
              </>
            )}
            {showManualSkip && isHost && (
              <button
                type="button"
                onClick={() => void skipCurrentLocation()}
                disabled={skipPending}
                className="mt-5 w-full rounded-lg bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 shadow-[0_0_28px_rgba(52,211,153,0.18)] ring-1 ring-emerald-300/70 transition hover:bg-emerald-400/16"
              >
                {skipPending ? "Anderer Ort wird geladen …" : "Anderen Ort nehmen"}
              </button>
            )}
          </div>
        </div>
      )}

      {!chromeHidden && sourceVariant === "compact" && (
        <div className="punktlandung-source-chip punktlandung-source-chip--compact absolute bottom-3 left-1/2 z-10 w-fit max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-slate-950/44 px-3 py-2 text-center shadow-[0_16px_36px_rgba(0,0,0,0.18)] ring-1 ring-slate-700/35 backdrop-blur sm:bottom-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Quelle</p>
          <h1 className="mt-0.5 text-sm font-semibold leading-tight text-slate-200">{sourceName}</h1>
        </div>
      )}

      {!chromeHidden && sourceVariant === "detail" && (
        <a
          className="punktlandung-source-chip punktlandung-source-chip--detail absolute bottom-3 left-1/2 z-10 w-fit max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-slate-950/68 px-3.5 py-2.5 text-center shadow-[0_18px_44px_rgba(0,0,0,0.30)] ring-1 ring-indigo-300/35 backdrop-blur sm:bottom-4"
          href={sourceHref}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">Quelle</p>
          <h1 className="mt-0.5 text-sm font-black leading-tight text-white">{sourceName}</h1>
          <p className="mt-1 text-[10px] font-semibold leading-tight text-slate-300">Lizenz und Urheberinfos auf der Commons-Dateiseite</p>
        </a>
      )}

    </section>
  );
}
