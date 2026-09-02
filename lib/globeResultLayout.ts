export type ResultScreenPoint = { x: number; y: number };

export type ResultScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const RESULT_MAP_CONTROL_LABELS = {
  zoomIn: "Karte vergrößern",
  zoomOut: "Karte verkleinern",
  compassNorth: "Nach Norden ausrichten",
  compassRestore: "Gedrehte Ansicht wiederherstellen"
} as const;

const RESULT_EDGE_INSET_PX = 20;
const RESULT_CONTROL_RAIL_PX = 72;
const RESULT_COMPACT_CONTROL_RAIL_PX = 96;

export const RESULT_ROUTE_DASH_GAP_PX = 9;
export const RESULT_LABEL_VISUAL_GAP_PX = 10;

export function resultSafeRect(width: number, height: number): ResultScreenRect {
  const controlRail = width <= 480 ? RESULT_COMPACT_CONTROL_RAIL_PX : RESULT_CONTROL_RAIL_PX;
  return {
    left: RESULT_EDGE_INSET_PX,
    top: RESULT_EDGE_INSET_PX,
    right: Math.max(RESULT_EDGE_INSET_PX, width - controlRail),
    bottom: Math.max(RESULT_EDGE_INSET_PX, height - RESULT_EDGE_INSET_PX)
  };
}

export function usesCenteredResultInfoOverlay(width: number, height: number): boolean {
  return width <= 480 || (width <= 960 && height <= 480);
}

/** Places a marker label toward the usable map interior instead of outside an
 * endpoint. This keeps the rule independent of coordinates and route length. */
export type ResultLabelVerticalPair = {
  first: "above" | "below";
  second: "above" | "below";
};

/** Keeps the visually northern endpoint label above its pin and the southern
 * endpoint label below. Projected screen order is authoritative after camera
 * rotation and pitch; latitude is only the stable tie-breaker for almost
 * horizontal screen pairs. The final coordinate ordering makes coincident
 * points deterministic without assigning meaning to player/target roles. */
export function resultLabelPairVerticalPlacement(
  firstPoint: ResultScreenPoint,
  secondPoint: ResultScreenPoint,
  firstCoordinates: readonly [number, number],
  secondCoordinates: readonly [number, number]
): ResultLabelVerticalPair {
  const screenDelta = secondPoint.y - firstPoint.y;
  const latitudeDelta = firstCoordinates[1] - secondCoordinates[1];
  const firstIsNorthern = Math.abs(screenDelta) > 0.75
    ? screenDelta > 0
    : Math.abs(latitudeDelta) > 1e-7
      ? latitudeDelta > 0
      : firstCoordinates[0] !== secondCoordinates[0]
        ? firstCoordinates[0] < secondCoordinates[0]
        : true;

  return firstIsNorthern
    ? { first: "above", second: "below" }
    : { first: "below", second: "above" };
}

export type ResultInfoInputMode = "keyboard" | "pointer";

export function shouldRestoreResultTriggerFocus(inputMode: ResultInfoInputMode): boolean {
  return inputMode === "keyboard";
}

/** Chooses the horizontal anchor with the smallest overflow into either map
 * edge or the control rail. Center wins ties to avoid unnecessary jumps. */
export function resultLabelHorizontalPlacement(
  centerX: number,
  labelWidth: number,
  safeRect: ResultScreenRect
): "left" | "center" | "right" {
  const width = Math.max(0, labelWidth);
  const candidates = [
    { placement: "center" as const, left: centerX - width / 2, right: centerX + width / 2 },
    { placement: "right" as const, left: centerX, right: centerX + width },
    { placement: "left" as const, left: centerX - width, right: centerX }
  ];
  const overflow = (candidate: { left: number; right: number }) =>
    Math.max(0, safeRect.left - candidate.left) + Math.max(0, candidate.right - safeRect.right);
  return candidates.reduce((best, candidate) => overflow(candidate) < overflow(best) ? candidate : best).placement;
}

function distance(from: ResultScreenPoint, to: ResultScreenPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export type ResultMarkerOffsets = {
  guess: ResultScreenPoint;
  target: ResultScreenPoint;
  active: boolean;
};

/**
 * Separates result markers only when their projected visuals would cover one
 * another. The displacement follows their real screen-space relationship; an
 * exactly shared point uses a stable vertical split. This is a presentation
 * rule, not a location-specific camera exception.
 */
export function resultMarkerCollisionOffsets(
  guess: ResultScreenPoint,
  target: ResultScreenPoint,
  minimumSeparation = 76
): ResultMarkerOffsets {
  const projectedDistance = distance(guess, target);
  if (projectedDistance >= minimumSeparation) {
    return { guess: { x: 0, y: 0 }, target: { x: 0, y: 0 }, active: false };
  }

  const unit = projectedDistance > 0.5
    ? { x: (target.x - guess.x) / projectedDistance, y: (target.y - guess.y) / projectedDistance }
    : { x: 0, y: -1 };
  const shift = (minimumSeparation - projectedDistance) / 2;
  return {
    guess: { x: -unit.x * shift, y: -unit.y * shift },
    target: { x: unit.x * shift, y: unit.y * shift },
    active: true
  };
}

function pointBetween(from: ResultScreenPoint, to: ResultScreenPoint, progress: number): ResultScreenPoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress
  };
}

export function trimProjectedRoute(
  points: ResultScreenPoint[],
  startGap: number,
  endGap: number
): ResultScreenPoint[] {
  if (points.length < 2) return [];
  const segmentLengths = points.slice(1).map((point, index) => distance(points[index], point));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const startDistance = Math.max(0, startGap);
  const endDistance = totalLength - Math.max(0, endGap);
  if (totalLength <= 0.001 || endDistance <= startDistance + 0.001) return [];

  const pointAtDistance = (wantedDistance: number): ResultScreenPoint => {
    let traversed = 0;
    for (let index = 0; index < segmentLengths.length; index += 1) {
      const segmentLength = segmentLengths[index];
      if (traversed + segmentLength >= wantedDistance) {
        const progress = segmentLength <= 0.001 ? 0 : (wantedDistance - traversed) / segmentLength;
        return pointBetween(points[index], points[index + 1], Math.min(1, Math.max(0, progress)));
      }
      traversed += segmentLength;
    }
    return points.at(-1)!;
  };

  const trimmed = [pointAtDistance(startDistance)];
  let traversed = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    traversed += segmentLengths[index - 1];
    if (traversed > startDistance && traversed < endDistance) trimmed.push(points[index]);
  }
  trimmed.push(pointAtDistance(endDistance));
  return trimmed;
}

export function unionResultRects(rects: ResultScreenRect[]): ResultScreenRect | null {
  if (!rects.length) return null;
  return rects.reduce<ResultScreenRect>((bounds, rect) => ({
    left: Math.min(bounds.left, rect.left),
    top: Math.min(bounds.top, rect.top),
    right: Math.max(bounds.right, rect.right),
    bottom: Math.max(bounds.bottom, rect.bottom)
  }), { ...rects[0] });
}

export function expandResultRect(
  rect: ResultScreenRect,
  inset: { left?: number; top?: number; right?: number; bottom?: number }
): ResultScreenRect {
  return {
    left: rect.left - (inset.left ?? 0),
    top: rect.top - (inset.top ?? 0),
    right: rect.right + (inset.right ?? 0),
    bottom: rect.bottom + (inset.bottom ?? 0)
  };
}

export type ResultFitAdjustment = {
  zoomDelta: number;
  shiftX: number;
  shiftY: number;
  fits: boolean;
};

export function resultFitAdjustment(
  bounds: ResultScreenRect,
  safeRect: ResultScreenRect
): ResultFitAdjustment {
  const boundsWidth = Math.max(1, bounds.right - bounds.left);
  const boundsHeight = Math.max(1, bounds.bottom - bounds.top);
  const safeWidth = Math.max(1, safeRect.right - safeRect.left);
  const safeHeight = Math.max(1, safeRect.bottom - safeRect.top);
  const scaleRatio = Math.max(boundsWidth / safeWidth, boundsHeight / safeHeight);
  if (scaleRatio > 1.001) {
    return {
      zoomDelta: -Math.min(0.8, Math.log2(scaleRatio) + 0.08),
      shiftX: 0,
      shiftY: 0,
      fits: false
    };
  }

  let shiftX = 0;
  let shiftY = 0;
  if (bounds.left < safeRect.left) shiftX = safeRect.left - bounds.left;
  else if (bounds.right > safeRect.right) shiftX = safeRect.right - bounds.right;
  if (bounds.top < safeRect.top) shiftY = safeRect.top - bounds.top;
  else if (bounds.bottom > safeRect.bottom) shiftY = safeRect.bottom - bounds.bottom;
  return {
    zoomDelta: 0,
    shiftX,
    shiftY,
    fits: Math.abs(shiftX) < 0.1 && Math.abs(shiftY) < 0.1
  };
}
