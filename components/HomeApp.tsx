"use client";

import { useEffect, useState } from "react";
import { HomeMapPreview } from "./HomeMapPreview";
import { useSound } from "./SoundProvider";
import { RedesignHomeView } from "./redesign/RedesignHomeView";

const activeSessionStorageKey = "punktlandung-active-session-v1";
const rankedSessionStorageKey = "punktlandung-ranked-active-game-v1";

const homeModes = [
  { id: "solo" as const, title: "Solo", text: "Spiele für dich und in deinem Tempo.", href: "/solo-modus" },
  { id: "couch" as const, title: "Party", text: "Gemeinsam oder gegeneinander an einem Gerät.", href: "/party-modus" },
  { id: "online" as const, title: "Online-Raum", text: "Erstelle einen Raum oder tritt per Code bei.", href: "/online-modus" }
];

function clearInactiveGameSession() {
  try {
    window.localStorage.removeItem(activeSessionStorageKey);
    window.localStorage.removeItem(rankedSessionStorageKey);
    window.sessionStorage.removeItem("punktlandung-direct-start");
  } catch {
    // Explicit destination routes still work in restricted browser modes.
  }
}

export function HomeApp({
  accountsEnabled,
  accountAuthenticated,
  accountDisplayName
}: {
  accountsEnabled: boolean;
  accountAuthenticated: boolean;
  accountDisplayName: string | null;
}) {
  const { enabled: soundEnabled, toggle: toggleSound, playSelect } = useSound();
  const [playerName, setPlayerName] = useState(accountDisplayName || "Spieler 1");

  useEffect(() => {
    if (accountDisplayName) {
      setPlayerName(accountDisplayName);
      return;
    }
    try {
      const storedName = window.localStorage.getItem("punktlandung-name");
      if (storedName) setPlayerName(storedName);
    } catch {
      // Keep the static landing page usable when storage is blocked.
    }
  }, [accountDisplayName]);

  const prepareNavigation = () => {
    playSelect();
    clearInactiveGameSession();
  };

  return (
    <RedesignHomeView
      playerName={playerName}
      connectionStatus="closed"
      soundEnabled={soundEnabled}
      accountHref={accountsEnabled ? "/konto" : undefined}
      accountAuthenticated={accountAuthenticated}
      mapPreview={<div className="absolute inset-0 overflow-hidden bg-slate-950"><HomeMapPreview /></div>}
      modes={homeModes}
      onDirectPlay={prepareNavigation}
      onModeSelect={prepareNavigation}
      onSoundToggle={toggleSound}
    />
  );
}
