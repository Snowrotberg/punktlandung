"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoLocation, GameSettings } from "@/types/game";

type PanoramaViewerProps = {
  location: GeoLocation;
  settings: GameSettings;
  isHost: boolean;
  onSkipLocation: (locationId: string) => void;
  chromeHidden?: boolean;
};

const imageLoadTimeoutMs: Record<GeoLocation["category"], number> = {
  mixed: 18000,
  landmarks: 18000,
  cities: 18000,
  landscapes: 18000,
  flags: 12000,
  capitals: 18000,
  streetview: 18000
};

const slowLoadHintMs = 10000;
const manualSkipHintMs = 15000;
const failedImageAutoSkipMs = 7000;
const loadOverlayDelayMs = 2200;
const acceptedImageUrls = new Set<string>();

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

export function PanoramaViewer({ location, settings, isHost, onSkipLocation, chromeHidden = false }: PanoramaViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [autoSkipPaused, setAutoSkipPaused] = useState(false);
  const [showLoadOverlay, setShowLoadOverlay] = useState(false);
  const [showSlowLoadHint, setShowSlowLoadHint] = useState(false);
  const [showManualSkip, setShowManualSkip] = useState(false);
  const viewportRef = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const skippedLocationIds = useRef(new Set<string>());
  const autoSkipStreak = useRef(0);

  const imageUrls = useMemo(() => {
    const urls = location.panoramaUrls?.length ? location.panoramaUrls : [location.panoramaUrl];
    return Array.from(new Set(urls.filter(Boolean)));
  }, [location.panoramaUrl, location.panoramaUrls]);

  const currentImageUrl = imageUrls[imageIndex] ?? location.panoramaUrl;
  const imageProxyDisabled = process.env.NEXT_PUBLIC_DISABLE_IMAGE_PROXY === "true";
  const proxyWidth = 1800;
  const displayedImageUrl = imageProxyDisabled
    ? wikimediaSizedImageUrl(currentImageUrl, proxyWidth)
    : `/api/image?src=${encodeURIComponent(currentImageUrl)}&w=${proxyWidth}`;
  const imageLoaded = loadedImageUrl === displayedImageUrl || acceptedImageUrls.has(displayedImageUrl);

  useEffect(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    setImageIndex(0);
    setImageFailed(false);
    setLoadedImageUrl(null);
    setAutoSkipPaused(false);
    setShowLoadOverlay(false);
    setShowSlowLoadHint(false);
    setShowManualSkip(false);
  }, [location.id]);

  useEffect(() => {
    setImageFailed(false);
    setShowLoadOverlay(false);
    setShowSlowLoadHint(false);
    setShowManualSkip(false);
  }, [location.id, imageIndex]);

  useEffect(() => {
    if (!acceptedImageUrls.has(displayedImageUrl)) return;
    setLoadedImageUrl(displayedImageUrl);
    setImageFailed(false);
    setShowLoadOverlay(false);
    setShowSlowLoadHint(false);
    setShowManualSkip(false);
  }, [displayedImageUrl]);

  const tryNextImageCandidate = () => {
    if (imageIndex < imageUrls.length - 1) {
      setImageIndex((value) => value + 1);
    } else {
      setImageFailed(true);
    }
  };

  useEffect(() => {
    if (imageLoaded) return;
    const overlayTimer = window.setTimeout(() => setShowLoadOverlay(true), loadOverlayDelayMs);
    const hintTimer = window.setTimeout(() => setShowSlowLoadHint(true), slowLoadHintMs);
    const manualSkipTimer = window.setTimeout(() => setShowManualSkip(true), manualSkipHintMs);
    const timer = window.setTimeout(() => {
      tryNextImageCandidate();
    }, imageLoadTimeoutMs[location.category] ?? 14000);
    return () => {
      window.clearTimeout(overlayTimer);
      window.clearTimeout(hintTimer);
      window.clearTimeout(manualSkipTimer);
      window.clearTimeout(timer);
    };
  }, [imageIndex, imageLoaded, imageUrls.length, location.category, location.id]);

  useEffect(() => {
    if (!imageFailed) return;
    setShowLoadOverlay(true);
  }, [imageFailed]);

  useEffect(() => {
    if (!imageFailed || autoSkipPaused || skippedLocationIds.current.has(location.id)) return;
    if (autoSkipStreak.current >= 4) {
      setAutoSkipPaused(true);
      return;
    }

    const timer = window.setTimeout(() => {
      skippedLocationIds.current.add(location.id);
      autoSkipStreak.current += 1;
      onSkipLocation(location.id);
    }, failedImageAutoSkipMs);
    return () => window.clearTimeout(timer);
  }, [autoSkipPaused, imageFailed, location.id, onSkipLocation]);

  const skipCurrentLocation = () => {
    skippedLocationIds.current.add(location.id);
    autoSkipStreak.current += 1;
    onSkipLocation(location.id);
  };

  const scale = zoom / 100;
  const canPanImage = !settings.noPan && zoom > 100;

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
    setIsDragging(false);
  };

  return (
    <section
      ref={viewportRef}
      tabIndex={0}
      className={`punktlandung-panorama-viewport absolute inset-0 overflow-hidden bg-slate-950 outline-none ${canPanImage ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      onPointerDown={(event) => {
        if (!canPanImage || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        setIsDragging(true);
        lastPointer.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (!dragging.current || !canPanImage) return;
        event.preventDefault();
        const deltaX = event.clientX - lastPointer.current.x;
        const deltaY = event.clientY - lastPointer.current.y;
        lastPointer.current = { x: event.clientX, y: event.clientY };
        setPan((value) => clampPan({ x: value.x + deltaX, y: value.y + deltaY }));
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setIsDragging(false);
      }}
      onDoubleClick={(event) => {
        if (zoom <= 100) return;
        event.preventDefault();
        resetView();
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
          const nextZoom = Math.max(100, Math.min(220, value + event.deltaY * -0.04));
          setPan((currentPan) => clampPan(currentPan, nextZoom));
          return nextZoom;
        });
      }}
    >
      {!imageFailed && (
        <img
          key={`${location.id}-${imageIndex}`}
          src={displayedImageUrl}
          alt="Ort zum Erraten"
          className={`absolute inset-0 h-full w-full select-none object-cover transition-[opacity,transform] ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${isDragging ? "duration-0" : "duration-150"}`}
          style={style}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (!isImageLargeEnough(image.naturalWidth, image.naturalHeight, location.category)) {
              setLoadedImageUrl(null);
              tryNextImageCandidate();
              return;
            }
            if (isLikelyImageCollage(image, location.category)) {
              setLoadedImageUrl(null);
              tryNextImageCandidate();
              return;
            }
            autoSkipStreak.current = 0;
            acceptedImageUrls.add(displayedImageUrl);
            setLoadedImageUrl(displayedImageUrl);
            setShowLoadOverlay(false);
            setShowSlowLoadHint(false);
            setShowManualSkip(false);
          }}
          onError={() => {
            setLoadedImageUrl(null);
            tryNextImageCandidate();
          }}
        />
      )}

      {!imageLoaded && (showLoadOverlay || imageFailed) && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),rgba(2,6,23,0.72)_58%,rgba(2,6,23,0.9)_100%)] p-6 text-center backdrop-blur-[2px]">
          <div
            className={`punktlandung-image-loader pointer-events-auto transition-all duration-500 ${
              showSlowLoadHint
                ? "punktlandung-image-loader-framed w-full max-w-md rounded-md bg-slate-950/82 px-6 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)] ring-1 ring-emerald-300/70"
                : "h-56 w-56 bg-transparent p-0 shadow-none ring-0"
            }`}
          >
            <div className="punktlandung-loader-mark mx-auto">
              <span className="punktlandung-loader-ring punktlandung-loader-ring-outer" />
              <span className="punktlandung-loader-ring punktlandung-loader-ring-inner" />
              <span className="punktlandung-loader-sweep" />
              <span className="punktlandung-loader-pin" />
            </div>
            {showSlowLoadHint && (
              <>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.26em] text-emerald-200">Ort wird vorbereitet</p>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">
                  {imageFailed
                    ? "Die Verbindung braucht gerade etwas länger. Wir nehmen gleich automatisch einen anderen Ort."
                    : "Die Verbindung braucht gerade einen Moment. Wir bleiben dran."}
                </p>
              </>
            )}
            {showManualSkip && isHost && (
              <button
                type="button"
                onClick={skipCurrentLocation}
                className="mt-5 w-full rounded-md bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 shadow-[0_0_28px_rgba(52,211,153,0.18)] ring-1 ring-emerald-300/70 transition hover:bg-emerald-400/16"
              >
                Anderen Ort nehmen
              </button>
            )}
          </div>
        </div>
      )}

      {!chromeHidden && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.18)_58%,rgba(2,6,23,0.7)_100%)]" />}

      {!chromeHidden && (
        <div className="absolute bottom-3 left-1/2 z-10 w-fit max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-slate-950/58 px-3 py-2 text-center shadow-[0_16px_36px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/50 backdrop-blur sm:bottom-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Quelle</p>
          <h1 className="mt-0.5 text-sm font-black leading-tight text-white">{location.source === "wikimedia" ? "Wikimedia Commons" : location.source}</h1>
          {location.source !== "wikimedia" && location.attribution && <p className="mt-0.5 text-[10px] leading-tight text-slate-300">{location.attribution}</p>}
        </div>
      )}

      {!chromeHidden && (
        <div className="absolute left-3 top-28 flex flex-wrap gap-2 sm:left-4 sm:top-24">
          {settings.noMove && <span className="rounded-md bg-rose-500/20 px-3 py-2 text-xs font-black ring-1 ring-rose-400/70 backdrop-blur">NICHT BEWEGEN</span>}
          {settings.noPan && <span className="rounded-md bg-rose-500/20 px-3 py-2 text-xs font-black ring-1 ring-rose-400/70 backdrop-blur">NICHT SCHWENKEN</span>}
          {settings.noZoom && <span className="rounded-md bg-rose-500/20 px-3 py-2 text-xs font-black ring-1 ring-rose-400/70 backdrop-blur">NICHT ZOOMEN</span>}
        </div>
      )}
    </section>
  );
}
