const imageWidthSteps = [800, 1000, 1200, 1400, 1600, 1800, 2200, 2600] as const;

export type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g" | "unknown";

export function normalizeEffectiveConnectionType(value?: string): EffectiveConnectionType {
  return value === "slow-2g" || value === "2g" || value === "3g" || value === "4g" ? value : "unknown";
}

export function gameplayImageWidth(
  viewportWidth: number,
  devicePixelRatio = 1,
  connection: { effectiveType?: string; saveData?: boolean } = {}
): number {
  const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1200;
  const safePixelRatio = Math.min(Math.max(Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1, 1), 2);
  const desiredWidth = safeViewportWidth * safePixelRatio * 1.15;
  const roundedWidth = imageWidthSteps.find((width) => width >= desiredWidth) ?? imageWidthSteps.at(-1)!;
  const effectiveType = normalizeEffectiveConnectionType(connection.effectiveType);

  if (connection.saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
    return Math.min(roundedWidth, 800);
  }
  if (effectiveType === "3g") return Math.min(roundedWidth, 1000);
  if (safeViewportWidth >= 3000) return Math.min(roundedWidth, 2600);
  if (safeViewportWidth >= 1600) return Math.min(roundedWidth, 2200);
  return Math.min(roundedWidth, 1600);
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
