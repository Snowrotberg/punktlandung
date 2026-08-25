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
  targetLabelRevealProgress: number;
  terrainRampProgress: number | null;
  keyframes: CameraKeyframe[];
};

export const RESULT_CAMERA_CONFIG = {
  distanceThresholdKm: {
    short: 15,
    medium: 2_500
  },
  endPitch: {
    short: 48,
    medium: 46,
    long: 42
  },
  terrainExaggeration: 1.5
} as const;

type DistanceAnchor = readonly [distanceKm: number, value: number];

const END_ZOOM_BY_DISTANCE: readonly DistanceAnchor[] = [
  [0.1, 15.4],
  [2, 12.45],
  [10, 10.75],
  [100, 7.95],
  [1_000, 5.1],
  [2_500, 3.7],
  [5_000, 3.05],
  [9_000, 2.68],
  [12_500, 2.42],
  [20_050, 2.24]
] as const;

const DURATION_BY_DISTANCE: readonly DistanceAnchor[] = [
  [0.1, 800],
  [2, 1_000],
  [10, 1_150],
  [100, 1_450],
  [1_000, 1_900],
  [5_000, 2_350],
  [10_000, 2_600],
  [20_050, 2_800]
] as const;

function interpolateDistanceAnchors(distanceKm: number, anchors: readonly DistanceAnchor[]): number {
  const safeDistance = Math.max(0.001, distanceKm);
  if (safeDistance <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [nextDistance, nextValue] = anchors[index];
    if (safeDistance <= nextDistance) {
      const [previousDistance, previousValue] = anchors[index - 1];
      const progress = (Math.log(safeDistance) - Math.log(previousDistance))
        / (Math.log(nextDistance) - Math.log(previousDistance));
      return previousValue + (nextValue - previousValue) * progress;
    }
  }
  return anchors.at(-1)![1];
}

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
  }
];

const EARTH_RADIUS_KM = 6_371.0088;

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

export function buildResultCameraPlan(
  guess: GlobeCoordinates,
  target: GlobeCoordinates,
  options: { compactViewport?: boolean; durationScale?: number } = {}
): ResultCameraPlan {
  const distanceKm = distanceBetweenCoordinatesKm(guess, target);
  const distanceClass = classifyResultDistance(distanceKm);
  // The final mobile framing is refined against the real on-screen marker and
  // label rectangles by GlobeMapLab. Keep this geographic baseline close
  // enough that the globe still fills the result card instead of becoming a
  // small ball surrounded by empty space.
  const compactLongAdjustment = -interpolateDistanceAnchors(distanceKm, [
    [2_500, 0.18],
    [9_000, 0.24],
    [12_500, 0.28],
    [20_050, 0.32]
  ]);
  const compactAdjustment = options.compactViewport
    ? distanceClass === "short" ? -0.18 : distanceClass === "medium" ? -0.2 : compactLongAdjustment
    : 0;
  const direction = initialBearing(guess, target);
  const movementIntensity = clamp((Math.log10(Math.max(distanceKm, 0.1)) + 1) / 4, 0.18, 1);
  const viewportMotionScale = options.compactViewport ? 0.72 : 1;
  const endBearing = clamp(direction - 18, -24, 24) * movementIntensity * viewportMotionScale;
  const midpoint = relationshipCenter(guess, target);
  const durationScale = clamp(options.durationScale ?? 1, 0.65, 1.5);
  const viewportDurationScale = options.compactViewport ? 0.86 : 1;
  const endZoom = interpolateDistanceAnchors(distanceKm, END_ZOOM_BY_DISTANCE);
  const pullback = distanceClass === "short"
    ? interpolateDistanceAnchors(distanceKm, [[0.1, 0.14], [2, 0.24], [15, 0.42]])
    : distanceClass === "medium"
      ? interpolateDistanceAnchors(distanceKm, [[15, 0.42], [100, 0.55], [1_000, 0.64], [2_500, 0.58]])
      : interpolateDistanceAnchors(distanceKm, [[2_500, 0.42], [9_000, 0.32], [20_050, 0.26]]);
  const startLead = distanceClass === "short"
    ? interpolateDistanceAnchors(distanceKm, [[0.1, 0.38], [2, 0.55], [15, 0.72]])
    : distanceClass === "medium"
      ? interpolateDistanceAnchors(distanceKm, [[15, 0.8], [100, 1.15], [1_000, 1.9], [2_500, 2]])
      : 1.8;
  // Once two points approach opposite sides of the globe, a strongly pitched
  // final camera pushes one endpoint behind the horizon even though the
  // geographic midpoint is correct. Preserve the spatial pitch for ordinary
  // intercontinental results, but progressively level the camera for the
  // extreme cases so both pins remain on the visible hemisphere.
  let endPitch = interpolateDistanceAnchors(distanceKm, [
    [0.1, 46],
    [2, 48],
    [10, 48],
    [100, 46],
    [1_000, 43],
    [5_000, 40],
    [10_000, 34],
    [12_500, 26],
    [20_050, options.compactViewport ? 10 : 18]
  ]);
  if (options.compactViewport) {
    endPitch *= distanceClass === "long" ? 0.9 : 0.94;
    if (distanceClass === "long" && distanceKm >= 12_500) endPitch = Math.min(endPitch, 10);
  }

  const profiles = {
    short: {
      startZoom: Math.min(16.2, endZoom + startLead),
      transitZoom: endZoom - pullback,
      startPitch: 43,
      transitPitch: 48,
      curve: interpolateDistanceAnchors(distanceKm, [[0.1, 0.01], [15, 0.12]]),
      revealProgress: 0,
      targetRevealProgress: 0.5,
      terrainRampProgress: 0.12
    },
    medium: {
      startZoom: Math.min(11.4, endZoom + startLead),
      transitZoom: endZoom - pullback,
      startPitch: 38,
      transitPitch: 30,
      curve: interpolateDistanceAnchors(distanceKm, [[15, 0.18], [100, 0.4], [1_000, 0.85], [2_500, 1.2]]),
      revealProgress: 0,
      targetRevealProgress: 0.52,
      terrainRampProgress: 0.66
    },
    long: {
      startZoom: Math.max(5, endZoom + startLead),
      transitZoom: endZoom - pullback,
      startPitch: 34,
      transitPitch: 8,
      curve: 5.5,
      revealProgress: 0,
      targetRevealProgress: 0.46,
      terrainRampProgress: null
    }
  } as const;
  const profile = profiles[distanceClass];
  const startFrame: CameraKeyframe = {
    at: 0,
    center: guess,
    zoom: profile.startZoom + compactAdjustment,
    bearing: endBearing - (distanceClass === "long" ? 14 : 8),
    pitch: profile.startPitch
  };
  const endFrame: CameraKeyframe = {
    at: 1,
    center: midpoint,
    zoom: endZoom + compactAdjustment,
    bearing: endBearing,
    pitch: endPitch
  };
  const keyframes: CameraKeyframe[] = distanceClass === "short"
    ? [
        startFrame,
        {
          at: 0.44,
          center: interpolateGreatCircle(guess, target, 0.3),
          zoom: profile.transitZoom + compactAdjustment,
          bearing: endBearing - 4,
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
            zoom: profile.transitZoom + compactAdjustment,
            bearing: endBearing - 4,
            pitch: 40
          },
          endFrame
        ]
      : [
          startFrame,
          {
            at: 0.34,
            center: curvedRoutePoint(guess, target, 0.2, profile.curve),
            zoom: profile.transitZoom + compactAdjustment,
            bearing: endBearing - 9,
            pitch: profile.transitPitch
          },
          {
            at: 0.7,
            center: curvedRoutePoint(guess, target, 0.4, profile.curve),
            zoom: profile.transitZoom + 0.1 + compactAdjustment,
            bearing: endBearing - 4,
            pitch: 18
          },
          endFrame
        ];

  return {
    distanceClass,
    distanceKm,
    durationMs: Math.round(interpolateDistanceAnchors(distanceKm, DURATION_BY_DISTANCE) * durationScale * viewportDurationScale),
    revealProgress: profile.revealProgress,
    targetRevealProgress: options.compactViewport
      ? Math.min(profile.targetRevealProgress, distanceClass === "long" ? 0.36 : 0.44)
      : profile.targetRevealProgress,
    targetLabelRevealProgress: options.compactViewport
      ? Math.min(profile.targetRevealProgress + 0.1, distanceClass === "long" ? 0.48 : 0.56)
      : profile.targetRevealProgress + 0.12,
    terrainRampProgress: profile.terrainRampProgress,
    keyframes
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
