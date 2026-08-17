"use client";

import { useState } from "react";
import { RedesignStatusControls } from "@/components/redesign";

export function AccountHeaderControls({ authenticated = true }: { authenticated?: boolean }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  return (
    <RedesignStatusControls
      connectionStatus="open"
      soundEnabled={soundEnabled}
      accountHref="/konto"
      accountAuthenticated={authenticated}
      onSoundToggle={() => setSoundEnabled((value) => !value)}
    />
  );
}
