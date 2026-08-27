const imageWidthSteps = [800, 1000, 1200, 1400, 1600, 1800, 2200, 2600, 3200, 3840] as const;

export type GameplayImageGeometry = {
  viewportHeight?: number;
  sourceWidth?: number;
  sourceHeight?: number;
};

export type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g" | "unknown";

export function normalizeEffectiveConnectionType(value?: string): EffectiveConnectionType {
  return value === "slow-2g" || value === "2g" || value === "3g" || value === "4g" ? value : "unknown";
}

export function gameplayImageWidth(
  viewportWidth: number,
  devicePixelRatio = 1,
  connection: { effectiveType?: string; saveData?: boolean } = {},
  geometry: GameplayImageGeometry = {}
): number {
  const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1200;
  const safeViewportHeight = Number.isFinite(geometry.viewportHeight) && geometry.viewportHeight! > 0
    ? geometry.viewportHeight!
    : 0;
  const sourceAspectRatio = Number.isFinite(geometry.sourceWidth)
    && Number.isFinite(geometry.sourceHeight)
    && geometry.sourceWidth! > 0
    && geometry.sourceHeight! > 0
    ? geometry.sourceWidth! / geometry.sourceHeight!
    : 0;
  // object-cover can render an image wider than its CSS box when a panoramic
  // source is cropped vertically. Account for that rendered width instead of
  // sizing only from the container width.
  const coveredCssWidth = sourceAspectRatio > 0 && safeViewportHeight > 0
    ? Math.max(safeViewportWidth, safeViewportHeight * sourceAspectRatio)
    : safeViewportWidth;
  const safePixelRatio = Math.min(Math.max(Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1, 1), 2.5);
  const desiredWidth = coveredCssWidth * safePixelRatio * 1.08;
  const roundedWidth = imageWidthSteps.find((width) => width >= desiredWidth) ?? imageWidthSteps.at(-1)!;
  const effectiveType = normalizeEffectiveConnectionType(connection.effectiveType);

  if (connection.saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
    return Math.min(roundedWidth, 800);
  }
  if (effectiveType === "3g") return Math.min(roundedWidth, 1000);
  return roundedWidth;
}

export function directImageFallbackDelayMs(effectiveType?: string): number {
  switch (normalizeEffectiveConnectionType(effectiveType)) {
    case "slow-2g":
    case "2g":
      return 6500;
    case "3g":
      return 5000;
    default:
      return 3200;
  }
}
