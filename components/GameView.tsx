"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Guess, LatLng, LocationCategory, Player, RoomState } from "@/types/game";
import { findCountryCodeAtPoint } from "@/lib/countryLookup";
import { AdContainer } from "./AdContainer";
import { Button } from "./Button";
import { GuessMap } from "./GuessMap";
import { PanoramaViewer } from "./PanoramaViewer";
import { useSound } from "./SoundProvider";
import { TriangleIcon } from "./TriangleIcon";

const categoryTaskText: Record<LocationCategory, string> = {
  mixed: "Gemischter Ort",
  landmarks: "Wahrzeichen",
  cities: "Stadt",
  landscapes: "Landschaft",
  flags: "Flagge",
  capitals: "Hauptstadt",
  streetview: "Straßenansicht"
};

function pinCursorUrl(color: string): string {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#f43f5e";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="${safeColor}" stroke="#fff" stroke-width="2" d="M16 3a9 9 0 0 0-9 9c0 7 9 17 9 17s9-10 9-17a9 9 0 0 0-9-9Z"/><circle cx="16" cy="12" r="3.2" fill="#fff"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

type GameViewProps = {
  room: RoomState;
  me: Player | null;
  isHost: boolean;
  onGuess: (point: LatLng & { countryCode?: string }, playerId?: string) => void;
  onCancelRound: () => void;
  onSkipLocation: (locationId: string) => void;
  onLeave: () => void;
};

export function GameView({ room, me, isHost, onGuess, onCancelRound, onSkipLocation, onLeave }: GameViewProps) {
  const { playCountdownTick } = useSound();
  const [guess, setGuess] = useState<Guess | null>(null);
  const [mapSize, setMapSize] = useState<"closed" | "open" | "full">("closed");
  const [tick, forceTick] = useState(0);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [chromeHoverHidden, setChromeHoverHidden] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [mapResetNonce, setMapResetNonce] = useState(0);
  const mapCloseTimer = useRef<number | null>(null);
  const countdownTimersRef = useRef<number[]>([]);
  const expanded = mapSize !== "closed";
  const fullMap = mapSize === "full";
  const isMobileTouchMap = isMobilePortrait || isMobileLandscape;
  const mapInteractive = expanded || isMobileTouchMap;
  const showMapSizeButton = (expanded || isMobileTouchMap) && !fullMap;
  const showMapCloseButton = expanded && (!isMobilePortrait || fullMap);

  useEffect(() => {
    setGuess(null);
  }, [room.currentRound, room.location?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => forceTick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 879px) and (orientation: portrait)");
    const update = () => setIsMobilePortrait(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px) and (max-height: 520px) and (orientation: landscape)");
    const update = () => setIsMobileLandscape(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!chromeHidden) return;
    const timer = window.setTimeout(() => setChromeHidden(false), 5000);
    return () => window.clearTimeout(timer);
  }, [chromeHidden]);

  const secondsLeft = useMemo(() => {
    if (!room.roundEndsAt) return null;
    return Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000));
  }, [room.roundEndsAt, room.guesses.length, tick]);

  useEffect(() => {
    countdownTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    countdownTimersRef.current = [];

    if (room.status !== "guessing" || !room.roundEndsAt) return;

    const timers: number[] = [];
    for (let remaining = 9; remaining >= 1; remaining -= 1) {
      const delay = room.roundEndsAt - Date.now() - remaining * 1000;
      if (delay < 0) continue;
      timers.push(window.setTimeout(() => playCountdownTick(remaining), delay));
    }
    countdownTimersRef.current = timers;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [playCountdownTick, room.currentRound, room.roundEndsAt, room.status]);

  const activePlayerList = room.players.filter((player) => player.connected && player.status === "active");
  const activePlayers = activePlayerList.length;
  const isLocalRoom = room.kind === "solo";
  const resolvedPlayerIds = new Set([...room.guesses.map((item) => item.playerId), ...room.timedOutPlayerIds]);
  const pendingPlayerList = activePlayerList.filter((player) => !resolvedPlayerIds.has(player.id));
  const selectedLocalPlayer =
    pendingPlayerList.find((player) => player.id === localPlayerId) ?? pendingPlayerList[0] ?? activePlayerList[0] ?? null;
  const targetPlayerId = isLocalRoom ? selectedLocalPlayer?.id : me?.id;
  const currentPlayerColor = (isLocalRoom ? selectedLocalPlayer?.color : me?.color) ?? "#f43f5e";
  const alreadySubmitted = Boolean(targetPlayerId && room.guesses.some((item) => item.playerId === targetPlayerId));
  const currentPlayerTimedOut = Boolean(targetPlayerId && room.timedOutPlayerIds.includes(targetPlayerId));
  const readyToSubmit = Boolean(guess && !alreadySubmitted && !currentPlayerTimedOut && targetPlayerId);
  const primaryMapActionLabel = currentPlayerTimedOut
    ? "Zeit abgelaufen"
    : alreadySubmitted
      ? "Pin abgegeben"
      : guess
        ? "Pin abgeben"
        : "Pin setzen";
  const collapsedMapActionLabel =
    readyToSubmit || alreadySubmitted || currentPlayerTimedOut ? primaryMapActionLabel : "Pin setzen";
  const primaryMapActionTone = readyToSubmit ? "selected" : alreadySubmitted ? "good" : "ghost";
  const primaryMapActionDisabled = mapInteractive ? !readyToSubmit : alreadySubmitted || currentPlayerTimedOut;
  const taskText = categoryTaskText[room.location?.category ?? "mixed"] ?? categoryTaskText.mixed;
  const viewerLayout = fullMap
    ? "punktlandung-game-viewer punktlandung-game-viewer--map-full absolute inset-x-0 top-0 bottom-[23rem] overflow-hidden sm:bottom-[18rem] lg:bottom-0"
    : expanded
      ? "punktlandung-game-viewer punktlandung-game-viewer--map-open absolute inset-0 overflow-hidden"
      : "punktlandung-game-viewer punktlandung-game-viewer--map-closed absolute inset-x-0 top-0 bottom-[23rem] overflow-hidden sm:bottom-[18rem] lg:bottom-0";
  const chromeSuppressed = chromeHidden || chromeHoverHidden;

  useEffect(() => {
    setGuess(null);
    setMapResetNonce((value) => value + 1);
  }, [targetPlayerId]);

  useEffect(() => {
    return () => {
      if (mapCloseTimer.current !== null) window.clearTimeout(mapCloseTimer.current);
    };
  }, []);

  const enrichGuess = async (point: LatLng): Promise<LatLng & { countryCode?: string }> => {
    if (room.location?.category !== "flags") return point;
    const countryCode = "countryCode" in point ? point.countryCode : undefined;
    if (countryCode) return point;
    return { ...point, countryCode: await findCountryCodeAtPoint(point) };
  };

  const handleMapGuess = (point: LatLng) => {
    const draftGuess: Guess = { ...point, playerId: targetPlayerId ?? "pending", createdAt: Date.now() };
    setGuess(draftGuess);
    if (room.location?.category === "flags") {
      void enrichGuess(point).then((enriched) => {
        setGuess((current) =>
          current && current.lat === point.lat && current.lng === point.lng
            ? { ...current, countryCode: enriched.countryCode }
            : current
        );
      });
    }
  };

  const submitCurrentGuess = async () => {
    if (!guess || !targetPlayerId) return;
    if (isLocalRoom) {
      const nextPendingPlayer = activePlayerList.find(
        (player) => player.id !== targetPlayerId && !resolvedPlayerIds.has(player.id)
      );
      setLocalPlayerId(nextPendingPlayer?.id ?? null);
    }
    setGuess(null);
    onGuess(await enrichGuess(guess), isLocalRoom ? targetPlayerId : undefined);
  };

  const handlePrimaryMapAction = async () => {
    if (!expanded) {
      if (readyToSubmit) {
        await submitCurrentGuess();
        return;
      }
      if (isMobileTouchMap) return;
      setMapSize("open");
      return;
    }
    if (!readyToSubmit) return;
    await submitCurrentGuess();
  };

  const toggleMapSize = () => setMapSize((value) => (value === "full" ? (isMobileTouchMap ? "closed" : "open") : "full"));
  const openMapByHover = () => {
    if (isMobileTouchMap) return;
    if (fullMap) return;
    if (mapCloseTimer.current !== null) {
      window.clearTimeout(mapCloseTimer.current);
      mapCloseTimer.current = null;
    }
    setMapSize("open");
  };
  const closeMapByHover = () => {
    if (isMobileTouchMap) return;
    if (fullMap) return;
    if (mapCloseTimer.current !== null) window.clearTimeout(mapCloseTimer.current);
    mapCloseTimer.current = window.setTimeout(() => {
      setMapSize("closed");
      mapCloseTimer.current = null;
    }, 480);
  };
  const hideChrome = () => {
    setMapSize("closed");
    setChromeHidden(true);
  };
  const mapPanelLayout = fullMap
    ? "fixed bottom-3 right-3 h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] cursor-[crosshair] sm:absolute sm:bottom-4 sm:right-4 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] min-[1900px]:bottom-4 min-[1900px]:right-4 min-[1900px]:h-[calc(100dvh-2rem)] min-[1900px]:w-[calc(100vw-2rem)]"
    : expanded
      ? "absolute bottom-3 left-3 right-3 h-[min(56dvh,470px)] cursor-[crosshair] sm:bottom-4 sm:left-auto sm:right-4 sm:h-[min(56dvh,540px)] sm:w-[min(58vw,720px)] min-[1900px]:h-[min(56dvh,580px)] min-[1900px]:w-[min(52vw,820px)] min-[2400px]:w-[min(48vw,980px)]"
      : "absolute bottom-3 left-3 right-3 h-[14.5rem] cursor-pointer sm:bottom-4 sm:left-auto sm:right-4 sm:h-[16.5rem] sm:w-[min(52vw,440px)] min-[1900px]:h-[18rem] min-[1900px]:w-[min(48vw,520px)] sm:hover:-translate-y-1";

  useEffect(() => {
    if (!isLocalRoom) return;
    const nextPending = activePlayerList.find((player) => !resolvedPlayerIds.has(player.id));
    setLocalPlayerId(nextPending?.id ?? activePlayerList[0]?.id ?? null);
  }, [isLocalRoom, room.currentRound, room.location?.id, room.guesses.length, room.timedOutPlayerIds.length, activePlayers]);

  if (!room.location) return null;

  return (
    <main className="punktlandung-game-shell fixed inset-0 overflow-hidden bg-slate-950">
      <div className={viewerLayout}>
        <PanoramaViewer location={room.location} settings={room.settings} isHost={isHost} onSkipLocation={onSkipLocation} chromeHidden={chromeSuppressed} />
      </div>

      {!chromeSuppressed && (
        <div className="punktlandung-game-hud absolute inset-x-3 top-3 z-40 sm:inset-x-4 sm:top-4">
          <div className="punktlandung-game-hud-grid grid grid-cols-[auto_1fr_auto] items-start gap-2 xl:gap-3">
            <div className="punktlandung-game-stats pointer-events-none order-1 col-span-1 flex min-w-0 flex-wrap gap-1.5 sm:gap-2">
              <div className="punktlandung-game-stat flex min-h-10 w-fit flex-col justify-center rounded-md bg-slate-950/52 px-3 py-1 shadow-[0_14px_30px_rgba(0,0,0,0.22)] ring-1 ring-indigo-300/30 backdrop-blur-md sm:min-h-11 sm:px-3.5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Runde</p>
                <p className="punktlandung-game-stat-value punktlandung-game-stat-value-round text-[18px] font-black leading-tight sm:text-[20px]">
                  {room.currentRound}/{room.settings.rounds}
                </p>
              </div>
              <div className="punktlandung-game-stat flex min-h-10 w-fit flex-col justify-center rounded-md bg-slate-950/52 px-3 py-1 shadow-[0_14px_30px_rgba(0,0,0,0.22)] ring-1 ring-emerald-300/40 backdrop-blur-md sm:min-h-11 sm:px-3.5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Zeit</p>
                <p className="punktlandung-game-stat-value punktlandung-game-stat-value-time text-[18px] font-black leading-tight sm:text-[20px]">{secondsLeft === null ? "frei" : `${secondsLeft}s`}</p>
              </div>
            </div>

            <div className="punktlandung-game-task-slot pointer-events-none order-2 col-span-1 flex justify-center px-1 xl:px-2">
              <div className="punktlandung-task-card inline-flex min-h-10 w-fit max-w-[min(100%,20rem)] flex-col items-center justify-center rounded-md bg-slate-950/46 px-4 py-1 text-center shadow-[0_14px_30px_rgba(0,0,0,0.22)] ring-1 ring-emerald-300/40 backdrop-blur-md sm:min-h-11 sm:px-5">
                <p className="text-[10px] font-black uppercase leading-none tracking-[0.22em] text-emerald-300">Gesucht</p>
                <p className="punktlandung-task-card-title text-[18px] font-black leading-none text-white sm:text-[20px] xl:text-[22px]">
                  <span aria-hidden="true" className="punktlandung-task-card-title-line" />
                  <span>{taskText}</span>
                </p>
              </div>
            </div>
            <div className="punktlandung-game-actions pointer-events-auto order-3 col-span-1 flex justify-end gap-2">
                {isHost && (
                  <Button
                    className="punktlandung-game-back-button"
                    tone="ghost"
                    sound="click"
                    onClick={onCancelRound}
                    aria-label="Zurueck"
                    title="Zurueck"
                  >
                    <span className="punktlandung-game-back-button-inner">
                      <TriangleIcon direction="left" className="h-4 w-4" />
                      <span>Zurück</span>
                    </span>
                  </Button>
                )}
            </div>
          </div>
        </div>
      )}

      {!expanded && (
      <button
        type="button"
        onClick={chromeHidden ? () => setChromeHidden(false) : hideChrome}
        onMouseEnter={() => setChromeHoverHidden(true)}
        onMouseLeave={() => setChromeHoverHidden(false)}
        className={`punktlandung-focus-tab fixed left-0 z-[80] rounded-r-md border-3 px-2.5 py-4 text-[12px] font-black tracking-[0.02em] shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-md transition ${
          chromeSuppressed
            ? "border-emerald-300/85 bg-emerald-400/18 text-emerald-100"
            : "border-slate-500/70 bg-slate-950/58 text-slate-100 hover:border-emerald-300/80 hover:bg-slate-900/86"
        }`}
        title={chromeSuppressed ? "Einblendungen wieder anzeigen" : "Einblendungen für 5 Sekunden ausblenden"}
      >
        <span className="punktlandung-focus-tab-text">{chromeSuppressed ? "Einblenden" : "Bild frei"}</span>
      </button>
      )}

      {!chromeSuppressed && !fullMap && (
        <AdContainer
          placement="game-bottom-left"
          variant="game"
          label="Anzeige"
          position="absolute"
          className="pointer-events-auto bottom-3 left-3 z-40 hidden lg:block sm:bottom-4 sm:left-4"
        />
      )}

      {!chromeSuppressed && (
      <section
        className={`punktlandung-guess-map-panel ${fullMap ? "punktlandung-guess-map-panel--full" : expanded ? "punktlandung-guess-map-panel--open" : "punktlandung-guess-map-panel--closed"} origin-bottom-right transform-gpu z-50 rounded-md bg-slate-950/88 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.34)] ring-1 ring-indigo-300/45 backdrop-blur-md transition-[width,height,transform] duration-300 sm:p-3 ${mapPanelLayout}`}
        onMouseEnter={openMapByHover}
        onMouseLeave={closeMapByHover}
        onClick={() => {
          if (!expanded && !isMobileTouchMap) setMapSize("open");
        }}
      >
        <div className="flex h-full flex-col gap-3">
          <div className="punktlandung-map-panel-header flex items-center justify-between gap-3">
            <p className="punktlandung-map-panel-title min-w-0 text-xs font-black uppercase tracking-[0.2em] text-indigo-300">Karte öffnen</p>
            <div className="punktlandung-map-panel-actions flex shrink-0 items-center gap-2">
              {showMapSizeButton && (
                <Button
                  className="punktlandung-map-size-button min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm"
                  tone="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleMapSize();
                  }}
                  title={fullMap ? "Karte verkleinern" : "Karte maximieren"}
                >
                  {fullMap ? "Minimieren" : "Maximieren"}
                </Button>
              )}
              <Button
                className="punktlandung-map-primary-button min-h-10 w-fit min-w-[6.75rem] px-3 py-2 text-xs normal-case sm:min-h-11 sm:text-sm"
                tone={mapInteractive || readyToSubmit ? primaryMapActionTone : "ghost"}
                sound="select"
                disabled={primaryMapActionDisabled}
                onClick={async (event) => {
                  event.stopPropagation();
                  await handlePrimaryMapAction();
                }}
              >
                {mapInteractive ? primaryMapActionLabel : collapsedMapActionLabel}
              </Button>
              {showMapCloseButton && (
                <Button
                  className="punktlandung-map-close-button min-h-10 min-w-10 px-0 py-0 text-sm sm:min-h-11 sm:min-w-11"
                  tone="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMapSize("closed");
                  }}
                  title="Tippkarte minimieren"
                >
                  X
                </Button>
              )}
            </div>
          </div>

          {isLocalRoom && activePlayers > 1 && mapInteractive && (
            <div className="flex flex-wrap gap-1.5">
              {activePlayerList.map((player) => {
                const submitted = room.guesses.some((item) => item.playerId === player.id);
                const timedOut = room.timedOutPlayerIds.includes(player.id);
                const active = player.id === selectedLocalPlayer?.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setLocalPlayerId(player.id);
                    }}
                    className={`relative inline-flex min-h-9 max-w-full items-center justify-center overflow-hidden rounded-md border bg-slate-950/70 py-1.5 pl-5 pr-3 text-center text-xs font-black ring-1 transition sm:min-h-10 sm:text-sm ${
                      active
                        ? "text-white ring-emerald-300/75"
                        : submitted || timedOut
                          ? "text-slate-500 ring-slate-700/60"
                          : "text-slate-200 ring-slate-700/60 hover:ring-slate-500"
                    }`}
                    style={{
                      borderColor: active ? player.color : `${player.color}80`,
                      boxShadow: active ? `0 0 16px ${player.color}30` : undefined
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                      style={{
                        background: player.color,
                        boxShadow: active ? `0 0 12px ${player.color}55` : undefined
                      }}
                    />
                    <span className="whitespace-nowrap leading-none">{player.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md ring-1 ring-slate-700/70">
            <div
              className={mapInteractive ? "pin-cursor h-full" : "pointer-events-none h-full"}
              style={{ "--pin-cursor": pinCursorUrl(currentPlayerColor) } as CSSProperties}
            >
              <GuessMap
                guess={guess}
                players={room.players}
                currentPlayerColor={currentPlayerColor}
                onGuess={handleMapGuess}
                disabled={alreadySubmitted || !mapInteractive}
                noZoom={!mapInteractive}
                noPan={!mapInteractive}
                resizeSignal={`${mapSize}-${targetPlayerId ?? "none"}-${alreadySubmitted ? "submitted" : "live"}`}
                resetSignal={`${room.location.id}-${targetPlayerId ?? "none"}-${mapResetNonce}`}
              />
            </div>
          </div>
        </div>
      </section>
      )}
    </main>
  );
}
