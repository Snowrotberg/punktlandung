import { unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { getSupabaseAccountContext, supabaseAccountsEnabled } from "@/lib/supabase/auth.server";
import { SupabaseAccountProfileRepository } from "@/lib/supabase/accountProfileRepository.server";
import { loadOptionalAccountNavigation } from "@/lib/optionalAccountNavigation";

export async function accountNavigationState() {
  // Account-aware pages must be rendered per request. Otherwise a production
  // build without the PM2 runtime environment can freeze the signed-out,
  // disabled account state into otherwise static pages.
  await cookies();
  const enabled = supabaseAccountsEnabled();
  return loadOptionalAccountNavigation({
    enabled,
    loadContext: getSupabaseAccountContext,
    loadDisplayName: async (context) => {
      const profile = await new SupabaseAccountProfileRepository().findByAccountId(context.identity.account.accountId);
      return profile?.displayName ?? null;
    },
    onError: (error) => {
      // Never swallow redirects, dynamic-rendering signals or other framework
      // control-flow exceptions. Only genuine account/backend failures degrade
      // the optional header state to signed out.
      unstable_rethrow(error);
      console.error("[account-navigation] Optional account state unavailable", {
        error: error instanceof Error ? error.name : "UnknownError"
      });
    }
  });
}
