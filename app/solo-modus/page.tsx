import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export default function SoloModusPage() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp initialMode="solo" />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
