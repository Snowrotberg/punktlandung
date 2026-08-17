import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

export default async function DirectSoloPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (!params.rounds || !params.time || !params.difficulty || !params.category) {
    redirect("/solo-modus/direct?rounds=15&time=60&difficulty=medium&category=mixed");
  }
  const account = await accountNavigationState();
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp key="solo-direct" initialMode="solo" directStart accountsEnabled={account.enabled} accountAuthenticated={account.authenticated} accountDisplayName={account.displayName} />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
