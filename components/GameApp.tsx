"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categoryOptions } from "@/lib/categories";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useOnlineRoomSocket } from "@/hooks/useOnlineRoomSocket";
import type { InitialLocalGameMode } from "@/hooks/useLocalGame";
import type { GameSettings, LatLng, RoomState, RoundStatus, TeamId } from "@/types/game";
import { AdContainer } from "./AdContainer";
import { GameView } from "./GameView";
import { LobbyView } from "./LobbyView";
import { ResultsView } from "./ResultsView";
import { useSound } from "./SoundProvider";

const modePreview: Array<{
  id: GameSettings["localMode"] | "online";
  title: string;
  text: string;
  available: boolean;
  badge?: string;
}> = [
  { id: "solo", title: "Solo-Modus", text: "Eine Person, ein Tipp.", available: true },
  { id: "couch", title: "Party-Modus", text: "Mehrere Personen am selben Bildschirm. Jeder kann tippen", available: true },
  { id: "online", title: "Online-Modus", text: "Eigener Tipp, gegeneinander online.", available: true }
];

const legalLinks = [
  { href: "/infos", label: "Infos" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/lizenzen", label: "Lizenzen" }
];

export type InitialGameMode = "home" | GameSettings["localMode"] | "online";
export type RequiredGameStatus = Extract<RoundStatus, "guessing" | "results" | "finished">;
const activeSessionStorageKey = "punktlandung-active-session-v1";
const sessionResetStorageKey = "punktlandung-reset-session-v1";
const historyStateKey = "punktlandung-history-v1";

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
    <div className="absolute inset-0 overflow-hidden bg-[#efeae0]">
      <img
        src="/punktlandung-kartenbild.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center 64%" }}
        draggable={false}
      />
    </div>
  );
}

function SoundToggle() {
  const { enabled, toggle } = useSound();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ring-1 transition hover:-translate-y-0.5 ${
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

function GameStateLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50">
      <section className="arcade-panel w-full max-w-md rounded-md border-slate-700/80 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Punktlandung</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">Spielrunde wird geladen</h1>
      </section>
    </main>
  );
}

function GameStateGuard({ requiredStatus, currentStatus }: { requiredStatus: RequiredGameStatus; currentStatus?: RoundStatus }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50">
      <section className="arcade-panel w-full max-w-md rounded-md border-slate-700/80 p-5">
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
            Solo-Modus
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
      <section className="arcade-panel w-full max-w-md rounded-md border-slate-700/80 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Online-Warteraum</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">Kein aktiver Warteraum</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Oeffne zuerst im Online-Modus einen Raum. Danach ist der Warteraum mit QR-Code und Raumcode hier erreichbar.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href="/online-modus"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-400/14 px-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-100 ring-1 ring-emerald-300/65 transition hover:bg-emerald-400/20"
          >
            Online-Modus
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
  requiredStatus,
  requireOnlineWaitingRoom = false
}: {
  initialMode?: InitialGameMode;
  requiredStatus?: RequiredGameStatus;
  requireOnlineWaitingRoom?: boolean;
}) {
  const routeInitialMode: InitialLocalGameMode | undefined = initialMode === "home" ? undefined : initialMode;
  const localGame = useLocalGame(routeInitialMode);
  const onlineGame = useOnlineRoomSocket();
  const { playSelect } = useSound();
  const [name, setName] = useState("Geo-Gast");
  const [password, setPassword] = useState("");
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [pendingOnlineSettings, setPendingOnlineSettings] = useState<GameSettings | null>(null);
  const [routeGuardReady, setRouteGuardReady] = useState(!requiredStatus);
  const initialModeHandledRef = useRef(false);

  const isOnlineFlow = Boolean(onlineGame.room) || Boolean(pendingJoinCode);
  const activeGame = isOnlineFlow ? onlineGame : localGame;
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
    setTeam
  } = activeGame;

  useEffect(() => {
    try {
      const savedName = window.localStorage.getItem("punktlandung-name");
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
    const openButtonTargetInNewTab = (event: MouseEvent) => {
      const isMiddleClick = event.type === "auxclick" && event.button === 1;
      const isModifiedLeftClick = event.type === "click" && event.button === 0 && (event.ctrlKey || event.metaKey);
      if (!isMiddleClick && !isModifiedLeftClick) return;
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.punktlandungNewTabComponent === "true") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const opened = window.open(button.dataset.newTabHref ?? window.location.href, "_blank", "noopener,noreferrer");
      if (opened) opened.opener = null;
    };

    document.addEventListener("click", openButtonTargetInNewTab, true);
    document.addEventListener("auxclick", openButtonTargetInNewTab, true);
    return () => {
      document.removeEventListener("click", openButtonTargetInNewTab, true);
      document.removeEventListener("auxclick", openButtonTargetInNewTab, true);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? null;
    if (!roomCode) return;
    setPendingJoinCode(roomCode);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("room")) return;
    const queryMode = params.get("mode");
    const pathMode = modeFromPathname(window.location.pathname);
    const routeMode = initialMode === "home" ? pathMode : initialMode;
    const mode = queryMode ?? routeMode;
    if (mode !== "solo" && mode !== "couch" && mode !== "online") return;
    if (roomMatchesInitialMode(localGame.room, mode)) {
      initialModeHandledRef.current = true;
      return;
    }
    if (initialModeHandledRef.current) return;

    initialModeHandledRef.current = true;
    setPendingJoinCode(null);
    if (routeMode) {
      try {
        window.localStorage.removeItem(activeSessionStorageKey);
      } catch {
        // Ignore storage restrictions; the route-owned mode still opens in memory.
      }
    }
    let playerName = name;
    try {
      playerName = window.localStorage.getItem("punktlandung-name") || name;
    } catch {
      // Keep URL-start usable when localStorage is unavailable.
    }

    if (mode === "solo" || mode === "couch") {
      localGame.createSolo(playerName, mode);
      return;
    }

    localGame.createOnlineSetup({
      hostParticipation: "host_player",
      playerName
    });
  }, [initialMode, localGame, name]);

  useEffect(() => {
    if (!pendingOnlineSettings || !onlineGame.room || !onlineGame.isHost || onlineGame.room.status !== "lobby") return;
    onlineGame.updateSettings(pendingOnlineSettings);
    setPendingOnlineSettings(null);
  }, [pendingOnlineSettings, onlineGame]);

  useEffect(() => {
    if (requiredStatus) setRouteGuardReady(true);
  }, [requiredStatus]);

  const handleCreateLiveOnlineRoom = () => {
    if (localGame.room?.kind === "online") setPendingOnlineSettings(localGame.room.settings);
    const hostParticipation = localGame.room?.hostParticipation ?? "host_only";
    onlineGame.createOnlineRoom({
      hostParticipation,
      playerName: hostParticipation === "host_player" ? localGame.room?.hostPlayerName ?? name : undefined
    });
  };
  const handleJoinByCode = () => {
    const roomCode = joinCodeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!roomCode) return;
    playSelect();
    setPendingJoinCode(roomCode);
  };
  const handleJoinOnlineRoom = () => {
    if (!pendingJoinCode) return;
    playSelect();
    onlineGame.joinRoom(pendingJoinCode, name);
  };
  const handleUpdateSettings = (settings: Partial<GameSettings>) => {
    updateSettings(settings);
  };
  const handleStartRound = () => startRound();
  const handleSubmitGuess = (guess: LatLng & { countryCode?: string }, targetPlayerId?: string) => submitGuess(guess, targetPlayerId);
  const handleSetTeam = (team: TeamId) => setTeam(team);
  const handleLeaveToHome = () => {
    initialModeHandledRef.current = true;
    setPendingJoinCode(null);
    try {
      window.sessionStorage.setItem(sessionResetStorageKey, "1");
      window.localStorage.removeItem(activeSessionStorageKey);
      window.history.replaceState({ appState: historyStateKey, room: null }, "");
    } catch {
      // The in-memory leave still works when browser storage is unavailable.
    }
    leaveRoom();
    window.location.href = "/";
  };

  if (requiredStatus && !routeGuardReady) {
    return <GameStateLoading />;
  }

  if (requiredStatus && room?.status !== requiredStatus) {
    return <GameStateGuard requiredStatus={requiredStatus} currentStatus={room?.status} />;
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
            type="button"
            disabled={onlineGame.status !== "open" || name.trim().length === 0}
            onClick={handleJoinOnlineRoom}
            className="mt-4 min-h-12 w-full rounded-md bg-emerald-400/14 px-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-100 ring-1 ring-emerald-300/65 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500 disabled:ring-slate-700"
          >
            {onlineGame.status === "open" ? "Beitreten" : "Verbinde Raumserver"}
          </button>
          {onlineGame.error && (
            <button type="button" onClick={onlineGame.clearError} className="mt-3 w-full rounded-md bg-rose-950 px-3 py-2 text-sm font-black text-rose-100 ring-1 ring-rose-500/70">
              {onlineGame.error}
            </button>
          )}
        </section>
      </main>
    );
  }

  if (room?.status === "guessing") {
    return (
      <GameView
        room={room}
        me={me}
        isHost={isHost}
        onGuess={handleSubmitGuess}
        onCancelRound={cancelRound}
        onSkipLocation={skipLocation}
        onLeave={handleLeaveToHome}
      />
    );
  }

  if (room?.status === "results" || room?.status === "finished") {
    return (
      <ResultsView
        room={room}
        isHost={isHost}
        onNext={handleStartRound}
        onBackToLobby={cancelRound}
        onRestart={restart}
        onLeave={handleLeaveToHome}
      />
    );
  }

  if (room?.status === "lobby") {
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
          onLeave={handleLeaveToHome}
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

  return (
    <main className="min-h-dvh overflow-x-hidden overflow-y-auto bg-slate-950 p-4 text-slate-50 lg:h-dvh lg:overflow-hidden">
      <div className="punktlandung-home-shell mx-auto grid min-h-full min-w-0 w-full max-w-[132rem] min-[2200px]:max-w-[calc(100vw-1rem)] grid-cols-1 gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px] 2xl:grid-cols-[180px_minmax(0,1fr)_180px] min-[1900px]:grid-cols-[220px_minmax(0,1fr)_220px] min-[2300px]:grid-cols-[260px_minmax(0,1fr)_260px]">
        <AdContainer
          placement="home-left-rail"
          variant="rail"
          label="Anzeige"
          className="hidden h-full min-h-0 xl:block"
          fullWidthResponsive={false}
        />
        <div className="punktlandung-tv-home flex min-h-0 min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[1fr_420px] min-[1900px]:grid-cols-[minmax(0,1fr)_480px] min-[2200px]:grid-cols-[minmax(0,1fr)_520px]">
        <section className="arcade-panel relative z-10 order-1 overflow-hidden rounded-md border-slate-700/80 lg:order-none lg:min-h-0">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(52,211,153,0.14),transparent_28rem),radial-gradient(circle_at_82%_36%,rgba(99,102,241,0.18),transparent_30rem)]" />

          <div className="relative flex flex-col p-4 lg:h-full lg:min-h-0 lg:overflow-auto">
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
              <div className="mt-2 grid grid-cols-3 gap-4 rounded-md bg-slate-950/38 px-4 py-1 text-xs text-slate-200 ring-1 ring-slate-700/60 min-[2200px]:text-lg">
                {[
                  "Bild ansehen",
                  "Ort erraten",
                  "Punkte sammeln"
                ].map((step, index) => (
                  <div key={step} className="flex items-center gap-2 leading-tight">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-emerald-400 bg-emerald-400/15 text-xs font-black text-emerald-200 min-[2200px]:h-10 min-[2200px]:w-10 min-[2200px]:text-lg">
                      {index + 1}
                    </span>
                    <span className="font-bold">{step}</span>
                  </div>
                ))}
              </div>
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
                <p className="hidden text-right text-xs leading-none text-slate-400 sm:block">Wähle die Art der Orte für deine Runde.</p>
              </div>

                  <div className="punktlandung-home-category-grid mt-4 grid flex-1 auto-rows-fr grid-cols-2 gap-4">
              {categoryOptions.map((category) => (
                <div
                  key={category.id}
                  className={`punktlandung-home-category-card relative grid h-full min-h-[52px] grid-cols-1 items-center gap-4 overflow-hidden rounded-md px-4 py-2 sm:min-h-[clamp(48px,6.5vh,68px)] sm:grid-cols-[minmax(0,1fr)_64px] min-[2200px]:min-h-[96px] min-[2200px]:grid-cols-[minmax(0,1fr)_124px] ${
                    category.disabled
                      ? "punktlandung-preview-dash cursor-not-allowed select-none bg-slate-950/24"
                      : "bg-slate-950/50 ring-1 ring-slate-700/50"
                  }`}
                >
                  <div className="punktlandung-home-category-copy min-w-0">
                    <p className={`font-black leading-tight min-[2200px]:text-2xl ${category.disabled ? "text-slate-300" : "text-white"}`}>{category.title}</p>
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
                  {category.disabled ? (
                      <span className="absolute right-2 top-2 z-10 rounded-sm border border-slate-600/80 px-2 py-0.5 text-[10px] font-black tracking-[0.08em] text-slate-400 min-[2200px]:right-4 min-[2200px]:top-4 min-[2200px]:text-sm">
                      SPÄTER
                    </span>
                  ) : (
                    <span className="absolute right-2 top-2 z-10 text-xs font-black text-indigo-200 min-[2200px]:right-4 min-[2200px]:top-4 min-[2200px]:text-xl">{category.tag}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="relative z-20 order-2 lg:order-none lg:min-h-0 lg:overflow-hidden">
          <div className="punktlandung-home-side-panel arcade-panel relative flex flex-col rounded-md border-slate-700/80 p-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
            <div className="absolute right-4 top-4 z-10 flex items-start justify-end gap-4">
              <div className="flex shrink-0 items-center gap-2">
                <SoundToggle />
              </div>
            </div>

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
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">Passwort</span>
                    <span className="rounded-sm border border-slate-600/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                      Später
                    </span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled
                    aria-disabled="true"
                    placeholder="Noch nicht verfügbar"
                    className="mt-1 h-9 w-full cursor-not-allowed rounded-md border-0 bg-slate-950/35 px-3.5 text-sm text-slate-500 outline-none ring-1 ring-slate-700/70 placeholder:text-slate-600 md:text-base"
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
                    <button
                      key={mode.id}
                      type="button"
                      disabled={isDisabled}
                      data-new-tab-href={mode.available ? appPathWithMode(mode.id) : undefined}
                      onClick={() => {
                        playSelect();
                        window.location.href = appPathWithMode(mode.id);
                      }}
                      className={`punktlandung-home-mode-card group relative min-h-[46px] rounded-md px-3.5 py-1.5 text-left transition lg:min-h-[clamp(40px,4.5vh,52px)] ${
                        mode.available
                          ? "cursor-pointer overflow-hidden bg-slate-950/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_34px_rgba(0,0,0,0.18)] ring-1 ring-slate-600/80 hover:-translate-y-0.5 hover:bg-slate-900/86 hover:ring-emerald-300/75 focus:outline-none focus:ring-2 focus:ring-emerald-300/85"
                          : "punktlandung-preview-dash bg-slate-950/28 pr-24"
                      } disabled:cursor-not-allowed disabled:hover:bg-slate-950/35 disabled:hover:ring-slate-700/70`}
                    >
                      {mode.available && (
                        <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-emerald-400/22 transition group-hover:bg-emerald-300/75" />
                      )}
                      <span className="flex items-start justify-between gap-2">
                        <span>
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
                    </button>
                  );
                })}
              </div>

              <div className="punktlandung-home-room-card mt-3 rounded-md bg-slate-950/72 p-3 ring-1 ring-slate-600/80 transition hover:bg-slate-900/86 hover:ring-emerald-300/75">
                <label className="block">
                  <span className="punktlandung-home-mode-title block text-lg font-black leading-tight text-white">Online-Raum</span>
                  <span className="punktlandung-home-mode-text mt-0.5 block text-xs leading-tight text-slate-300">Online-Raum beitreten</span>
                  <span className="mt-1 block text-xs font-bold text-slate-400">Raumcode</span>
                  <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      value={joinCodeInput}
                      onChange={(event) => setJoinCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleJoinByCode();
                      }}
                      maxLength={6}
                      placeholder="ABC123"
                      className="h-10 min-w-0 rounded-md border-0 bg-slate-950/70 px-3 text-sm font-black uppercase tracking-[0.14em] text-white outline-none ring-1 ring-slate-700 transition placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-300"
                    />
                    <button
                      type="button"
                      disabled={joinCodeInput.trim().length === 0}
                      onClick={handleJoinByCode}
                      className="h-10 rounded-md bg-emerald-400/12 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-100 ring-1 ring-emerald-300/50 transition hover:bg-emerald-400/18 hover:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500 disabled:ring-slate-700"
                    >
                      Beitreten
                    </button>
                  </div>
                </label>
              </div>
          </div>

            <nav className="mt-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2 text-[12px] font-bold text-slate-500 md:justify-start">
              {legalLinks.map((link) => (
                <a key={link.href} href={link.href} className="transition hover:text-emerald-300">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>
        </div>
        <AdContainer
          placement="home-right-rail"
          variant="rail"
          label="Anzeige"
          className="hidden h-full min-h-0 xl:block"
          fullWidthResponsive={false}
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
  );
}
