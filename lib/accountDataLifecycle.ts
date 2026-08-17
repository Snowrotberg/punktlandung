import type { AccountIdentity, PublicProfile } from "./accountProfile";
import { toPublicRankedGame, type PublicRankedGame, type RankedGame } from "./rankedGame";

export const accountExportSchemaVersion = 2;
export const deletionReauthenticationMaxAgeMs = 10 * 60 * 1000;

export type AccountDataExport = {
  schemaVersion: typeof accountExportSchemaVersion;
  generatedAt: number;
  accountId: string;
  authentication: {
    currentEmail: string | null;
    pendingEmail: string | null;
    providers: string[];
    lastSignInAt: number | null;
  };
  profile: PublicProfile;
  loginIdentities: AccountIdentity[];
  rankedGames: PublicRankedGame[];
};

export type AccountDeletionRequest = {
  deletionRequestId: string;
  accountId: string | null;
  requestedAt: number;
  status: "queued" | "processing" | "completed" | "failed";
  attemptCount: number;
  leaseUntil: number | null;
  completedAt: number | null;
  lastErrorCode: string | null;
};

export type AccountLifecycleErrorCode = "identity_mismatch" | "invalid_request" | "reauthentication_required";

export class AccountLifecycleError extends Error {
  constructor(readonly code: AccountLifecycleErrorCode, message: string) {
    super(message);
    this.name = "AccountLifecycleError";
  }
}

/** Builds the authenticated user's portable JSON payload without guest secrets. */
export function createAccountDataExport(input: {
  accountId: string;
  profile: PublicProfile;
  loginIdentities: AccountIdentity[];
  rankedGames: RankedGame[];
  authentication: {
    currentEmail: string | null;
    pendingEmail: string | null;
    providers: string[];
    lastSignInAt: number | null;
  };
  now: number;
}): AccountDataExport {
  if (!input.accountId.trim() || !Number.isFinite(input.now)) {
    throw new AccountLifecycleError("invalid_request", "Account export request is invalid.");
  }
  if (input.profile.accountId !== input.accountId
    || input.loginIdentities.some((identity) => identity.accountId !== input.accountId)
    || input.rankedGames.some((game) => game.accountId !== input.accountId)) {
    throw new AccountLifecycleError("identity_mismatch", "Export data does not belong to one account.");
  }
  return {
    schemaVersion: accountExportSchemaVersion,
    generatedAt: input.now,
    accountId: input.accountId,
    authentication: structuredClone(input.authentication),
    profile: structuredClone(input.profile),
    loginIdentities: structuredClone(input.loginIdentities),
    rankedGames: input.rankedGames.map(toPublicRankedGame)
  };
}

/** Creates the durable outbox job; provider adapters execute and audit it later. */
export function createAccountDeletionRequest(input: {
  deletionRequestId: string;
  accountId: string;
  requestedAt: number;
  reauthenticatedAt: number;
}): AccountDeletionRequest {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.deletionRequestId) || !input.accountId.trim()
    || !Number.isFinite(input.requestedAt) || !Number.isFinite(input.reauthenticatedAt)) {
    throw new AccountLifecycleError("invalid_request", "Account deletion request is invalid.");
  }
  const age = input.requestedAt - input.reauthenticatedAt;
  if (age < -60_000 || age > deletionReauthenticationMaxAgeMs) {
    throw new AccountLifecycleError("reauthentication_required", "Recent authentication is required before account deletion.");
  }
  return {
    deletionRequestId: input.deletionRequestId,
    accountId: input.accountId,
    requestedAt: input.requestedAt,
    status: "queued",
    attemptCount: 0,
    leaseUntil: null,
    completedAt: null,
    lastErrorCode: null
  };
}

/**
 * Adapter transaction: request IDs are idempotent and the job is committed
 * before sessions, provider identity and personal rows are erased.
 */
export interface AccountDeletionOutbox {
  enqueue(request: AccountDeletionRequest): Promise<AccountDeletionRequest>;
  findById(deletionRequestId: string): Promise<AccountDeletionRequest | null>;
  claimNext(now: number, leaseMs: number): Promise<AccountDeletionRequest | null>;
  complete(deletionRequestId: string, now: number): Promise<AccountDeletionRequest>;
  fail(deletionRequestId: string, errorCode: string, now: number): Promise<AccountDeletionRequest>;
}

export class InMemoryAccountDeletionOutbox implements AccountDeletionOutbox {
  private readonly jobs = new Map<string, AccountDeletionRequest>();

  async enqueue(request: AccountDeletionRequest): Promise<AccountDeletionRequest> {
    const existing = this.jobs.get(request.deletionRequestId);
    if (existing) {
      if (existing.accountId && request.accountId && existing.accountId !== request.accountId) {
        throw new AccountLifecycleError("identity_mismatch", "Deletion request belongs to another account.");
      }
      return structuredClone(existing);
    }
    const stored = structuredClone(request);
    this.jobs.set(stored.deletionRequestId, stored);
    return structuredClone(stored);
  }

  async findById(deletionRequestId: string): Promise<AccountDeletionRequest | null> {
    const job = this.jobs.get(deletionRequestId);
    return job ? structuredClone(job) : null;
  }

  async claimNext(now: number, leaseMs: number): Promise<AccountDeletionRequest | null> {
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 15 * 60 * 1000) {
      throw new AccountLifecycleError("invalid_request", "Deletion worker lease is invalid.");
    }
    const candidate = Array.from(this.jobs.values())
      .filter((job) => job.accountId && (
        job.status === "queued" || job.status === "failed" || (job.status === "processing" && (job.leaseUntil ?? 0) <= now)
      ))
      .sort((left, right) => left.requestedAt - right.requestedAt || left.deletionRequestId.localeCompare(right.deletionRequestId))[0];
    if (!candidate) return null;
    const processing: AccountDeletionRequest = {
      ...candidate,
      status: "processing",
      attemptCount: candidate.attemptCount + 1,
      leaseUntil: now + leaseMs,
      lastErrorCode: null
    };
    this.jobs.set(processing.deletionRequestId, processing);
    return structuredClone(processing);
  }

  async complete(deletionRequestId: string, now: number): Promise<AccountDeletionRequest> {
    const current = this.requireJob(deletionRequestId);
    if (current.status === "completed") return structuredClone(current);
    if (current.status !== "processing" || !Number.isSafeInteger(now)) {
      throw new AccountLifecycleError("invalid_request", "Deletion job cannot be completed.");
    }
    const completed: AccountDeletionRequest = {
      ...current,
      accountId: null,
      status: "completed",
      leaseUntil: null,
      completedAt: now,
      lastErrorCode: null
    };
    this.jobs.set(deletionRequestId, completed);
    return structuredClone(completed);
  }

  async fail(deletionRequestId: string, errorCode: string, now: number): Promise<AccountDeletionRequest> {
    const current = this.requireJob(deletionRequestId);
    if (current.status !== "processing" || !Number.isSafeInteger(now) || !/^[a-z0-9_]{3,64}$/.test(errorCode)) {
      throw new AccountLifecycleError("invalid_request", "Deletion job failure is invalid.");
    }
    const failed: AccountDeletionRequest = {
      ...current,
      status: "failed",
      leaseUntil: null,
      lastErrorCode: errorCode
    };
    this.jobs.set(deletionRequestId, failed);
    return structuredClone(failed);
  }

  private requireJob(deletionRequestId: string): AccountDeletionRequest {
    const job = this.jobs.get(deletionRequestId);
    if (!job) throw new AccountLifecycleError("invalid_request", "Deletion job does not exist.");
    return job;
  }
}

/** Must revoke sessions and erase provider plus application data idempotently. */
export interface AccountDeletionExecutor {
  erase(accountId: string): Promise<void>;
}

export class AccountDeletionWorker {
  constructor(
    private readonly outbox: AccountDeletionOutbox,
    private readonly executor: AccountDeletionExecutor,
    private readonly leaseMs = 60_000
  ) {}

  async runNext(now: number): Promise<boolean> {
    const job = await this.outbox.claimNext(now, this.leaseMs);
    if (!job || !job.accountId) return false;
    try {
      await this.executor.erase(job.accountId);
      await this.outbox.complete(job.deletionRequestId, now);
    } catch {
      await this.outbox.fail(job.deletionRequestId, "execution_failed", now);
    }
    return true;
  }
}
