export type ResultLabelLane = { dx: number; dy: number };

export function resultMarkerZIndex(rank: number | "target"): number {
  if (rank === "target") return 30_000;
  return Math.max(1_200, 12_000 - Math.max(0, rank) * 1_200);
}

export function resultLabelLaneCandidates({
  anchor,
  viewport,
  label,
  margin,
  rightMargin = margin,
  preferredVerticalSide = 0
}: {
  anchor: { x: number; y: number };
  viewport: { width: number; height: number };
  label: { width: number; height: number };
  margin: number;
  rightMargin?: number;
  preferredVerticalSide?: -1 | 0 | 1;
}): ResultLabelLane[] {
  const gap = 12;
  const availableWidth = Math.max(label.width, viewport.width - margin - rightMargin);
  const availableHeight = Math.max(label.height, viewport.height - margin * 2);
  const columns = Math.max(1, Math.floor((availableWidth + gap) / (label.width + gap)));
  const rows = Math.max(1, Math.floor((availableHeight + gap) / (label.height + gap)));
  const horizontalSlack = Math.max(0, availableWidth - columns * label.width);
  const verticalSlack = Math.max(0, availableHeight - rows * label.height);
  const columnGap = columns > 1 ? horizontalSlack / (columns - 1) : 0;
  const rowGap = rows > 1 ? verticalSlack / (rows - 1) : 0;
  const candidates: ResultLabelLane[] = [];

  for (let row = 0; row < rows; row += 1) {
    const centerY = margin + label.height / 2 + row * (label.height + rowGap);
    const dy = centerY - anchor.y;
    if (preferredVerticalSide && Math.sign(dy) !== preferredVerticalSide) continue;
    for (let column = 0; column < columns; column += 1) {
      const centerX = margin + label.width / 2 + column * (label.width + columnGap);
      candidates.push({ dx: centerX - anchor.x, dy });
    }
  }

  return candidates.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
}
