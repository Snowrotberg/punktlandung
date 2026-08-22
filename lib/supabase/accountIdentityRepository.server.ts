import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  AccountIdentityError,
  type AccountIdentityRepository,
  type AccountRecord,
  type AuthBinding,
  type ExternalAuthPrincipal,
  type ResolvedAccountIdentity
} from "@/lib/accountIdentity";
import type { AccountIdentity, AccountStatus, LoginProvider } from "@/lib/accountProfile";
import { createSupabaseAdminClient } from "./admin.server";
import type { Database, Json } from "./database.types";

type JsonObject = { [key: string]: Json | undefined };

function object(value: Json | undefined, label: string): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Supabase returned an invalid ${label}.`);
  }
  return value;
}

function string(value: Json | undefined, label: string): string {
  if (typeof value !== "string") throw new Error(`Supabase returned an invalid ${label}.`);
  return value;
}

function nullableTimestamp(value: Json | undefined, label: string): number | null {
  if (value === null) return null;
  const timestamp = Date.parse(string(value, label));
  if (!Number.isFinite(timestamp)) throw new Error(`Supabase returned an invalid ${label}.`);
  return timestamp;
}

function timestamp(value: Json | undefined, label: string): number {
  const parsed = nullableTimestamp(value, label);
  if (parsed === null) throw new Error(`Supabase returned an invalid ${label}.`);
  return parsed;
}

function accountStatus(value: Json | undefined): AccountStatus {
  if (value !== "active" && value !== "restricted" && value !== "deleted") {
    throw new Error("Supabase returned an invalid account status.");
  }
  return value;
}

function loginProvider(value: Json | undefined): LoginProvider {
  if (value !== "email" && value !== "google" && value !== "apple") {
    throw new Error("Supabase returned an invalid login provider.");
  }
  return value;
}

function mapAccount(value: Json | undefined): AccountRecord {
  const row = object(value, "account");
  return {
    accountId: string(row.account_id, "account ID"),
    status: accountStatus(row.status),
    createdAt: timestamp(row.created_at, "account creation time"),
    updatedAt: timestamp(row.updated_at, "account update time"),
    deletedAt: nullableTimestamp(row.deleted_at, "account deletion time")
  };
}

function mapBinding(value: Json | undefined): AuthBinding {
  const row = object(value, "auth binding");
  const authBackend = string(row.auth_backend, "auth backend");
  if (authBackend !== "supabase" && authBackend !== "firebase") {
    throw new Error("Supabase returned an invalid auth backend.");
  }
  return {
    authBackend,
    backendUserId: string(row.backend_user_id, "backend user ID"),
    accountId: string(row.account_id, "binding account ID"),
    createdAt: timestamp(row.created_at, "binding creation time"),
    lastUsedAt: timestamp(row.last_used_at, "binding usage time")
  };
}

function mapIdentity(value: Json | undefined): AccountIdentity {
  const row = object(value, "login identity");
  return {
    accountId: string(row.account_id, "identity account ID"),
    provider: loginProvider(row.provider),
    providerSubject: string(row.provider_subject, "provider subject"),
    verifiedAt: timestamp(row.verified_at, "identity verification time"),
    lastUsedAt: timestamp(row.last_used_at, "identity usage time")
  };
}

function mapResult(data: Json): ResolvedAccountIdentity {
  const result = object(data, "identity result");
  if (typeof result.account_created !== "boolean") {
    throw new Error("Supabase returned an invalid account-created flag.");
  }
  return {
    account: mapAccount(result.account),
    binding: mapBinding(result.binding),
    identity: mapIdentity(result.identity),
    accountCreated: result.account_created
  };
}

function identityError(error: PostgrestError): AccountIdentityError {
  const message = error.message.toLowerCase();
  if (message.includes("identity_conflict")) return new AccountIdentityError("identity_conflict", "Authentication identity is already linked.");
  if (message.includes("account_missing")) return new AccountIdentityError("account_missing", "Account does not exist.");
  if (message.includes("account_inactive")) return new AccountIdentityError("account_inactive", "Account is not active.");
  if (error.code === "22023" || message.includes("invalid_principal")) {
    return new AccountIdentityError("invalid_principal", "External authentication principal is invalid.");
  }
  throw new Error(`Could not resolve account identity in Supabase (${error.code || "unknown"}).`);
}

export class SupabaseAccountIdentityRepository implements AccountIdentityRepository {
  constructor(private readonly client: SupabaseClient<Database> = createSupabaseAdminClient()) {}

  async resolveAtomically(
    principal: ExternalAuthPrincipal,
    newAccount: AccountRecord,
    now: number
  ): Promise<ResolvedAccountIdentity> {
    if (newAccount.status !== "active" || newAccount.createdAt !== now || newAccount.updatedAt !== now || newAccount.deletedAt !== null) {
      throw new AccountIdentityError("invalid_principal", "New account state is invalid.");
    }
    return this.resolve(principal, newAccount.accountId, null, now);
  }

  async linkAtomically(
    accountId: string,
    principal: ExternalAuthPrincipal,
    now: number
  ): Promise<ResolvedAccountIdentity> {
    return this.resolve(principal, accountId, accountId, now);
  }

  async findAccount(accountId: string): Promise<AccountRecord | null> {
    const { data, error } = await this.client.from("accounts").select("*").eq("account_id", accountId).maybeSingle();
    if (error) throw new Error("Could not read account from Supabase.");
    return data ? {
      accountId: data.account_id,
      status: data.status,
      createdAt: Date.parse(data.created_at),
      updatedAt: Date.parse(data.updated_at),
      deletedAt: data.deleted_at ? Date.parse(data.deleted_at) : null
    } : null;
  }

  async listIdentities(accountId: string): Promise<AccountIdentity[]> {
    const { data, error } = await this.client
      .from("login_identities")
      .select("account_id, provider, provider_subject, verified_at, last_used_at")
      .eq("account_id", accountId)
      .order("provider")
      .order("provider_subject");
    if (error) throw new Error("Could not read login identities from Supabase.");
    return data.map((row) => ({
      accountId: row.account_id,
      provider: row.provider,
      providerSubject: row.provider_subject,
      verifiedAt: Date.parse(row.verified_at),
      lastUsedAt: Date.parse(row.last_used_at)
    }));
  }

  private async resolve(
    principal: ExternalAuthPrincipal,
    newAccountId: string,
    targetAccountId: string | null,
    now: number
  ): Promise<ResolvedAccountIdentity> {
    const { data, error } = await this.client.rpc("resolve_account_identity", {
      p_auth_backend: principal.authBackend,
      p_backend_user_id: principal.backendUserId,
      p_login_provider: principal.loginProvider,
      p_new_account_id: newAccountId,
      p_now: new Date(now).toISOString(),
      p_provider_subject: principal.providerSubject,
    p_target_account_id: targetAccountId ?? undefined,
      p_verified_at: new Date(principal.verifiedAt).toISOString()
    });
    if (error) throw identityError(error);
    return mapResult(data);
  }
}
