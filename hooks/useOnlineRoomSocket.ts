"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, GameSettings, HostParticipation, LatLng, RoomState, ServerMessage, TeamId } from "@/types/game";

type ConnectionStatus = "connecting" | "open" | "closed";
const onlineRoomStorageKey = "punktlandung-online-room-v1";

function readStoredOnlineRoom(): RoomState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(onlineRoomStorageKey);
    const room = raw ? (JSON.parse(raw) as Partial<RoomState>) : null;
    return room?.kind === "online" && room.status === "lobby" ? (room as RoomState) : null;
  } catch {
    return null;
  }
}

function writeStoredOnlineRoom(room: RoomState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (room?.kind === "online") {
      window.sessionStorage.setItem(onlineRoomStorageKey, JSON.stringify(room));
      return;
    }
    window.sessionStorage.removeItem(onlineRoomStorageKey);
  } catch {
    // Online rooms still work in memory when sessionStorage is unavailable.
  }
}

export function useOnlineRoomSocket() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: number | null = null;
    let stopped = false;
    const restoredRoom = readStoredOnlineRoom();
    if (restoredRoom) setRoom(restoredRoom);

    const params = new URLSearchParams(window.location.search);
    const sharedWsUrl = params.get("ws");
    if (sharedWsUrl?.startsWith("ws://") || sharedWsUrl?.startsWith("wss://")) {
      window.localStorage.setItem("punktlandung-ws-url", sharedWsUrl);
    }
    const storedWsUrl = window.localStorage.getItem("punktlandung-ws-url");
    const hostname = window.location.hostname;
    const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const defaultWsUrl = isLocalHost ? `${protocol}://${window.location.hostname}:3001` : `${protocol}://${window.location.host}/ws`;
    const wsUrl =
      sharedWsUrl?.startsWith("ws://") || sharedWsUrl?.startsWith("wss://")
        ? sharedWsUrl
        : storedWsUrl && !isLocalHost
          ? storedWsUrl
          : process.env.NEXT_PUBLIC_WS_URL ?? defaultWsUrl;

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1200);
    };

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => setStatus("open"));
      socket.addEventListener("error", () => {
        setStatus("closed");
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        setStatus("closed");
        scheduleReconnect();
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === "hello") setPlayerId(message.playerId);
        if (message.type === "room_state") {
          writeStoredOnlineRoom(message.state);
          setRoom(message.state);
        }
        if (message.type === "left_room") {
          writeStoredOnlineRoom(null);
          setRoom(null);
        }
        if (message.type === "error") setError(message.message);
      });
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("WebSocket ist noch nicht verbunden.");
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const isHost = useMemo(() => Boolean(room && playerId && room.hostId === playerId), [playerId, room]);
  const me = useMemo(() => room?.players.find((player) => player.id === playerId) ?? null, [playerId, room]);

  return {
    playerId,
    room,
    error,
    status,
    isHost,
    me,
    clearError: () => setError(null),
    createOnlineRoom: (options: { hostParticipation: HostParticipation; playerName?: string }) => send({ type: "create_online_room", ...options }),
    joinRoom: (code: string, playerName: string) => send({ type: "join_room", code, playerName }),
    updateSettings: (settings: Partial<GameSettings>) => send({ type: "update_settings", settings }),
    renamePlayer: (_playerIdToRename: string, _name: string) => undefined,
    startRound: () => send({ type: "start_round" }),
    submitGuess: (guess: LatLng & { countryCode?: string }, targetPlayerId?: string) =>
      send({ type: "submit_guess", guess, countryCode: guess.countryCode, playerId: targetPlayerId }),
    cancelRound: () => send({ type: "cancel_round" }),
    skipLocation: (locationId?: string) => send({ type: "skip_location", locationId }),
    restart: () => send({ type: "restart" }),
    leaveRoom: () => {
      writeStoredOnlineRoom(null);
      send({ type: "leave_room" });
    },
    setTeam: (team: TeamId) => send({ type: "set_team", team }),
    send
  };
}
