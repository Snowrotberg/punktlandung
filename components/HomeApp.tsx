"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { HomeMapPreview } from "./HomeMapPreview";
import { useSound } from "./SoundProvider";
import { RedesignHomeView } from "./redesign/RedesignHomeView";
import { browserUuid } from "@/lib/browserUuid";
import { queueDirectRankedStart } from "@/lib/directRankedStart.client";
import { discardResumeAfterLandingNavigation } from "@/lib/gameResume.client";
import type { PublicRankedGame } from "@/lib/rankedGame";
import type { GameSettings } from "@/types/game";

const activeSessionStorageKey = "punktlandung-active-session-v1";
const rankedSessionStorageKey = "punktlandung-ranked-active-game-v1";
const directPlayHref = "/solo-modus/direct?rounds=15&time=60&difficulty=medium&category=mixed";
const directPlaySettings: GameSettings = {
  mode: "classic",
  localMode: "solo",
  localPlayerCount: 1,
  timeLimitSec: 60,
  rounds: 15,
  noMove: false,
  noPan: false,
  noZoom: false,
  mapPackId: "world",
  category: "mixed",
  difficulty: "medium"
};

const homeModes = [
  { id: "solo" as const, title: "Solo", text: "Spiele für dich und in deinem Tempo.", href: "/solo-modus" },
  { id: "couch" as const, title: "Party", text: "Gemeinsam oder gegeneinander an einem Gerät.", href: "/party-modus" },
  { id: "online" as const, title: "Online-Raum", text: "Erstelle einen Raum oder tritt per Code bei.", href: "/online-modus" }
];

function clearSessionForNewGameNavigation() {
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
  accountDisplayName,
  rankedGamesEnabled
}: {
  accountsEnabled: boolean;
  accountAuthenticated: boolean;
  accountDisplayName: string | null;
  rankedGamesEnabled: boolean;
}) {
  const router = useRouter();
  const { enabled: soundEnabled, toggle: toggleSound, playSelect } = useSound();
  const [playerName, setPlayerName] = useState(accountDisplayName || "Spieler 1");
  const directStartInFlightRef = useRef(false);

  useEffect(() => {
    // Reaching the landing page from a visible resume setup is the user's
    // second Back step and therefore a deliberate exit. This same-tab marker
    // avoids affecting a game that may be open in another tab.
    if (!discardResumeAfterLandingNavigation()) return;
    // Drop Next's cached forward branch for the discarded game. Keeping that
    // branch would allow browser Forward to revive an empty/stale setup
    // component even though all recovery data was already removed.
    const currentState = window.history.state;
    window.history.pushState(
      {
        ...(currentState && typeof currentState === "object" ? currentState : {}),
        punktlandungDiscardedResume: true
      },
      "",
      window.location.href
    );
  }, []);

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
    clearSessionForNewGameNavigation();
  };

  const startDirectPlay = async (event: MouseEvent<HTMLAnchorElement>) => {
    prepareNavigation();
    if (!rankedGamesEnabled) return;
    event.preventDefault();
    if (directStartInFlightRef.current) return;
    directStartInFlightRef.current = true;
    try {
      const response = await fetch("/api/v1/ranked-games", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-ranked-defer-start": "true"
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        body: JSON.stringify({
          requestId: browserUuid(),
          rulesetId: "daily-five",
          rounds: directPlaySettings.rounds,
          timeLimitSec: directPlaySettings.timeLimitSec,
          category: directPlaySettings.category,
          difficulty: directPlaySettings.difficulty,
          noZoom: directPlaySettings.noZoom
        })
      });
      const payload = await response.json() as { data?: PublicRankedGame };
      if (!response.ok || !payload.data) throw new Error("Direct game start failed");
      queueDirectRankedStart({ game: payload.data, name: playerName, settings: directPlaySettings });
      router.push("/spielen");
    } catch {
      router.push(directPlayHref);
    } finally {
      directStartInFlightRef.current = false;
    }
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
      onDirectPlay={startDirectPlay}
      onModeSelect={prepareNavigation}
      onSoundToggle={toggleSound}
    />
  );
}
