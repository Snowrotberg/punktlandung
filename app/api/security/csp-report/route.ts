import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limits = new Map<string, { count: number; resetAt: number }>();

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, 512);
  } catch {
    return value === "inline" || value === "eval" ? value : undefined;
  }
}

function safeText(value: unknown, max = 160): string | undefined {
  return typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").slice(0, max) : undefined;
}

export async function POST(request: NextRequest) {
  const client = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
  const now = Date.now();
  const current = limits.get(client);
  if (current && current.resetAt > now && current.count >= 30) return new Response(null, { status: 429 });
  limits.set(client, current && current.resetAt > now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: now + 60_000 });

  const raw = await request.text();
  if (raw.length > 16_384) return new Response(null, { status: 413 });
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const source = (parsed["csp-report"] ?? parsed.body ?? parsed) as Record<string, unknown>;
    console.warn("[security:csp]", JSON.stringify({
      document: safeUrl(source["document-uri"] ?? source.documentURL),
      blocked: safeUrl(source["blocked-uri"] ?? source.blockedURL),
      directive: safeText(source["effective-directive"] ?? source.effectiveDirective),
      disposition: safeText(source.disposition),
      status: typeof source["status-code"] === "number" ? source["status-code"] : undefined
    }));
  } catch {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
