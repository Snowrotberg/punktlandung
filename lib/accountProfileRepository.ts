import type { PublicProfile } from "./accountProfile";

export type AccountProfileConflictCode = "profile_exists" | "profile_missing" | "handle_taken";

export class AccountProfileConflictError extends Error {
  constructor(readonly code: AccountProfileConflictCode, message: string) {
    super(message);
    this.name = "AccountProfileConflictError";
  }
}

/** Atomic profile port. Handle claims must commit in the same transaction. */
export interface AccountProfileRepository {
  findByAccountId(accountId: string): Promise<PublicProfile | null>;
  findByNormalizedHandle(normalizedHandle: string): Promise<PublicProfile | null>;
  create(profile: PublicProfile): Promise<PublicProfile>;
  updateAtomically(
    accountId: string,
    transform: (current: PublicProfile) => PublicProfile
  ): Promise<PublicProfile>;
}

export class InMemoryAccountProfileRepository implements AccountProfileRepository {
  private readonly profiles = new Map<string, PublicProfile>();
  private readonly handleOwners = new Map<string, string>();

  async findByAccountId(accountId: string): Promise<PublicProfile | null> {
    const profile = this.profiles.get(accountId);
    return profile ? structuredClone(profile) : null;
  }

  async findByNormalizedHandle(normalizedHandle: string): Promise<PublicProfile | null> {
    const accountId = this.handleOwners.get(normalizedHandle);
    const profile = accountId ? this.profiles.get(accountId) : null;
    return profile ? structuredClone(profile) : null;
  }

  async create(profile: PublicProfile): Promise<PublicProfile> {
    if (this.profiles.has(profile.accountId)) {
      throw new AccountProfileConflictError("profile_exists", "An account profile already exists.");
    }
    if (this.handleOwners.has(profile.normalizedHandle)) {
      throw new AccountProfileConflictError("handle_taken", "This handle is already in use.");
    }
    const stored = structuredClone(profile);
    this.profiles.set(profile.accountId, stored);
    this.handleOwners.set(profile.normalizedHandle, profile.accountId);
    return structuredClone(stored);
  }

  async updateAtomically(
    accountId: string,
    transform: (current: PublicProfile) => PublicProfile
  ): Promise<PublicProfile> {
    const current = this.profiles.get(accountId);
    if (!current) throw new AccountProfileConflictError("profile_missing", "Account profile does not exist.");
    const next = transform(structuredClone(current));
    if (next.accountId !== current.accountId || next.createdAt !== current.createdAt) {
      throw new Error("Profile updates cannot replace profile identity.");
    }
    const owner = this.handleOwners.get(next.normalizedHandle);
    if (owner && owner !== accountId) {
      throw new AccountProfileConflictError("handle_taken", "This handle is already in use.");
    }
    if (next.normalizedHandle !== current.normalizedHandle) {
      this.handleOwners.delete(current.normalizedHandle);
      this.handleOwners.set(next.normalizedHandle, accountId);
    }
    const stored = structuredClone(next);
    this.profiles.set(accountId, stored);
    return structuredClone(stored);
  }
}
