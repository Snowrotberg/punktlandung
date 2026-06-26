import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export default function SpielenPage() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp requiredStatus="guessing" />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
