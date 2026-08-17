import type { GeoLocation, LocationDifficulty } from "../types/game";

type CatalogCategory = Exclude<GeoLocation["category"], "mixed" | "streetview">;

const initialDifficultyShares: Record<CatalogCategory, { easy: number; medium: number }> = {
  landmarks: { easy: 0.3, medium: 0.4 },
  cities: { easy: 0.35, medium: 0.4 },
  landscapes: { easy: 0.2, medium: 0.4 },
  flags: { easy: 0.35, medium: 0.35 },
  capitals: { easy: 0.35, medium: 0.4 }
};

function fallbackPopularity(location: GeoLocation): number {
  if (Number.isFinite(location.popularity)) return location.popularity as number;
  return location.difficulty === "easy" ? 300 : location.difficulty === "hard" ? 0 : 150;
}

/**
 * Builds a usable initial difficulty distribution from catalog popularity.
 * Runtime metrics can later override individual entries after enough verified
 * plays. This prevents a newly deployed catalog from having empty pools.
 */
export function applyInitialCatalogDifficultyBands(locations: GeoLocation[]): GeoLocation[] {
  const result = new Map<string, LocationDifficulty>();

  for (const category of Object.keys(initialDifficultyShares) as CatalogCategory[]) {
    const categoryLocations = locations
      .filter((location) => location.category === category)
      .sort((left, right) => fallbackPopularity(right) - fallbackPopularity(left)
        || left.title.localeCompare(right.title, "de")
        || left.id.localeCompare(right.id));
    const shares = initialDifficultyShares[category];
    const easyEnd = Math.round(categoryLocations.length * shares.easy);
    const mediumEnd = easyEnd + Math.round(categoryLocations.length * shares.medium);

    categoryLocations.forEach((location, index) => {
      result.set(location.id, index < easyEnd ? "easy" : index < mediumEnd ? "medium" : "hard");
    });
  }

  return locations.map((location) => {
    const difficulty = result.get(location.id);
    return difficulty ? { ...location, difficulty } : location;
  });
}

/** Returns the current catalog classification without mutating catalog data. */
export function locationDifficultyMap(locations: GeoLocation[]): Map<string, LocationDifficulty> {
  return new Map(locations.map((location) => [location.id, location.difficulty ?? "medium"]));
}

export function filterLocationsByDifficulty(
  locations: GeoLocation[],
  difficulty: LocationDifficulty | "mixed"
): GeoLocation[] {
  if (difficulty === "mixed") return locations;
  const classifications = locationDifficultyMap(locations);
  return locations.filter((location) => classifications.get(location.id) === difficulty);
}

/**
 * Prefer the requested difficulty, but keep a category playable when the
 * catalog contains fewer matching locations than the requested round count.
 * The caller can shuffle the returned pool; the preferred locations remain
 * first so the fallback only fills the shortage.
 */
export function playableLocationsForDifficulty(
  locations: GeoLocation[],
  difficulty: LocationDifficulty | "mixed",
  minimumCount: number
): GeoLocation[] {
  if (difficulty === "mixed") return [...locations];

  const preferred = filterLocationsByDifficulty(locations, difficulty);
  if (preferred.length >= minimumCount) return preferred;

  const preferredIds = new Set(preferred.map((location) => location.id));
  return [...preferred, ...locations.filter((location) => !preferredIds.has(location.id))];
}

export type LocationDifficultyOverride = {
  locationId: string;
  suggestedDifficulty: LocationDifficulty;
  confidence: "insufficient" | "provisional" | "stable";
};

/**
 * Applies persisted, server-maintained classifications to a copy of the
 * catalog. Insufficient samples deliberately keep the catalog fallback.
 */
export function applyLocationDifficultyOverrides(
  locations: GeoLocation[],
  overrides: LocationDifficultyOverride[]
): GeoLocation[] {
  const classifications = new Map(
    overrides
      .filter((override) => override.confidence !== "insufficient")
      .map((override) => [override.locationId, override.suggestedDifficulty])
  );

  return locations.map((location) => {
    const difficulty = classifications.get(location.id);
    return difficulty ? { ...location, difficulty } : location;
  });
}

export type LocationDifficultyMetrics = {
  /** Only server-verified rounds from comparable rulesets belong here. */
  verifiedRounds: number;
  averagePoints: number;
  successRate: number;
  medianResponseRatio: number;
};

export type LocationDifficultyDecision = {
  difficulty: LocationDifficulty;
  confidence: "insufficient" | "provisional" | "stable";
  sampleSize: number;
};

/** A single server-verified round used by the automatic catalog evaluator. */
export type VerifiedLocationRoundObservation = {
  locationId: string;
  points: number;
  responseTimeMs: number;
  timeLimitSec: 15 | 30 | 60;
  successful: boolean;
};

/**
 * Aggregates verified round observations by image/location.
 *
 * This is deliberately independent from the database: a scheduled server job
 * can feed it rows from ranked_rounds/ranked_guesses, while tests and an admin
 * preview can use the exact same calculation. Free, unverified and malformed
 * observations must be filtered before this function is called.
 */
export function buildLocationDifficultyMetrics(
  observations: VerifiedLocationRoundObservation[]
): Map<string, LocationDifficultyMetrics> {
  const grouped = new Map<string, VerifiedLocationRoundObservation[]>();

  for (const observation of observations) {
    if (!observation.locationId.trim()
      || !Number.isFinite(observation.points)
      || observation.points < 0
      || observation.points > 5000
      || !Number.isFinite(observation.responseTimeMs)
      || observation.responseTimeMs < 0
      || ![15, 30, 60].includes(observation.timeLimitSec)
      || typeof observation.successful !== "boolean") {
      throw new Error("Verified location round observation is invalid.");
    }

    const locationObservations = grouped.get(observation.locationId) ?? [];
    locationObservations.push(observation);
    grouped.set(observation.locationId, locationObservations);
  }

  const result = new Map<string, LocationDifficultyMetrics>();
  for (const [locationId, locationObservations] of grouped) {
    const responseRatios = locationObservations
      .map((observation) => clamp(
        observation.responseTimeMs / (observation.timeLimitSec * 1000),
        0,
        1
      ))
      .sort((left, right) => left - right);
    const middle = Math.floor(responseRatios.length / 2);
    const medianResponseRatio = responseRatios.length % 2 === 0
      ? (responseRatios[middle - 1] + responseRatios[middle]) / 2
      : responseRatios[middle];

    result.set(locationId, {
      verifiedRounds: locationObservations.length,
      averagePoints: locationObservations.reduce((sum, observation) => sum + observation.points, 0)
        / locationObservations.length,
      successRate: locationObservations.filter((observation) => observation.successful).length
        / locationObservations.length,
      medianResponseRatio
    });
  }

  return result;
}

export const MINIMUM_DIFFICULTY_SAMPLES = 15;
export const STABLE_DIFFICULTY_SAMPLES = 50;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validMetrics(metrics: LocationDifficultyMetrics): boolean {
  return Number.isSafeInteger(metrics.verifiedRounds)
    && metrics.verifiedRounds >= 0
    && Number.isFinite(metrics.averagePoints)
    && metrics.averagePoints >= 0
    && metrics.averagePoints <= 5000
    && Number.isFinite(metrics.successRate)
    && metrics.successRate >= 0
    && metrics.successRate <= 1
    && Number.isFinite(metrics.medianResponseRatio)
    && metrics.medianResponseRatio >= 0
    && metrics.medianResponseRatio <= 1;
}

/**
 * Classifies an image from comparable, server-verified rounds only.
 *
 * The response ratio is relative to the selected time limit, so changing from
 * 15 to 60 seconds does not make the same image look artificially harder.
 * With too little data we retain the existing/default classification instead
 * of letting a handful of players move a location between difficulty pools.
 */
export function classifyLocationDifficulty(
  metrics: LocationDifficultyMetrics,
  fallback: LocationDifficulty = "medium"
): LocationDifficultyDecision {
  if (!validMetrics(metrics)) throw new Error("Location difficulty metrics are invalid.");
  if (metrics.verifiedRounds < MINIMUM_DIFFICULTY_SAMPLES) {
    return { difficulty: fallback, confidence: "insufficient", sampleSize: metrics.verifiedRounds };
  }

  const errorScore = 1 - metrics.averagePoints / 5000;
  const missScore = 1 - metrics.successRate;
  const timeScore = clamp(metrics.medianResponseRatio, 0, 1);
  const difficultyScore = 0.55 * errorScore + 0.3 * missScore + 0.15 * timeScore;
  const difficulty = difficultyScore >= 0.62 ? "hard" : difficultyScore <= 0.34 ? "easy" : "medium";

  return {
    difficulty,
    confidence: metrics.verifiedRounds >= STABLE_DIFFICULTY_SAMPLES ? "stable" : "provisional",
    sampleSize: metrics.verifiedRounds
  };
}
