import "server-only";

import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { AccountIdentityError, AccountIdentityService, type ResolvedAccountIdentity } from "@/lib/accountIdentity";
import type { LoginProvider } from "@/lib/accountProfile";
import { readBackendFeatureConfig } from "@/lib/backendConfig.server";
import { SupabaseAccountIdentityRepository } from "./accountIdentityRepository.server";
import { principalFromSupabaseUser, supabaseLoginProvider } from "./principal";
import { createClient } from "./server";

export type SupabaseAccountContext = {
  user: User;
  identity: ResolvedAccountIdentity;
  provider: LoginProvider;
};

function accountId(): string {
  return `account_${randomUUID().replaceAll("-", "")}`;
}

function assertSupabaseAccountsEnabled(): void {
  const config = readBackendFeatureConfig(process.env);
  if (!config.accountsEnabled || config.provider !== "supabase") {
    throw new Error("Account login is not enabled.");
  }
}

export function supabaseAccountsEnabled(): boolean {
  try {
    const config = readBackendFeatureConfig(process.env);
    return config.accountsEnabled && config.provider === "supabase";
  } catch {
    return false;
  }
}

export function googleLoginEnabled(): boolean {
  return supabaseAccountsEnabled() && process.env.SUPABASE_GOOGLE_LOGIN_ENABLED === "true";
}

export async function resolveSupabaseAccount(
  user: User,
  preferredProvider?: LoginProvider
): Promise<SupabaseAccountContext> {
  assertSupabaseAccountsEnabled();
  const provider = preferredProvider ?? supabaseLoginProvider(user.app_metadata?.provider) ?? "email";
  const now = Date.now();
  const identities = new AccountIdentityService(
    new SupabaseAccountIdentityRepository(),
    { accountId }
  );
  const identity = await identities.resolve(principalFromSupabaseUser(user, now, provider), now);
  return { user, identity, provider };
}

export async function getSupabaseAccountContext(): Promise<SupabaseAccountContext | null> {
  if (!supabaseAccountsEnabled()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  try {
    return await resolveSupabaseAccount(data.user);
  } catch (error) {
    // A valid Supabase session can outlive an app-owned account binding (for
    // example after deletion or an interrupted first login). Treat that as
    // unauthenticated and fail closed instead of crashing public pages.
    if (error instanceof AccountIdentityError) return null;
    throw error;
  }
}
