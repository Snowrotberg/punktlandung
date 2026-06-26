import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export default function AufloesungPage() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp requiredStatus="results" />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
