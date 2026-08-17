import { RankedGameError, rankedRulesetId } from "./rankedGame";
import { RankedGuestSessionCodec, RankedGuestSessionError, type RankedGuestSession } from "./rankedGuestSession.server";
import type { RankedGameService } from "./rankedGameService";
import { AccountSessionError, validateAccountSession, type AccountSessionReader } from "./accountSession.server";

export const rankedGuestCookieName = "pl_ranked_guest";

export type RankedRequestAction = "start" | "read" | "prompt" | "ready" | "reroll" | "guess" | "expire" | "claim";

export interface RankedRequestGuard {
  check(input: {
    action: RankedRequestAction;
    request: Request;
    guestIdHash: string;
  }): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

export type RankedPromptAsset = {
  bytes: ArrayBuffer;
  contentType: string;
};

export interface RankedPromptAssetReader {
  read(sourceUrl: string): Promise<RankedPromptAsset | null>;
}

export type RankedGameHttpOptions = {
  expectedOrigin: string;
  secureCookies?: boolean;
  allowLocalDevelopmentOrigin?: boolean;
  now?: () => number;
};

class RankedHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers?: HeadersInit
  ) {
    super(message);
    this.name = "RankedHttpError";
  }
}

function json(status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const entry of raw.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return null;
}

function ownObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

async function requestJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new RankedHttpError(415, "unsupported_media_type", "JSON is required.");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 8_192) throw new RankedHttpError(413, "payload_too_large", "Request body is too large.");
  const text = await request.text();
  if (text.length > 8_192) throw new RankedHttpError(413, "payload_too_large", "Request body is too large.");
  try {
    const parsed: unknown = JSON.parse(text);
    if (!ownObject(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new RankedHttpError(400, "invalid_json", "Request body is invalid.");
  }
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new RankedHttpError(400, "invalid_request", `${label} is invalid.`);
  }
  return value;
}

function domainError(error: RankedGameError): RankedHttpError {
  switch (error.code) {
    case "invalid_game": return new RankedHttpError(404, error.code, "Ranked game does not exist.");
    case "invalid_guess": return new RankedHttpError(400, error.code, error.message);
    case "game_completed":
    case "round_not_open":
    case "round_mismatch":
    case "round_expired":
    case "guess_conflict":
    case "game_not_completed":
    case "claim_conflict":
      return new RankedHttpError(409, error.code, error.message);
  }
}

/** Provider-neutral HTTP boundary. Future Next.js routes only delegate here. */
export class RankedGameHttpApi {
  private readonly expectedOrigin: string;
  private readonly secureCookies: boolean;
  private readonly allowLocalDevelopmentOrigin: boolean;
  private readonly now: () => number;

  constructor(
    private readonly service: RankedGameService,
    private readonly guestSessions: RankedGuestSessionCodec,
    private readonly accountSessions: AccountSessionReader,
    private readonly requestGuard: RankedRequestGuard,
    private readonly promptAssets: RankedPromptAssetReader,
    options: RankedGameHttpOptions
  ) {
    this.expectedOrigin = new URL(options.expectedOrigin).origin;
    this.secureCookies = options.secureCookies ?? true;
    this.allowLocalDevelopmentOrigin = options.allowLocalDevelopmentOrigin ?? false;
    this.now = options.now ?? Date.now;
  }

  start(request: Request): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const body = await requestJson(request);
      if (!onlyKeys(body, ["requestId", "rulesetId", "rounds", "timeLimitSec", "category", "difficulty", "noZoom"])) throw new RankedHttpError(400, "invalid_request", "Unknown request field.");
      const requestId = identifier(body.requestId, "requestId");
      if (body.rulesetId !== undefined && body.rulesetId !== rankedRulesetId) {
        throw new RankedHttpError(400, "invalid_request", "Unsupported ruleset.");
      }

      const existingToken = cookieValue(request, rankedGuestCookieName);
      const issued = existingToken ? null : this.guestSessions.issue(this.now());
      const session = issued?.session ?? this.verifyGuest(existingToken as string);
      await this.assertAllowed("start", request, session);
      const rounds = body.rounds === undefined ? undefined : Number(body.rounds);
      const timeLimitSec = body.timeLimitSec === undefined ? undefined : Number(body.timeLimitSec);
      const validCategories = ["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"];
      if (rounds !== undefined && (!Number.isInteger(rounds) || rounds < 1 || rounds > 25)) throw new RankedHttpError(400, "invalid_request", "rounds is invalid.");
      if (timeLimitSec !== undefined && (!Number.isInteger(timeLimitSec) || ![0, 15, 30, 60].includes(timeLimitSec))) throw new RankedHttpError(400, "invalid_request", "timeLimitSec is invalid.");
      if (body.category !== undefined && (typeof body.category !== "string" || !validCategories.includes(body.category))) throw new RankedHttpError(400, "invalid_request", "category is invalid.");
      if (body.difficulty !== undefined && (body.difficulty !== "easy" && body.difficulty !== "medium" && body.difficulty !== "hard")) throw new RankedHttpError(400, "invalid_request", "difficulty is invalid.");
      if (body.noZoom !== undefined && typeof body.noZoom !== "boolean") throw new RankedHttpError(400, "invalid_request", "noZoom is invalid.");
      const game = await this.service.start({ createRequestId: requestId, guestIdHash: session.guestIdHash, now: this.now(), rounds: rounds as number | undefined, timeLimitSec: timeLimitSec as 0 | 15 | 30 | 60 | undefined, category: body.category as any, difficulty: body.difficulty as any, noZoom: body.noZoom as boolean | undefined, deferRoundStart: request.headers.get("x-ranked-defer-start") === "true" });
      const headers = issued ? { "set-cookie": this.serializeGuestCookie(issued.token, issued.session) } : undefined;
      return json(201, { data: game }, headers);
    });
  }

  ready(request: Request, gameId: string, roundId: string): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const session = this.requireGuest(request);
      await this.assertAllowed("ready", request, session);
      const account = await this.optionalAccount(request);
      const game = await this.service.ready(identifier(gameId, "gameId"), session.guestIdHash, identifier(roundId, "roundId"), this.now(), account?.accountId);
      return json(200, { data: game });
    });
  }

  reroll(request: Request, gameId: string, roundId: string): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const session = this.requireGuest(request);
      await this.assertAllowed("reroll", request, session);
      const account = await this.optionalAccount(request);
      const game = await this.service.reroll(identifier(gameId, "gameId"), session.guestIdHash, identifier(roundId, "roundId"), account?.accountId);
      return json(200, { data: game });
    });
  }

  get(request: Request, gameId: string): Promise<Response> {
    return this.respond(async () => {
      const session = this.requireGuest(request);
      await this.assertAllowed("read", request, session);
      const account = await this.optionalAccount(request);
      const game = await this.service.get(identifier(gameId, "gameId"), session.guestIdHash, account?.accountId);
      return json(200, { data: game });
    });
  }

  recoverLatest(request: Request): Promise<Response> {
    return this.respond(async () => {
      const session = this.requireGuest(request);
      await this.assertAllowed("read", request, session);
      const requestUrl = new URL(request.url);
      const resumeGameId = requestUrl.searchParams.get("resume");
      let game;
      if (resumeGameId) {
        // The runtime only enables this flag for a local development request.
        // Checking the parsed hostname a second time made valid local recovery
        // fail behind IPv6/forwarded development hosts and returned a misleading
        // 404 even though the game was still present.
        if (!this.allowLocalDevelopmentOrigin) {
          throw new RankedHttpError(404, "active_game_not_found", "No active ranked game is available.");
        }
        game = await this.service.resumeLocalGame(identifier(resumeGameId, "resume"), session.guestIdHash, this.now());
      } else {
        game = await this.service.recoverLatest(session.guestIdHash);
      }
      if (!game) throw new RankedHttpError(404, "active_game_not_found", "No active ranked game is available.");
      return json(200, { data: game });
    });
  }

  prompt(request: Request, gameId: string, roundId: string): Promise<Response> {
    return this.respond(async () => {
      const session = this.requireGuest(request);
      await this.assertAllowed("prompt", request, session);
      const account = await this.optionalAccount(request);
      const source = await this.service.promptSource(
        identifier(gameId, "gameId"),
        session.guestIdHash,
        identifier(roundId, "roundId"),
        account?.accountId
      );
      const sourceUrls = [source.sourceUrl, ...(source.fallbackUrls ?? [])];
      const firstCandidates = sourceUrls.slice(0, 2);
      let asset = await new Promise<RankedPromptAsset | null>((resolve) => {
        let pending = firstCandidates.length;
        let settled = false;
        for (const sourceUrl of firstCandidates) {
          void this.promptAssets.read(sourceUrl).then((candidate) => {
            if (settled) return;
            if (candidate) {
              settled = true;
              resolve(candidate);
              return;
            }
            pending -= 1;
            if (pending === 0) resolve(null);
          });
        }
      });
      for (const sourceUrl of sourceUrls.slice(2)) {
        if (asset) break;
        asset = await this.promptAssets.read(sourceUrl);
      }
      if (!asset) throw new RankedHttpError(502, "prompt_unavailable", "Round image is temporarily unavailable.");
      const contentType = asset.contentType.split(";", 1)[0].trim().toLowerCase();
      if (!contentType.startsWith("image/") || asset.bytes.byteLength === 0 || asset.bytes.byteLength > 18 * 1024 * 1024) {
        throw new RankedHttpError(502, "prompt_unavailable", "Round image is temporarily unavailable.");
      }
      return new Response(asset.bytes, {
        status: 200,
        headers: {
          "content-type": contentType,
          "content-length": String(asset.bytes.byteLength),
          "cache-control": "private, max-age=3600, immutable",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox"
        }
      });
    });
  }

  submitGuess(request: Request, gameId: string): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const session = this.requireGuest(request);
      await this.assertAllowed("guess", request, session);
      const account = await this.optionalAccount(request);
      const body = await requestJson(request);
      if (!onlyKeys(body, ["roundId", "guessId", "lat", "lng", "countryCode"])) {
        throw new RankedHttpError(400, "invalid_request", "Unknown request field.");
      }
      const lat = body.lat;
      const lng = body.lng;
      if (typeof lat !== "number" || typeof lng !== "number") throw new RankedHttpError(400, "invalid_request", "Coordinates are invalid.");
      let countryCode: string | undefined;
      if (body.countryCode !== undefined) {
        if (typeof body.countryCode !== "string" || !/^[A-Za-z]{2}$/.test(body.countryCode)) {
          throw new RankedHttpError(400, "invalid_request", "countryCode is invalid.");
        }
        countryCode = body.countryCode.toUpperCase();
      }
      const game = await this.service.submit(identifier(gameId, "gameId"), session.guestIdHash, {
        roundId: identifier(body.roundId, "roundId"),
        guessId: identifier(body.guessId, "guessId"),
        point: { lat, lng },
        countryCode,
        now: this.now()
      }, account?.accountId);
      return json(200, { data: game });
    });
  }

  expireRound(request: Request, gameId: string): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const session = this.requireGuest(request);
      await this.assertAllowed("expire", request, session);
      const account = await this.optionalAccount(request);
      const game = await this.service.expire(identifier(gameId, "gameId"), session.guestIdHash, this.now(), account?.accountId);
      return json(200, { data: game });
    });
  }

  claim(request: Request, gameId: string): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const guest = this.requireGuest(request);
      await this.assertAllowed("claim", request, guest);
      const rawSession = await this.accountSessions.read(request);
      if (!rawSession) throw new RankedHttpError(401, "authentication_required", "Sign in to save this game.");
      const account = validateAccountSession(rawSession, this.now());
      const game = await this.service.claim(identifier(gameId, "gameId"), guest.guestIdHash, account.accountId);
      return json(200, { data: game });
    });
  }

  private async respond(action: () => Promise<Response>): Promise<Response> {
    try {
      return await action();
    } catch (error) {
      const mapped = error instanceof RankedGameError ? domainError(error) : error;
      if (mapped instanceof RankedGuestSessionError) {
        return json(401, { error: { code: "guest_session_invalid", message: "This saved guest session is no longer available." } });
      }
      if (mapped instanceof AccountSessionError) {
        return json(401, { error: { code: "account_session_invalid", message: "Sign in again to save this game." } });
      }
      if (mapped instanceof RankedHttpError) {
        return json(mapped.status, { error: { code: mapped.code, message: mapped.message } }, mapped.headers);
      }
      return json(500, { error: { code: "internal_error", message: "The request could not be completed." } });
    }
  }

  private assertWriteOrigin(request: Request): void {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    const requestOrigin = new URL(request.url).origin;
    const originAllowed = origin === this.expectedOrigin || (this.allowLocalDevelopmentOrigin && (!origin || this.isAllowedLocalOrigin(origin, request)));
    const fetchSiteAllowed = this.allowLocalDevelopmentOrigin || !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
    if (!originAllowed || !fetchSiteAllowed) {
      throw new RankedHttpError(403, "origin_forbidden", "Request origin is not allowed.");
    }
  }

  private isAllowedLocalOrigin(origin: string, request: Request): boolean {
    try {
      const candidate = new URL(origin);
      const requestUrl = new URL(request.url);
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0].trim();
      const requestHost = forwardedHost || request.headers.get("host") || requestUrl.host;
      return candidate.host === requestHost;
    } catch {
      return false;
    }
  }

  private requireGuest(request: Request): RankedGuestSession {
    const token = cookieValue(request, rankedGuestCookieName);
    if (!token) throw new RankedHttpError(401, "guest_session_required", "Guest session is required.");
    return this.verifyGuest(token);
  }

  private verifyGuest(token: string): RankedGuestSession {
    return this.guestSessions.verify(token, this.now());
  }

  private async optionalAccount(request: Request) {
    const rawSession = await this.accountSessions.read(request);
    return rawSession ? validateAccountSession(rawSession, this.now()) : null;
  }

  private async assertAllowed(action: RankedRequestAction, request: Request, session: RankedGuestSession): Promise<void> {
    const result = await this.requestGuard.check({ action, request, guestIdHash: session.guestIdHash });
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.min(3_600, Math.floor(result.retryAfterSeconds ?? 60)));
      throw new RankedHttpError(
        429,
        "rate_limited",
        `Too many requests. Retry after ${retryAfter} seconds.`,
        { "retry-after": String(retryAfter) }
      );
    }
  }

  private serializeGuestCookie(token: string, session: RankedGuestSession): string {
    const maxAge = Math.max(0, Math.floor((session.expiresAt - this.now()) / 1000));
    return `${rankedGuestCookieName}=${token}; Path=/api/v1/ranked-games; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${this.secureCookies ? "; Secure" : ""}`;
  }
}
