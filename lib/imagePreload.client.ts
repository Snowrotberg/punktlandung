"use client";

import { gameplayImageWidth } from "@/lib/imageDelivery";
import type { GeoLocation } from "@/types/game";

const preloadByUrl = new Map<string, Promise<boolean>>();
const preparedImageUrls = new Set<string>();
const preparedImageElements = new Map<string, HTMLImageElement>();
const retainedDecodedImageLimit = 3;

function retainDecodedImage(url: string, image: HTMLImageElement) {
  preparedImageElements.delete(url);
  preparedImageElements.set(url, image);
  while (preparedImageElements.size > retainedDecodedImageLimit) {
    const oldestUrl = preparedImageElements.keys().next().value as string | undefined;
    if (!oldestUrl) break;
    preparedImageElements.delete(oldestUrl);
  }
}

export function isPreparedImageUrl(url: string | null | undefined): boolean {
  return Boolean(url && preparedImageUrls.has(url));
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function wikimediaFileTitle(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.hostname === "commons.wikimedia.org") {
      for (const prefix of ["/wiki/Special:FilePath/", "/wiki/Special:Redirect/file/"]) {
        if (url.pathname.startsWith(prefix)) return safeDecodeURIComponent(url.pathname.slice(prefix.length));
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

function sizedWikimediaUrl(rawUrl: string, width: number): string {
  const fileTitle = wikimediaFileTitle(rawUrl);
  if (!fileTitle) return rawUrl;
  const url = new URL(`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileTitle)}`);
  url.searchParams.set("width", String(width));
  return url.toString();
}

function currentImageWidth(location: GeoLocation): number {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  // The portrait game image does not occupy the full window height. Using the
  // full height here would request oversized panoramic thumbnails before the
  // actual viewer exists. Three quarters of the window width closely bounds
  // the responsive image stage while landscape layouts may still use all of
  // their available height.
  const estimatedViewportHeight = Math.min(window.innerHeight, window.innerWidth * 0.75);
  return gameplayImageWidth(window.innerWidth, window.devicePixelRatio, connection, {
    viewportHeight: estimatedViewportHeight,
    sourceWidth: location.imageWidth,
    sourceHeight: location.imageHeight
  });
}

function imageLargeEnough(image: HTMLImageElement, category: GeoLocation["category"], trustedRankedAsset = false): boolean {
  if (trustedRankedAsset) {
    if (image.naturalWidth < 1 || image.naturalHeight < 1) return false;
    if (category === "flags") return true;
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    return aspectRatio >= 1.05 && aspectRatio <= 3.8;
  }
  if (category === "flags") return image.naturalWidth >= 240 && image.naturalHeight >= 120;
  const aspectRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
  return aspectRatio >= 1.2 && aspectRatio <= 3.4
    && image.naturalWidth >= 760
    && image.naturalHeight >= 420
    && image.naturalWidth * image.naturalHeight >= 420_000;
}

export function preloadBrowserImage(
  url: string,
  category: GeoLocation["category"],
  timeoutMs = 8_000,
  trustedRankedAsset = false
): Promise<boolean> {
  const existing = preloadByUrl.get(url);
  if (existing) return existing;

  const pending = new Promise<boolean>((resolve) => {
    const image = new Image();
    const finish = (loaded: boolean) => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    image.decoding = "async";
    image.fetchPriority = "high";
    image.onload = async () => {
      const loaded = imageLargeEnough(image, category, trustedRankedAsset);
      if (!loaded) {
        finish(false);
        return;
      }

      // `load` only guarantees that the bytes arrived. Waiting for `decode`
      // while the round is still being prepared prevents a several-second
      // decode pause when the same image becomes visible (or is replayed) on
      // slower mobile devices.
      try {
        await image.decode();
      } catch {
        // Some browsers reject decode() for images that are nevertheless
        // drawable. The successful load and dimension check still count.
      }
      preparedImageUrls.add(url);
      // Keep the current and immediately adjacent rounds decoded. Holding a
      // small bounded set avoids mobile memory growth while making replay and
      // the prefetched next round reuse the browser's decoded surface.
      retainDecodedImage(url, image);
      finish(true);
    };
    image.onerror = () => finish(false);
    image.src = url;
  });

  preloadByUrl.set(url, pending);
  void pending.then((loaded) => {
    if (!loaded) preloadByUrl.delete(url);
  });
  return pending;
}

export async function prepareLocationImage(location: GeoLocation): Promise<GeoLocation | null> {
  if (typeof window === "undefined") return location;
  const width = currentImageWidth(location);
  const sourceUrls = Array.from(new Set((location.panoramaUrls?.length ? location.panoramaUrls : [location.panoramaUrl]).filter(Boolean)));

  for (const sourceUrl of sourceUrls) {
    if (sourceUrl.startsWith("/") || location.deliveryUrl) {
      const deliveryUrl = location.deliveryUrl ?? sourceUrl;
      const trustedRankedAsset = deliveryUrl.startsWith("/api/v1/ranked-games/");
      if (await preloadBrowserImage(deliveryUrl, location.category, trustedRankedAsset ? 15_000 : 8_000, trustedRankedAsset)) {
        return { ...location, deliveryUrl };
      }
      continue;
    }

    const directUrl = sizedWikimediaUrl(sourceUrl, width);
    const isWikimedia = Boolean(wikimediaFileTitle(sourceUrl));
    if (isWikimedia && process.env.NEXT_PUBLIC_DISABLE_IMAGE_PROXY !== "true") {
      const proxyUrl = `/api/image?src=${encodeURIComponent(sourceUrl)}&w=${width}`;
      if (await preloadBrowserImage(proxyUrl, location.category)) return { ...location, deliveryUrl: proxyUrl };
    }
    if (await preloadBrowserImage(directUrl, location.category, 6_000)) return { ...location, deliveryUrl: directUrl };
  }

  return null;
}
