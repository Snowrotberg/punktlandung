import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function internalRoomServerUrl(): string {
  const configured = process.env.WS_INTERNAL_HTTP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const port = Number(process.env.WS_PORT ?? 3001);
  return `http://127.0.0.1:${Number.isFinite(port) ? port : 3001}`;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return new NextResponse("Not found", { status: 404 });

  try {
    const response = await fetch(`${internalRoomServerUrl()}/prompt/${token}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
      headers: { accept: "image/avif,image/webp,image/*,*/*" }
    });
    if (!response.ok || !response.body) return new NextResponse("Image unavailable", { status: response.status === 404 ? 404 : 502 });
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      return new NextResponse("Image unavailable", { status: 502 });
    }
    const headers = new Headers({
      "content-type": contentType,
      "cache-control": "private, max-age=600",
      "x-content-type-options": "nosniff"
    });
    const contentLength = response.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    return new NextResponse(response.body, { headers });
  } catch {
    return new NextResponse("Image unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
}
