import type { Metadata } from "next";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function WarteraumPage() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp initialMode="online" requireOnlineWaitingRoom />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
