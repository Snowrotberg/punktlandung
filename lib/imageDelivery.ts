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

  // The browser rejects non-flag images below 760x420 / 420k pixels after
  // loading. A fixed 800/1000 px data-saving cap can never satisfy that
  // contract for wide panoramas, causing valid images to be downloaded and
  // then discarded. Keep the network cap for ordinary images, but raise it to
  // the smallest existing thumbnail step that can pass the same quality gate.
  const minimumQualityWidth = sourceAspectRatio > 0
    ? Math.max(760, 420 * sourceAspectRatio, Math.sqrt(420_000 * sourceAspectRatio))
    : 0;
  const qualityWidth = minimumQualityWidth > 0
    ? imageWidthSteps.find((width) => width >= minimumQualityWidth) ?? imageWidthSteps.at(-1)!
    : 0;
  const networkBoundedWidth = (cap: number) => Math.max(Math.min(roundedWidth, cap), qualityWidth);

  if (connection.saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
    return networkBoundedWidth(800);
  }
  if (effectiveType === "3g") return networkBoundedWidth(1000);
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
