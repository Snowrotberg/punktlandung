export function resultWorldMinimumZoom(width: number, accountHistory: boolean): number {
  if (accountHistory) return Math.max(0, Math.log2(Math.max(1, width) / 256));
  return Math.max(1, Math.ceil(Math.log2(Math.max(1, width) / 256)));
}
