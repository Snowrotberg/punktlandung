import { NextRequest, NextResponse } from "next/server";
import { recordUsageEvent } from "@/lib/usageMetrics.server";

export const runtime = "nodejs";

const allowedEvents = new Set(["game_start", "game_complete"]);
const allowedGameTypes = new Set(["solo", "party", "online"]);
const allowedGameModes = new Set(["classic", "crew", "elimination", "duel"]);
const allowedCategories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);

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

  if (
    typeof input.event !== "string" ||
    !allowedEvents.has(input.event) ||
    typeof input.gameType !== "string" ||
    !allowedGameTypes.has(input.gameType) ||
    typeof input.gameMode !== "string" ||
    !allowedGameModes.has(input.gameMode) ||
    typeof input.category !== "string" ||
    !allowedCategories.has(input.category) ||
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
