"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";
import { gameplayStatusForRoute } from "@/lib/gameplayRoute";

type GameplayRouteHostProps = {
  children: ReactNode;
  accountsEnabled: boolean;
  rankedGamesEnabled: boolean;
  accountAuthenticated: boolean;
  accountDisplayName: string | null;
};

export function GameplayRouteHost({
  children,
  accountsEnabled,
  rankedGamesEnabled,
  accountAuthenticated,
  accountDisplayName
}: GameplayRouteHostProps) {
  const pathname = usePathname() ?? "/spielen";
  const searchParams = useSearchParams();
  const previewRequested = process.env.NODE_ENV !== "production" && (
    searchParams?.get("preview") === "1" ||
    (pathname === "/endergebnis" && Boolean(searchParams?.has("vorschau")))
  );

  if (previewRequested) return children;

  const requiredStatus = gameplayStatusForRoute(pathname) ?? "guessing";
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp
          requiredStatus={requiredStatus}
          accountsEnabled={accountsEnabled}
          rankedGamesEnabled={rankedGamesEnabled}
          accountAuthenticated={accountAuthenticated}
          accountDisplayName={accountDisplayName}
        />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
