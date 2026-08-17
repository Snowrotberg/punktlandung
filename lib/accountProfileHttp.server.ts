import { AccountSessionError, validateAccountSession, type AccountSessionReader } from "./accountSession.server";
import { ProfileValidationError, type ProfileVisibility } from "./accountProfile";
import { AccountProfileConflictError } from "./accountProfileRepository";
import type { AccountProfileService } from "./accountProfileService";

export type AccountProfileRequestAction = "public_read" | "own_read" | "create" | "update";

export interface AccountProfileRequestGuard {
  check(input: { action: AccountProfileRequestAction; request: Request; accountId?: string }): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

class ProfileHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly headers?: HeadersInit) {
    super(message);
    this.name = "ProfileHttpError";
  }
}

function json(status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function requestJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ProfileHttpError(415, "unsupported_media_type", "JSON is required.");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > 4_096) throw new ProfileHttpError(413, "payload_too_large", "Request body is too large.");
  const text = await request.text();
  if (text.length > 4_096) throw new ProfileHttpError(413, "payload_too_large", "Request body is too large.");
  try {
    const parsed: unknown = JSON.parse(text);
    if (!object(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new ProfileHttpError(400, "invalid_json", "Request body is invalid.");
  }
}

function exactKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new ProfileHttpError(400, "invalid_request", "Unknown profile field.");
  }
}

function textField(value: unknown, name: string): string {
  if (typeof value !== "string") throw new ProfileHttpError(400, "invalid_request", `${name} is required.`);
  return value;
}

function visibility(value: unknown): ProfileVisibility | undefined {
  if (value === undefined) return undefined;
  if (value !== "public" && value !== "private") throw new ProfileHttpError(400, "invalid_request", "visibility is invalid.");
  return value;
}

export class AccountProfileHttpApi {
  private readonly expectedOrigin: string;
  private readonly now: () => number;

  constructor(
    private readonly profiles: AccountProfileService,
    private readonly sessions: AccountSessionReader,
    private readonly guard: AccountProfileRequestGuard,
    options: { expectedOrigin: string; now?: () => number }
  ) {
    this.expectedOrigin = new URL(options.expectedOrigin).origin;
    this.now = options.now ?? Date.now;
  }

  publicProfile(request: Request, handle: string): Promise<Response> {
    return this.respond(async () => {
      if (request.method !== "GET") throw new ProfileHttpError(405, "method_not_allowed", "Only GET is allowed.", { allow: "GET" });
      await this.assertAllowed("public_read", request);
      const profile = await this.profiles.getPublic(handle);
      if (!profile) throw new ProfileHttpError(404, "profile_not_found", "Profile does not exist.");
      return json(200, { data: profile }, { "cache-control": "public, max-age=60, stale-while-revalidate=120" });
    });
  }

  me(request: Request): Promise<Response> {
    return this.respond(async () => {
      if (request.method !== "GET") throw new ProfileHttpError(405, "method_not_allowed", "Only GET is allowed.", { allow: "GET" });
      const accountId = await this.accountId(request);
      await this.assertAllowed("own_read", request, accountId);
      return json(200, { data: await this.profiles.get(accountId) });
    });
  }

  create(request: Request): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const accountId = await this.accountId(request);
      await this.assertAllowed("create", request, accountId);
      const body = await requestJson(request);
      exactKeys(body, ["handle", "displayName", "visibility"]);
      const profile = await this.profiles.create(accountId, {
        handle: textField(body.handle, "handle"),
        displayName: textField(body.displayName, "displayName"),
        visibility: visibility(body.visibility),
        now: this.now()
      });
      return json(201, { data: profile });
    });
  }

  update(request: Request): Promise<Response> {
    return this.respond(async () => {
      this.assertWriteOrigin(request);
      const accountId = await this.accountId(request);
      await this.assertAllowed("update", request, accountId);
      const body = await requestJson(request);
      exactKeys(body, ["handle", "displayName", "visibility"]);
      if (Object.keys(body).length === 0) throw new ProfileHttpError(400, "invalid_request", "At least one profile field is required.");
      const profile = await this.profiles.update(accountId, {
        handle: body.handle === undefined ? undefined : textField(body.handle, "handle"),
        displayName: body.displayName === undefined ? undefined : textField(body.displayName, "displayName"),
        visibility: visibility(body.visibility),
        now: this.now()
      });
      return json(200, { data: profile });
    });
  }

  private async respond(action: () => Promise<Response>): Promise<Response> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ProfileHttpError) return json(error.status, { error: { code: error.code, message: error.message } }, error.headers);
      if (error instanceof AccountSessionError) return json(401, { error: { code: "account_session_invalid", message: "Sign in again." } });
      if (error instanceof ProfileValidationError) return json(400, { error: { code: error.code, message: error.message } });
      if (error instanceof AccountProfileConflictError) {
        const status = error.code === "profile_missing" ? 404 : 409;
        return json(status, { error: { code: error.code, message: error.message } });
      }
      return json(500, { error: { code: "internal_error", message: "The profile request could not be completed." } });
    }
  }

  private async accountId(request: Request): Promise<string> {
    const raw = await this.sessions.read(request);
    if (!raw) throw new ProfileHttpError(401, "authentication_required", "Sign in to manage your profile.");
    return validateAccountSession(raw, this.now()).accountId;
  }

  private assertWriteOrigin(request: Request): void {
    const site = request.headers.get("sec-fetch-site");
    if (request.headers.get("origin") !== this.expectedOrigin || (site && site !== "same-origin" && site !== "same-site")) {
      throw new ProfileHttpError(403, "origin_forbidden", "Request origin is not allowed.");
    }
  }

  private async assertAllowed(action: AccountProfileRequestAction, request: Request, accountId?: string): Promise<void> {
    const result = await this.guard.check({ action, request, accountId });
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.min(3_600, Math.floor(result.retryAfterSeconds ?? 60)));
      throw new ProfileHttpError(429, "rate_limited", "Too many requests.", { "retry-after": String(retryAfter) });
    }
  }
}
