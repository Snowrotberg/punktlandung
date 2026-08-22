import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createSupabaseSecretKeyFetch } from "./secretKeyFetch.server";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Trusted application-table client. Never import this module into Client
 * Components and never expose SUPABASE_SECRET_KEY through NEXT_PUBLIC_*.
 */
export function createSupabaseAdminClient(
  env: Readonly<Record<string, string | undefined>> = process.env
): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error("Supabase server access is not configured.");
  }
  if (secretKey === env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error("Supabase server access requires a secret key, not the publishable key.");
  }

  cachedClient = createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: { fetch: createSupabaseSecretKeyFetch(secretKey) }
  });
  return cachedClient;
}
