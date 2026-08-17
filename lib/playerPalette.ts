export const PLAYER_PALETTE = [
  "#ff4775",
  "#938cff",
  "#fb923c",
  "#4e8eff",
  "#f6c94c",
  "#22c55e",
  "#e879f9",
  "#22d3ee",
  "#a3e635",
  "#93a4ba"
] as const;

export function playerColorAt(index: number): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return PLAYER_PALETTE[safeIndex % PLAYER_PALETTE.length];
}

export function playerColorForId(
  players: readonly { id: string }[] | undefined,
  playerId: string | null | undefined,
  fallbackIndex = 0
): string {
  const index = playerId ? players?.findIndex((player) => player.id === playerId) ?? -1 : -1;
  return playerColorAt(index >= 0 ? index : fallbackIndex);
}
