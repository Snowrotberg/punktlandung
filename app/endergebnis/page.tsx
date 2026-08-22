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

type EndergebnisPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EndergebnisPage({ searchParams }: EndergebnisPageProps) {
  const params = await searchParams;
  const previewValue = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const legacyPreviewValue = Array.isArray(params.vorschau) ? params.vorschau[0] : params.vorschau;
  const playersValue = Array.isArray(params.players) ? params.players[0] : params.players;
  const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode = modeValue === "solo" || modeValue === "online" ? modeValue : "party";
  const playerCount = Number(playersValue ?? legacyPreviewValue ?? (mode === "solo" ? 1 : 10));
  const showLocalPreview = process.env.NODE_ENV !== "production" && (previewValue === "1" || Boolean(legacyPreviewValue));
  if (showLocalPreview) {
    return (
      <AppErrorBoundary>
        <SoundProvider><FinalResultPreview playerCount={playerCount} mode={mode} /></SoundProvider>
      </AppErrorBoundary>
    );
  }
  const account = await accountNavigationState();
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp requiredStatus="finished" accountsEnabled={account.enabled} rankedGamesEnabled={account.rankedGamesEnabled} accountAuthenticated={account.authenticated} accountDisplayName={account.displayName} />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
