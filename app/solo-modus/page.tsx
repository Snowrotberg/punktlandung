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

export default async function SoloModusPage({ searchParams }: { searchParams: Promise<{ direct?: string; resume?: string }> }) {
  const account = await accountNavigationState();
  const params = await searchParams;
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp
          key="solo-setup"
          initialMode="solo"
          directStart={params.direct === "1"}
          resumeRankedGame={params.resume === "ranked"}
          accountsEnabled={account.enabled}
          rankedGamesEnabled={account.rankedGamesEnabled}
          accountAuthenticated={account.authenticated}
          accountDisplayName={account.displayName}
        />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
