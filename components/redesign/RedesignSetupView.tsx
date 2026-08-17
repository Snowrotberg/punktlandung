"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  Building2,
  CircleAlert,
  Crown,
  Flag,
  Globe2,
  Landmark,
  MapPin,
  Mountain,
  RotateCcw,
  Satellite,
  Sparkles,
  UserRound,
  UsersRound
} from "lucide-react";
import { LegalLinks } from "@/components/LegalLinks";
import { TriangleIcon } from "@/components/TriangleIcon";
import { categoryOptions } from "@/lib/categories";
import { playerColorAt } from "@/lib/playerPalette";
import type { GameDifficulty, GameSettings, HostParticipation, Player, RoomKind } from "@/types/game";
import { RedesignBrand, RedesignButton, RedesignFooter, RedesignHeader, RedesignShell, RedesignStatusControls } from "./RedesignPrimitives";
import styles from "./RedesignSetupView.module.css";

type Props = {
  roomKind: RoomKind;
  settings: GameSettings;
  players: Player[];
  playerName: string;
  hostParticipation: HostParticipation;
  connectionStatus: "connecting" | "open" | "closed";
  soundEnabled: boolean;
  accountHref?: string;
  accountAuthenticated?: boolean;
  canStart: boolean;
  starting?: boolean;
  error?: string | null;
  onSettings: (settings: Partial<GameSettings>) => void;
  onRenamePlayer: (playerId: string, name: string) => void;
  onHostParticipationChange?: (value: HostParticipation, playerName?: string) => void;
  onStart: () => void;
  onBack: () => void;
  onSoundToggle: () => void;
};

const timeOptions = [[15, "15 s"], [30, "30 s"], [60, "60 s"]] as const;
// Legacy-Links mit "mixed" bleiben kompatibel, die Auswahl bietet aber nur drei Stufen.
const difficultyOptions: Array<[GameDifficulty, string]> = [["easy", "Leicht"], ["medium", "Mittel"], ["hard", "Schwer"]];
const modeOptions = [
  { id: "solo", label: "Solo", href: "/solo-modus", icon: UserRound },
  { id: "couch", label: "Party", href: "/party-modus", icon: UsersRound },
  { id: "online", label: "Online-Raum", href: "/online-modus", icon: Globe2 }
] as const;
const categoryIcons = [Sparkles, Landmark, Building2, Mountain, Flag, Crown, Satellite, MapPin];

type NumericStepperProps = {
  value: number;
  presets: readonly number[];
  step: number;
  min: number;
  max: number;
  suffix?: string;
  inputLabel: string;
  increaseLabel: string;
  decreaseLabel: string;
  className: string;
  onChange: (value: number) => void;
};

function NumericStepper({ value, presets, step, min, max, suffix = "", inputLabel, increaseLabel, decreaseLabel, className, onChange }: NumericStepperProps) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const valueRef = useRef(value);
  const repeatDelayRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  valueRef.current = value;

  const clamp = (nextValue: number) => Math.min(max, Math.max(min, Math.round(nextValue)));
  const displayedValue = editing ? draft : presets.includes(value) ? "" : String(value);

  const changeValue = (nextValue: number) => {
    const clampedValue = clamp(nextValue);
    valueRef.current = clampedValue;
    setDraft(String(clampedValue));
    onChange(clampedValue);
  };

  const stepValue = (direction: -1 | 1) => {
    const baseValue = valueRef.current > 0 ? valueRef.current : min;
    changeValue(baseValue + direction * step);
  };

  const stopRepeating = () => {
    if (repeatDelayRef.current !== null) window.clearTimeout(repeatDelayRef.current);
    if (repeatIntervalRef.current !== null) window.clearInterval(repeatIntervalRef.current);
    repeatDelayRef.current = null;
    repeatIntervalRef.current = null;
  };

  const startRepeating = (event: ReactPointerEvent<HTMLButtonElement>, direction: -1 | 1) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopRepeating();
    stepValue(direction);
    repeatDelayRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => stepValue(direction), 180);
    }, 450);
  };

  useEffect(() => stopRepeating, []);

  return (
    <span className={className} data-active={editing || !presets.includes(value) || undefined}>
      <span className={styles.customValue}>
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={inputLabel}
          value={displayedValue}
          placeholder="Frei"
          onFocus={(event) => {
            const input = event.currentTarget;
            setEditing(true);
            const nextDraft = presets.includes(value) ? "" : String(value);
            setDraft(nextDraft);
            window.requestAnimationFrame(() => input.select());
          }}
          onChange={(event) => {
            const digits = event.currentTarget.value.replace(/\D/g, "").slice(0, 3);
            setDraft(digits);
            if (digits) {
              const nextValue = clamp(Number(digits));
              valueRef.current = nextValue;
              onChange(nextValue);
            }
          }}
          onBlur={() => {
            setEditing(false);
            setDraft("");
          }}
        />
        {suffix && displayedValue && <span aria-hidden="true">{suffix}</span>}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        onPointerDown={(event) => startRepeating(event, 1)}
        onPointerUp={stopRepeating}
        onPointerCancel={stopRepeating}
        onLostPointerCapture={stopRepeating}
        onClick={(event) => { if (event.detail === 0) stepValue(1); }}
      >+</button>
      <button
        type="button"
        aria-label={decreaseLabel}
        onPointerDown={(event) => startRepeating(event, -1)}
        onPointerUp={stopRepeating}
        onPointerCancel={stopRepeating}
        onLostPointerCapture={stopRepeating}
        onClick={(event) => { if (event.detail === 0) stepValue(-1); }}
      >−</button>
    </span>
  );
}

function isGeneratedPlayerName(name: string, index: number): boolean {
  return name.trim() === `Spieler ${index + 1}`;
}

function modeHref(href: string, settings: GameSettings): string {
  const query = new URLSearchParams({
    time: String(settings.timeLimitSec),
    rounds: String(settings.rounds),
    difficulty: settings.difficulty,
    category: settings.category,
    noMove: settings.noMove ? "1" : "0",
    noPan: settings.noPan ? "1" : "0",
    noZoom: settings.noZoom ? "1" : "0"
  });
  return `${href}?${query.toString()}`;
}

export function RedesignSetupView({
  roomKind,
  settings,
  players,
  playerName,
  hostParticipation,
  connectionStatus,
  soundEnabled,
  accountHref,
  accountAuthenticated,
  canStart,
  starting = false,
  error,
  onSettings,
  onRenamePlayer,
  onHostParticipationChange,
  onStart,
  onBack,
  onSoundToggle
}: Props) {
  const [namesOpen, setNamesOpen] = useState(false);
  const activeMode = roomKind === "online" ? "online" : settings.localMode;
  const isParty = activeMode === "couch";
  const isOnline = activeMode === "online";

  const reset = () => onSettings({
    timeLimitSec: 60,
    rounds: 15,
    difficulty: "medium",
    category: "mixed",
    noMove: false,
    noPan: false,
    noZoom: false,
    localPlayerCount: isParty ? 2 : 1
  });

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <RedesignBrand />
            <RedesignStatusControls connectionStatus={connectionStatus} soundEnabled={soundEnabled} playerName={playerName} accountHref={accountHref} accountAuthenticated={accountAuthenticated} onSoundToggle={onSoundToggle} />
          </RedesignHeader>

          <div className={styles.intro}>
            <div><span>Neue Partie</span><h1>{activeMode === "solo" ? "Was willst du erraten?" : "Was wollt ihr erraten?"}</h1><p>{activeMode === "solo" ? "Wähle eine Kategorie und passe die Runde an." : isOnline ? "Gemeinsam im virtuellen Raum: Wählt eine Kategorie und passt die Runde an." : "Wählt eine Kategorie und passt die Runde an."}</p></div>
            <div className={styles.introActions}>
              {error && (
                <p role="alert" className={styles.startError}>
                  <CircleAlert aria-hidden="true" />
                  <span>{error}</span>
                </p>
              )}
              <RedesignButton onClick={onBack}><TriangleIcon direction="left" />Zurück</RedesignButton>
              <RedesignButton tone="primary" disabled={!canStart} onClick={onStart}>{starting ? "Wird gestartet..." : "Spiel starten"}<TriangleIcon direction="right" /></RedesignButton>
              <small>{activeMode === "solo" ? "Solo" : isParty ? "Party" : "Online-Raum"} · {settings.rounds} Runden · {settings.timeLimitSec ? `${settings.timeLimitSec} s` : "frei"}</small>
            </div>
          </div>

          <div className={styles.workspace}>
            <div className={styles.settingsColumn}>
              <div className={styles.columnHeading}><span>Einstellungen</span></div>
              <section className={styles.settingsPanel} aria-label="Spieleinstellungen">
              <div className={styles.modeTabs} aria-label="Spielweise">
                {modeOptions.map(({ id, label, href, icon: Icon }) => <Link key={id} href={modeHref(href, settings)} data-active={activeMode === id || undefined}><Icon />{label}</Link>)}
              </div>

              {isParty && (
                <div className={styles.controlGroup}>
                  <label>Spieleranzahl</label>
                  <div className={styles.playerCount}>
                    {Array.from({ length: 9 }, (_, index) => index + 2).map((count) => (
                      <button key={count} style={{ "--player-color": playerColorAt(count - 1) } as CSSProperties} data-active={settings.localPlayerCount === count || undefined} onClick={() => onSettings({ localPlayerCount: count })}>{count}</button>
                    ))}
                  </div>
                  <button type="button" className={styles.namesButton} onClick={() => setNamesOpen(true)}>Namen bearbeiten</button>
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

              <div className={styles.controlGroup}><label>Zeit pro Runde</label><div className={styles.timeOptions}>{timeOptions.map(([value, label]) => <button key={value} data-active={settings.timeLimitSec === value || undefined} onClick={() => onSettings({ timeLimitSec: value })}>{label}</button>)}<NumericStepper className={styles.customTime} value={settings.timeLimitSec} presets={[15, 30, 60]} step={5} min={5} max={999} suffix="s" inputLabel="Zeit pro Runde frei eingeben" increaseLabel="Zeit pro Runde erhöhen" decreaseLabel="Zeit pro Runde verringern" onChange={(timeLimitSec) => onSettings({ timeLimitSec })} /></div></div>
              <div className={styles.controlGroup}><label>Runden</label><div className={styles.roundOptions}>{[10, 15, 20].map((value) => <button key={value} data-active={settings.rounds === value || undefined} onClick={() => onSettings({ rounds: value })}>{value}</button>)}<NumericStepper className={styles.customRounds} value={settings.rounds} presets={[10, 15, 20]} step={1} min={1} max={999} inputLabel="Rundenzahl frei eingeben" increaseLabel="Rundenzahl erhöhen" decreaseLabel="Rundenzahl verringern" onChange={(rounds) => onSettings({ rounds })} /></div></div>
              <div className={styles.controlGroup}><label>Schwierigkeit</label><div className={styles.threeOptions}>{difficultyOptions.map(([value, label]) => <button key={value} data-active={settings.difficulty === value || undefined} onClick={() => onSettings({ difficulty: value })}>{label}</button>)}</div></div>
              <div className={styles.controlGroup}><label>Einschränkung <small>(optional)</small></label><div className={styles.restrictionOptions}><button data-active={settings.noZoom || undefined} onClick={() => onSettings({ noZoom: !settings.noZoom })}>Kein Bildzoom</button></div></div>
              <RedesignButton tone="text" className={styles.resetButton} onClick={reset}><RotateCcw />Standard wiederherstellen</RedesignButton>
              </section>
            </div>

            <div className={styles.categoriesColumn}>
              <div className={styles.columnHeading}><span>Kategorien</span></div>
              <section className={styles.categories} aria-label="Spielkategorien">
                {categoryOptions.map((category, index) => {
                  const Icon = categoryIcons[index];
                  const selected = category.selectableId === settings.category;
                  return <button key={category.id} disabled={category.disabled} data-active={selected || undefined} onClick={() => category.selectableId && onSettings({ category: category.selectableId })}><span className={styles.categoryIcon}><Icon /></span><span><strong>{category.title}</strong><small>{category.short}</small></span><b>{category.tag}</b></button>;
                })}
              </section>
            </div>
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" className={styles.setupLegal} /></RedesignFooter>
        </RedesignShell>
      </div>

      {isParty && namesOpen && (
        <div className={styles.nameEditorBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNamesOpen(false); }}>
          <section className={styles.nameEditor} role="dialog" aria-modal="true" aria-labelledby="player-names-title">
            <div className={styles.nameEditorHeader}>
              <div><span>Party</span><h2 id="player-names-title">Spielernamen bearbeiten</h2></div>
              <button type="button" aria-label="Namensbearbeitung schließen" onClick={() => setNamesOpen(false)}>×</button>
            </div>
            <div className={styles.nameGrid}>
              {players.slice(0, settings.localPlayerCount).map((player, index) => (
                <label
                  key={player.id}
                  className={styles.nameField}
                  style={{ "--player-color": playerColorAt(index) } as CSSProperties}
                >
                  <input
                    value={player.name}
                    onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                    onFocus={(event) => {
                      if (isGeneratedPlayerName(player.name, index)) event.currentTarget.select();
                    }}
                    onPointerUp={(event) => {
                      if (isGeneratedPlayerName(player.name, index)) {
                        event.preventDefault();
                        event.currentTarget.select();
                      }
                    }}
                    onBlur={(event) => {
                      if (!event.currentTarget.value.trim()) onRenamePlayer(player.id, `Spieler ${index + 1}`);
                    }}
                    aria-label={`Name von Spieler ${index + 1}`}
                  />
                </label>
              ))}
            </div>
            <RedesignButton tone="primary" className={styles.nameEditorDone} onClick={() => setNamesOpen(false)}>Fertig<TriangleIcon direction="right" /></RedesignButton>
          </section>
        </div>
      )}
    </main>
  );
}
