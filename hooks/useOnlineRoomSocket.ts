"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, GameSettings, HostParticipation, LatLng, RoomState, ServerMessage, TeamId } from "@/types/game";

type ConnectionStatus = "connecting" | "open" | "closed";
const onlineRoomStorageKey = "punktlandung-online-room-v1";
const onlinePlayerStorageKey = "punktlandung-online-player-v1";
const wsUrlStorageKey = "punktlandung-ws-url";

function readStoredOnlineRoomSnapshot(): RoomState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(onlineRoomStorageKey);
    const room = raw ? (JSON.parse(raw) as Partial<RoomState>) : null;
    return room?.kind === "online" ? (room as RoomState) : null;
  } catch {
    return null;
  }
}

function readStoredOnlineRoom(): RoomState | null {
  const room = readStoredOnlineRoomSnapshot();
  return room?.status === "lobby" ? room : null;
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

function readStoredOnlinePlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(onlinePlayerStorageKey);
  } catch {
    return null;
  }
}

function writeStoredOnlinePlayerId(playerId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (playerId) {
      window.sessionStorage.setItem(onlinePlayerStorageKey, playerId);
      return;
    }
    window.sessionStorage.removeItem(onlinePlayerStorageKey);
  } catch {
    // The resume path is best effort when sessionStorage is unavailable.
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
    const restoredRoomSnapshot = readStoredOnlineRoomSnapshot();
    if (restoredRoom) setRoom(restoredRoom);

    const params = new URLSearchParams(window.location.search);
    const sharedWsUrl = params.get("ws");
    const canResumeRouteHost = !params.get("room") && window.location.pathname === "/online-modus";
    const hostname = window.location.hostname;
    const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const defaultWsUrl = isLocalHost ? `${protocol}://${window.location.hostname}:3001` : `${protocol}://${window.location.host}/ws`;
    const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const isValidWsUrl = (value: string | null | undefined): value is string => value?.startsWith("ws://") || value?.startsWith("wss://") || false;

    if (isValidWsUrl(sharedWsUrl)) {
      window.localStorage.setItem(wsUrlStorageKey, sharedWsUrl);
    } else if (!isLocalHost) {
      window.localStorage.removeItem(wsUrlStorageKey);
    }

    const wsUrl =
      isValidWsUrl(sharedWsUrl)
        ? sharedWsUrl
        : isLocalHost && isValidWsUrl(configuredWsUrl)
          ? configuredWsUrl
          : defaultWsUrl;

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
        if (message.type === "hello") {
          const storedRoom = readStoredOnlineRoomSnapshot() ?? restoredRoomSnapshot;
          const previousPlayerId = readStoredOnlinePlayerId() ?? (canResumeRouteHost ? storedRoom?.hostId ?? null : null);
          setPlayerId(message.playerId);
          if (storedRoom?.code && previousPlayerId && previousPlayerId !== message.playerId) {
            socket.send(JSON.stringify({ type: "resume_room", code: storedRoom.code, previousPlayerId } satisfies ClientMessage));
          }
          writeStoredOnlinePlayerId(message.playerId);
        }
        if (message.type === "room_state") {
          writeStoredOnlineRoom(message.state);
          setRoom(message.state);
        }
        if (message.type === "left_room") {
          writeStoredOnlineRoom(null);
          writeStoredOnlinePlayerId(null);
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
      writeStoredOnlinePlayerId(null);
      send({ type: "leave_room" });
    },
    setTeam: (team: TeamId) => send({ type: "set_team", team }),
    send
  };
}
