import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { AccountSessionReader, VerifiedAccountSession } from "@/lib/accountSession.server";
import type { LoginProvider } from "@/lib/accountProfile";
import { resolveSupabaseAccount } from "./auth.server";
import type { Database } from "./database.types";

const providers = new Set<LoginProvider>(["email", "google", "apple"]);

function requestCookies(request: Request): Array<{ name: string; value: string }> {
  return (request.headers.get("cookie") ?? "").split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    return [{ name: part.slice(0, separator).trim(), value: part.slice(separator + 1).trim() }];
  });
}

function provider(user: User): LoginProvider {
  const value = user.app_metadata?.provider;
  return typeof value === "string" && providers.has(value as LoginProvider) ? value as LoginProvider : "email";
}

export class SupabaseAccountSessionReader implements AccountSessionReader {
  async read(request: Request): Promise<VerifiedAccountSession | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) return null;
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => requestCookies(request),
        setAll: () => undefined
      }
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    if (claimsError || typeof claims?.sub !== "string") return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== claims.sub) return null;
    const context = await resolveSupabaseAccount(data.user);
    const authenticatedAt = Date.parse(data.user.last_sign_in_at ?? data.user.updated_at ?? data.user.created_at);
    const exp = typeof claims.exp === "number" ? claims.exp * 1000 : NaN;
    const rawSessionId = typeof claims.session_id === "string" ? claims.session_id : data.user.id;
    return {
      accountId: context.identity.account.accountId,
      sessionId: rawSessionId,
      provider: provider(data.user),
      authenticatedAt: Number.isSafeInteger(authenticatedAt) ? authenticatedAt : Date.now() - 1_000,
      expiresAt: Number.isSafeInteger(exp) ? exp : Date.now() + 5 * 60_000
    };
  }
}
