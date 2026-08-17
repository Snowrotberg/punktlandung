import "server-only";

import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";

export async function getAdminAccountContext() {
  const context = await getSupabaseAccountContext();
  if (!context) return null;

  const { data, error } = await createSupabaseAdminClient()
    .from("accounts")
    .select("role")
    .eq("account_id", context.identity.account.accountId)
    .maybeSingle();

  return !error && data?.role === "admin" ? context : null;
}

export async function isAdminAccount(accountId: string): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient()
    .from("accounts")
    .select("role")
    .eq("account_id", accountId)
    .maybeSingle();
  return !error && data?.role === "admin";
}
