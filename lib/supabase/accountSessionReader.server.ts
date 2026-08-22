import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { AccountSessionReader, VerifiedAccountSession } from "@/lib/accountSession.server";
import type { LoginProvider } from "@/lib/accountProfile";
import { resolveSupabaseAccount } from "./auth.server";
import { hasSupabaseAuthCookie } from "./authCookie.server";
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
    // Ranked guest requests carry their own signed HttpOnly guest cookie. Do
    // not contact Supabase Auth at all when no Supabase session cookie exists;
    // prompt/read/reroll requests otherwise burn Auth rate limits for a user
    // who is not signed in.
    if (!hasSupabaseAuthCookie(request, url)) return null;
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => requestCookies(request),
        setAll: () => undefined
      }
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const context = await resolveSupabaseAccount(data.user);
    const authenticatedAt = Date.parse(data.user.last_sign_in_at ?? data.user.updated_at ?? data.user.created_at);
    return {
      accountId: context.identity.account.accountId,
      sessionId: data.user.id,
      provider: provider(data.user),
      authenticatedAt: Number.isSafeInteger(authenticatedAt) ? authenticatedAt : Date.now() - 1_000,
      // getUser() has just verified the bearer session with Supabase Auth. The
      // ranked service deliberately revalidates this short-lived app context
      // on the next request instead of trusting a long local expiry.
      expiresAt: Date.now() + 5 * 60_000
    };
  }
}
