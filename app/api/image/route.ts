import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["commons.wikimedia.org", "upload.wikimedia.org"]);
const DEFAULT_IMAGE_WIDTH = 1400;
const MIN_IMAGE_WIDTH = 640;
const MAX_IMAGE_WIDTH = 2200;
const FETCH_TIMEOUT_MS = 6500;
const FALLBACK_IMAGE_WIDTH = 1000;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

type BufferedImage = {
  bytes: ArrayBuffer;
  contentType: string;
  sourceUrl: string;
};

function clampWidth(rawWidth: string | null): number {
  const parsed = Number(rawWidth);
  if (!Number.isFinite(parsed)) return DEFAULT_IMAGE_WIDTH;
  return Math.max(MIN_IMAGE_WIDTH, Math.min(MAX_IMAGE_WIDTH, Math.round(parsed)));
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractWikimediaFileTitle(url: URL): string | null {
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

  return null;
}

function sizedWikimediaUrl(sourceUrl: URL, width: number): string {
  const title = extractWikimediaFileTitle(sourceUrl);
  if (!title) return sourceUrl.toString();

  // Special:Redirect/file accepts a width itself. Using it directly avoids the
  // former, sequential metadata-API request before every actual image request.
  const target = new URL(`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(title)}`);
  target.searchParams.set("width", String(width));
  return target.toString();
}

function uniqueCandidates(sourceUrl: URL, requestedWidth: number): string[] {
  const widths = [requestedWidth, Math.min(requestedWidth, FALLBACK_IMAGE_WIDTH), MIN_IMAGE_WIDTH];
  const candidates = widths.map((width) => sizedWikimediaUrl(sourceUrl, width));

  // Direct upload URLs are useful as a last server-side fallback. FilePath
  // sources can point at huge originals, so their sized variants remain safer.
  if (sourceUrl.hostname === "upload.wikimedia.org") candidates.push(sourceUrl.toString());
  return Array.from(new Set(candidates));
}

async function fetchBufferedImage(targetUrl: string): Promise<BufferedImage | null> {
  try {
    const response = await fetch(targetUrl, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "image/avif,image/webp,image/svg+xml,image/*,*/*",
        "user-agent": "Punktlandung/1.0 (https://punktlandung.app; aintartstudio@gmail.com)"
      }
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!contentType.startsWith("image/")) return null;

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) return null;

    // Buffering lets us detect a transfer that breaks halfway through and retry
    // a smaller candidate instead of forwarding a truncated image to browsers.
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;

    return { bytes, contentType, sourceUrl: response.url || targetUrl };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (process.env.PUNKTLANDUNG_STATIC_EXPORT === "true") {
    return new NextResponse("Image proxy disabled in static export", { status: 404 });
  }

  const source = request.nextUrl.searchParams.get("src");
  if (!source) return new NextResponse("Missing src", { status: 400 });

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return new NextResponse("Invalid src", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(sourceUrl.hostname)) {
    return new NextResponse("Image host is not allowed", { status: 403 });
  }

  const targetWidth = clampWidth(request.nextUrl.searchParams.get("w"));
  for (const candidate of uniqueCandidates(sourceUrl, targetWidth)) {
    const image = await fetchBufferedImage(candidate);
    if (!image) continue;

    return new NextResponse(image.bytes, {
      headers: {
        "content-type": image.contentType,
        "content-length": String(image.bytes.byteLength),
        "cache-control": "public, max-age=604800, stale-while-revalidate=2592000",
        "x-content-type-options": "nosniff",
        "x-punktlandung-image-source": image.sourceUrl === candidate ? "primary" : "redirect"
      }
    });
  }

  console.warn("[image-proxy] All Wikimedia candidates failed", {
    host: sourceUrl.hostname,
    file: extractWikimediaFileTitle(sourceUrl) ?? "unknown",
    width: targetWidth
  });
  return new NextResponse("Image unavailable", {
    status: 502,
    headers: { "cache-control": "no-store" }
  });
}
