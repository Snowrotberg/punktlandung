"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2 } from "lucide-react";
import { LegalLinks } from "@/components/LegalLinks";
import { TriangleIcon } from "@/components/TriangleIcon";
import { categoryOptions } from "@/lib/categories";
import { playerColorAt } from "@/lib/playerPalette";
import type { GameSettings, HostParticipation, Player, TeamId } from "@/types/game";
import {
  PlayerAvatar,
  RedesignBrand,
  RedesignButton,
  RedesignFooter,
  RedesignHeader,
  RedesignShell,
  RedesignStatusControls
} from "./RedesignPrimitives";
import styles from "./RedesignWaitingRoomView.module.css";

type Props = {
  code: string;
  players: Player[];
  meId: string | null;
  isHost: boolean;
  settings: GameSettings;
  hostParticipation: HostParticipation;
  connectionStatus: "connecting" | "open" | "closed";
  soundEnabled: boolean;
  accountHref?: string;
  accountAuthenticated?: boolean;
  canStart: boolean;
  onStart: () => void;
  onTeam: (team: TeamId) => void;
  onLeave: () => void;
  onSoundToggle: () => void;
};

function inviteFor(code: string) {
  if (typeof window === "undefined") return { link: "", reachable: false };
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const url = new URL(configuredOrigin || window.location.origin);
  url.searchParams.set("room", code);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return { link: url.toString(), reachable: !loopback };
}

export function RedesignWaitingRoomView({
  code,
  players,
  meId,
  isHost,
  settings,
  hostParticipation,
  connectionStatus,
  soundEnabled,
  accountHref,
  accountAuthenticated,
  canStart,
  onStart,
  onTeam,
  onLeave,
  onSoundToggle
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "code" | "invite">("idle");
  const invite = useMemo(() => inviteFor(code), [code]);
  const selectedCategory = categoryOptions.find((category) => category.selectableId === settings.category);

  useEffect(() => {
    if (!invite.link || !invite.reachable) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(invite.link, {
      errorCorrectionLevel: "H",
      margin: 3,
      width: 720,
      color: { dark: "#070b14", light: "#ffffff" }
    }).then((value) => {
      if (!cancelled) setQrDataUrl(value);
    }).catch(() => {
      if (!cancelled) setQrDataUrl("");
    });
    return () => { cancelled = true; };
  }, [invite.link, invite.reachable]);

  const markCopied = (state: "code" | "invite") => {
    setCopyState(state);
    window.setTimeout(() => setCopyState("idle"), 1400);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      markCopied("code");
    } catch {
      setCopyState("idle");
    }
  };

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Punktlandung", text: `Tritt meinem Raum ${code} bei.`, url: invite.link });
      } else {
        await navigator.clipboard.writeText(invite.link);
      }
      markCopied("invite");
    } catch {
      setCopyState("idle");
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.header}>
            <RedesignBrand />
            <RedesignStatusControls connectionStatus={connectionStatus} soundEnabled={soundEnabled} accountHref={accountHref} accountAuthenticated={accountAuthenticated} onSoundToggle={onSoundToggle} />
          </RedesignHeader>

          <div className={styles.intro}>
            <div>
              <span>Online-Raum · Verbunden</span>
              <h1>Warteraum</h1>
              <p>Teilt den Code, wählt Teams und startet gemeinsam.</p>
            </div>
            <div className={styles.introActions}>
              <RedesignButton onClick={onLeave}><TriangleIcon direction="left" />Verlassen</RedesignButton>
              <RedesignButton tone="primary" disabled={!isHost || players.length === 0 || !canStart} onClick={onStart}>Starten<TriangleIcon direction="right" /></RedesignButton>
            </div>
          </div>

          <div className={styles.workspace}>
            <section className={styles.joinPanel} aria-labelledby="join-title">
              <div className={styles.panelHeading}>
                <div><span>Beitreten</span><h2 id="join-title">QR-Code</h2></div>
                <small>Mit dem Smartphone scannen</small>
              </div>
              <div className={styles.qrBox}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR-Code für Raum ${code}`} draggable={false} />
                ) : invite.reachable ? (
                  <p>QR-Code wird erstellt …</p>
                ) : (
                  <div className={styles.localHint}><strong>Lokaler Link nicht per Handy erreichbar</strong><small>Öffne Punktlandung über eine Netzwerk- oder Freigabe-Adresse.</small></div>
                )}
              </div>
              <div className={styles.roomCode}>
                <span>Raumcode</span>
                <strong>{code}</strong>
              </div>
              <div className={styles.inviteActions}>
                <RedesignButton onClick={copyCode}><Copy />{copyState === "code" ? "Code kopiert" : "Code kopieren"}</RedesignButton>
                <RedesignButton onClick={shareInvite}><Share2 />{copyState === "invite" ? "Einladung kopiert" : "Einladung teilen"}</RedesignButton>
              </div>
            </section>

            <section className={styles.playersPanel} aria-labelledby="players-title">
              <div className={styles.playersHeading}>
                <div><span>Spieler · {players.length}/10</span><h2 id="players-title">Alle bereit?</h2></div>
                <small><i data-online={connectionStatus === "open" || undefined} />Raumserver verbunden</small>
              </div>
              <div className={styles.playerList}>
                {players.length === 0 ? <p className={styles.empty}>Noch niemand ist beigetreten.</p> : players.map((player, index) => (
                  <article key={player.id} className={styles.playerRow}>
                    <PlayerAvatar name={player.name} playerIndex={index} color={playerColorAt(index)} />
                    <div className={styles.playerName}><strong>{player.name}</strong><small>{player.isHost ? "Host" : player.team === "aurora" ? "Team Rot" : "Team Blau"}</small></div>
                    {settings.mode === "duel" && player.id === meId ? (
                      <div className={styles.teamButtons}>
                        <button data-active={player.team === "aurora" || undefined} onClick={() => onTeam("aurora")}>Rot</button>
                        <button data-active={player.team === "pulse" || undefined} onClick={() => onTeam("pulse")}>Blau</button>
                      </div>
                    ) : <span className={styles.ready}>{player.connected ? "Bereit" : "Offline"}</span>}
                  </article>
                ))}
              </div>
              <div className={styles.roundSummary}>
                <div><span>Kategorie</span><strong>{selectedCategory?.title ?? settings.category}</strong></div>
                <div><span>Schwierigkeit</span><strong>{settings.difficulty === "mixed" ? "Gemischt" : settings.difficulty === "easy" ? "Leicht" : settings.difficulty === "medium" ? "Mittel" : "Schwer"}</strong></div>
                <div><span>Runden</span><strong>{settings.rounds}</strong></div>
                <div><span>Zeit</span><strong>{settings.timeLimitSec ? `${settings.timeLimitSec} s` : "Frei"}</strong></div>
              </div>
              <p className={styles.hostHint}>{hostParticipation === "host_player" ? "Der Host spielt mit." : "Der große Bildschirm moderiert den Raum."}</p>
            </section>
          </div>

          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
      </div>
    </main>
  );
}
