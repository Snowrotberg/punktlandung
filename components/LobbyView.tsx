"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { categoryOptions } from "@/lib/categories";
import type { GameMode, GameSettings, HostParticipation, Player, RoomKind, TeamId } from "@/types/game";
import { AdContainer } from "./AdContainer";
import { BackButton } from "./BackButton";
import { Button } from "./Button";

type LobbyViewProps = {
  code: string;
  roomKind: RoomKind;
  hostParticipation?: HostParticipation;
  hostPlayerName?: string;
  players: Player[];
  meId: string | null;
  isHost: boolean;
  settings: GameSettings;
  onSettings: (settings: Partial<GameSettings>) => void;
  onRenamePlayer: (playerId: string, name: string) => void;
  onStart: () => void;
  onTeam: (team: TeamId) => void;
  onLeave: () => void;
  canStart?: boolean;
  isRoomOnline?: boolean;
  connectionStatus?: "connecting" | "open" | "closed";
  onHostParticipationChange?: (hostParticipation: HostParticipation, playerName?: string) => void;
  onCreateLiveRoom?: () => void;
};

const onlineModes: Array<{ id: GameMode; title: string; short: string }> = [
  { id: "classic", title: "Jeder gegen jeden", short: "Eigener Pin pro Gerät." },
  { id: "duel", title: "Team-Duell", short: "Zwei Gruppen treten an." }
];

const timeOptions = [
  { value: 10, label: "10 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "60 s" },
  { value: 120, label: "2 min" },
  { value: 0, label: "frei" }
];

const roundPresets = [10, 15, 20];

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

export function LobbyView({
  code,
  roomKind,
  hostParticipation = "host_only",
  hostPlayerName = "",
  players,
  meId,
  isHost,
  settings,
  onSettings,
  onRenamePlayer,
  onStart,
  onTeam,
  onLeave,
  canStart = true,
  isRoomOnline = true,
  connectionStatus = "closed",
  onHostParticipationChange,
  onCreateLiveRoom
}: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const [customRoundText, setCustomRoundText] = useState("");
  const [isPlayerEditorOpen, setIsPlayerEditorOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const repeatDelayRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const isSolo = roomKind === "solo";
  const isOnlineRoom = roomKind === "online";
  const isCouchMode = isSolo && settings.localMode === "couch";
  const isSoloMode = isSolo && !isCouchMode;
  const usesModeSidebarAd = isSoloMode || isCouchMode || isOnlineRoom;
  const leftRailPlacement = isSoloMode ? "solo-left-rail" : isCouchMode ? "party-left-rail" : isOnlineRoom ? "online-left-rail" : "lobby-left-rail";
  const rightRailPlacement = isSoloMode ? "solo-right-rail" : isCouchMode ? "party-right-rail" : isOnlineRoom ? "online-right-rail" : "lobby-right-rail";
  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.origin);
    url.searchParams.set("room", code);
    return url.toString();
  }, [code]);
  const me = players.find((player) => player.id === meId);
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
  const headerKicker = isSolo ? (isCouchMode ? "Partymodus" : "Solo-Modus") : "Online-Raum";
  const headerTitle = isSolo
    ? isCouchMode
      ? "Mehrere Personen an einem Bildschirm"
      : "Eine Person, ein Tipp"
    : "Gemeinsam im virtuellen Raum";
  const headerHint = isSolo
    ? isCouchMode
      ? "Reihum tippen, Punkte jagen."
      : "Eine Person setzt pro Runde einen Pin."
    : "Code teilen und live gegeneinander spielen.";
  const categoryQuestion = isSolo && !isCouchMode ? "Was willst du erraten?" : "Was wollt ihr erraten?";
  const categoryHint = isSolo && !isCouchMode ? "Wähle die Kategorie für deine Runde." : "Wählt die Kategorie für diese Runde.";
  const currentLocalMode = isCouchMode
    ? { title: "Party-Modus", short: "Reihum am selben Bildschirm." }
    : { title: "Solo-Modus", short: "Eine Person, ein Tipp." };
  const localPlayerSlots = Array.from({ length: 10 }, (_, index) => players[index] ?? null);
  const isOnlineSetup = isOnlineRoom && !isRoomOnline;
  const primaryActionLabel = isOnlineSetup ? (connectionStatus === "open" ? "Online-Raum öffnen" : "Raumserver fehlt") : "Starten";
  const primaryActionDisabled = isOnlineSetup
    ? !isHost || connectionStatus !== "open" || !onCreateLiveRoom
    : !isHost || players.length === 0 || !canStart;
  const handlePrimaryAction = isOnlineSetup ? onCreateLiveRoom ?? onStart : onStart;
  const selectedCategory = categoryOptions.find((category) => category.selectableId === settings.category);

  const isCustomRoundCount = customRoundText !== "" || !roundPresets.includes(settings.rounds);

  useEffect(() => {
    if (isSolo || !isRoomOnline || !inviteLink) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(inviteLink, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      color: {
        dark: "#020617",
        light: "#ffffff"
      }
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteLink, isRoomOnline, isSolo]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const stepCustomRounds = (delta: number) => {
    setCustomRoundText((currentText) => {
      const baseRounds = Number(currentText || settings.rounds || 20);
      const nextRounds = Math.max(1, Math.round(baseRounds + delta));
      onSettings({ rounds: nextRounds });
      return String(nextRounds);
    });
  };

  const stopRoundStepper = () => {
    if (repeatDelayRef.current) {
      window.clearTimeout(repeatDelayRef.current);
      repeatDelayRef.current = null;
    }
    if (repeatIntervalRef.current) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  };

  const startRoundStepper = (delta: number) => {
    stopRoundStepper();
    stepCustomRounds(delta);
    repeatDelayRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => stepCustomRounds(delta), 85);
    }, 360);
  };

  useEffect(() => stopRoundStepper, []);

  if (isOnlineRoom && isRoomOnline) {
    return (
      <main className="punktlandung-lobby h-dvh overflow-hidden bg-slate-950 p-2 text-slate-50 md:p-4">
        <div className="mx-auto grid h-full min-h-0 w-full max-w-[132rem] min-[2200px]:max-w-[calc(100vw-1rem)] grid-cols-1 gap-2 md:gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px] 2xl:grid-cols-[180px_minmax(0,1fr)_180px] min-[1900px]:grid-cols-[220px_minmax(0,1fr)_220px] min-[2300px]:grid-cols-[260px_minmax(0,1fr)_260px]">
          <AdContainer
            placement="online-left-rail"
            variant="rail"
            adFormat="auto"
            label="Anzeige"
            className="hidden h-full min-h-0 xl:block"
            fullWidthResponsive
          />
          <div className="flex min-h-0 min-w-0 flex-col gap-2 md:gap-4">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md bg-slate-900/70 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Online-Warteraum</p>
                <h1 className="mt-1 text-2xl font-black leading-tight text-white md:text-4xl">QR-Code scannen und beitreten</h1>
                <p className="mt-1 text-sm text-slate-400">Großer Bildschirm: Raumleitung und Ergebnisanzeige.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <BackButton className="punktlandung-lobby-header-back" onClick={onLeave} label="Zurueck" />
                <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 normal-case" disabled={!isHost || players.length === 0 || !canStart} onClick={onStart}>
                  Starten
                </Button>
              </div>
            </header>

            <section className="punktlandung-online-waiting-grid grid min-h-0 flex-1 gap-2 overflow-hidden md:gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.58fr)]">
              <div className="arcade-panel punktlandung-online-qr-panel grid min-h-0 rounded-md border-slate-700/70 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Beitreten</p>
                    <h2 className="mt-1 text-2xl font-black md:text-3xl">QR-Code</h2>
                  </div>
                  <button
                    type="button"
                    onClick={copyInvite}
                    className="min-h-10 rounded-md bg-slate-950/70 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-100 ring-1 ring-emerald-300/45 transition hover:ring-emerald-300/80"
                  >
                    {copied ? "Link kopiert" : "Link kopieren"}
                  </button>
                </div>

                <div className="punktlandung-online-qr-box mt-4 grid min-h-0 place-items-center overflow-hidden rounded-md bg-white p-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR-Code fuer Raum ${code}`}
                      className="block aspect-square h-full max-h-full w-auto max-w-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div className="grid h-64 w-64 place-items-center text-center text-sm font-black text-slate-700">QR wird erstellt</div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                  <div className="rounded-md bg-slate-950/70 p-3 text-center ring-1 ring-slate-700/70">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Raumcode</p>
                    <p className="mt-1 text-3xl font-black tracking-[0.22em] text-white">{code}</p>
                  </div>
                  <div className="rounded-md bg-slate-950/45 p-3 ring-1 ring-slate-700/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Runde</p>
                    <p className="mt-1 text-sm font-bold text-slate-200">
                      Jeder gegen jeden · {selectedCategory?.title ?? settings.category} · {settings.rounds} Runden
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {settings.timeLimitSec > 0 ? `${settings.timeLimitSec} s pro Runde` : "Ohne Zeitlimit"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 truncate rounded-md bg-slate-950/45 px-3 py-2 text-xs font-bold text-slate-400 ring-1 ring-slate-700/50">
                  {inviteLink}
                </p>
              </div>

              <aside className="arcade-panel flex min-h-0 flex-col rounded-md border-slate-700/70 p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Spieler</p>
                    <h2 className="mt-1 text-2xl font-black">Warteliste</h2>
                  </div>
                  <span className="text-lg font-black text-emerald-300">{players.length}</span>
                </div>

                <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                  {rankedPlayers.length === 0 ? (
                    <div className="grid h-full min-h-48 place-items-center rounded-md bg-slate-950/42 p-4 text-center ring-1 ring-slate-700/60">
                      <p className="max-w-xs text-sm leading-6 text-slate-400">Noch niemand ist beigetreten. Scannt den QR-Code mit Handy, Tablet oder Laptop.</p>
                    </div>
                  ) : (
                    rankedPlayers.map((player, index) => (
                      <div key={player.id} className="relative overflow-hidden rounded-md bg-slate-950/55 p-3 pl-4 ring-1 ring-slate-700/60">
                        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: player.color }} />
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black">
                              #{index + 1} {player.name}
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-slate-400">{player.connected ? "bereit" : "offline"}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white/80" style={{ background: player.color }} />
                            {!isOnlineRoom && settings.mode === "duel" && (
                              <span className="rounded-sm bg-slate-900/90 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-200 ring-1 ring-emerald-300/35">
                                {player.team === "aurora" ? "Team A" : "Team B"}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isOnlineRoom && settings.mode === "duel" && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {(["aurora", "pulse"] as TeamId[]).map((team) => (
                              <button
                                key={team}
                                disabled={player.id !== meId}
                                onClick={() => onTeam(team)}
                                className={`min-h-9 rounded-md px-2 text-xs font-black uppercase ring-1 ${
                                  player.team === team ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/75" : "bg-slate-900/60 text-slate-300 ring-slate-700/60"
                                } disabled:cursor-default`}
                              >
                                {team === "aurora" ? "Team A" : "Team B"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  {hostParticipation === "host_player"
                    ? "Host spielt mit und wird später als Teilnehmer hinzugefügt."
                    : "Der große Bildschirm verwaltet den Raum und spielt nicht mit."}
                </p>
              </aside>
            </section>
          </div>
          <AdContainer
            placement="online-right-rail"
            variant="rail"
            adFormat="auto"
            label="Anzeige"
            className="hidden h-full min-h-0 xl:block"
            fullWidthResponsive
          />
        </div>
      </main>
    );
  }

  return (
    <main className="punktlandung-lobby h-dvh overflow-hidden bg-slate-950 p-2 text-slate-50 md:p-4">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[132rem] min-[2200px]:max-w-[calc(100vw-1rem)] grid-cols-1 gap-2 md:gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px] 2xl:grid-cols-[180px_minmax(0,1fr)_180px] min-[1900px]:grid-cols-[220px_minmax(0,1fr)_220px] min-[2300px]:grid-cols-[260px_minmax(0,1fr)_260px]">
        <AdContainer
          placement={leftRailPlacement}
          variant="rail"
          adFormat={usesModeSidebarAd ? "auto" : undefined}
          label="Anzeige"
          className="hidden h-full min-h-0 xl:block"
          fullWidthResponsive={usesModeSidebarAd}
        />
        <div className="flex min-h-0 min-w-0 flex-col gap-2 md:gap-4">
          <header className="punktlandung-lobby-header flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md bg-slate-900/70 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)] ring-1 ring-slate-700/60 md:p-5 min-[2200px]:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{headerKicker}</p>
              <div className="relative mt-1 inline-block max-w-full pr-12 md:pr-14">
                <SvgPin
                  className="absolute right-1 top-1/2 z-0 h-8 w-7 -translate-y-[58%] drop-shadow-[0_0_14px_rgba(52,211,153,0.55)] md:right-2 md:h-9 md:w-8"
                  color="#34d399"
                />
                <h1 className="relative z-10 truncate text-2xl font-black md:text-3xl min-[2200px]:text-5xl">{headerTitle}</h1>
              </div>
              <p className="mt-0.5 hidden text-xs text-slate-400 min-[420px]:block md:mt-1 md:text-sm min-[2200px]:text-xl">{headerHint}</p>
            </div>
          </div>

          <div className="punktlandung-desktop-only shrink-0 items-center gap-2">
            {!isSolo && isRoomOnline && (
              <button
                onClick={copyInvite}
                className="min-h-12 rounded-md bg-slate-950/70 px-3 py-2 text-left ring-1 ring-slate-700 transition hover:ring-emerald-300/70"
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Raumcode</span>
                <span className="block text-lg font-black tracking-[0.18em] text-white">{copied ? "KOPIERT" : code}</span>
              </button>
            )}
            <BackButton className="punktlandung-lobby-header-back" onClick={onLeave} label="Zurueck" />
            <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 normal-case" disabled={primaryActionDisabled} onClick={handlePrimaryAction}>
              {primaryActionLabel}
            </Button>
          </div>
          <div className="punktlandung-lobby-mobile-back shrink-0">
            <BackButton onClick={onLeave} label="Zurueck" />
          </div>
        </header>

        <section className={`punktlandung-lobby-config-section ${isOnlineRoom ? "punktlandung-online-layout" : ""} min-h-0 flex-1 overflow-y-auto pb-20 sm:pb-0 lg:overflow-hidden ${isSolo ? "" : "grid gap-2 md:gap-4 lg:grid-cols-[1fr_310px]"}`}>
          <div className="punktlandung-lobby-config-stage flex min-h-0 flex-col gap-2 md:gap-4 lg:grid lg:h-full lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-stretch min-[2200px]:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className={`arcade-panel punktlandung-lobby-settings ${isSolo ? "punktlandung-local-settings" : ""} ${isCouchMode ? "punktlandung-party-settings" : ""} ${isOnlineRoom ? "punktlandung-online-settings" : ""} order-1 min-w-0 rounded-md border-slate-700/70 p-3 md:p-4 lg:order-none lg:h-full min-[2200px]:p-6`}>
              {isSolo ? (
                <div className="punktlandung-settings-main punktlandung-local-main">
                  <h2 className="punktlandung-settings-heading text-[22px] font-black leading-tight min-[2200px]:text-3xl">Spielweise</h2>
                  <div className="punktlandung-mode-list punktlandung-mode-list-single mt-4 grid gap-3">
                    <div className="punktlandung-mode-choice punktlandung-static-mode-choice group relative min-h-12 overflow-hidden rounded-md bg-slate-950/70 py-2.5 pl-6 pr-2.5 text-left shadow-good ring-2 ring-emerald-300/75 min-[2200px]:min-h-24 min-[2200px]:p-5">
                      <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-emerald-300/80" />
                      <p className="text-lg font-black min-[2200px]:text-2xl">{currentLocalMode.title}</p>
                      <p className="mt-0.5 text-[12px] text-slate-300 min-[2200px]:text-lg">{currentLocalMode.short}</p>
                    </div>
                  </div>
                  {settings.localMode === "couch" && (
                    <div className="punktlandung-party-player-card mt-3 rounded-md bg-slate-950/40 p-2 ring-1 ring-slate-700/50 md:p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Spieler</p>
                          <p className="punktlandung-party-player-hint mt-0.5 text-[11px] text-slate-300">Slot antippen: Anzahl wählen.</p>
                        </div>
                        <button
                          type="button"
                          disabled={!isHost}
                          onClick={() => setIsPlayerEditorOpen(true)}
                          className="min-h-9 rounded-md bg-slate-950/60 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-200 ring-1 ring-emerald-300/45 transition hover:bg-emerald-400/12 hover:ring-emerald-300/75 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Namen
                        </button>
                      </div>
                      <fieldset disabled={!isHost} className="punktlandung-party-player-slots mt-2 grid min-w-0 grid-cols-5 gap-1.5 disabled:opacity-55">
                        {localPlayerSlots.map((player, index) => {
                          const slotNumber = index + 1;
                          const isActive = slotNumber <= settings.localPlayerCount;
                          const slotColor = player?.color ?? "#64748b";
                          return (
                            <button
                              key={slotNumber}
                              type="button"
                              onClick={() => onSettings({ localPlayerCount: Math.max(2, slotNumber) })}
                              className={`punktlandung-party-slot group min-h-9 min-w-0 rounded-md px-1 py-1 text-xs font-black ring-1 transition ${
                                isActive
                                  ? "bg-slate-950/75 text-white ring-slate-500/80 shadow-[0_10px_22px_rgba(0,0,0,0.22)]"
                                  : "bg-slate-900/38 text-slate-500 ring-slate-700/50 hover:text-slate-200 hover:ring-slate-500"
                              }`}
                              title={player?.name ?? `Spieler ${slotNumber}`}
                            >
                              <span
                                className="mx-auto mb-1 block h-3.5 w-3.5 rounded-full border-2 border-white/85 shadow-[0_0_12px_rgba(0,0,0,0.3)] transition group-hover:scale-110"
                                style={{ background: isActive ? slotColor : "transparent" }}
                              />
                              <span>{slotNumber}</span>
                            </button>
                          );
                        })}
                      </fieldset>
                    </div>
                  )}
                </div>
              ) : (
                <div className="punktlandung-settings-main punktlandung-online-main">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="punktlandung-settings-heading text-[22px] font-black leading-tight">Spielweise</h2>
                    {!isHost && <span className="text-xs font-black text-slate-400">Host stellt ein</span>}
                  </div>
                  <div className="punktlandung-mode-list mt-4 grid grid-cols-2 gap-3">
                    {onlineModes.map((mode) => (
                      <button
                        key={mode.id}
                        disabled={!isHost}
                        onClick={() => onSettings({ mode: mode.id })}
                        className={`punktlandung-mode-choice group relative overflow-hidden rounded-md p-3 text-left transition ${
                          settings.mode === mode.id
                            ? "bg-slate-950/70 shadow-good ring-2 ring-emerald-300/75"
                            : "bg-slate-950/40 ring-1 ring-slate-700/60 hover:bg-slate-900/70 hover:ring-emerald-300/60"
                        } disabled:cursor-not-allowed`}
                      >
                        <span
                          className={`absolute inset-y-4 left-0 w-1 rounded-r-full transition ${
                            settings.mode === mode.id ? "bg-emerald-300/80" : "bg-emerald-400/28 group-hover:bg-emerald-300/70"
                          }`}
                        />
                        <p className="punktlandung-mode-title font-black">{mode.title}</p>
                        <p className="punktlandung-mode-text mt-1 text-xs text-slate-300">{mode.short}</p>
                      </button>
                    ))}
                  </div>
                  {isOnlineRoom && !isRoomOnline && (
                    <div className="punktlandung-online-host-card mt-4 rounded-md bg-slate-950/42 p-3 ring-1 ring-slate-700/60">
                      <div className="punktlandung-online-host-head flex items-center justify-between gap-3">
                        <h2 className="punktlandung-settings-heading text-[22px] font-black leading-tight">Host-Rolle</h2>
                        {!isHost && <span className="text-xs font-black text-slate-400">Host stellt ein</span>}
                      </div>
                      <div className="punktlandung-online-host-options mt-3 grid grid-cols-2 gap-2">
                        {([
                          ["host_player", "Ich spiele selbst", ""],
                          ["host_only", "Ich verwalte nur", ""]
                        ] as const).map(([value, title, text]) => (
                          <button
                            key={value}
                            type="button"
                            disabled={!isHost || !onHostParticipationChange}
                            onClick={() => onHostParticipationChange?.(value, value === "host_player" ? hostPlayerName : undefined)}
                            className={`group relative overflow-hidden rounded-md p-3 text-left transition ${
                              hostParticipation === value
                                ? "bg-slate-950/70 shadow-good ring-2 ring-emerald-300/75"
                                : "bg-slate-950/40 ring-1 ring-slate-700/60 hover:bg-slate-900/70 hover:ring-emerald-300/60"
                            } disabled:cursor-not-allowed`}
                          >
                            <span
                              className={`absolute inset-y-4 left-0 w-1 rounded-r-full transition ${
                                hostParticipation === value ? "bg-emerald-300/80" : "bg-emerald-400/28 group-hover:bg-emerald-300/70"
                              }`}
                            />
                            <p className="font-black leading-tight">{title}</p>
                            {text && <p className="punktlandung-online-host-text mt-1 text-xs leading-5 text-slate-300">{text}</p>}
                          </button>
                        ))}
                      </div>
                      {hostParticipation === "host_player" && (
                        <label className="punktlandung-online-host-name mt-3 block">
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Name</span>
                          <input
                            type="text"
                            value={hostPlayerName}
                            maxLength={18}
                            disabled={!isHost || !onHostParticipationChange}
                            onChange={(event) => onHostParticipationChange?.("host_player", event.target.value)}
                            className="mt-1.5 h-10 w-full rounded-md border-0 bg-slate-950/70 px-3 text-sm font-black text-white outline-none ring-1 ring-slate-700 transition focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="punktlandung-party-rules punktlandung-setup-rules mt-3 border-t border-slate-800/85 pt-3">
                <fieldset disabled={!isHost} className="space-y-2 disabled:opacity-55">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Zeit</p>
                    <div className="mt-1.5 grid grid-cols-5 gap-2">
                      {timeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onSettings({ timeLimitSec: option.value })}
                          className={`h-9 rounded-md px-2 text-[13px] font-black ring-1 transition min-[2200px]:h-20 min-[2200px]:text-2xl ${
                            settings.timeLimitSec === option.value
                              ? "bg-slate-950/70 text-emerald-100 ring-emerald-300/75"
                              : "bg-slate-950/50 text-slate-200 ring-slate-700/50 hover:ring-slate-500"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Runden</p>
                    <div className="mt-1.5 grid grid-cols-4 gap-2">
                      {roundPresets.map((rounds) => (
                        <button
                          key={rounds}
                          type="button"
                          onClick={() => {
                            setCustomRoundText("");
                            onSettings({ rounds });
                          }}
                          className={`h-9 rounded-md px-2 text-[13px] font-black ring-1 transition min-[2200px]:h-20 min-[2200px]:text-2xl ${
                            settings.rounds === rounds ? "bg-slate-950/70 ring-emerald-300/75" : "bg-slate-950/50 ring-slate-700/50 hover:ring-slate-500"
                          }`}
                        >
                          {rounds}
                        </button>
                      ))}
                        <div
                          className={`punktlandung-round-stepper grid h-9 grid-cols-[minmax(0,1fr)_2.35rem] overflow-hidden rounded-md text-[13px] font-black ring-1 transition ${
                          isCustomRoundCount
                            ? "bg-slate-950/70 text-emerald-100 ring-emerald-300/75"
                            : "bg-slate-950/50 text-slate-200 ring-slate-700/50 focus-within:ring-slate-500"
                        }`}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Runden manuell"
                          value={customRoundText}
                          placeholder="frei"
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, "");
                            setCustomRoundText(digits);
                            if (digits !== "") onSettings({ rounds: Math.max(1, Number(digits)) });
                          }}
                          className="min-w-0 bg-transparent px-1 text-center font-black text-inherit outline-none placeholder:text-slate-400"
                        />
                        <div className="punktlandung-round-stepper-controls grid grid-rows-2 border-l border-slate-600/70">
                          <button
                            type="button"
                            aria-label="Runden erhöhen"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              startRoundStepper(1);
                            }}
                            onPointerUp={stopRoundStepper}
                            onPointerCancel={stopRoundStepper}
                            onPointerLeave={stopRoundStepper}
                            className="punktlandung-round-stepper-button grid min-h-0 place-items-center bg-slate-800/90 text-base leading-none text-slate-200 transition hover:bg-emerald-400/20 hover:text-emerald-100 active:bg-emerald-400/25"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            aria-label="Runden verringern"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              startRoundStepper(-1);
                            }}
                            onPointerUp={stopRoundStepper}
                            onPointerCancel={stopRoundStepper}
                            onPointerLeave={stopRoundStepper}
                            className="punktlandung-round-stepper-button grid min-h-0 place-items-center border-t border-slate-600/70 bg-slate-800/90 text-base leading-none text-slate-200 transition hover:bg-emerald-400/20 hover:text-emerald-100 active:bg-emerald-400/25"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        Einschränkungen <span className="tracking-[0.08em] text-slate-500">(optional)</span>
                      </p>
                    </div>
                    <div className="punktlandung-restriction-grid mt-1.5 grid grid-cols-3 gap-2">
                      {[
                        ["noMove", "Nicht bewegen"],
                        ["noPan", "Nicht schwenken"],
                        ["noZoom", "Nicht zoomen"]
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className={`group relative flex min-h-10 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-black ring-1 transition ${
                            settings[key as keyof GameSettings]
                              ? "bg-slate-950/72 text-white ring-emerald-300/65 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                              : "bg-slate-950/40 text-slate-200 ring-slate-700/55 hover:bg-slate-900/60 hover:ring-slate-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(settings[key as keyof GameSettings])}
                            onChange={(event) => onSettings({ [key]: event.target.checked })}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                          <span
                            aria-hidden="true"
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm border-2 transition ${
                              settings[key as keyof GameSettings]
                                ? "border-emerald-300 bg-emerald-400/20 text-emerald-200"
                                : "border-slate-500 bg-slate-800/80 text-transparent group-hover:border-slate-400"
                            }`}
                          >
                            <span className="text-xs leading-none">{settings[key as keyof GameSettings] ? "?" : ""}</span>
                          </span>
                          <span className="leading-tight">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="arcade-panel punktlandung-lobby-categories order-2 min-w-0 rounded-md border-slate-700/70 p-3 md:p-4 lg:order-none lg:h-full min-[2200px]:p-6">
              <div className="punktlandung-category-heading flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-black leading-tight text-white min-[2200px]:text-4xl">{categoryQuestion}</h2>
                </div>
                <p className="max-w-xs text-left text-xs text-slate-400 sm:text-right sm:text-sm min-[2200px]:max-w-lg min-[2200px]:text-xl">{categoryHint}</p>
              </div>
              <div className="punktlandung-category-grid punktlandung-category-grid--preview mt-4 grid grid-cols-2 gap-4 sm:mt-4 sm:gap-4">
                {categoryOptions.map((category) => (
                  <button
                    key={category.id}
                    disabled={!isHost || category.disabled}
                    onClick={() => {
                      if (!category.selectableId) return;
                      onSettings({ category: category.selectableId });
                    }}
                    className={`punktlandung-category-card group relative min-h-[92px] overflow-hidden rounded-md p-3 text-left transition sm:grid sm:min-h-[118px] sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center sm:gap-4 sm:p-5 min-[2200px]:min-h-[180px] min-[2200px]:grid-cols-[minmax(0,1fr)_220px] min-[2200px]:p-7 ${
                      category.disabled
                        ? "punktlandung-preview-dash punktlandung-category-card--preview bg-slate-950/24 ring-0"
                        : category.selectableId && settings.category === category.selectableId
                          ? "punktlandung-category-card--selected bg-slate-950/70 shadow-good ring-2 ring-emerald-300/75"
                          : "punktlandung-category-card--available bg-slate-950/50 ring-1 ring-slate-700/50 hover:bg-slate-900/60 hover:ring-emerald-300/60"
                    } disabled:cursor-not-allowed`}
                  >
                    {!category.disabled && (
                      <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full transition ${category.selectableId && settings.category === category.selectableId ? "bg-emerald-300/80" : "bg-emerald-400/28 group-hover:bg-emerald-300/70"}`} />
                    )}
                    <span className="punktlandung-category-copy relative z-10 block min-w-0">
                      <span className={`punktlandung-category-title block pr-8 text-base font-black leading-tight sm:pr-0 sm:text-[22px] min-[2200px]:text-4xl ${category.disabled ? "text-slate-400" : "text-white"}`}>{category.title}</span>
                      <span className={`punktlandung-category-text mt-2 block text-xs leading-4 sm:mt-3 sm:text-base sm:leading-6 min-[2200px]:text-xl min-[2200px]:leading-8 ${category.disabled ? "text-slate-500" : "text-slate-300"}`}>{category.short}</span>
                      {category.disabled && (
                        <span className="mt-3 inline-block rounded-sm border border-slate-600/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                          SPÄTER
                        </span>
                      )}
                    </span>
                    <span className="punktlandung-category-art relative z-10 hidden h-24 min-w-0 items-center justify-center pr-7 sm:flex sm:h-24 sm:pr-14 min-[2200px]:h-36">
                      <img
                        src={category.icon}
                        alt=""
                        aria-hidden="true"
                        className={`pointer-events-none h-auto w-auto object-contain drop-shadow-[0_0_16px_rgba(52,211,153,0.42)] transition ${category.disabled ? "opacity-45" : "opacity-90 group-hover:scale-105"} ${category.lobbyIconClass}`}
                        draggable={false}
                      />
                    </span>
                    <span className="punktlandung-category-tag absolute right-3 top-3 z-20 text-sm font-black text-indigo-200 sm:text-xl min-[2200px]:right-5 min-[2200px]:top-5 min-[2200px]:text-3xl">
                      {category.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!isSolo && (
            <aside className={`punktlandung-lobby-party-aside ${isOnlineRoom ? "punktlandung-online-aside" : ""} arcade-panel min-h-0 rounded-md border-slate-700/70 p-4`}>
              {isOnlineRoom && (
                <div className="rounded-md bg-slate-950/58 p-3 ring-1 ring-emerald-300/35">
                  {isRoomOnline ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Beitreten</p>
                          <h2 className="mt-1 text-lg font-black leading-tight">QR-Code scannen</h2>
                        </div>
                        <button
                          type="button"
                          onClick={copyInvite}
                          className="rounded-md bg-slate-900/85 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-100 ring-1 ring-emerald-300/45 transition hover:ring-emerald-300/80"
                        >
                          {copied ? "Kopiert" : "Link"}
                        </button>
                      </div>
                      <div className="mt-3 grid place-items-center rounded-md bg-white p-2">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt={`QR-Code fuer Raum ${code}`} className="h-40 w-40" draggable={false} />
                        ) : (
                          <div className="grid h-40 w-40 place-items-center text-center text-xs font-black text-slate-700">QR wird erstellt</div>
                        )}
                      </div>
                      <div className="mt-3 rounded-md bg-slate-900/80 p-3 text-center ring-1 ring-slate-700/70">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Raumcode</p>
                        <p className="mt-1 text-2xl font-black tracking-[0.2em] text-white">{code}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-300">Teile den Link oder Raumcode, damit Spieler beitreten können.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Warteraum</p>
                      <h2 className="mt-1 text-lg font-black leading-tight">Online-Raum vorbereiten</h2>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        Lege zuerst Kategorie und Regeln fest. Danach öffnest du den Warteraum für QR-Code und beitretende Spieler.
                      </p>
                      <p className="mt-2 rounded-md bg-slate-900/70 px-3 py-2 text-xs leading-5 text-slate-300 ring-1 ring-slate-700/70">
                        {hostParticipation === "host_player"
                          ? "Host spielt selbst mit und wird für den Raum vorgemerkt."
                          : "Host verwaltet nur Lobby, Spiel und Ergebnisse."}
                      </p>
                      {connectionStatus !== "open" && (
                        <p className="mt-2 rounded-md bg-slate-900/80 px-3 py-2 text-xs leading-5 text-slate-400 ring-1 ring-slate-700/70">
                          Starte den Raumserver, damit QR-Code und Beitritt verfuegbar werden.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={connectionStatus !== "open" || !onCreateLiveRoom}
                        onClick={onCreateLiveRoom}
                        className="mt-3 min-h-11 w-full rounded-md bg-emerald-400/12 px-3 text-sm font-black uppercase tracking-[0.08em] text-emerald-100 ring-1 ring-emerald-300/55 transition hover:bg-emerald-400/18 hover:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500 disabled:ring-slate-700/70"
                      >
                        {connectionStatus === "open" ? "Online-Raum öffnen" : "Raumserver fehlt"}
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className={`${isOnlineRoom ? "mt-4" : ""} flex items-center justify-between gap-3`}>
                <h2 className="text-lg font-black">Spieler</h2>
                <span className="text-xs font-black text-emerald-300">{players.length}</span>
              </div>
              <div className="mt-3 max-h-[calc(100vh-220px)] space-y-2 overflow-auto pr-1">
                {rankedPlayers.map((player, index) => (
                  <div key={player.id} className="rounded-md bg-slate-950/50 p-3 ring-1 ring-slate-700/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-4 w-4 rounded-full" style={{ background: player.color }} />
                        <span className="truncate font-black">
                          #{index + 1} {player.name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{player.score}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{player.isHost ? "Host" : player.connected ? "Online" : "Offline"}</p>
                    {!isOnlineRoom && settings.mode === "duel" && (
                      <div className="mt-2 flex gap-2">
                        {(["aurora", "pulse"] as TeamId[]).map((team) => (
                          <button
                            key={team}
                            disabled={player.id !== meId}
                            onClick={() => onTeam(team)}
                            className={`flex-1 rounded-md px-2 py-2 text-xs font-black uppercase ring-1 ${
                              player.team === team ? "bg-emerald-400/15 ring-emerald-300/75" : "bg-slate-900/60 ring-slate-700/60"
                            } disabled:cursor-default`}
                          >
                            {team === "aurora" ? "Team A" : "Team B"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {isOnlineRoom && isHost
                  ? hostParticipation === "host_player"
                    ? "Host spielt mit und wird später als Teilnehmer hinzugefügt."
                    : "Großer Bildschirm: Raumleitung und Ergebnisanzeige."
                  : `Du spielst als ${me?.name ?? "Gast"}.`}
              </p>
            </aside>
          )}
        </section>
        {isPlayerEditorOpen && (
          <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/82 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Spieler bearbeiten">
            <div className="w-full max-w-3xl rounded-md border-3 border-emerald-300/70 bg-slate-950 p-4 shadow-[0_28px_70px_rgba(0,0,0,0.55),0_0_44px_rgba(52,211,153,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Spieler</p>
                  <h2 className="mt-1 text-2xl font-black">Namen eintragen</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlayerEditorOpen(false)}
                  className="grid min-h-12 min-w-12 place-items-center rounded-md bg-slate-900 text-xl font-black text-white ring-1 ring-slate-600 transition hover:ring-emerald-300/70"
                  aria-label="Namensfenster schließen"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-300">Optional: Wer nichts einträgt, spielt einfach als Spieler 1, Spieler 2 und so weiter.</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {players.slice(0, settings.localPlayerCount).map((player, index) => (
                  <label
                    key={player.id}
                    className="flex min-h-12 items-center gap-3 rounded-md bg-slate-900/88 px-3 ring-1 ring-slate-700/70 focus-within:ring-emerald-300/80"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white/80 text-xs font-black text-white shadow-[0_0_16px_rgba(0,0,0,0.32)]"
                      style={{ background: player.color }}
                    >
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={player.name}
                      maxLength={18}
                      disabled={!isHost}
                      onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                      onBlur={(event) => {
                        if (event.target.value.trim() === "") onRenamePlayer(player.id, `Spieler ${index + 1}`);
                      }}
                      aria-label={`Name Spieler ${index + 1}`}
                      className="min-w-0 flex-1 bg-transparent text-base font-black text-white outline-none placeholder:text-slate-500 disabled:cursor-default"
                      placeholder={`Spieler ${index + 1}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="punktlandung-touch-only-grid fixed inset-x-2 bottom-2 z-50 grid grid-cols-1 gap-2 rounded-md bg-slate-950/92 p-2 shadow-[0_-18px_44px_rgba(0,0,0,0.32)] ring-1 ring-slate-700/70 backdrop-blur-md lg:hidden">
          <Button sound="select" tone="selected" className="punktlandung-command-button min-h-12 normal-case" disabled={primaryActionDisabled} onClick={handlePrimaryAction}>
            {primaryActionLabel}
          </Button>
        </div>
        </div>
        <AdContainer
          placement={rightRailPlacement}
          variant="rail"
          adFormat={usesModeSidebarAd ? "auto" : undefined}
          label="Anzeige"
          className="hidden h-full min-h-0 xl:block"
          fullWidthResponsive={usesModeSidebarAd}
        />
      </div>
    </main>
  );
}
