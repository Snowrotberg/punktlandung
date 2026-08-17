import type { LoginProvider } from "./accountProfile";

export type VerifiedAccountSession = {
  accountId: string;
  sessionId: string;
  provider: LoginProvider;
  authenticatedAt: number;
  expiresAt: number;
};

export class AccountSessionError extends Error {
  constructor(readonly code: "invalid" | "expired", message: string) {
    super(message);
    this.name = "AccountSessionError";
  }
}

/** Provider adapter output; raw Firebase/Supabase tokens never enter domain services. */
export interface AccountSessionReader {
  read(request: Request): Promise<VerifiedAccountSession | null>;
}

export function validateAccountSession(session: VerifiedAccountSession, now: number): VerifiedAccountSession {
  if (!session.accountId.trim() || session.accountId.length > 256
    || !/^[A-Za-z0-9_-]{8,256}$/.test(session.sessionId)
    || (session.provider !== "email" && session.provider !== "google" && session.provider !== "apple")
    || !Number.isSafeInteger(session.authenticatedAt) || !Number.isSafeInteger(session.expiresAt)
    || !Number.isSafeInteger(now) || session.authenticatedAt > now + 60_000
    || session.expiresAt <= session.authenticatedAt) {
    throw new AccountSessionError("invalid", "Account session is invalid.");
  }
  if (now >= session.expiresAt) throw new AccountSessionError("expired", "Account session has expired.");
  return session;
}
