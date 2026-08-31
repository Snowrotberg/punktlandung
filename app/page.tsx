import type { Metadata } from "next";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { HomeApp } from "@/components/HomeApp";
import { SoundProvider } from "@/components/SoundProvider";
import { accountNavigationState } from "@/lib/accountNavigation.server";
import { metadataForRoomInvite } from "@/lib/seo";
import { normalizeOnlineRoomCode, onlineRoomPath } from "@/lib/onlineRoomInvite";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams: Promise<{ code?: string; error?: string; error_code?: string; error_description?: string; room?: string }>;
};

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const params = await searchParams;
  return metadataForRoomInvite(params.room);
}

export default async function Home({ searchParams }: HomeProps) {
  const authParams = await searchParams;
  // Older deployments and a rejected Supabase redirect allow-list entry can
  // send the PKCE code to the site root. Keep those sign-ins recoverable.
  if (authParams.code || authParams.error) {
    const callbackParams = new URLSearchParams({ returnTo: "/konto" });
    for (const key of ["code", "error", "error_code", "error_description"] as const) {
      const value = authParams[key];
      if (value) callbackParams.set(key, value);
    }
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }
  // Invitations created by older releases pointed to /?room=CODE. Keep them
  // usable while giving every new invitation one canonical route.
  if (authParams.room && normalizeOnlineRoomCode(authParams.room)) {
    redirect(onlineRoomPath(authParams.room));
  }
  const account = await accountNavigationState();
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <HomeApp accountsEnabled={account.enabled} accountAuthenticated={account.authenticated} accountDisplayName={account.displayName} rankedGamesEnabled={account.rankedGamesEnabled} />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
