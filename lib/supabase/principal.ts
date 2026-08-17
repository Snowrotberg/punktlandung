import type { User } from "@supabase/supabase-js";
import type { ExternalAuthPrincipal } from "@/lib/accountIdentity";
import type { LoginProvider } from "@/lib/accountProfile";

const supportedProviders = new Set<LoginProvider>(["email", "google", "apple"]);

export function supabaseLoginProvider(value: unknown): LoginProvider | null {
  return typeof value === "string" && supportedProviders.has(value as LoginProvider)
    ? value as LoginProvider
    : null;
}

export function principalFromSupabaseUser(
  user: User,
  now: number,
  preferredProvider?: LoginProvider
): ExternalAuthPrincipal {
  const providerFromAppMetadata = supabaseLoginProvider(user.app_metadata?.provider);
  const provider = preferredProvider ?? providerFromAppMetadata ?? "email";
  const matchingIdentity = user.identities?.find((identity) => identity.provider === provider);
  const providerSubject = matchingIdentity?.identity_id ?? user.id;
  const parsedVerifiedAt = Date.parse(user.last_sign_in_at ?? user.updated_at ?? user.created_at);

  // Supabase timestamps are authoritative, but a small clock difference between
  // the app host and Auth must not turn a valid signed-in user into an invalid
  // principal. Clamping also preserves the service rule that verification can
  // never happen in the future.
  const verifiedAt = Number.isFinite(parsedVerifiedAt) ? Math.min(parsedVerifiedAt, now) : now;

  return {
    authBackend: "supabase",
    backendUserId: user.id,
    loginProvider: provider,
    providerSubject,
    verifiedAt
  };
}
