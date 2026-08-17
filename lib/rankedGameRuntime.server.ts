import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { builtInLocations, locationVisualKey } from "@/data/locations";
import { readBackendFeatureConfig } from "@/lib/backendConfig.server";
import { RankedGameHttpApi, type RankedRequestAction, type RankedRequestGuard } from "@/lib/rankedGameHttp.server";
import { RankedGameService, type RankedLocationSource } from "@/lib/rankedGameService";
import { RankedGuestSessionCodec } from "@/lib/rankedGuestSession.server";
import { SafeRankedPromptAssetReader } from "@/lib/rankedPromptAssetReader.server";
import { SupabaseAccountSessionReader } from "@/lib/supabase/accountSessionReader.server";
import { SupabaseRankedGameRepository } from "@/lib/supabase/rankedGameRepository.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import type { GeoLocation } from "@/types/game";
import {
  applyLocationDifficultyOverrides,
  filterLocationsByDifficulty,
  type LocationDifficultyOverride
} from "@/lib/locationDifficulty";

type RateBucket = { count: number; resetAt: number };
const buckets = new Map<string, RateBucket>();
const limits: Record<RankedRequestAction, number> = { start: 8, read: 120, prompt: 80, ready: 40, reroll: 20, guess: 30, expire: 20, claim: 8 };

class MemoryRankedRequestGuard implements RankedRequestGuard {
  async check(input: { action: RankedRequestAction; request: Request; guestIdHash: string }) {
    const now = Date.now();
    const forwarded = input.request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim() || "local";
    const key = `${input.action}:${input.guestIdHash}:${forwarded}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return { allowed: true };
    }
    if (current.count >= limits[input.action]) {
      return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
    }
    current.count += 1;
    return { allowed: true };
  }
}

class CatalogRankedLocationSource implements RankedLocationSource {
  private async catalogWithMaintainedDifficulty(): Promise<GeoLocation[]> {
    try {
      const { data, error } = await createSupabaseAdminClient()
        .from("location_difficulty_metrics")
        .select("location_id, suggested_difficulty, confidence");

      if (error || !data) return builtInLocations;

      const overrides: LocationDifficultyOverride[] = data
        .filter((row) => ["easy", "medium", "hard"].includes(row.suggested_difficulty))
        .filter((row) => ["insufficient", "provisional", "stable"].includes(row.confidence))
        .map((row) => ({
          locationId: row.location_id,
          suggestedDifficulty: row.suggested_difficulty as LocationDifficultyOverride["suggestedDifficulty"],
          confidence: row.confidence as LocationDifficultyOverride["confidence"]
        }));

      return applyLocationDifficultyOverrides(builtInLocations, overrides);
    } catch {
      // The ranked flow remains usable while the optional maintenance table
      // is being deployed or has not collected enough data yet.
      return builtInLocations;
    }
  }

  async drawLocations(count: number, filters?: { category?: GeoLocation["category"]; difficulty?: "easy" | "medium" | "hard" }): Promise<GeoLocation[]> {
    const catalog = await this.catalogWithMaintainedDifficulty();
    const categoryPool = filters?.category && filters.category !== "mixed" ? catalog.filter((location) => location.category === filters.category) : catalog;
    const seenVisuals = new Set<string>();
    const uniquePool = categoryPool.filter((location) => {
      const key = locationVisualKey(location);
      if (seenVisuals.has(key)) return false;
      seenVisuals.add(key);
      return true;
    });
    const preferred = filters?.difficulty
      ? filterLocationsByDifficulty(uniquePool, filters.difficulty)
      : [...uniquePool];
    const preferredIds = new Set(preferred.map((location) => location.id));
    const fallback = preferred.length >= count
      ? []
      : uniquePool.filter((location) => !preferredIds.has(location.id));
    const selected: GeoLocation[] = [];
    for (const pool of [preferred, fallback]) {
      while (selected.length < count && pool.length > 0) {
        selected.push(pool.splice(randomInt(pool.length), 1)[0]);
      }
    }
    return selected;
  }
}

let service: RankedGameService | null = null;
const guard = new MemoryRankedRequestGuard();

function rankedService(): RankedGameService {
  if (service) return service;
  service = new RankedGameService(
    new SupabaseRankedGameRepository(),
    new CatalogRankedLocationSource(),
    {
      gameId: () => `ranked_${randomUUID().replaceAll("-", "")}`,
      roundId: (roundNumber) => `round_${roundNumber}_${randomUUID().replaceAll("-", "")}`
    }
  );
  return service;
}

export function rankedModeEnabled(): boolean {
  try {
    const config = readBackendFeatureConfig(process.env);
    return config.provider === "supabase" && config.accountsEnabled && config.rankedGamesEnabled;
  } catch {
    return false;
  }
}

export function createRankedGameHttpApi(request: Request): RankedGameHttpApi {
  const config = readBackendFeatureConfig(process.env);
  if (config.provider !== "supabase" || !config.accountsEnabled || !config.rankedGamesEnabled || !config.gameSessionSecret) {
    throw new Error("Ranked mode is not configured.");
  }
  const secrets = [config.gameSessionSecret, config.gameSessionPreviousSecret].filter((value): value is string => Boolean(value));
  const requestUrl = new URL(request.url);
  const isLocalDevelopment = process.env.NODE_ENV !== "production"
    || ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(requestUrl.hostname);
  const expectedOrigin = isLocalDevelopment ? requestUrl.origin : (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin);
  return new RankedGameHttpApi(
    rankedService(),
    new RankedGuestSessionCodec(secrets),
    new SupabaseAccountSessionReader(),
    guard,
    new SafeRankedPromptAssetReader(),
    {
      expectedOrigin,
      secureCookies: new URL(expectedOrigin).protocol === "https:",
      allowLocalDevelopmentOrigin: isLocalDevelopment
    }
  );
}

export function rankedUnavailableResponse(): Response {
  return Response.json({ error: { code: "ranked_mode_unavailable", message: "Der gewertete Modus ist noch nicht aktiviert." } }, { status: 503 });
}
