import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["commons.wikimedia.org", "upload.wikimedia.org"]);
const DEFAULT_IMAGE_WIDTH = 1800;
const MIN_IMAGE_WIDTH = 640;
const MAX_IMAGE_WIDTH = 2200;
const REQUEST_TIMEOUT_MS = 20000;

type WikimediaImageInfoResponse = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          thumburl?: string;
          url?: string;
        }>;
      }
    >;
  };
};

function clampWidth(rawWidth: string | null): number {
  const parsed = Number(rawWidth);
  if (!Number.isFinite(parsed)) return DEFAULT_IMAGE_WIDTH;
  return Math.max(MIN_IMAGE_WIDTH, Math.min(MAX_IMAGE_WIDTH, Math.round(parsed)));
}

function extractWikimediaFileTitle(url: URL): string | null {
  if (url.hostname === "commons.wikimedia.org") {
    const filePathPrefix = "/wiki/Special:FilePath/";
    const redirectPrefix = "/wiki/Special:Redirect/file/";

    if (url.pathname.startsWith(filePathPrefix)) {
      return decodeURIComponent(url.pathname.slice(filePathPrefix.length));
    }

    if (url.pathname.startsWith(redirectPrefix)) {
      return decodeURIComponent(url.pathname.slice(redirectPrefix.length));
    }
  }

  if (url.hostname === "upload.wikimedia.org") {
    const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
    return lastSegment ? decodeURIComponent(lastSegment) : null;
  }

  return null;
}

async function resolveThumbUrl(sourceUrl: URL, width: number): Promise<string> {
  const title = extractWikimediaFileTitle(sourceUrl);
  if (!title) return sourceUrl.toString();

  const apiUrl = new URL("https://commons.wikimedia.org/w/api.php");
  apiUrl.searchParams.set("action", "query");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("prop", "imageinfo");
  apiUrl.searchParams.set("iiprop", "url");
  apiUrl.searchParams.set("iiurlwidth", String(width));
  apiUrl.searchParams.set("titles", `File:${title}`);

  const metadataResponse = await fetch(apiUrl, {
    cache: "force-cache",
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!metadataResponse.ok) return sourceUrl.toString();

  const payload = (await metadataResponse.json()) as WikimediaImageInfoResponse;
  const pages = payload.query?.pages ? Object.values(payload.query.pages) : [];
  const imageInfo = pages[0]?.imageinfo?.[0];
  return imageInfo?.thumburl ?? imageInfo?.url ?? sourceUrl.toString();
}

export async function GET(request: NextRequest) {
  if (process.env.STATIC_EXPORT === "true") {
    return new NextResponse("Image proxy disabled in static export", { status: 404 });
  }

  const source = request.nextUrl.searchParams.get("src");
  if (!source) return new NextResponse("Missing src", { status: 400 });

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return new NextResponse("Invalid src", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse("Image host is not allowed", { status: 403 });
  }

  const targetWidth = clampWidth(request.nextUrl.searchParams.get("w"));
  const targetUrl = await resolveThumbUrl(url, targetWidth);

  const response = await fetch(targetUrl, {
    cache: "force-cache",
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      accept: "image/avif,image/webp,image/svg+xml,image/*,*/*",
      "user-agent": "Punktlandung local prototype (https://example.local)"
    }
  });

  if (!response.ok || !response.body) {
    return new NextResponse("Image unavailable", { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(response.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800"
    }
  });
}
