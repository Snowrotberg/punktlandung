import { createHash, randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import type { FeedbackPayload } from "@/types/feedback";

export const runtime = "nodejs";

const targetEmail = "aintartstudio@gmail.com";
const maxBodyBytes = 12_000;
const minCompletionMs = 3_000;
const maxCompletionMs = 2 * 60 * 60 * 1000;
const rateLimitWindowMs = 60 * 60 * 1000;
const rateLimitMax = 3;
const rateLimitSalt = randomBytes(24).toString("hex");
const rateLimits = new Map<string, number[]>();
const rateLimitExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

const allowedSources = new Set(["post-game", "feedback-page"]);
const allowedModes = new Set(["solo", "party", "online"]);
const allowedCategories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);

function clientFingerprint(request: NextRequest): string {
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${rateLimitSalt}:${ip}`).digest("hex");
}

function isRateLimited(request: NextRequest): boolean {
  const now = Date.now();
  const key = clientFingerprint(request);
  const recent = (rateLimits.get(key) ?? []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  const previousTimer = rateLimitExpiryTimers.get(key);
  if (previousTimer) clearTimeout(previousTimer);
  const expiryTimer = setTimeout(() => {
    rateLimits.delete(key);
    rateLimitExpiryTimers.delete(key);
  }, rateLimitWindowMs);
  expiryTimer.unref?.();
  rateLimitExpiryTimers.set(key, expiryTimer);
  if (recent.length >= rateLimitMax) {
    rateLimits.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimits.set(key, recent);
  if (rateLimits.size > 2_000) {
    for (const [storedKey, timestamps] of rateLimits) {
      if (!timestamps.some((timestamp) => now - timestamp < rateLimitWindowMs)) rateLimits.delete(storedKey);
    }
  }
  return false;
}

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanLine(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/[\r\n]+/g, " ").slice(0, maxLength) : "";
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Ungültiges Datenformat." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBodyBytes) {
    return NextResponse.json({ error: "Die Nachricht ist zu groß." }, { status: 413 });
  }
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Bitte warte etwas, bevor du weiteres Feedback sendest." }, { status: 429 });
  }

  let payload: Partial<FeedbackPayload>;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
      return NextResponse.json({ error: "Die Nachricht ist zu groß." }, { status: 413 });
    }
    payload = JSON.parse(rawBody) as Partial<FeedbackPayload>;
  } catch {
    return NextResponse.json({ error: "Das Feedback konnte nicht gelesen werden." }, { status: 400 });
  }

  if (cleanLine(payload.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const email = cleanLine(payload.email, 254);
  const elapsed = Date.now() - Number(payload.openedAt || 0);
  if (message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: "Bitte schreibe zwischen 10 und 4000 Zeichen." }, { status: 400 });
  }
  if (email && !isEmail(email)) {
    return NextResponse.json({ error: "Bitte prüfe die angegebene E-Mail-Adresse." }, { status: 400 });
  }
  if (!Number.isFinite(elapsed) || elapsed < minCompletionMs || elapsed > maxCompletionMs) {
    return NextResponse.json({ error: "Bitte öffne das Formular erneut und versuche es noch einmal." }, { status: 400 });
  }

  const source = allowedSources.has(String(payload.source)) ? String(payload.source) : "feedback-page";
  const mode = allowedModes.has(String(payload.mode)) ? String(payload.mode) : "-";
  const category = allowedCategories.has(String(payload.category)) ? String(payload.category) : "-";
  const rounds = Number.isInteger(payload.rounds) && Number(payload.rounds) > 0 && Number(payload.rounds) <= 100 ? Number(payload.rounds) : null;

  const gmailUser = process.env.FEEDBACK_GMAIL_USER?.trim();
  const gmailAppPassword = process.env.FEEDBACK_GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const recipient = process.env.FEEDBACK_TO_EMAIL?.trim() || targetEmail;
  if (!gmailUser || !gmailAppPassword) {
    console.error("Feedback mail transport is not configured.");
    return NextResponse.json({ error: "Der Feedback-Versand ist noch nicht freigeschaltet. Bitte versuche es später erneut." }, { status: 503 });
  }

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword }
  });
  const subject = source === "post-game" ? `[Punktlandung Beta] Feedback nach ${mode}-Partie` : "[Punktlandung Beta] Allgemeines Feedback";
  const contextLines = [`Quelle: ${source}`, `Spielmodus: ${mode}`, `Kategorie: ${category}`, `Runden: ${rounds ?? "-"}`, `Rückfrage-E-Mail: ${email || "nicht angegeben"}`];

  try {
    await transport.sendMail({
      from: `Punktlandung Beta <${gmailUser}>`,
      to: recipient,
      replyTo: email || undefined,
      subject,
      text: `${contextLines.join("\n")}\n\nFeedback:\n${message}`,
      html: `<p>${contextLines.map((line) => htmlEscape(line)).join("<br>")}</p><h2>Feedback</h2><p style="white-space:pre-wrap">${htmlEscape(message)}</p>`
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feedback mail delivery failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Das Feedback konnte gerade nicht gesendet werden. Bitte versuche es später erneut." }, { status: 502 });
  }
}
