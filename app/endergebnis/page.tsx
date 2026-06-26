import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export default function EndergebnisPage() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp requiredStatus="finished" />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
