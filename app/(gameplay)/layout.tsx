import { Suspense } from "react";
import { GameplayRouteHost } from "@/components/GameplayRouteHost";
import { GameplayRestoringView } from "@/components/GameplayRestoringView";
import { accountNavigationState } from "@/lib/accountNavigation.server";

export default async function GameplayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await accountNavigationState();
  return (
    <Suspense fallback={<GameplayRestoringView />}>
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
