import type { Metadata } from "next";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";
import { FinalResultPreview } from "@/components/FinalResultPreview";
import { accountNavigationState } from "@/lib/accountNavigation.server";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

type AufloesungPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AufloesungPage({ searchParams }: AufloesungPageProps) {
  const params = await searchParams;
  const previewValue = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const playersValue = Array.isArray(params.players) ? params.players[0] : params.players;
  const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode = modeValue === "solo" || modeValue === "online" ? modeValue : "party";
  const playerCount = Number(playersValue ?? (mode === "solo" ? 1 : 3));
  if (process.env.NODE_ENV !== "production" && previewValue === "1") {
    return (
      <div className="min-h-dvh">
        <AppErrorBoundary><SoundProvider><FinalResultPreview playerCount={playerCount} mode={mode} surface="resolution" /></SoundProvider></AppErrorBoundary>
      </div>
    );
  }
  const account = await accountNavigationState();
  return (
    <div className="min-h-dvh">
      <AppErrorBoundary><SoundProvider><GameApp requiredStatus="results" accountsEnabled={account.enabled} accountAuthenticated={account.authenticated} accountDisplayName={account.displayName} /></SoundProvider></AppErrorBoundary>
    </div>
  );
}
