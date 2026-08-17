import type { AccountIdentity, AccountStatus, LoginProvider } from "./accountProfile";
import type { VerifiedAccountSession } from "./accountSession.server";

export type AuthBackend = "supabase" | "firebase";

export type AccountRecord = {
  accountId: string;
  status: AccountStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type AuthBinding = {
  authBackend: AuthBackend;
  backendUserId: string;
  accountId: string;
  createdAt: number;
  lastUsedAt: number;
};

export type ExternalAuthPrincipal = {
  authBackend: AuthBackend;
  backendUserId: string;
  loginProvider: LoginProvider;
  /** Stable provider identity ID, never an email address used as a key. */
  providerSubject: string;
  verifiedAt: number;
};

export type ResolvedAccountIdentity = {
  account: AccountRecord;
  binding: AuthBinding;
  identity: AccountIdentity;
  accountCreated: boolean;
};

export class AccountIdentityError extends Error {
  constructor(readonly code: "invalid_principal" | "identity_conflict" | "account_missing" | "account_inactive" | "reauthentication_required", message: string) {
    super(message);
    this.name = "AccountIdentityError";
  }
}

export interface AccountIdentityRepository {
  resolveAtomically(principal: ExternalAuthPrincipal, newAccount: AccountRecord, now: number): Promise<ResolvedAccountIdentity>;
  linkAtomically(accountId: string, principal: ExternalAuthPrincipal, now: number): Promise<ResolvedAccountIdentity>;
  findAccount(accountId: string): Promise<AccountRecord | null>;
  listIdentities(accountId: string): Promise<AccountIdentity[]>;
}

function bindingKey(principal: ExternalAuthPrincipal): string {
  return `${principal.authBackend}:${principal.backendUserId}`;
}

function identityKey(principal: ExternalAuthPrincipal): string {
  return `${principal.loginProvider}:${principal.providerSubject}`;
}

function validatePrincipal(principal: ExternalAuthPrincipal, now: number): void {
  if ((principal.authBackend !== "supabase" && principal.authBackend !== "firebase")
    || (principal.loginProvider !== "email" && principal.loginProvider !== "google" && principal.loginProvider !== "apple")
    || !principal.backendUserId.trim() || principal.backendUserId.length > 512
    || !principal.providerSubject.trim() || principal.providerSubject.length > 512
    || !Number.isSafeInteger(principal.verifiedAt) || !Number.isSafeInteger(now)
    || principal.verifiedAt > now + 60_000) {
    throw new AccountIdentityError("invalid_principal", "External authentication principal is invalid.");
  }
}

export class InMemoryAccountIdentityRepository implements AccountIdentityRepository {
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly bindings = new Map<string, AuthBinding>();
  private readonly identities = new Map<string, AccountIdentity>();

  async resolveAtomically(principal: ExternalAuthPrincipal, newAccount: AccountRecord, now: number): Promise<ResolvedAccountIdentity> {
    validatePrincipal(principal, now);
    const existingBinding = this.bindings.get(bindingKey(principal));
    const existingIdentity = this.identities.get(identityKey(principal));
    if (existingBinding && existingIdentity && existingBinding.accountId !== existingIdentity.accountId) {
      throw new AccountIdentityError("identity_conflict", "Authentication identities resolve to different accounts.");
    }
    const accountId = existingBinding?.accountId ?? existingIdentity?.accountId ?? newAccount.accountId;
    let account = this.accounts.get(accountId);
    let accountCreated = false;
    if (!account) {
      if (accountId !== newAccount.accountId || this.accounts.has(newAccount.accountId)) {
        throw new AccountIdentityError("account_missing", "Account does not exist.");
      }
      account = structuredClone(newAccount);
      this.accounts.set(account.accountId, account);
      accountCreated = true;
    }
    this.assertActive(account);
    const binding = this.upsertBinding(accountId, principal, now);
    const identity = this.upsertIdentity(accountId, principal, now);
    return { account: structuredClone(account), binding, identity, accountCreated };
  }

  async linkAtomically(accountId: string, principal: ExternalAuthPrincipal, now: number): Promise<ResolvedAccountIdentity> {
    validatePrincipal(principal, now);
    const account = this.accounts.get(accountId);
    if (!account) throw new AccountIdentityError("account_missing", "Account does not exist.");
    this.assertActive(account);
    const existingBinding = this.bindings.get(bindingKey(principal));
    const existingIdentity = this.identities.get(identityKey(principal));
    if ((existingBinding && existingBinding.accountId !== accountId) || (existingIdentity && existingIdentity.accountId !== accountId)) {
      throw new AccountIdentityError("identity_conflict", "Authentication identity already belongs to another account.");
    }
    return {
      account: structuredClone(account),
      binding: this.upsertBinding(accountId, principal, now),
      identity: this.upsertIdentity(accountId, principal, now),
      accountCreated: false
    };
  }

  async findAccount(accountId: string): Promise<AccountRecord | null> {
    const account = this.accounts.get(accountId);
    return account ? structuredClone(account) : null;
  }

  async listIdentities(accountId: string): Promise<AccountIdentity[]> {
    return Array.from(this.identities.values())
      .filter((identity) => identity.accountId === accountId)
      .sort((left, right) => left.provider.localeCompare(right.provider) || left.providerSubject.localeCompare(right.providerSubject))
      .map((identity) => structuredClone(identity));
  }

  private upsertBinding(accountId: string, principal: ExternalAuthPrincipal, now: number): AuthBinding {
    const key = bindingKey(principal);
    const existing = this.bindings.get(key);
    if (existing && existing.accountId !== accountId) throw new AccountIdentityError("identity_conflict", "Auth binding already belongs to another account.");
    const binding: AuthBinding = existing
      ? { ...existing, lastUsedAt: now }
      : { authBackend: principal.authBackend, backendUserId: principal.backendUserId, accountId, createdAt: now, lastUsedAt: now };
    this.bindings.set(key, binding);
    return structuredClone(binding);
  }

  private upsertIdentity(accountId: string, principal: ExternalAuthPrincipal, now: number): AccountIdentity {
    const key = identityKey(principal);
    const existing = this.identities.get(key);
    if (existing && existing.accountId !== accountId) throw new AccountIdentityError("identity_conflict", "Login identity already belongs to another account.");
    const identity: AccountIdentity = existing
      ? { ...existing, lastUsedAt: now }
      : { accountId, provider: principal.loginProvider, providerSubject: principal.providerSubject, verifiedAt: principal.verifiedAt, lastUsedAt: now };
    this.identities.set(key, identity);
    return structuredClone(identity);
  }

  private assertActive(account: AccountRecord): void {
    if (account.status !== "active") throw new AccountIdentityError("account_inactive", "Account is not active.");
  }
}

export interface AccountIdSource {
  accountId(): string;
}

export class AccountIdentityService {
  constructor(private readonly repository: AccountIdentityRepository, private readonly ids: AccountIdSource) {}

  async resolve(principal: ExternalAuthPrincipal, now: number): Promise<ResolvedAccountIdentity> {
    validatePrincipal(principal, now);
    const accountId = this.ids.accountId();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(accountId)) throw new AccountIdentityError("invalid_principal", "Generated account ID is invalid.");
    return this.repository.resolveAtomically(principal, {
      accountId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }, now);
  }

  async link(session: VerifiedAccountSession, principal: ExternalAuthPrincipal, now: number): Promise<ResolvedAccountIdentity> {
    validatePrincipal(principal, now);
    if (now - principal.verifiedAt > 10 * 60 * 1000 || principal.verifiedAt < session.authenticatedAt - 60_000) {
      throw new AccountIdentityError("reauthentication_required", "Fresh authentication is required to link a login method.");
    }
    return this.repository.linkAtomically(session.accountId, principal, now);
  }
}
