import { NextRequest, NextResponse } from "next/server";
import { recordUsageEvent } from "@/lib/usageMetrics.server";

export const runtime = "nodejs";

const allowedEvents = new Set(["game_start", "game_complete", "image_delivery", "page_view", "page_engagement", "visit_start"]);
const allowedGameTypes = new Set(["solo", "party", "online"]);
const allowedGameModes = new Set(["classic", "crew", "elimination", "duel"]);
const allowedCategories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);
const allowedImageOutcomes = new Set(["loaded", "fallback", "failed"]);
const allowedImageDeliveries = new Set(["direct", "proxy", "ranked"]);
const allowedConnectionTypes = new Set(["slow-2g", "2g", "3g", "4g", "unknown"]);
const allowedDeviceClasses = new Set(["phone", "tablet", "laptop", "desktop", "large-screen"]);
const allowedViewportBuckets = new Set(["unter 360", "360–479", "480–767", "768–1023", "1024–1439", "1440–1919", "1920+"]);

function validPageContext(input: Record<string, unknown>): boolean {
  return typeof input.path === "string" &&
    input.path.length >= 1 && input.path.length <= 100 && /^\/[a-z0-9/\-[\]]*$/.test(input.path) &&
    typeof input.visitId === "string" && /^[A-Za-z0-9-]{16,64}$/.test(input.visitId) &&
    typeof input.deviceClass === "string" && allowedDeviceClasses.has(input.deviceClass) &&
    typeof input.viewportBucket === "string" && allowedViewportBuckets.has(input.viewportBucket);
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const requestHost = request.headers.get("host") ?? request.nextUrl.host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 1_500) return NextResponse.json({ error: "Zu groß." }, { status: 413 });

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  if (typeof input.event !== "string" || !allowedEvents.has(input.event)) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  if (input.event === "page_view" || input.event === "visit_start") {
    if (!validPageContext(input)) return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
    await recordUsageEvent(input.event, {
      path: input.path as string,
      visitId: input.visitId as string,
      deviceClass: input.deviceClass as "phone" | "tablet" | "laptop" | "desktop" | "large-screen",
      viewportBucket: input.viewportBucket as string
    });
    return NextResponse.json({ ok: true });
  }

  if (input.event === "page_engagement") {
    if (!validPageContext(input) || typeof input.durationMs !== "number" || !Number.isInteger(input.durationMs) || input.durationMs < 1_000 || input.durationMs > 30 * 60_000) {
      return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
    }
    await recordUsageEvent("page_engagement", {
      path: input.path as string,
      visitId: input.visitId as string,
      deviceClass: input.deviceClass as "phone" | "tablet" | "laptop" | "desktop" | "large-screen",
      viewportBucket: input.viewportBucket as string,
      durationMs: input.durationMs
    });
    return NextResponse.json({ ok: true });
  }

  if (typeof input.category !== "string" || !allowedCategories.has(input.category)) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  if (input.event === "image_delivery") {
    if (
      typeof input.durationMs !== "number" ||
      !Number.isInteger(input.durationMs) ||
      input.durationMs < 0 ||
      input.durationMs > 120_000 ||
      typeof input.outcome !== "string" ||
      !allowedImageOutcomes.has(input.outcome) ||
      typeof input.delivery !== "string" ||
      !allowedImageDeliveries.has(input.delivery) ||
      typeof input.cacheHit !== "boolean" ||
      typeof input.connectionType !== "string" ||
      !allowedConnectionTypes.has(input.connectionType) ||
      typeof input.locationId !== "string" ||
      input.locationId.length < 1 ||
      input.locationId.length > 180 ||
      !/^[A-Za-z0-9._:-]+$/.test(input.locationId)
    ) {
      return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
    }
    await recordUsageEvent("image_delivery", {
      category: input.category,
      durationMs: input.durationMs,
      outcome: input.outcome as "loaded" | "fallback" | "failed",
      delivery: input.delivery as "direct" | "proxy" | "ranked",
      cacheHit: input.cacheHit,
      connectionType: input.connectionType as "slow-2g" | "2g" | "3g" | "4g" | "unknown",
      locationId: input.locationId
    });
    return NextResponse.json({ ok: true });
  }

  if (
    typeof input.gameType !== "string" ||
    !allowedGameTypes.has(input.gameType) ||
    typeof input.gameMode !== "string" ||
    !allowedGameModes.has(input.gameMode) ||
    typeof input.plannedRounds !== "number" ||
    !Number.isInteger(input.plannedRounds) ||
    input.plannedRounds < 1 ||
    input.plannedRounds > 100 ||
    typeof input.playerCount !== "number" ||
    !Number.isInteger(input.playerCount) ||
    input.playerCount < 0 ||
    input.playerCount > 10
  ) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  await recordUsageEvent(input.event as "game_start" | "game_complete", {
    gameType: input.gameType as "solo" | "party" | "online",
    gameMode: input.gameMode,
    category: input.category,
    plannedRounds: input.plannedRounds,
    playerCount: input.playerCount
  });
  return NextResponse.json({ ok: true });
}
