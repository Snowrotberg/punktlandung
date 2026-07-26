import nodemailer from "nodemailer";
import { readUsageEvents, type UsageEvent } from "../lib/usageMetrics.server";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Production can provide the same values directly through the process environment.
}

type Summary = {
  starts: number;
  completions: number;
  byGameType: Record<string, number>;
  byCategory: Record<string, number>;
  connections: number;
  rejectedConnections: number;
  roomsCreated: number;
  roomJoins: number;
  peakConnections: number;
  peakRooms: number;
};

const number = new Intl.NumberFormat("de-DE");

function summarize(events: UsageEvent[]): Summary {
  const summary: Summary = {
    starts: 0,
    completions: 0,
    byGameType: {},
    byCategory: {},
    connections: 0,
    rejectedConnections: 0,
    roomsCreated: 0,
    roomJoins: 0,
    peakConnections: 0,
    peakRooms: 0
  };

  for (const event of events) {
    if (event.event === "game_start") summary.starts += 1;
    if (event.event === "game_complete") {
      summary.completions += 1;
      if (event.gameType) summary.byGameType[event.gameType] = (summary.byGameType[event.gameType] ?? 0) + 1;
      if (event.category) summary.byCategory[event.category] = (summary.byCategory[event.category] ?? 0) + 1;
    }
    if (event.event === "ws_connection_accepted") summary.connections += 1;
    if (event.event === "ws_connection_rejected") summary.rejectedConnections += 1;
    if (event.event === "room_created") summary.roomsCreated += 1;
    if (event.event === "room_joined") summary.roomJoins += 1;
    if (event.event === "capacity_sample") {
      summary.peakConnections = Math.max(summary.peakConnections, event.connections ?? 0);
      summary.peakRooms = Math.max(summary.peakRooms, event.rooms ?? 0);
    }
  }
  return summary;
}

function list(values: Record<string, number>): string {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([key, value]) => `${key}: ${number.format(value)}`).join(", ") : "keine";
}

function reportText(summary: Summary, from: Date, until: Date): string {
  const completionRate = summary.starts > 0 ? Math.round((summary.completions / summary.starts) * 100) : 0;
  return [
    "Punktlandung – wöchentlicher Betriebsbericht",
    `${from.toLocaleDateString("de-DE")} bis ${until.toLocaleDateString("de-DE")}`,
    "",
    `Gestartete Partien: ${number.format(summary.starts)}`,
    `Vollständig beendete Partien: ${number.format(summary.completions)}`,
    `Abschlussquote: ${number.format(completionRate)} %`,
    `Beendete Partien nach Typ: ${list(summary.byGameType)}`,
    `Beendete Partien nach Kategorie: ${list(summary.byCategory)}`,
    "",
    `WebSocket-Verbindungen: ${number.format(summary.connections)}`,
    `Abgewiesene Verbindungen: ${number.format(summary.rejectedConnections)}`,
    `Erstellte Online-Räume: ${number.format(summary.roomsCreated)}`,
    `Raumbeitritte: ${number.format(summary.roomJoins)}`,
    `Spitzenwert gleichzeitiger Verbindungen: ${number.format(summary.peakConnections)}`,
    `Spitzenwert gleichzeitiger Räume: ${number.format(summary.peakRooms)}`,
    "",
    "Hinweis: Verbindungen sind keine eindeutigen Personen. Der Bericht enthält nur anonyme Ereigniszähler und keine Namen, Raumcodes, IP-Adressen oder Spielkoordinaten."
  ].join("\n");
}

async function main() {
  const until = new Date();
  const from = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
  const events = await readUsageEvents(from);
  const summary = summarize(events);
  const text = reportText(summary, from, until);
  if (process.env.USAGE_REPORT_DRY_RUN === "true") {
    console.log(text);
    return;
  }
  const gmailUser = process.env.FEEDBACK_GMAIL_USER?.trim();
  const gmailAppPassword = process.env.FEEDBACK_GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const recipient = process.env.USAGE_REPORT_TO_EMAIL?.trim() || process.env.FEEDBACK_TO_EMAIL?.trim();
  if (!gmailUser || !gmailAppPassword || !recipient) {
    throw new Error("FEEDBACK_GMAIL_USER, FEEDBACK_GMAIL_APP_PASSWORD und USAGE_REPORT_TO_EMAIL müssen gesetzt sein.");
  }

  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailAppPassword } });
  await transport.sendMail({
    from: `Punktlandung Betrieb <${gmailUser}>`,
    to: recipient,
    subject: `[Punktlandung] Wochenbericht ${until.toLocaleDateString("de-DE")}`,
    text
  });
  console.log(`Weekly usage report sent to ${recipient}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
