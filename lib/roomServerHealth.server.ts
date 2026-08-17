type RoomServerHealthPayload = {
  ok?: boolean;
  checkedAt?: string;
  uptimeSeconds?: number;
  memory?: {
    rssBytes?: number;
    heapUsedBytes?: number;
    heapTotalBytes?: number;
  };
  capacity?: {
    status?: "ok" | "warning" | "full";
    connections?: { active?: number; limit?: number };
    rooms?: { active?: number; limit?: number };
  };
};

export type RoomServerHealth = {
  available: boolean;
  latencyMs: number | null;
  checkedAt: string | null;
  uptimeSeconds: number | null;
  rssBytes: number | null;
  heapUsedBytes: number | null;
  heapTotalBytes: number | null;
  status: "ok" | "warning" | "full" | "offline";
  activeConnections: number | null;
  activeRooms: number | null;
};

export async function readRoomServerHealth(): Promise<RoomServerHealth> {
  const configured = process.env.ROOM_SERVER_HEALTH_URL?.trim();
  const port = Number(process.env.WS_PORT ?? 3001);
  const url = configured || (Number.isInteger(port) && port > 0 ? `http://127.0.0.1:${port}/` : "");
  const offline: RoomServerHealth = {
    available: false,
    latencyMs: null,
    checkedAt: null,
    uptimeSeconds: null,
    rssBytes: null,
    heapUsedBytes: null,
    heapTotalBytes: null,
    status: "offline",
    activeConnections: null,
    activeRooms: null
  };
  if (!url) return offline;

  const startedAt = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2_000) });
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    if (!response.ok) return { ...offline, latencyMs };
    const payload = await response.json() as RoomServerHealthPayload;
    if (payload.ok !== true) return { ...offline, latencyMs };
    const status = payload.capacity?.status;
    return {
      available: true,
      latencyMs,
      checkedAt: typeof payload.checkedAt === "string" ? payload.checkedAt : null,
      uptimeSeconds: Number.isFinite(payload.uptimeSeconds) ? payload.uptimeSeconds! : null,
      rssBytes: Number.isFinite(payload.memory?.rssBytes) ? payload.memory!.rssBytes! : null,
      heapUsedBytes: Number.isFinite(payload.memory?.heapUsedBytes) ? payload.memory!.heapUsedBytes! : null,
      heapTotalBytes: Number.isFinite(payload.memory?.heapTotalBytes) ? payload.memory!.heapTotalBytes! : null,
      status: status === "warning" || status === "full" ? status : "ok",
      activeConnections: Number.isFinite(payload.capacity?.connections?.active) ? payload.capacity!.connections!.active! : null,
      activeRooms: Number.isFinite(payload.capacity?.rooms?.active) ? payload.capacity!.rooms!.active! : null
    };
  } catch {
    return offline;
  }
}
