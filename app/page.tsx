import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export default function Home() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
