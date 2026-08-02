"use client";

import "@fontsource-variable/inter";
import type { CSSProperties } from "react";
import {
  Building2,
  CircleDot,
  Flag,
  Globe2,
  Landmark,
  MapPin,
  Mountain,
  Radio,
  RotateCcw,
  Satellite,
  Sparkles,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX
} from "lucide-react";
import { AdContainer } from "@/components/AdContainer";
import { LegalLinks } from "@/components/LegalLinks";
import { TriangleIcon } from "@/components/TriangleIcon";
import { categoryOptions } from "@/lib/categories";
import { playerColorAt } from "@/lib/playerPalette";
import type { GameDifficulty, GameSettings, HostParticipation, Player, RoomKind } from "@/types/game";
import { RedesignButton, RedesignFooter, RedesignHeader, RedesignShell } from "./RedesignPrimitives";
import styles from "./RedesignSetupView.module.css";

type Props = {
  roomKind: RoomKind;
  settings: GameSettings;
  players: Player[];
  playerName: string;
  hostParticipation: HostParticipation;
  connectionStatus: "connecting" | "open" | "closed";
  soundEnabled: boolean;
  canStart: boolean;
  onSettings: (settings: Partial<GameSettings>) => void;
  onRenamePlayer: (playerId: string, name: string) => void;
  onHostParticipationChange?: (value: HostParticipation, playerName?: string) => void;
  onStart: () => void;
  onBack: () => void;
  onSoundToggle: () => void;
};

const timeOptions = [[10, "10 s"], [30, "30 s"], [60, "60 s"], [120, "2 min"], [0, "Frei"]] as const;
const difficultyOptions: Array<[GameDifficulty, string]> = [["mixed", "Gemischt"], ["easy", "Leicht"], ["medium", "Mittel"], ["hard", "Schwer"]];
const modeOptions = [
  { id: "solo", label: "Solo", href: "/solo-modus", icon: UserRound },
  { id: "couch", label: "Party", href: "/party-modus", icon: UsersRound },
  { id: "online", label: "Online", href: "/online-modus", icon: Globe2 }
] as const;
const categoryIcons = [Sparkles, Landmark, Building2, Mountain, Flag, Landmark, Satellite, MapPin];

export function RedesignSetupView({
  roomKind,
  settings,
  players,
  playerName,
  hostParticipation,
  connectionStatus,
  soundEnabled,
  canStart,
  onSettings,
  onRenamePlayer,
  onHostParticipationChange,
  onStart,
  onBack,
  onSoundToggle
}: Props) {
  const activeMode = roomKind === "online" ? "online" : settings.localMode;
  const serverState = connectionStatus === "open" ? "online" : connectionStatus === "connecting" ? "connecting" : "offline";
  const isParty = activeMode === "couch";
  const isOnline = activeMode === "online";
  const adMode = isParty ? "party" : activeMode;

  const reset = () => onSettings({
    timeLimitSec: 60,
    rounds: 15,
    difficulty: "mixed",
    category: "mixed",
    noMove: false,
    noPan: false,
    noZoom: false,
    localPlayerCount: isParty ? 2 : 1
  });

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <AdContainer placement={`${adMode}-left-rail`} variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <a href="/" className={styles.brand}><span><MapPin /></span>Punktlandung</a>
            <div className={styles.topActions}>
              <a href="/feedback" className={styles.beta}><CircleDot /><b>Öffentliche Beta</b></a>
              <span className={styles.server} data-state={serverState} title={`Server ${serverState}`}><Radio /><b>Server</b></span>
              <button className={styles.iconButton} onClick={onSoundToggle} aria-label={soundEnabled ? "Sound ausschalten" : "Sound einschalten"}>{soundEnabled ? <Volume2 /> : <VolumeX />}</button>
              <button className={styles.iconButton} aria-label="Account"><UserRound /></button>
            </div>
          </RedesignHeader>

          <div className={styles.intro}>
            <div><span>Neue Partie</span><h1>{activeMode === "solo" ? "Was willst du erraten?" : "Was wollt ihr erraten?"}</h1><p>{activeMode === "solo" ? "Wähle eine Kategorie und passe die Runde an." : isOnline ? "Gemeinsam im virtuellen Raum: Wählt eine Kategorie und passt die Runde an." : "Wählt eine Kategorie und passt die Runde an."}</p></div>
            <div className={styles.introActions}>
              <RedesignButton onClick={onBack}><TriangleIcon direction="left" />Zurück</RedesignButton>
              <RedesignButton tone="primary" disabled={!canStart} onClick={onStart}>Starten<TriangleIcon direction="right" /></RedesignButton>
              <small>{activeMode === "solo" ? "Solo" : isParty ? "Party" : "Online"} · {settings.rounds} Runden · {settings.timeLimitSec ? `${settings.timeLimitSec} s` : "frei"}</small>
            </div>
          </div>

          <div className={styles.workspace}>
            <section className={styles.settingsPanel} aria-label="Spieleinstellungen">
              <div className={styles.modeHeading}><span>Modus</span><button onClick={reset}><RotateCcw />Standard</button></div>
              <div className={styles.modeTabs}>
                {modeOptions.map(({ id, label, href, icon: Icon }) => <a key={id} href={href} data-active={activeMode === id || undefined}><Icon />{label}</a>)}
              </div>

              {isParty && (
                <div className={styles.controlGroup}>
                  <label>Spieleranzahl</label>
                  <div className={styles.playerCount}>
                    {Array.from({ length: 9 }, (_, index) => index + 2).map((count) => (
                      <button key={count} style={{ "--player-color": playerColorAt(count - 1) } as CSSProperties} data-active={settings.localPlayerCount === count || undefined} onClick={() => onSettings({ localPlayerCount: count })}>{count}</button>
                    ))}
                  </div>
                  <details className={styles.names}><summary>Namen bearbeiten</summary>{players.slice(0, settings.localPlayerCount).map((player) => <input key={player.id} value={player.name} onChange={(event) => onRenamePlayer(player.id, event.target.value)} aria-label={`Name von ${player.name}`} />)}</details>
                </div>
              )}

              {isOnline && (
                <div className={styles.controlGroup}>
                  <label>Hostrolle</label>
                  <div className={styles.twoOptions}>
                    <button data-active={hostParticipation === "host_player" || undefined} onClick={() => onHostParticipationChange?.("host_player", playerName)}>Host spielt mit</button>
                    <button data-active={hostParticipation === "host_only" || undefined} onClick={() => onHostParticipationChange?.("host_only")}>Nur moderieren</button>
                  </div>
                </div>
              )}

              <div className={styles.controlGroup}><label>Zeit pro Runde</label><div className={styles.fiveOptions}>{timeOptions.map(([value, label]) => <button key={value} data-active={settings.timeLimitSec === value || undefined} onClick={() => onSettings({ timeLimitSec: value })}>{label}</button>)}</div></div>
              <div className={styles.controlGroup}><label>Runden</label><div className={styles.roundOptions}>{[10, 15, 20].map((value) => <button key={value} data-active={settings.rounds === value || undefined} onClick={() => onSettings({ rounds: value })}>{value}</button>)}<span className={styles.customRounds}><b>{[10, 15, 20].includes(settings.rounds) ? "frei" : settings.rounds}</b><button onClick={() => onSettings({ rounds: settings.rounds + 1 })}>+</button><button onClick={() => onSettings({ rounds: Math.max(1, settings.rounds - 1) })}>−</button></span></div></div>
              <div className={styles.controlGroup}><label>Schwierigkeit</label><div className={styles.fourOptions}>{difficultyOptions.map(([value, label]) => <button key={value} data-active={settings.difficulty === value || undefined} onClick={() => onSettings({ difficulty: value })}>{label}</button>)}</div></div>
              <div className={styles.controlGroup}><label>Einschränkungen <small>(optional)</small></label><div className={styles.threeOptions}><button data-active={settings.noMove || undefined} onClick={() => onSettings({ noMove: !settings.noMove })}>Nicht bewegen</button><button data-active={settings.noPan || undefined} onClick={() => onSettings({ noPan: !settings.noPan })}>Nicht schwenken</button><button data-active={settings.noZoom || undefined} onClick={() => onSettings({ noZoom: !settings.noZoom })}>Nicht zoomen</button></div></div>
            </section>

            <section className={styles.categories} aria-label="Kategorien">
              {categoryOptions.map((category, index) => {
                const Icon = categoryIcons[index];
                const selected = category.selectableId === settings.category;
                return <button key={category.id} disabled={category.disabled} data-active={selected || undefined} onClick={() => category.selectableId && onSettings({ category: category.selectableId })}><span className={styles.categoryIcon}><Icon /></span><span><strong>{category.title}</strong><small>{category.short}</small></span><b>{category.tag}</b></button>;
              })}
            </section>
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
        <AdContainer placement={`${adMode}-right-rail`} variant="rail" label="Anzeige" className={styles.rail} fullWidthResponsive />
      </div>
    </main>
  );
}
