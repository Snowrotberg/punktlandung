"use client";

import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { categoryOptions } from "@/lib/categories";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  isServerRankedSoloRoom,
  preferLocalRequiredSession,
  shouldOfferSetupResume,
  shouldRestoreLocalSession,
  shouldRestoreRankedSoloSession,
  shouldUseRankedSoloSession
} from "@/lib/gameSessionSelection";
import { saveCompletedGame } from "@/app/endergebnis/actions";
import { flushCompletedGameSaves } from "@/lib/completedGameSaveQueue.client";
import { useLocalGame } from "@/hooks/useLocalGame";
import { clearSetupResumeRequest, clearVisibleResumeSetup, markResumeSetupVisible, requestSetupResume, setupResumeUrl, shouldDiscardResumeOnHistoryExit } from "@/lib/gameResume.client";
import {
  gameplayRouteForStatus,
  gameplayStatusForRoute,
  shouldShowGameplayRestoration,
  shouldShowGameplayStateGuard,
  shouldSynchronizeGameplayRoute
} from "@/lib/gameplayRoute";
import { prepareResultExperience } from "@/lib/resultReadiness.client";
import { normalizeOnlineRoomCode, onlineRoomCodeValidationMessage, onlineRoomPath } from "@/lib/onlineRoomInvite";
import type { GuessCapture } from "@/lib/guessCapture";
import { useRankedSoloGame } from "@/hooks/useRankedSoloGame";
import { useOnlineRoomSocket } from "@/hooks/useOnlineRoomSocket";
import type { InitialLocalGameMode } from "@/hooks/useLocalGame";
import type { GameSettings, LatLng, RoomState, RoundStatus, TeamId } from "@/types/game";
import { AdContainer } from "./AdContainer";
import { ENABLE_FULLSCREEN_INTRO, FullscreenIntro } from "./FullscreenIntro";
import { HomeMapPreview } from "./HomeMapPreview";
import { GameplayRestoringView } from "./GameplayRestoringView";
import { ResultsView } from "./ResultsView";
import { LegalLinks } from "./LegalLinks";
import { LobbyView } from "./LobbyView";
import { PublicBetaBadge } from "./PublicBetaBadge";
import { useSound } from "./SoundProvider";
import { RedesignHomeView } from "./redesign/RedesignHomeView";
import { RedesignSetupView } from "./redesign/RedesignSetupView";
import { RedesignWaitingRoomView } from "./redesign/RedesignWaitingRoomView";

// Leaflet/MapLibre and the result visualizations are the heaviest client
// modules. Setup and landing pages do not need them, so load them only when a
// round or its result is actually shown.
const GameView = dynamic(() => import("./GameView").then((module) => module.GameView), { ssr: false });

const modePreview: Array<{
  id: GameSettings["localMode"] | "online";
  title: string;
  text: string;
  available: boolean;
  icon: string;
  badge?: string;
}> = [
  { id: "solo", title: "Solo", text: "Spiele für dich und in deinem Tempo.", available: true, icon: "/mode-icons/solo-modus-crop.webp" },
  { id: "couch", title: "Party", text: "Gemeinsam oder gegeneinander an einem Gerät.", available: true, icon: "/mode-icons/party-modus-crop.webp" },
  { id: "online", title: "Online-Raum", text: "Erstelle einen Raum oder tritt per Code bei.", available: true, icon: "/mode-icons/online-modus-crop.webp" }
];

export type InitialGameMode = "home" | GameSettings["localMode"] | "online";
export type RequiredGameStatus = Extract<RoundStatus, "guessing" | "results" | "finished">;
const activeSessionStorageKey = "punktlandung-active-session-v1";
const sessionResetStorageKey = "punktlandung-reset-session-v1";
const historyStateKey = "punktlandung-history-v1";
const gameBackBoundaryStateKey = "punktlandung-game-back-boundary-v1";
const trackedGameStartPrefix = "punktlandung-ga-game-start-";
const trackedGameCompletePrefix = "punktlandung-ga-game-complete-";
const redesignHomeEnabled = process.env.NEXT_PUBLIC_REDESIGN_HOME !== "false";

function analyticsGameType(room: RoomState): "solo" | "party" | "online" {
  if (room.kind === "online") return "online";
  return room.settings.localMode === "couch" ? "party" : "solo";
}

function trackRoomEventOnce(storageKey: string, eventName: string, room: RoomState): void {
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // Analytics remains best effort when sessionStorage is unavailable.
  }
  const gameType = analyticsGameType(room);
  trackAnalyticsEvent(eventName, {
    game_type: gameType,
    game_mode: room.settings.mode,
    category: room.settings.category,
    planned_rounds: room.settings.rounds,
    player_count: room.players.length
  });
  void fetch("/api/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: eventName,
      gameType,
      gameMode: room.settings.mode,
      category: room.settings.category,
      plannedRounds: room.settings.rounds,
      playerCount: room.players.length
    }),
    keepalive: true
  }).catch(() => undefined);
}

function SvgPin({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 64 84" aria-hidden="true" className={className}>
      <path
        d="M32 82C32 82 6 48 6 28C6 12.5 17.6 3 32 3C46.4 3 58 12.5 58 28C58 48 32 82 32 82Z"
        fill="white"
      />
      <path
        d="M32 73C32 73 13 45 13 28C13 16.4 21.2 9 32 9C42.8 9 51 16.4 51 28C51 45 32 73 32 73Z"
        fill={color}
      />
      <circle cx="32" cy="27" r="12" fill="white" />
    </svg>
  );
}

function HeroMapPreview() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      <HomeMapPreview />
    </div>
  );
}

function SoundToggle() {
  const { enabled, toggle } = useSound();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ring-1 transition ${
        enabled
          ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/50"
          : "bg-slate-950/70 text-slate-400 ring-slate-600/80 hover:text-slate-200"
      }`}
      title={enabled ? "Sound ausschalten" : "Sound einschalten"}
      aria-pressed={enabled}
    >
      Sound {enabled ? "an" : "aus"}
    </button>
  );
}

function ServerStatus({ status }: { status: "connecting" | "open" | "closed" }) {
  const [visibleStatus, setVisibleStatus] = useState<"open" | "closed">("open");
  const offlineTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "open") {
      if (offlineTimerRef.current !== null) window.clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
      setVisibleStatus("open");
      return;
    }

    if (offlineTimerRef.current === null) {
      offlineTimerRef.current = window.setTimeout(() => {
        offlineTimerRef.current = null;
        setVisibleStatus("closed");
      }, 5000);
    }
  }, [status]);

  useEffect(() => () => {
    if (offlineTimerRef.current !== null) window.clearTimeout(offlineTimerRef.current);
  }, []);

  const label = visibleStatus === "open" ? "Server an" : "Server aus";
  const title = visibleStatus === "open"
    ? status === "open" ? "Raumserver ist verbunden" : "Verbindung zum Raumserver wird geprüft"
    : "Raumserver ist seit mindestens fünf Sekunden nicht verbunden";

  return (
    <span
      role="status"
      aria-live="polite"
      title={title}
      className={`inline-flex min-h-[24px] items-center rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ring-1 ${
        visibleStatus === "open"
          ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/50"
          : "bg-rose-400/10 text-rose-200 ring-rose-300/50"
      }`}
    >
      {label}
    </span>
  );
}

function HomeStatusControls({ serverStatus, placement }: { serverStatus: "connecting" | "open" | "closed"; placement: "hero" | "side" }) {
  return (
    <div className={`punktlandung-home-statuses punktlandung-home-statuses--${placement}`}>
      <ServerStatus status={serverStatus} />
      <SoundToggle />
    </div>
  );
}

function appPathWithMode(mode: GameSettings["localMode"] | "online"): string {
  if (mode === "solo") return "/solo-modus";
  if (mode === "couch") return "/party-modus";
  return "/online-modus";
}

function modeFromPathname(pathname: string): Exclude<InitialGameMode, "home"> | null {
  if (pathname === "/solo-modus") return "solo";
  if (pathname === "/party-modus") return "couch";
  if (pathname === "/online-modus") return "online";
  return null;
}

function roomMatchesInitialMode(room: RoomState | null, mode: Exclude<InitialGameMode, "home">) {
  if (!room) return false;
  if (mode === "online") return room.kind === "online";
  return room.kind === "solo" && room.settings.localMode === mode;
}

function statusLabel(status: RequiredGameStatus) {
  if (status === "guessing") return "laufende Runde";
  if (status === "results") return "Rundenauswertung";
  return "Endergebnis";
}

function GameStateGuard({ requiredStatus, currentStatus }: { requiredStatus: RequiredGameStatus; currentStatus?: RoundStatus }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50">
      <section className="arcade-panel w-full max-w-md rounded-xl border-slate-700/80 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Punktlandung</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">Keine passende Spielrunde</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Fuer diese Seite brauchst du eine {statusLabel(requiredStatus)} im aktuellen Browser. Aktueller Status: {currentStatus ?? "keine aktive Runde"}.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href="/solo-modus"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-400/14 px-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-100 ring-1 ring-emerald-300/65 transition hover:bg-emerald-400/20"
          >
            Solo
          </a>
          <a
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950/70 px-4 text-sm font-black uppercase tracking-[0.1em] text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-900"
          >
            Startseite
          </a>
        </div>
      </section>
    </main>
  );
}

function OnlineWaitingRoomGuard() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50">
      <section className="arcade-panel w-full max-w-md rounded-xl border-slate-700/80 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Online-Warteraum</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">Kein aktiver Warteraum</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Öffne zuerst online einen Raum. Danach ist der Warteraum mit QR-Code und Raumcode hier erreichbar.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href="/online-modus"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-400/14 px-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-100 ring-1 ring-emerald-300/65 transition hover:bg-emerald-400/20"
          >
            Online-Raum
          </a>
          <a
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950/70 px-4 text-sm font-black uppercase tracking-[0.1em] text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-900"
          >
            Startseite
          </a>
        </div>
      </section>
    </main>
  );
}

export function GameApp({
  initialMode = "home",
  directStart = false,
  requiredStatus,
  requireOnlineWaitingRoom = false,
  accountsEnabled = false,
  accountAuthenticated = false,
  rankedGamesEnabled = false,
  accountDisplayName = null,
  resumeRankedGame = false
}: {
  initialMode?: InitialGameMode;
  directStart?: boolean;
  requiredStatus?: RequiredGameStatus;
  requireOnlineWaitingRoom?: boolean;
  accountsEnabled?: boolean;
  accountAuthenticated?: boolean;
  rankedGamesEnabled?: boolean;
  accountDisplayName?: string | null;
  resumeRankedGame?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const routeInitialMode: InitialLocalGameMode | undefined = initialMode === "home" ? undefined : initialMode;
  const localGame = useLocalGame(routeInitialMode, shouldRestoreLocalSession(requiredStatus, Boolean(directStart)));
  // An explicit signed guest resume link must use the server-backed ranked
  // game even when no player account is signed in. Falling back to useLocalGame
  // here can silently replace the requested game with an unrelated browser
  // session.
  // Rankings-enabled Solo games are server-backed for signed-in players and
  // guests alike. A deliberately restored legacy-local session keeps priority
  // so an older in-progress game is never silently replaced.
  const rankedSoloEnabled = Boolean(rankedGamesEnabled) || resumeRankedGame;
  // Opening the normal setup or direct-play route always starts a fresh flow.
  // Stored ranked games are restored only on gameplay/result routes or through
  // the explicit "Spiel fortsetzen" action.
  const rankedSoloRestoreEnabled = shouldRestoreRankedSoloSession(requiredStatus, resumeRankedGame);
  const rankedSoloGame = useRankedSoloGame(
    rankedSoloEnabled,
    rankedSoloRestoreEnabled,
    accountAuthenticated,
    accountAuthenticated || resumeRankedGame
  );
  const routeAllowsRankedSolo = initialMode !== "couch" && initialMode !== "online";
  const localRequiredSessionHasPriority = preferLocalRequiredSession(
    requiredStatus,
    localGame.restoring,
    localGame.room?.status
  );
  const localSetupSessionHasPriority = initialMode === "solo"
    && (localGame.restoring || Boolean(localGame.resumePending) || (localGame.room?.status !== undefined && localGame.room.status !== "lobby"));
  const rankedSoloContext = shouldUseRankedSoloSession({
    rankedGamesEnabled: rankedSoloEnabled,
    resumeRankedGame,
    routeAllowsRankedSolo,
    localSessionHasPriority: localRequiredSessionHasPriority || localSetupSessionHasPriority,
    onSoloFlow: resumeRankedGame || Boolean(requiredStatus) || initialMode === "solo"
  });
  const rankedRestoring = rankedSoloContext && rankedSoloGame.restoring;
  const onlineGame = useOnlineRoomSocket();
  const { enabled: soundEnabled, toggle: toggleSound, playSelect } = useSound();
  const [name, setName] = useState(accountDisplayName || "Spieler 1");
  const [password, setPassword] = useState("");
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [pendingOnlineSettings, setPendingOnlineSettings] = useState<GameSettings | null>(null);
  const [startingRound, setStartingRound] = useState(false);
  const [pendingGameplayExit, setPendingGameplayExit] = useState<{
    target: string;
    action: "cancel" | "restart" | "leave";
  } | null>(null);
  const initialModeHandledRef = useRef(false);
  const initialSetupSettingsHandledRef = useRef(false);
  const pendingDirectStartRef = useRef(false);
  const directStartConsumedRef = useRef(false);

  useEffect(() => {
    if (!directStart) directStartConsumedRef.current = false;
  }, [directStart]);

  const isOnlineFlow = Boolean(onlineGame.room) || Boolean(pendingJoinCode);
  const singlePlayerGame = rankedSoloContext ? rankedSoloGame : localGame;
  const activeGame = isOnlineFlow ? onlineGame : singlePlayerGame;
  const {
    playerId,
    room,
    error,
    status,
    isHost,
    me,
    clearError,
    updateSettings,
    renamePlayer,
    startRound,
    submitGuess,
    cancelRound,
    skipLocation,
    restart,
    leaveRoom,
    setTeam,
    readyNextRound
  } = activeGame;
  const resumePending = "resumePending" in activeGame && activeGame.resumePending;
  const resumeRound = "resumeRound" in activeGame ? activeGame.resumeRound : undefined;
  const discardResume = "discardResume" in activeGame ? activeGame.discardResume : undefined;
  const serverRankedRoom = isServerRankedSoloRoom(room);
  const activeRankedGameId = serverRankedRoom ? rankedSoloGame.gameId : undefined;
  const restorationPending = isOnlineFlow
    ? onlineGame.restoring
    : rankedSoloContext
      ? rankedRestoring
      : localGame.restoring;
  const gameplayRoute = gameplayRouteForStatus(room?.status, Boolean(resumePending));
  const pathnameGameplayStatus = gameplayStatusForRoute(pathname ?? "");
  const routeRequiredStatus = pathname ? pathnameGameplayStatus : requiredStatus;
  const requestedGameplayRouteRef = useRef<string | null>(null);
  const resultPreparationKeyRef = useRef<string | null>(null);
  const [resultExperienceReady, setResultExperienceReady] = useState(false);

  useEffect(() => {
    if (!room || room.status === "lobby") {
      resultPreparationKeyRef.current = null;
      setResultExperienceReady(false);
      return;
    }
    const preparationKey = `${room.code}:${room.currentRound}:${room.location?.id ?? "resolved"}`;
    if (resultPreparationKeyRef.current === preparationKey) return;
    resultPreparationKeyRef.current = preparationKey;
    setResultExperienceReady(false);
    void prepareResultExperience().then(() => {
      if (resultPreparationKeyRef.current === preparationKey) setResultExperienceReady(true);
    });
  }, [room?.code, room?.currentRound, room?.location?.id, room?.status]);

  const resultTransitionPending = Boolean(
    room && (room.status === "results" || room.status === "finished") && !resultExperienceReady
  );
  const synchronizedGameplayRoute = resultTransitionPending && pathname === "/spielen" ? "/spielen" : gameplayRoute;
  const gameplayRouteMismatch = Boolean(pathnameGameplayStatus && synchronizedGameplayRoute && pathname !== synchronizedGameplayRoute);

  useEffect(() => {
    if (pathname === synchronizedGameplayRoute) {
      requestedGameplayRouteRef.current = null;
      return;
    }
    if (!synchronizedGameplayRoute || !shouldSynchronizeGameplayRoute({
      pathname: pathname ?? "",
      targetRoute: synchronizedGameplayRoute,
      restorationPending,
      intentionalExitPending: Boolean(pendingGameplayExit)
    })) return;
    if (requestedGameplayRouteRef.current === synchronizedGameplayRoute) return;
    requestedGameplayRouteRef.current = synchronizedGameplayRoute;
    // All three routes share the persistent gameplay layout, so this URL
    // change no longer remounts GameApp or exposes an empty transition frame.
    router.replace(synchronizedGameplayRoute);
  }, [pathname, pendingGameplayExit, restorationPending, router, synchronizedGameplayRoute]);

  useEffect(() => {
    if (!room || room.status === "lobby" || resumePending || restorationPending || pathname !== gameplayRoute) return;
    const handleGameHistoryReturn = () => {
      const setupPath = room.kind === "online" ? "/online-modus" : room.settings.localMode === "couch" ? "/party-modus" : "/solo-modus";
      if (room.status === "finished") {
        clearSetupResumeRequest();
        window.location.replace(setupPath);
        return;
      }
      const resumeKind = rankedSoloContext && room.kind === "solo" ? "ranked" : "local";
      requestSetupResume(resumeKind);
      window.location.replace(setupResumeUrl(setupPath, resumeKind));
    };
    window.addEventListener("popstate", handleGameHistoryReturn);

    const currentState = window.history.state;
    const boundaryState = currentState && typeof currentState === "object"
      ? currentState[gameBackBoundaryStateKey]
      : undefined;
    if (boundaryState !== "guard") {
      const stateBase = currentState && typeof currentState === "object" ? currentState : {};
      window.history.replaceState({ ...stateBase, [gameBackBoundaryStateKey]: "base" }, "");
      window.history.pushState({ ...stateBase, [gameBackBoundaryStateKey]: "guard" }, "");
    }

    return () => window.removeEventListener("popstate", handleGameHistoryReturn);
  }, [gameplayRoute, pathname, rankedSoloContext, restorationPending, resumePending, room]);
  const markLocationReady = "markLocationReady" in activeGame ? activeGame.markLocationReady : undefined;
  const captureGuess = "captureGuess" in activeGame ? activeGame.captureGuess : undefined;

  useEffect(() => {
    if (!room) return;
    if (room.status === "guessing" && room.currentRound === 1 && room.summaries.length === 0 && room.roundStartedAt) {
      trackRoomEventOnce(`${trackedGameStartPrefix}${room.roundStartedAt}`, "game_start", room);
    }
    if (room.status === "finished") {
      const completedAt = room.summaries.at(-1)?.completedAt;
      if (!completedAt) return;
      trackRoomEventOnce(`${trackedGameCompletePrefix}${completedAt}`, "game_complete", room);
    }
  }, [room]);

  useEffect(() => {
    try {
      const savedName = accountDisplayName ? null : window.localStorage.getItem("punktlandung-name");
      if (savedName) setName(savedName);
    } catch {
      // Local storage can be unavailable in restricted browser modes.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("punktlandung-name", name);
    } catch {
      // Keep the UI usable even when persistence is blocked.
    }
  }, [name]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam === null) return;
    const roomCode = normalizeOnlineRoomCode(roomParam);
    setJoinCodeInput(roomCode);
    const validationMessage = onlineRoomCodeValidationMessage(roomCode);
    if (validationMessage) {
      setPendingJoinCode(null);
      setJoinCodeError(validationMessage);
      return;
    }
    setJoinCodeError(null);
    setPendingJoinCode(roomCode);
  }, [accountDisplayName]);

  useEffect(() => {
    if (!accountDisplayName) return;
    setName(accountDisplayName);
    if (rankedSoloGame.room?.players[0] && rankedSoloGame.room.players[0].name !== accountDisplayName) {
      rankedSoloGame.renamePlayer(rankedSoloGame.room.players[0].id, accountDisplayName);
    }
    const localAccountPlayer = localGame.room?.players.find((player) => player.id === localGame.playerId);
    if (localAccountPlayer && localAccountPlayer.name !== accountDisplayName) {
      localGame.renamePlayer(localAccountPlayer.id, accountDisplayName);
    }
  }, [accountDisplayName, localGame, rankedSoloGame]);

  useEffect(() => {
    if (!accountAuthenticated) return;
    const flush = () => void flushCompletedGameSaves(saveCompletedGame);
    flush();
    window.addEventListener("online", flush);
    window.addEventListener("pageshow", flush);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("pageshow", flush);
    };
  }, [accountAuthenticated]);

  useEffect(() => {
    const setupGame = rankedSoloContext ? rankedSoloGame : localGame;
    if (rankedRestoring || localGame.restoring) return;
    if (initialSetupSettingsHandledRef.current || !setupGame.room || setupGame.room.status !== "lobby") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("rounds") && !params.has("time")) {
      initialSetupSettingsHandledRef.current = true;
      return;
    }
    const difficulty = params.get("difficulty");
    setupGame.updateSettings({
      rounds: Number(params.get("rounds")) || (setupGame.room?.settings.rounds ?? 15),
      timeLimitSec: Number(params.get("time")) || 0,
      category: (params.get("category") || setupGame.room?.settings.category || "mixed") as GameSettings["category"],
      difficulty: difficulty === "mixed" || difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
        ? difficulty
        : (setupGame.room?.settings.difficulty ?? "medium"),
      noMove: params.get("noMove") === "1",
      noPan: params.get("noPan") === "1",
      noZoom: params.get("noZoom") === "1"
    });
    initialSetupSettingsHandledRef.current = true;
  }, [localGame, rankedRestoring, rankedSoloContext, rankedSoloGame]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (rankedRestoring || localGame.restoring) return;
    const requestedRoomCode = params.get("room");
    if (requestedRoomCode && !onlineRoomCodeValidationMessage(normalizeOnlineRoomCode(requestedRoomCode))) return;
    const queryMode = params.get("mode");
    const pathMode = modeFromPathname(window.location.pathname);
    const routeMode = initialMode === "home" ? pathMode : initialMode;
    const mode = queryMode ?? routeMode;
    if (mode !== "solo" && mode !== "couch" && mode !== "online") return;
    const modeGame = mode === "solo" && rankedSoloContext ? rankedSoloGame : localGame;
    let directStartRequested = (directStart || params.get("direct") === "1") && mode === "solo";
    try {
      if (mode === "solo" && window.sessionStorage.getItem("punktlandung-direct-start") === "1") {
        directStartRequested = true;
        window.sessionStorage.removeItem("punktlandung-direct-start");
      }
    } catch {
      // The explicit route prop/query remains available as a fallback.
    }
    if (roomMatchesInitialMode(modeGame.room, mode)) {
      initialModeHandledRef.current = true;
      if (directStartRequested && !directStartConsumedRef.current && modeGame.room?.status === "lobby") {
        directStartConsumedRef.current = true;
        setStartingRound(true);
        void Promise.resolve(modeGame.startRound()).finally(() => setStartingRound(false));
      }
      return;
    }
    if (initialModeHandledRef.current) return;

    initialModeHandledRef.current = true;
    setPendingJoinCode(null);
    pendingDirectStartRef.current = directStartRequested;
    if (routeMode) {
      try {
        window.localStorage.removeItem(activeSessionStorageKey);
      } catch {
        // Ignore storage restrictions; the route-owned mode still opens in memory.
      }
    }
    let playerName = name;
    try {
      playerName = accountDisplayName || window.localStorage.getItem("punktlandung-name") || name;
    } catch {
      // Keep URL-start usable when localStorage is unavailable.
    }

    if (mode === "solo") {
      modeGame.createSolo(playerName, mode);
      return;
    }
    if (mode === "couch") {
      localGame.createSolo(playerName, mode);
      return;
    }

    localGame.createOnlineSetup({
      hostParticipation: "host_player",
      playerName
    });
  }, [accountDisplayName, directStart, initialMode, localGame, name, rankedRestoring, rankedSoloContext, rankedSoloGame]);

  useEffect(() => {
    if (!pendingDirectStartRef.current) return;
    const startGame = rankedSoloContext ? rankedSoloGame : localGame;
    if (!startGame.room || startGame.room.status !== "lobby" || startGame.room.settings.localMode !== "solo") return;
    pendingDirectStartRef.current = false;
    directStartConsumedRef.current = true;
    setStartingRound(true);
    void Promise.resolve(startGame.startRound()).finally(() => setStartingRound(false));
  }, [localGame.room, rankedSoloContext, rankedSoloGame.room]);

  useEffect(() => {
    if (!pendingOnlineSettings || !onlineGame.room || !onlineGame.isHost || onlineGame.room.status !== "lobby") return;
    onlineGame.updateSettings(pendingOnlineSettings);
    setPendingOnlineSettings(null);
  }, [pendingOnlineSettings, onlineGame]);

  const handleCreateLiveOnlineRoom = () => {
    trackAnalyticsEvent("online_room_create_attempt");
    if (localGame.room?.kind === "online") setPendingOnlineSettings(localGame.room.settings);
    const hostParticipation = localGame.room?.hostParticipation ?? "host_only";
    onlineGame.createOnlineRoom({
      hostParticipation,
      playerName: hostParticipation === "host_player" ? localGame.room?.hostPlayerName ?? name : undefined
    });
  };
  const handleJoinByCode = (codeInput: string) => {
    const roomCode = normalizeOnlineRoomCode(codeInput);
    const validationMessage = onlineRoomCodeValidationMessage(roomCode);
    setJoinCodeInput(roomCode);
    setJoinCodeError(validationMessage);
    if (validationMessage) return;
    playSelect();
    setPendingJoinCode(roomCode);
    router.replace(onlineRoomPath(roomCode));
  };
  const handleJoinOnlineRoom = () => {
    if (!pendingJoinCode) return;
    const playerName = name.trim();
    if (onlineGame.status !== "open" || playerName.length === 0) return;
    playSelect();
    trackAnalyticsEvent("online_room_join_attempt");
    onlineGame.joinRoom(pendingJoinCode, playerName);
  };
  const handleJoinOnlineRoomSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleJoinOnlineRoom();
  };
  const handleDirectPlay = () => {
    playSelect();
    setPendingJoinCode(null);
    try {
      // The dedicated /solo-modus/direct route owns the one-shot start.
      // Leaving a second session flag behind could start the same transition
      // twice while the homepage component was unmounting.
      window.sessionStorage.removeItem("punktlandung-direct-start");
      clearSetupResumeRequest();
      window.localStorage.removeItem(activeSessionStorageKey);
      window.localStorage.removeItem("punktlandung-ranked-active-game-v1");
    } catch {
      // The explicit direct route remains sufficient without browser storage.
    }
  };
  const handleModeSelect = (_href: string) => {
    playSelect();
    try {
      clearSetupResumeRequest();
      window.localStorage.removeItem(activeSessionStorageKey);
      window.localStorage.removeItem("punktlandung-ranked-active-game-v1");
    } catch {
      // Explicit mode navigation still works when browser storage is unavailable.
    }
  };
  const handleUpdateSettings = (settings: Partial<GameSettings>) => {
    updateSettings(settings);
  };
  const handleStartRound = async () => {
    if (startingRound) return;
    if (rankedSoloContext && room?.kind === "solo" && room.status === "lobby") {
      try {
        window.localStorage.removeItem(activeSessionStorageKey);
        const currentHistoryState = window.history.state;
        window.history.replaceState(
          {
            ...(currentHistoryState && typeof currentHistoryState === "object" ? currentHistoryState : {}),
            appState: historyStateKey,
            room: null
          },
          ""
        );
      } catch {
        // The new server-backed game remains authoritative in memory when
        // browser persistence is unavailable.
      }
    }
    setStartingRound(true);
    try {
      await Promise.resolve(startRound());
    } finally {
      setStartingRound(false);
    }
  };
  const handleResumeRound = () => {
    if (!resumePending || !resumeRound) return;
    clearVisibleResumeSetup();
    resumeRound();
    const resumeRoute = room?.status === "finished" ? "/endergebnis" : room?.status === "results" ? "/aufloesung" : "/spielen";
    router.replace(resumeRoute);
  };
  const freshStartAfterResumeRef = useRef(false);
  const handleStartNewRound = () => {
    if (!resumePending || !discardResume) {
      void handleStartRound();
      return;
    }
    freshStartAfterResumeRef.current = true;
    discardResume();
  };

  useEffect(() => {
    if (!freshStartAfterResumeRef.current || resumePending || room?.status !== "lobby") return;
    freshStartAfterResumeRef.current = false;
    void handleStartRound();
  }, [resumePending, room?.status]);
  const handleSubmitGuess = (guess: LatLng & { countryCode?: string }, targetPlayerId?: string, capture?: GuessCapture) => submitGuess(guess, targetPlayerId, capture);
  const handleSetTeam = (team: TeamId) => setTeam(team);
  const handleCancelRound = () => {
    const resultRouteTarget = requiredStatus
      ? room?.kind === "online"
        ? "/online-modus"
        : room?.settings.localMode === "couch"
          ? "/party-modus"
          : "/solo-modus"
      : null;
    const setupRouteTarget = room?.kind === "online"
      ? "/online-modus"
      : room?.settings.localMode === "couch"
        ? "/party-modus"
        : "/solo-modus";
    const onSetupRoute = window.location.pathname === setupRouteTarget;
    // A completed game may still be restored on /endergebnis for saving and
    // claiming, but it is no longer a playable session. Leaving the final
    // screen therefore opens a clean setup instead of advertising "Fortsetzen".
    if (room?.status === "finished") {
      clearSetupResumeRequest();
      setPendingGameplayExit({ target: setupRouteTarget, action: "cancel" });
      router.replace(setupRouteTarget);
      return;
    }
    // Leaving an active round must not cancel it. The setup route can restore
    // the same room, while its absolute deadline keeps running in the background.
    if (room && room.status !== "lobby" && shouldOfferSetupResume(requiredStatus, onSetupRoute, Boolean(directStart))) {
      requestSetupResume(rankedSoloContext && room.kind === "solo" ? "ranked" : "local");
      const resumeQuery = room.kind === "solo"
        ? rankedSoloContext
          ? "?resume=ranked"
          : "?resume=1"
        : "";
      const resumeUrl = `${resultRouteTarget ?? setupRouteTarget}${resumeQuery}`;
      if (onSetupRoute || directStart) {
        window.location.assign(resumeUrl);
      } else {
        router.replace(resumeUrl);
      }
      return;
    }
    cancelRound();
    // /endergebnis and /aufloesung are guarded routes: after leaving the
    // result, the room is intentionally a lobby and therefore cannot remain
    // on those routes. Otherwise the guard immediately reports "Keine
    // passende Spielrunde" even though the user simply clicked Zurück.
    if (resultRouteTarget) {
      router.replace(resultRouteTarget);
      return;
    }
    if (window.location.pathname === "/solo-modus/direct") {
      try {
        window.sessionStorage.removeItem("punktlandung-direct-start");
      } catch {
        // Route replacement remains sufficient when sessionStorage is unavailable.
      }
      router.replace("/solo-modus");
    }
  };
  const handleRestart = () => {
    const setupRouteTarget = room?.kind === "online"
      ? "/online-modus"
      : room?.settings.localMode === "couch"
        ? "/party-modus"
        : "/solo-modus";
    clearSetupResumeRequest();
    setPendingGameplayExit({ target: setupRouteTarget, action: "restart" });
    router.replace(setupRouteTarget);
  };
  const discardSessionForNavigation = () => {
    leaveRoom();
    try {
      clearSetupResumeRequest();
      clearVisibleResumeSetup();
      window.sessionStorage.setItem(sessionResetStorageKey, "1");
      window.localStorage.removeItem(activeSessionStorageKey);
      window.localStorage.removeItem("punktlandung-ranked-active-game-v1");
      const currentHistoryState = window.history.state;
      window.history.replaceState(
        {
          ...(currentHistoryState && typeof currentHistoryState === "object" ? currentHistoryState : {}),
          appState: historyStateKey,
          room: null
        },
        ""
      );
    } catch {
      // The in-memory leave still works when browser storage is unavailable.
    }
  };
  const handleLeaveToHome = () => {
    initialModeHandledRef.current = true;
    setPendingJoinCode(null);
    setPendingGameplayExit({ target: "/", action: "leave" });
    router.push("/");
  };

  useEffect(() => {
    if (!pendingGameplayExit || pathname !== pendingGameplayExit.target) return;
    if (pendingGameplayExit.action === "restart") {
      restart();
    } else if (pendingGameplayExit.action === "leave") {
      discardSessionForNavigation();
    } else {
      cancelRound();
    }
    setPendingGameplayExit(null);
  }, [cancelRound, pathname, pendingGameplayExit, restart]);

  useEffect(() => {
    if (!resumePending || !room) return;
    markResumeSetupVisible();
    const setupPath = room.kind === "online"
      ? "/online-modus"
      : room.settings.localMode === "couch"
        ? "/party-modus"
        : "/solo-modus";
    const handleSetupHistoryExit = () => {
      // Next applies the destination route immediately after popstate. Read it
      // in the next task so we do not mistake the still-visible setup URL for
      // the actual Back destination.
      window.setTimeout(() => {
        if (!shouldDiscardResumeOnHistoryExit(Boolean(resumePending), setupPath, window.location.pathname)) return;
        // A second browser-Back from setup to another page is a deliberate exit.
        // Convert the cached setup component to a clean lobby before removing
        // durable recovery markers. Next may reuse that component on browser
        // Forward; leaving it with room=null would otherwise render an empty
        // shell even though the old game itself was correctly discarded.
        if (discardResume) discardResume();
        else leaveRoom();
        clearSetupResumeRequest();
        clearVisibleResumeSetup();
        try {
          window.sessionStorage.setItem(sessionResetStorageKey, "1");
          window.localStorage.removeItem(activeSessionStorageKey);
          window.localStorage.removeItem("punktlandung-ranked-active-game-v1");
        } catch {
          // The cached in-memory lobby still prevents a stale resume action.
        }
      }, 0);
    };
    window.addEventListener("popstate", handleSetupHistoryExit);
    return () => window.removeEventListener("popstate", handleSetupHistoryExit);
  }, [discardResume, leaveRoom, resumePending, room]);
  const handleLeaveWaitingRoom = () => {
    initialModeHandledRef.current = true;
    setPendingJoinCode(null);
    onlineGame.leaveRoom();
    if (window.location.pathname !== "/online-modus") {
      window.location.replace("/online-modus");
    }
  };

  if (initialMode !== "home" && !room && !pendingJoinCode) {
    // This exists only for the first client render while the route-owned room
    // is initialized. Do not turn it into a visible loading interstitial.
    return <main className="min-h-dvh bg-slate-950" />;
  }

  if (routeRequiredStatus && shouldShowGameplayRestoration({
    requiredStatus: routeRequiredStatus,
    currentStatus: room?.status,
    restorationPending
  })) {
    return <GameplayRestoringView requiredStatus={routeRequiredStatus} />;
  }

  if (routeRequiredStatus && shouldShowGameplayStateGuard({
    requiredStatus: routeRequiredStatus,
    currentStatus: room?.status,
    restorationPending,
    gameplayRouteMismatch,
    intentionalExitPending: Boolean(pendingGameplayExit)
  })) {
    return <GameStateGuard requiredStatus={routeRequiredStatus} currentStatus={room?.status} />;
  }

  if (requireOnlineWaitingRoom && !onlineGame.room) {
    return <OnlineWaitingRoomGuard />;
  }

  if (pendingJoinCode && !onlineGame.room) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50">
        <section className="arcade-panel w-full max-w-md rounded-md border-slate-700/80 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Online-Raum</p>
          <h1 className="mt-2 text-3xl font-black leading-tight">Raum beitreten</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Du trittst Raum {pendingJoinCode} bei. Wähle einen Namen für die Spielerliste.</p>
          <form onSubmit={handleJoinOnlineRoomSubmit}>
            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={18}
                className="mt-2 h-12 w-full rounded-md border-0 bg-slate-950/70 px-3.5 text-base font-black text-white outline-none ring-1 ring-slate-700 transition focus:ring-2 focus:ring-emerald-300"
              />
            </label>
            <button
              type="submit"
              disabled={onlineGame.status !== "open" || name.trim().length === 0}
              className="mt-4 min-h-12 w-full rounded-md bg-emerald-400/14 px-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-100 ring-1 ring-emerald-300/65 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500 disabled:ring-slate-700"
            >
              {onlineGame.status === "open" ? "Beitreten" : "Verbinde Raumserver"}
            </button>
          </form>
          {onlineGame.error && (
            <button type="button" onClick={onlineGame.clearError} className="mt-3 w-full rounded-md bg-rose-950 px-3 py-2 text-sm font-black text-rose-100 ring-1 ring-rose-500/70">
              {onlineGame.error}
            </button>
          )}
        </section>
      </main>
    );
  }

  if (room?.status === "guessing" && !resumePending) {
    return (
      <GameView
        room={room}
        me={me}
        isHost={isHost}
        onGuess={handleSubmitGuess}
        onGuessCapture={captureGuess}
        onCancelRound={handleCancelRound}
        onSkipLocation={skipLocation}
        onImageReady={markLocationReady}
        onLeave={handleLeaveToHome}
        redesign={redesignHomeEnabled}
        rankedSyncStatus={rankedSoloContext ? rankedSoloGame.syncStatus : undefined}
        pendingUploadCount={rankedSoloContext ? rankedSoloGame.pendingUploadCount : 0}
      />
    );
  }

  if (resultTransitionPending && !resumePending) {
    return <GameplayRestoringView requiredStatus="results" preparing />;
  }

  if ((room?.status === "results" || room?.status === "finished") && !resumePending) {
    return (
      <ResultsView
        room={room}
        isHost={isHost}
        meId={playerId}
        onNext={handleStartRound}
        onReadyNextRound={readyNextRound}
        onBackToLobby={handleCancelRound}
        onRestart={handleRestart}
        onLeave={handleLeaveToHome}
        onDiscardSession={discardSessionForNavigation}
        redesign={redesignHomeEnabled}
        accountsEnabled={accountsEnabled}
        accountAuthenticated={accountAuthenticated}
        serverRanked={serverRankedRoom}
        rankedGameId={activeRankedGameId}
        rankedSyncStatus={serverRankedRoom ? rankedSoloGame.syncStatus : undefined}
        pendingUploadCount={serverRankedRoom ? rankedSoloGame.pendingUploadCount : 0}
      />
    );
  }

  if (room && (room.status === "lobby" || resumePending)) {
    const isLiveOnlineWaitingRoom = room.kind === "online" && Boolean(onlineGame.room);
    if (redesignHomeEnabled && isLiveOnlineWaitingRoom) {
      return (
        <RedesignWaitingRoomView
          code={room.code}
          players={room.players}
          meId={playerId}
          isHost={isHost}
          settings={room.settings}
          hostParticipation={room.hostParticipation}
          connectionStatus={onlineGame.status}
          soundEnabled={soundEnabled}
          accountHref={accountsEnabled ? "/konto" : undefined}
          accountAuthenticated={accountAuthenticated}
          canStart={Boolean(onlineGame.room)}
          onStart={handleStartRound}
          onTeam={handleSetTeam}
          onLeave={handleLeaveWaitingRoom}
          onSoundToggle={toggleSound}
        />
      );
    }
    if (redesignHomeEnabled && !isLiveOnlineWaitingRoom) {
      return (
        <RedesignSetupView
          roomKind={room.kind}
          settings={room.settings}
          players={room.players}
          playerName={name}
          hostParticipation={room.hostParticipation}
          connectionStatus={onlineGame.status}
          soundEnabled={soundEnabled}
          accountHref={accountsEnabled ? "/konto" : undefined}
          accountAuthenticated={accountAuthenticated}
          error={error}
          joinCode={joinCodeInput}
          joinCodeError={joinCodeError}
          canStart={!startingRound && (room.kind === "online" ? onlineGame.status === "open" : isHost && room.players.length > 0)}
          starting={startingRound}
          resumePending={resumePending}
          onSettings={handleUpdateSettings}
          onRenamePlayer={renamePlayer}
          onHostParticipationChange={room.kind === "online" ? localGame.updateHostParticipation : undefined}
          onStart={room.kind === "online" ? handleCreateLiveOnlineRoom : handleStartNewRound}
          onResume={resumePending ? handleResumeRound : undefined}
          onBack={handleLeaveToHome}
          onSoundToggle={toggleSound}
        />
      );
    }
    return (
      <>
        <LobbyView
          code={room.code}
          players={room.players}
          meId={playerId}
          roomKind={room.kind}
          hostParticipation={room.hostParticipation}
          hostPlayerName={room.hostPlayerName}
          isHost={isHost}
          settings={room.settings}
          onSettings={handleUpdateSettings}
          onRenamePlayer={renamePlayer}
          onStart={handleStartRound}
          onTeam={handleSetTeam}
          onLeave={room.kind === "online" && Boolean(onlineGame.room) ? handleLeaveWaitingRoom : handleLeaveToHome}
          leaveHref={room.kind === "online" && Boolean(onlineGame.room) ? "/online-modus" : "/"}
          canStart={room.kind !== "online" || Boolean(onlineGame.room)}
          isRoomOnline={room.kind !== "online" || Boolean(onlineGame.room)}
          connectionStatus={onlineGame.status}
          onHostParticipationChange={room.kind === "online" && !onlineGame.room ? localGame.updateHostParticipation : undefined}
          onCreateLiveRoom={room.kind === "online" && !onlineGame.room ? handleCreateLiveOnlineRoom : undefined}
        />
        {error && (
          <button
            onClick={clearError}
            className="fixed bottom-4 left-4 z-[100] rounded-md border-3 border-rose-500 bg-rose-950 px-4 py-3 text-sm font-black text-rose-100"
          >
            {error}
          </button>
        )}
      </>
    );
  }

  if (redesignHomeEnabled) {
    return (
      <>
        <RedesignHomeView
          playerName={name}
          connectionStatus={onlineGame.status}
          soundEnabled={soundEnabled}
          accountHref={accountsEnabled ? "/konto" : undefined}
          accountAuthenticated={accountAuthenticated}
          mapPreview={<HeroMapPreview />}
          modes={modePreview.filter((mode) => mode.available).map((mode) => ({
            id: mode.id,
            title: mode.title,
            text: mode.text,
            href: appPathWithMode(mode.id)
          }))}
          onDirectPlay={handleDirectPlay}
          onModeSelect={handleModeSelect}
          onSoundToggle={toggleSound}
        />
        {error && (
          <button
            onClick={clearError}
            className="fixed bottom-4 left-4 z-[100] rounded-md border-3 border-rose-500 bg-rose-950 px-4 py-3 text-sm font-black text-rose-100"
          >
            {error}
          </button>
        )}
      </>
    );
  }

  return (
    <>
      {ENABLE_FULLSCREEN_INTRO ? <FullscreenIntro /> : null}
      <main className="min-h-dvh overflow-x-hidden overflow-y-auto bg-slate-950 p-4 text-slate-50 lg:h-dvh lg:overflow-hidden">
      <div className="punktlandung-home-shell mx-auto grid min-h-full min-w-0 w-full max-w-[132rem] min-[2200px]:max-w-[calc(100vw-1rem)] grid-cols-1 gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px] 2xl:grid-cols-[180px_minmax(0,1fr)_180px] min-[1900px]:grid-cols-[220px_minmax(0,1fr)_220px] min-[2300px]:grid-cols-[260px_minmax(0,1fr)_260px]">
        <AdContainer
          placement="home-left-rail"
          variant="rail"
          adFormat="auto"
          label="Anzeige"
          className="hidden h-full min-h-0 xl:block"
          fullWidthResponsive
        />
        <div className="punktlandung-tv-home flex min-h-0 min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <section className="arcade-panel punktlandung-home-main-panel relative z-10 order-1 overflow-hidden rounded-md border-slate-700/80 lg:order-none lg:min-h-0">

          <div className="relative flex flex-col p-4 lg:h-full lg:min-h-0 lg:overflow-auto">
            <div className="punktlandung-home-header-meta">
              <PublicBetaBadge className="punktlandung-home-beta-badge" />
              <HomeStatusControls serverStatus={onlineGame.status} placement="hero" />
            </div>
            <div className="punktlandung-home-hero-copy max-w-3xl min-[2200px]:max-w-5xl">
              <div className="relative flex items-center gap-3">
                <SvgPin
                  className="order-2 h-10 w-8 shrink-0 drop-shadow-[0_0_14px_rgba(52,211,153,0.65)] md:h-11 md:w-9 min-[2200px]:h-14 min-[2200px]:w-11"
                  color="#34d399"
                />
                <h1 className="text-[2.35rem] font-black leading-[1.16] text-white md:text-5xl md:leading-[1.12] min-[2200px]:text-7xl">Punktlandung</h1>
              </div>
              <p className="mt-1.5 max-w-2xl text-xs font-bold uppercase leading-5 text-emerald-300/90 min-[2200px]:max-w-4xl min-[2200px]:text-xl min-[2200px]:leading-8">
                Wer kennt die Welt am besten?
              </p>
              <p className="mt-0.5 max-w-2xl text-sm leading-5 text-slate-200 min-[2200px]:max-w-4xl min-[2200px]:text-2xl min-[2200px]:leading-8">
                Geo-Guessing-Spiel für Städte, Flaggen, Wahrzeichen &amp; mehr.
              </p>
            </div>

            <div className="punktlandung-home-map relative mt-3.5 h-[150px] shrink-0 overflow-hidden rounded-md bg-slate-950/60 ring-1 ring-slate-700/70 sm:h-[176px] md:h-[194px] lg:h-[clamp(124px,22vh,190px)] min-[2200px]:h-[min(42vh,700px)]">
              <div className="absolute inset-0">
                <HeroMapPreview />
              </div>
            </div>

              <div className="punktlandung-home-category-heading mt-3.5 flex shrink-0 items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-base font-black leading-none text-white md:text-[22px] min-[2200px]:text-3xl">Spielkategorien</h2>
                </div>
              </div>

                  <div className="punktlandung-home-category-grid mt-4 grid flex-1 auto-rows-fr grid-cols-2 gap-4">
              {categoryOptions.map((category) => (
                <div
                  key={category.id}
                  data-category-id={category.id}
                  className={`punktlandung-home-category-card relative grid h-full min-h-[52px] grid-cols-1 items-center gap-4 overflow-hidden rounded-md px-4 py-2 sm:min-h-[clamp(48px,6.5vh,68px)] sm:grid-cols-[minmax(0,1fr)_64px] min-[2200px]:min-h-[96px] min-[2200px]:grid-cols-[minmax(0,1fr)_124px] ${
                    category.disabled
                      ? "punktlandung-preview-dash cursor-not-allowed select-none bg-slate-950/24"
                      : "bg-slate-950/50 ring-1 ring-slate-700/50"
                  }`}
                >
                  <div className="punktlandung-home-category-copy min-w-0">
                    <p className={`min-w-0 font-black leading-tight min-[2200px]:text-2xl ${category.disabled ? "text-slate-300" : "text-white"}`}>
                      <span className="punktlandung-home-category-title-line inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 hyphens-auto whitespace-normal [overflow-wrap:normal]">{category.title}</span>
                        {category.disabled && (
                          <span className="punktlandung-home-category-soon-badge shrink-0 rounded-sm border border-slate-600/80 px-2 py-0.5 text-[10px] font-black tracking-[0.08em] text-slate-400 min-[2200px]:text-sm">
                            SPÄTER
                          </span>
                        )}
                      </span>
                    </p>
                    <p className={`mt-0.5 text-xs leading-4 min-[2200px]:text-base min-[2200px]:leading-6 ${category.disabled ? "text-slate-500" : "text-slate-400"}`}>{category.short}</p>
                  </div>
                        <div className="punktlandung-home-category-art relative hidden h-10 min-w-0 -translate-x-4 items-center justify-center pr-3 sm:flex min-[2200px]:h-20 min-[2200px]:-translate-x-8">
                    <img
                      src={category.icon}
                      alt=""
                      aria-hidden="true"
                      className={`pointer-events-none h-auto w-auto object-contain ${category.disabled ? "opacity-45" : "opacity-85 drop-shadow-[0_0_12px_rgba(52,211,153,0.34)]"} ${category.homeIconClass}`}
                      draggable={false}
                    />
                  </div>
                  {!category.disabled && (
                    <span className="absolute right-2 top-2 z-10 text-xs font-black text-indigo-200 min-[2200px]:right-4 min-[2200px]:top-4 min-[2200px]:text-xl">{category.tag}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="relative z-20 order-2 lg:order-none lg:min-h-0 lg:overflow-hidden">
          <div className="punktlandung-home-side-panel arcade-panel relative flex flex-col rounded-md border-slate-700/80 p-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
            <HomeStatusControls serverStatus={onlineGame.status} placement="side" />

            <div className="punktlandung-home-login-block">
              <h2 className="text-lg font-black md:text-[22px]">Login</h2>

              <div className="mt-3 grid gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-400">Benutzername</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={18}
                    className="mt-1 h-9 w-full rounded-md border-0 bg-slate-950/70 px-3.5 text-sm text-white outline-none ring-1 ring-slate-700 transition focus:ring-2 focus:ring-indigo-400 md:text-base"
                  />
                </label>

                <label className="block cursor-not-allowed">
                  <span className="text-xs font-bold text-slate-500">Passwort</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled
                    aria-disabled="true"
                    placeholder="Noch nicht verfügbar"
                    className="mt-1 h-9 w-full cursor-not-allowed rounded-md border-0 bg-slate-950/35 px-3.5 text-sm text-slate-500 outline-none ring-1 ring-slate-700/70 placeholder:text-slate-500 disabled:opacity-100 md:text-base"
                  />
                </label>
              </div>
            </div>

            <div className="punktlandung-home-start-stack">
              <h2 className="text-lg font-black md:text-[22px]">Loslegen</h2>

              <div className="punktlandung-home-mode-list mt-3 grid gap-4">
                {modePreview.map((mode) => {
                  const isDisabled = !mode.available;
                  return (
                    <a
                      key={mode.id}
                      href={appPathWithMode(mode.id)}
                      aria-disabled={isDisabled}
                      tabIndex={isDisabled ? -1 : undefined}
                      onClick={(event) => {
                        if (isDisabled) {
                          event.preventDefault();
                          return;
                        }
                        handleModeSelect(appPathWithMode(mode.id));
                      }}
                      className={`punktlandung-home-mode-card punktlandung-interactive-surface group relative min-h-[46px] rounded-md px-3.5 py-1.5 text-left transition lg:min-h-[clamp(40px,4.5vh,52px)] ${
                        mode.available
                          ? "cursor-pointer overflow-hidden bg-slate-950/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_34px_rgba(0,0,0,0.18)] ring-1 ring-slate-600/80 hover:bg-slate-900/86 hover:ring-emerald-300/75 focus:outline-none focus:ring-2 focus:ring-emerald-300/85"
                          : "punktlandung-preview-dash bg-slate-950/28 pr-24"
                      } disabled:cursor-not-allowed disabled:hover:bg-slate-950/35 disabled:hover:ring-slate-700/70`}
                    >
                      {mode.available && (
                        <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-emerald-400/22 transition group-hover:bg-emerald-300/75" />
                      )}
                      <span className="punktlandung-home-mode-content">
                        <span className={`punktlandung-home-mode-icon punktlandung-home-mode-icon-${mode.id}`} aria-hidden="true">
                          <img src={mode.icon} alt="" draggable={false} />
                        </span>
                        <span className="min-w-0">
                          <span className={`punktlandung-home-mode-title block text-lg font-black leading-tight ${mode.available ? "text-white" : "text-slate-400"}`}>{mode.title}</span>
                          <span className={`punktlandung-home-mode-text mt-0.5 block max-w-[28ch] text-xs leading-[1.25] ${mode.available ? "text-slate-300" : "text-slate-500"}`}>{mode.text}</span>
                          {mode.available && <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300/90">Starten</span>}
                        </span>
                        {!mode.available && (
                          <span className="absolute right-3 top-3 whitespace-nowrap rounded-sm border border-slate-600/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                            {mode.badge ?? "SPÄTER"}
                          </span>
                        )}
                      </span>
                    </a>
                  );
                })}
              </div>

              <div className="punktlandung-home-room-card mt-3 rounded-md bg-slate-950/72 p-3 ring-1 ring-slate-600/80">
                <label className="block">
                  <span className="punktlandung-home-mode-content punktlandung-home-room-content">
                    <span className="punktlandung-home-mode-icon punktlandung-home-mode-icon-room" aria-hidden="true">
                      <img src="/mode-icons/online-raum3-crop.webp" alt="" draggable={false} />
                    </span>
                    <span className="punktlandung-home-room-main min-w-0">
                      <span className="punktlandung-home-room-heading">
                        <span className="punktlandung-home-mode-title block text-lg font-black leading-tight text-white">Online-Raum beitreten</span>
                      </span>
                      <span className="punktlandung-home-room-controls mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <input
                          value={joinCodeInput}
                          onChange={(event) => setJoinCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") handleJoinByCode(joinCodeInput);
                          }}
                          maxLength={6}
                          placeholder="Raumcode"
                          className="h-10 min-w-0 rounded-md border-0 bg-slate-950/70 px-3 text-sm text-white outline-none ring-1 ring-slate-700 transition placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-300 md:text-base"
                        />
                        <button
                          type="button"
                          disabled={joinCodeInput.trim().length === 0}
                          onClick={() => handleJoinByCode(joinCodeInput)}
                          className="h-10 rounded-md bg-emerald-400/12 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-100 ring-1 ring-emerald-300/50 transition hover:bg-emerald-400/18 hover:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500 disabled:ring-slate-700"
                        >
                          Beitreten
                        </button>
                      </span>
                    </span>
                  </span>
                </label>
              </div>
          </div>

            <LegalLinks includeInfos className="mt-auto pt-2 text-[12px] md:justify-start md:text-left" align="center" />
          </div>
        </aside>
        </div>
        <AdContainer
          placement="home-mobile-tablet"
          variant="banner"
          adFormat="horizontal"
          label="Anzeige"
          className="punktlandung-home-mobile-ad h-[100px] shrink-0 sm:h-[110px] xl:hidden"
          fullWidthResponsive
        />
        <AdContainer
          placement="home-right-rail"
          variant="rail"
          adFormat="auto"
          label="Anzeige"
          className="hidden h-full min-h-0 xl:block"
          fullWidthResponsive
        />
      </div>

      {error && (
        <button
          onClick={clearError}
          className="fixed bottom-4 left-4 z-[100] rounded-md border-3 border-rose-500 bg-rose-950 px-4 py-3 text-sm font-black text-rose-100"
        >
          {error}
        </button>
      )}
      </main>
    </>
  );
}
