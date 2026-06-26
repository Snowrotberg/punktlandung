import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { GameApp } from "@/components/GameApp";
import { SoundProvider } from "@/components/SoundProvider";

export default function OnlineModusPage() {
  return (
    <AppErrorBoundary>
      <SoundProvider>
        <GameApp initialMode="online" />
      </SoundProvider>
    </AppErrorBoundary>
  );
}
