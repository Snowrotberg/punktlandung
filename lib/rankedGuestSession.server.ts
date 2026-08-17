import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type RankedGuestSession = {
  guestIdHash: string;
  issuedAt: number;
  expiresAt: number;
};

export class RankedGuestSessionError extends Error {
  constructor(readonly code: "invalid" | "expired", message: string) {
    super(message);
    this.name = "RankedGuestSessionError";
  }
}

type GuestTokenPayload = {
  guestId: string;
  issuedAt: number;
  expiresAt: number;
};

function mac(secret: string, value: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function validateSecret(secret: string): void {
  if (secret.length < 32) throw new Error("Ranked guest session secrets must contain at least 32 characters.");
}

/**
 * Signed, short-lived guest authorization for ranked games. The raw guest ID
 * exists only inside the HttpOnly token; persistence receives a one-way HMAC.
 * Previous secrets allow a controlled key rotation without breaking active games.
 */
export class RankedGuestSessionCodec {
  constructor(
    private readonly secrets: readonly string[],
    private readonly ttlMs = 72 * 60 * 60 * 1000
  ) {
    if (secrets.length === 0) throw new Error("At least one ranked guest session secret is required.");
    secrets.forEach(validateSecret);
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 7 * 24 * 60 * 60 * 1000) {
      throw new Error("Ranked guest session TTL must be between one minute and seven days.");
    }
  }

  issue(now = Date.now()): { token: string; session: RankedGuestSession } {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Guest session time is invalid.");
    const payload: GuestTokenPayload = {
      guestId: randomBytes(24).toString("base64url"),
      issuedAt: now,
      expiresAt: now + this.ttlMs
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signed = `v1.${encoded}`;
    const signature = mac(this.secrets[0], signed).toString("base64url");
    return {
      token: `${signed}.${signature}`,
      session: this.toSession(payload, this.secrets[0])
    };
  }

  verify(token: string, now = Date.now()): RankedGuestSession {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") throw new RankedGuestSessionError("invalid", "Guest session is invalid.");

    let suppliedSignature: Buffer;
    try {
      suppliedSignature = Buffer.from(parts[2], "base64url");
    } catch {
      throw new RankedGuestSessionError("invalid", "Guest session is invalid.");
    }
    if (suppliedSignature.length !== 32 || suppliedSignature.toString("base64url") !== parts[2]) {
      throw new RankedGuestSessionError("invalid", "Guest session is invalid.");
    }
    const signed = `${parts[0]}.${parts[1]}`;
    const matchedSecret = this.secrets.find((secret) => safeEqual(mac(secret, signed), suppliedSignature));
    if (!matchedSecret) throw new RankedGuestSessionError("invalid", "Guest session is invalid.");

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      throw new RankedGuestSessionError("invalid", "Guest session is invalid.");
    }
    if (!this.isPayload(payload)) throw new RankedGuestSessionError("invalid", "Guest session is invalid.");
    if (!Number.isSafeInteger(now) || now < payload.issuedAt - 60_000 || now >= payload.expiresAt) {
      throw new RankedGuestSessionError("expired", "Guest session has expired.");
    }
    return this.toSession(payload, matchedSecret);
  }

  private isPayload(value: unknown): value is GuestTokenPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as Partial<GuestTokenPayload>;
    return typeof payload.guestId === "string" && /^[A-Za-z0-9_-]{32}$/.test(payload.guestId)
      && Number.isSafeInteger(payload.issuedAt) && Number.isSafeInteger(payload.expiresAt)
      && (payload.expiresAt as number) > (payload.issuedAt as number)
      && (payload.expiresAt as number) - (payload.issuedAt as number) <= 7 * 24 * 60 * 60 * 1000;
  }

  private toSession(payload: GuestTokenPayload, secret: string): RankedGuestSession {
    return {
      guestIdHash: createHmac("sha256", secret).update(`ranked-guest:${payload.guestId}`).digest("hex"),
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    };
  }
}
