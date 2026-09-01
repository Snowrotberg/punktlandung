export type GlobeCoordinates = [longitude: number, latitude: number];

export type ResultDistanceClass = "short" | "medium" | "long";

export type ResultCameraScenario = {
  id: string;
  label: string;
  description: string;
  playerName: string;
  targetName: string;
  targetDescription: string;
  guess: GlobeCoordinates;
  target: GlobeCoordinates;
  targetOnly?: boolean;
  kind?: "production" | "experiment";
};

export type CameraKeyframe = {
  at: number;
  center: GlobeCoordinates;
  zoom: number;
  bearing: number;
  pitch: number;
};

export type ResultCameraPlan = {
  distanceClass: ResultDistanceClass;
  distanceKm: number;
  durationMs: number;
  revealProgress: number;
  targetRevealProgress: number;
  terrainRampProgress: number | null;
  targetOnlyEndComposition: boolean;
  guessHideProgress: number | null;
  keyframes: CameraKeyframe[];
};

export type ResultCameraSnapshot = Omit<CameraKeyframe, "at">;

export const RESULT_CAMERA_CONFIG = {
  distanceThresholdKm: {
    short: 90,
    medium: 2_500
  },
  durationMs: {
    short: 1_300,
    medium: 1_900,
    long: 2_700
  },
  endPitch: {
    short: 48,
    medium: 46,
    long: 42
  },
  terrainExaggeration: {
    homePreview: 1,
    result: 1.5
  }
} as const;

// Normal plans stay well above this floor. Near-antipodal relationships need
// the additional space so both endpoints and their labels can share the
// visible hemisphere without a location-specific exception.
export const RESULT_MAP_MIN_ZOOM = 0.5;

export const RESULT_CAMERA_SCENARIOS: ResultCameraScenario[] = [
  {
    id: "short",
    label: "Kurz · Augsburg → München",
    description: "regionaler Push ohne Globe-Rückzug",
    playerName: "#1 Testspieler",
    targetName: "München",
    targetDescription: "München ist die Landeshauptstadt Bayerns und liegt nördlich der Alpen an der Isar.",
    guess: [10.8978, 48.3705],
    target: [11.5761, 48.1372]
  },
  {
    id: "medium",
    label: "Mittel · Köln → München",
    description: "Landesflug mit moderatem Herauszoomen",
    playerName: "#1 Testspieler",
    targetName: "München",
    targetDescription: "München ist die Landeshauptstadt Bayerns und liegt nördlich der Alpen an der Isar.",
    guess: [6.9603, 50.9375],
    target: [11.5761, 48.1372]
  },
  {
    id: "long",
    label: "Groß · Berlin → Tokio",
    description: "sichtbare Globe-Phase und interkontinentale Beziehung",
    playerName: "#1 Testspieler",
    targetName: "Tokio",
    targetDescription: "Tokio ist die Hauptstadt Japans und das politische, wirtschaftliche und kulturelle Zentrum des Landes.",
    guess: [13.405, 52.52],
    target: [139.6917, 35.6895]
  },
  {
    id: "extreme",
    label: "Experiment · 15.000 km über den Antimeridian",
    description: "generischer Stresstest für Vorderseite, Safe Area und Großkreislinie",
    playerName: "#1 Testspieler",
    targetName: "Westpazifik",
    targetDescription: "Ausdrücklich gekennzeichneter Laborfall mit rund 15.000 km Distanz und Antimeridian-Querung.",
    guess: [45, 0],
    target: [-180, 0],
    kind: "experiment"
  }
];

export const EARTH_RADIUS_KM = 6_371.0088;
export const MAX_GREAT_CIRCLE_DISTANCE_KM = Math.PI * EARTH_RADIUS_KM;
export const TARGET_ONLY_END_DISTANCE_KM = MAX_GREAT_CIRCLE_DISTANCE_KM * 0.8;

export function usesTargetOnlyEndComposition(distanceKm: number): boolean {
  return distanceKm >= TARGET_ONLY_END_DISTANCE_KM;
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function toDegrees(value: number): number {
  return value * 180 / Math.PI;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeLongitude(value: number): number {
  return ((value + 540) % 360) - 180;
}

function shortestLongitudeDelta(from: number, to: number): number {
  return normalizeLongitude(to - from);
}

export function distanceBetweenCoordinatesKm(from: GlobeCoordinates, to: GlobeCoordinates): number {
  const latitudeDelta = toRadians(to[1] - from[1]);
  const longitudeDelta = toRadians(shortestLongitudeDelta(from[0], to[0]));
  const fromLatitude = toRadians(from[1]);
  const toLatitude = toRadians(to[1]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function classifyResultDistance(distanceKm: number): ResultDistanceClass {
  if (distanceKm < RESULT_CAMERA_CONFIG.distanceThresholdKm.short) return "short";
  if (distanceKm < RESULT_CAMERA_CONFIG.distanceThresholdKm.medium) return "medium";
  return "long";
}

function initialBearing(from: GlobeCoordinates, to: GlobeCoordinates): number {
  const fromLatitude = toRadians(from[1]);
  const toLatitude = toRadians(to[1]);
  const longitudeDelta = toRadians(shortestLongitudeDelta(from[0], to[0]));
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude)
    - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return normalizeLongitude(toDegrees(Math.atan2(y, x)));
}

function interpolateGreatCircle(from: GlobeCoordinates, to: GlobeCoordinates, progress: number): GlobeCoordinates {
  const fromLatitude = toRadians(from[1]);
  const fromLongitude = toRadians(from[0]);
  const toLatitude = toRadians(to[1]);
  const toLongitude = fromLongitude + toRadians(shortestLongitudeDelta(from[0], to[0]));
  const fromVector = [
    Math.cos(fromLatitude) * Math.cos(fromLongitude),
    Math.cos(fromLatitude) * Math.sin(fromLongitude),
    Math.sin(fromLatitude)
  ];
  const toVector = [
    Math.cos(toLatitude) * Math.cos(toLongitude),
    Math.cos(toLatitude) * Math.sin(toLongitude),
    Math.sin(toLatitude)
  ];
  const dot = clamp(
    fromVector[0] * toVector[0] + fromVector[1] * toVector[1] + fromVector[2] * toVector[2],
    -1,
    1
  );
  const angle = Math.acos(dot);
  if (angle < 0.000001) return from;
  if (Math.PI - angle < 0.00001) {
    // Antipodal points have infinitely many valid great circles. Pick one
    // stable axis so the route and midpoint never collapse into NaN or jump
    // between opposite arcs on maximum-distance guesses.
    const reference = Math.abs(fromVector[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const axisCandidate = [
      fromVector[1] * reference[2] - fromVector[2] * reference[1],
      fromVector[2] * reference[0] - fromVector[0] * reference[2],
      fromVector[0] * reference[1] - fromVector[1] * reference[0]
    ];
    const axisLength = Math.hypot(...axisCandidate);
    const axis = axisCandidate.map((value) => value / axisLength);
    const turn = Math.PI * progress;
    const cross = [
      axis[1] * fromVector[2] - axis[2] * fromVector[1],
      axis[2] * fromVector[0] - axis[0] * fromVector[2],
      axis[0] * fromVector[1] - axis[1] * fromVector[0]
    ];
    const x = fromVector[0] * Math.cos(turn) + cross[0] * Math.sin(turn);
    const y = fromVector[1] * Math.cos(turn) + cross[1] * Math.sin(turn);
    const z = fromVector[2] * Math.cos(turn) + cross[2] * Math.sin(turn);
    return [normalizeLongitude(toDegrees(Math.atan2(y, x))), toDegrees(Math.atan2(z, Math.hypot(x, y)))];
  }
  const denominator = Math.sin(angle);
  const fromWeight = Math.sin((1 - progress) * angle) / denominator;
  const toWeight = Math.sin(progress * angle) / denominator;
  const x = fromVector[0] * fromWeight + toVector[0] * toWeight;
  const y = fromVector[1] * fromWeight + toVector[1] * toWeight;
  const z = fromVector[2] * fromWeight + toVector[2] * toWeight;
  return [normalizeLongitude(toDegrees(Math.atan2(y, x))), toDegrees(Math.atan2(z, Math.hypot(x, y)))];
}

function curvedRoutePoint(
  from: GlobeCoordinates,
  to: GlobeCoordinates,
  progress: number,
  curveStrength: number
): GlobeCoordinates {
  const [longitude, latitude] = interpolateGreatCircle(from, to, progress);
  const heading = toRadians(initialBearing(from, to) + 90);
  const lateral = Math.sin(Math.PI * progress) * curveStrength;
  return [
    normalizeLongitude(longitude + Math.sin(heading) * lateral / Math.max(0.3, Math.cos(toRadians(latitude)))),
    clamp(latitude + Math.cos(heading) * lateral, -82, 82)
  ];
}

function relationshipCenter(guess: GlobeCoordinates, target: GlobeCoordinates): GlobeCoordinates {
  return interpolateGreatCircle(guess, target, 0.5);
}

function resultViewingBearing(guess: GlobeCoordinates, target: GlobeCoordinates): number {
  const longitudeDelta = shortestLongitudeDelta(guess[0], target[0]);
  const latitudeDelta = target[1] - guess[1];
  const axisEpsilon = 0.000001;

  // Choose the viewing side from the unrotated geographic relationship. A
  // north-west/south-east pair is viewed from the south-west toward the
  // north-east; the opposite diagonal is viewed from the south-east toward
  // the north-west. Using the shortest longitude delta keeps this rule intact
  // across the antimeridian instead of interpreting a two-degree step as 358°.
  if (Math.abs(longitudeDelta) > axisEpsilon && Math.abs(latitudeDelta) > axisEpsilon) {
    return longitudeDelta * latitudeDelta < 0 ? 22 : -22;
  }

  // Axis-aligned and nearly coincident pairs do not define a diagonal. Keep a
  // deterministic gentle side view so tiny coordinate noise cannot flip the
  // camera between opposite sides.
  if (Math.abs(longitudeDelta) > axisEpsilon) return longitudeDelta > 0 ? -22 : 22;
  if (Math.abs(latitudeDelta) > axisEpsilon) return latitudeDelta > 0 ? 22 : -22;
  return 22;
}

export function buildResultCameraPlan(
  guess: GlobeCoordinates,
  target: GlobeCoordinates,
  options: { compactViewport?: boolean; durationScale?: number; homePreviewDesktop?: boolean } = {}
): ResultCameraPlan {
  const distanceKm = distanceBetweenCoordinatesKm(guess, target);
  const distanceClass = classifyResultDistance(distanceKm);
  const targetOnlyEndComposition = usesTargetOnlyEndComposition(distanceKm);
  // Compact result maps need additional breathing room for the two badges
  // and the target information card, not just for the geographic points.
  const compactAdjustment = options.compactViewport
    ? distanceClass === "short" ? -0.3 : distanceClass === "medium" ? -0.55 : -0.35
    : 0;
  const endBearing = resultViewingBearing(guess, target);
  const startBearing = endBearing * (distanceClass === "long" ? 0.45 : 0.65);
  const transitBearing = endBearing * 0.82;
  const midpoint = relationshipCenter(guess, target);
  const durationScale = clamp(options.durationScale ?? 1, 0.65, 1.5);

  const interpolateRange = (value: number, from: number, to: number, start: number, end: number) => {
    const progress = clamp((value - from) / Math.max(0.001, to - from), 0, 1);
    return start + (end - start) * progress;
  };
  const longEndZoom = distanceKm < 6_000
    ? interpolateRange(distanceKm, 2_500, 6_000, 3.35, 3.05)
    : distanceKm < 9_000
      ? interpolateRange(distanceKm, 6_000, 9_000, 3.05, 2.65)
      : distanceKm < 12_500
        ? interpolateRange(distanceKm, 9_000, 12_500, 2.65, 2.05)
        : distanceKm < 16_000
          ? interpolateRange(distanceKm, 12_500, 16_000, 2.05, 1.05)
          : interpolateRange(distanceKm, 16_000, 20_020, 1.05, RESULT_MAP_MIN_ZOOM);
  const longTransitZoom = Math.max(RESULT_MAP_MIN_ZOOM, longEndZoom - (distanceKm < 9_000 ? 0.32 : 0.18));
  // Pitch gives regional results depth, but on very large arcs it moves one
  // endpoint behind the globe. Flatten continuously before 15,000 km so the
  // great-circle midpoint remains a shared front-facing end composition.
  const longEndPitch = distanceKm < 6_000
    ? 40
    : distanceKm < 10_000
      ? interpolateRange(distanceKm, 6_000, 10_000, 40, 28)
      : distanceKm < 15_000
        ? interpolateRange(distanceKm, 10_000, 15_000, 28, 0)
        : 0;

  // "Kurz" covers everything from a street-level miss to almost 90 km. A
  // single zoom for that complete range made very close results (including
  // the home-page demo) pull back to a city-wide view. Interpolate on a
  // logarithmic distance scale so nearby pins stay legible and separated,
  // while the established regional composition near the 90 km boundary is
  // preserved.
  const shortDistanceProgress = clamp(
    Math.log2(Math.max(distanceKm, 2) / 2) / Math.log2(RESULT_CAMERA_CONFIG.distanceThresholdKm.short / 2),
    0,
    1
  );
  const shortEndZoom = 12.35 + (9.62 - 12.35) * shortDistanceProgress;
  const homeEndZoomBoost = options.homePreviewDesktop && distanceClass === "short" ? 0.28 : 0;

  const profiles = {
    short: {
      startZoom: Math.min(13.1, shortEndZoom + 0.75),
      transitZoom: shortEndZoom - 0.35,
      endZoom: shortEndZoom,
      startPitch: 43,
      transitPitch: 48,
      curve: 0.08,
      revealProgress: 0,
      targetRevealProgress: 0.84,
      terrainRampProgress: 0.12
    },
    medium: {
      startZoom: 7.1,
      transitZoom: 6.02,
      endZoom: 6.32,
      startPitch: 38,
      transitPitch: 30,
      curve: 0.48,
      revealProgress: 0,
      targetRevealProgress: 0.84,
      terrainRampProgress: 0.66
    },
    long: {
      startZoom: 5.0,
      transitZoom: longTransitZoom,
      endZoom: longEndZoom,
      startPitch: 34,
      transitPitch: 8,
      curve: 5.5,
      revealProgress: 0,
      targetRevealProgress: 0.82,
      terrainRampProgress: null
    }
  } as const;
  const profile = profiles[distanceClass];
  const endPitch = distanceClass === "long" ? longEndPitch : RESULT_CAMERA_CONFIG.endPitch[distanceClass];
  const adjustedZoom = (zoom: number) => Math.max(RESULT_MAP_MIN_ZOOM, zoom + compactAdjustment);

  const startFrame: CameraKeyframe = {
    at: 0,
    center: guess,
    zoom: adjustedZoom(profile.startZoom),
    bearing: startBearing,
    pitch: profile.startPitch
  };
  const endFrame: CameraKeyframe = {
    at: 1,
    center: targetOnlyEndComposition ? target : midpoint,
    zoom: targetOnlyEndComposition ? adjustedZoom(4.15) : adjustedZoom(profile.endZoom + homeEndZoomBoost),
    bearing: endBearing,
    pitch: targetOnlyEndComposition ? 38 : endPitch
  };
  const keyframes: CameraKeyframe[] = distanceClass === "short"
    ? [
        startFrame,
        {
          at: 0.44,
          center: interpolateGreatCircle(guess, target, 0.3),
          zoom: adjustedZoom(profile.transitZoom + homeEndZoomBoost * 0.45),
          bearing: transitBearing,
          pitch: 45
        },
        endFrame
      ]
    : distanceClass === "medium"
      ? [
          startFrame,
          {
            at: 0.55,
            center: curvedRoutePoint(guess, target, 0.32, profile.curve),
            zoom: adjustedZoom(profile.transitZoom),
            bearing: transitBearing,
            pitch: 40
          },
          endFrame
        ]
      : [
          startFrame,
          {
            at: 0.34,
            center: curvedRoutePoint(guess, target, 0.2, profile.curve),
            zoom: adjustedZoom(profile.transitZoom),
            bearing: startBearing,
            pitch: profile.transitPitch
          },
          {
            at: 0.7,
            center: curvedRoutePoint(guess, target, 0.4, profile.curve),
            zoom: adjustedZoom(profile.transitZoom + 0.1),
            bearing: transitBearing,
            pitch: 18
          },
          endFrame
        ];

  return {
    distanceClass,
    distanceKm,
    durationMs: Math.round(RESULT_CAMERA_CONFIG.durationMs[distanceClass] * durationScale),
    revealProgress: profile.revealProgress,
    targetRevealProgress: options.compactViewport
      ? Math.min(profile.targetRevealProgress, distanceClass === "long" ? 0.48 : 0.58)
      : profile.targetRevealProgress,
    terrainRampProgress: profile.terrainRampProgress,
    targetOnlyEndComposition,
    guessHideProgress: targetOnlyEndComposition ? 0.88 : null,
    keyframes
  };
}

export function withResultCameraEndFrame(
  plan: ResultCameraPlan,
  endCamera: ResultCameraSnapshot
): ResultCameraPlan {
  return {
    ...plan,
    keyframes: plan.keyframes.map((frame, index) => index === plan.keyframes.length - 1
      ? { ...frame, ...endCamera, at: 1 }
      : frame)
  };
}

export function buildMunichJourneyKeyframes(): CameraKeyframe[] {
  return [
    { at: 0, center: [8, 24], zoom: 1.35, bearing: 0, pitch: 0 },
    { at: 0.42, center: [5.2, 43.5], zoom: 2.55, bearing: -12, pitch: 17 },
    { at: 0.7, center: [10.5, 50], zoom: 3.75, bearing: -5, pitch: 30 },
    { at: 1, center: [11.5761, 48.1372], zoom: 7.15, bearing: 24, pitch: 47 }
  ];
}

function unwrapValues(values: number[], angular: boolean): number[] {
  if (!angular) return values;
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(result[index - 1] + shortestLongitudeDelta(result[index - 1], values[index]));
  }
  return result;
}

function interpolateHermite(times: number[], inputValues: number[], progress: number, angular = false): number {
  const values = unwrapValues(inputValues, angular);
  let segment = times.length - 2;
  for (let index = 0; index < times.length - 1; index += 1) {
    if (progress <= times[index + 1]) {
      segment = index;
      break;
    }
  }
  const startTime = times[segment];
  const endTime = times[segment + 1];
  const span = Math.max(0.000001, endTime - startTime);
  const local = clamp((progress - startTime) / span, 0, 1);
  const startSlope = segment === 0
    ? (values[1] - values[0]) / span
    : (values[segment + 1] - values[segment - 1]) / (times[segment + 1] - times[segment - 1]);
  const endSlope = segment + 1 === values.length - 1
    ? (values[segment + 1] - values[segment]) / span
    : (values[segment + 2] - values[segment]) / (times[segment + 2] - times[segment]);
  const localSquared = local * local;
  const localCubed = localSquared * local;
  const value = (2 * localCubed - 3 * localSquared + 1) * values[segment]
    + (localCubed - 2 * localSquared + local) * span * startSlope
    + (-2 * localCubed + 3 * localSquared) * values[segment + 1]
    + (localCubed - localSquared) * span * endSlope;
  return angular ? normalizeLongitude(value) : value;
}

export function sampleCameraTimeline(keyframes: CameraKeyframe[], progress: number): Omit<CameraKeyframe, "at"> {
  const times = keyframes.map((keyframe) => keyframe.at);
  const zoomValues = keyframes.map((keyframe) => keyframe.zoom);
  const pitchValues = keyframes.map((keyframe) => keyframe.pitch);
  return {
    center: [
      interpolateHermite(times, keyframes.map((keyframe) => keyframe.center[0]), progress, true),
      clamp(interpolateHermite(times, keyframes.map((keyframe) => keyframe.center[1]), progress), -85, 85)
    ],
    zoom: clamp(interpolateHermite(times, zoomValues, progress), Math.min(...zoomValues), Math.max(...zoomValues)),
    bearing: interpolateHermite(times, keyframes.map((keyframe) => keyframe.bearing), progress, true),
    pitch: clamp(interpolateHermite(times, pitchValues, progress), Math.max(0, Math.min(...pitchValues)), Math.min(70, Math.max(...pitchValues)))
  };
}

export function routeLineCoordinates(guess: GlobeCoordinates, target: GlobeCoordinates): GlobeCoordinates[] {
  return Array.from({ length: 129 }, (_, index) => interpolateGreatCircle(guess, target, index / 128));
}
