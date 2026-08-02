export const PLAYER_PALETTE = [
  "#ff4775",
  "#4e8eff",
  "#938cff",
  "#5ee7bd",
  "#ff9b54",
  "#46cce3",
  "#f472b6",
  "#f6c94c",
  "#9fda5c",
  "#93a4ba"
] as const;

export function playerColorAt(index: number): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return PLAYER_PALETTE[safeIndex % PLAYER_PALETTE.length];
}
