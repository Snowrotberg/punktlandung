import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAccountDataExport, deletionReauthenticationMaxAgeMs } from "@/lib/accountDataLifecycle";
import { getSupabaseAccountContext, type SupabaseAccountContext } from "@/lib/supabase/auth.server";
import { SupabaseAccountIdentityRepository } from "@/lib/supabase/accountIdentityRepository.server";
import { SupabaseAccountProfileRepository } from "@/lib/supabase/accountProfileRepository.server";
import { SupabaseRankedGameRepository } from "@/lib/supabase/rankedGameRepository.server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function settingsRedirect(request: Request, message: string) {
  const target = new URL("/konto/einstellungen", request.url);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target, 303);
}

function csvCell(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function createGamesCsv(exported: ReturnType<typeof createAccountDataExport>) {
  const headings = ["Partie-ID", "Abgeschlossen am", "Punkte", "Runden", "Status", "Zeitlimit (s)", "Schwierigkeit", "Kein Bildzoom", "Kategorien"];
  const rows = exported.rankedGames.map((game) => [
    game.gameId,
    game.completedAt ? new Date(game.completedAt).toLocaleString("de-DE") : "",
    game.score,
    game.resolvedRounds.length,
    game.integrityStatus === "verified" ? "Gewertet" : game.integrityStatus === "flagged" ? "In Prüfung" : "Nicht gewertet",
    game.timeLimitSec === 0 ? "Frei" : game.timeLimitSec ?? "",
    game.difficulty === "easy" ? "Leicht" : game.difficulty === "hard" ? "Schwer" : "Mittel",
    Boolean(game.noZoom) ? "Ja" : "Nein",
    Array.from(new Set(game.resolvedRounds.map((round) => round.location.category))).join(", ")
  ]);
  return `\uFEFF${[headings, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

async function exportResponse(context: SupabaseAccountContext, user: User, format: "csv" | "json") {
  const accountId = context.identity.account.accountId;
  const [profile, loginIdentities, rankedGames] = await Promise.all([
    new SupabaseAccountProfileRepository().findByAccountId(accountId),
    new SupabaseAccountIdentityRepository().listIdentities(accountId),
    new SupabaseRankedGameRepository().listByAccountId(accountId)
  ]);
  if (!profile) {
    return Response.json({ error: "profile_missing" }, {
      status: 409,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");
  const exported = createAccountDataExport({
    accountId,
    profile,
    loginIdentities,
    rankedGames,
    authentication: {
      currentEmail: user.email ?? null,
      pendingEmail: user.new_email ?? null,
      providers: Array.from(new Set(user.identities?.map((identity) => identity.provider) ?? [])),
      lastSignInAt: Number.isFinite(lastSignInAt) ? lastSignInAt : null
    },
    now: Date.now()
  });
  const date = new Date(exported.generatedAt).toISOString().slice(0, 10);

  if (format === "csv") {
    return new Response(createGamesCsv(exported), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="punktlandung-spiele-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  return new Response(`${JSON.stringify(exported, null, 2)}\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="punktlandung-datenexport-${date}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET() {
  return Response.json({ error: "confirmation_required" }, {
    status: 405,
    headers: {
      "Allow": "POST",
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  // Reject an explicit cross-origin form. Some privacy-focused browsers omit
  // Origin on same-site POSTs; Supabase's SameSite auth cookie still prevents
  // a cross-site request from carrying the authenticated session.
  if (origin && origin !== requestOrigin) {
    return Response.json({ error: "invalid_origin" }, {
      status: 403,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const context = await getSupabaseAccountContext();
  if (!context) return settingsRedirect(request, "Bitte melde dich erneut an, bevor du deine Daten exportierst.");

  const formData = await request.formData();
  const format = formData.get("format") === "csv" ? "csv" : "json";
  const confirmation = formData.get("confirmation");
  if (confirmation !== "EXPORTIEREN") {
    return settingsRedirect(request, "Bitte gib zur Bestätigung exakt EXPORTIEREN ein.");
  }

  let exportUser = context.user;
  if (context.provider === "email") {
    const password = formData.get("currentPassword");
    if (typeof password !== "string" || password.length < 8 || password.length > 128 || !context.user.email) {
      return settingsRedirect(request, "Bitte bestätige den Datenexport mit deinem aktuellen Passwort.");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: context.user.email,
      password
    });
    if (error || !data.user || data.user.id !== context.user.id) {
      return settingsRedirect(request, "Das aktuelle Passwort ist nicht korrekt.");
    }
    exportUser = data.user;
  } else {
    const lastSignInAt = Date.parse(context.user.last_sign_in_at ?? "");
    if (!Number.isFinite(lastSignInAt) || Date.now() - lastSignInAt > deletionReauthenticationMaxAgeMs) {
      return settingsRedirect(request, "Bitte melde dich erneut mit Google an und starte den Datenexport innerhalb von zehn Minuten.");
    }
  }

  return exportResponse(context, exportUser, format);
}
