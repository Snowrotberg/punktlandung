import type { Metadata } from "next";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";
import { accountNavigationState } from "@/lib/accountNavigation.server";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function OnlineModusPage() {
  const account = await accountNavigationState();
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp initialMode="online" accountsEnabled={account.enabled} accountAuthenticated={account.authenticated} accountDisplayName={account.displayName} />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
