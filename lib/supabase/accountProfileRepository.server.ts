import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { PublicProfile } from "@/lib/accountProfile";
import {
  AccountProfileConflictError,
  type AccountProfileRepository
} from "@/lib/accountProfileRepository";
import { createSupabaseAdminClient } from "./admin.server";
import type { Database, Tables } from "./database.types";

type ProfileRow = Tables<"profiles">;

function mapProfile(row: ProfileRow): PublicProfile {
  if (row.visibility !== "public" && row.visibility !== "private") {
    throw new Error("Supabase returned an invalid profile visibility.");
  }
  return {
    accountId: row.account_id,
    handle: row.handle,
    normalizedHandle: row.normalized_handle,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    visibility: row.visibility,
    status: row.status,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : null
  };
}

function conflict(error: PostgrestError, fallback: "profile_exists" | "profile_missing") {
  const detail = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  if (error.code === "23505" && detail.includes("normalized_handle")) {
    return new AccountProfileConflictError("handle_taken", "This handle is already in use.");
  }
  return new AccountProfileConflictError(fallback, fallback === "profile_exists"
    ? "An account profile already exists."
    : "Account profile does not exist.");
}

export class SupabaseAccountProfileRepository implements AccountProfileRepository {
  constructor(private readonly client: SupabaseClient<Database> = createSupabaseAdminClient()) {}

  async findByAccountId(accountId: string): Promise<PublicProfile | null> {
    const row = await this.findRow("account_id", accountId);
    return row ? mapProfile(row) : null;
  }

  async findByNormalizedHandle(normalizedHandle: string): Promise<PublicProfile | null> {
    const row = await this.findRow("normalized_handle", normalizedHandle);
    return row ? mapProfile(row) : null;
  }

  async create(profile: PublicProfile): Promise<PublicProfile> {
    const { data, error } = await this.client.from("profiles").insert({
      account_id: profile.accountId,
      avatar_key: profile.avatarKey,
      created_at: new Date(profile.createdAt).toISOString(),
      deleted_at: profile.deletedAt === null ? null : new Date(profile.deletedAt).toISOString(),
      display_name: profile.displayName,
      handle: profile.handle,
      normalized_handle: profile.normalizedHandle,
      status: profile.status,
      updated_at: new Date(profile.updatedAt).toISOString(),
      visibility: profile.visibility
    }).select("*").single();
    if (error) throw conflict(error, "profile_exists");
    return mapProfile(data);
  }

  async updateAtomically(
    accountId: string,
    transform: (current: PublicProfile) => PublicProfile
  ): Promise<PublicProfile> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const currentRow = await this.findRow("account_id", accountId);
      if (!currentRow) throw new AccountProfileConflictError("profile_missing", "Account profile does not exist.");
      const current = mapProfile(currentRow);
      const next = transform(structuredClone(current));
      if (next.accountId !== current.accountId || next.createdAt !== current.createdAt) {
        throw new Error("Profile updates cannot replace profile identity.");
      }

      const { data, error } = await this.client.from("profiles").update({
        avatar_key: next.avatarKey,
        deleted_at: next.deletedAt === null ? null : new Date(next.deletedAt).toISOString(),
        display_name: next.displayName,
        handle: next.handle,
        normalized_handle: next.normalizedHandle,
        revision: currentRow.revision + 1,
        status: next.status,
        updated_at: new Date(next.updatedAt).toISOString(),
        visibility: next.visibility
      }).eq("account_id", accountId).eq("revision", currentRow.revision).select("*").maybeSingle();
      if (error) throw conflict(error, "profile_missing");
      if (data) return mapProfile(data);
    }
    throw new Error("Profile update could not be committed after concurrent changes.");
  }

  private async findRow(column: "account_id" | "normalized_handle", value: string): Promise<ProfileRow | null> {
    const { data, error } = await this.client.from("profiles").select("*").eq(column, value).maybeSingle();
    if (error) throw new Error("Could not read account profile from Supabase.");
    return data;
  }
}
