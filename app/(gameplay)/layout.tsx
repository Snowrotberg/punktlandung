import { Suspense } from "react";
import { GameplayRouteHost } from "@/components/GameplayRouteHost";
import { accountNavigationState } from "@/lib/accountNavigation.server";

export default async function GameplayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await accountNavigationState();
  return (
    <Suspense fallback={<main className="min-h-dvh bg-slate-950" />}>
      <GameplayRouteHost
        accountsEnabled={account.enabled}
        rankedGamesEnabled={account.rankedGamesEnabled}
        accountAuthenticated={account.authenticated}
        accountDisplayName={account.displayName}
      >
        {children}
      </GameplayRouteHost>
    </Suspense>
  );
}
