import type { GameSettings, GeoLocation } from "@/types/game";
import { filterLocationsByDifficulty } from "@/lib/locationDifficulty";

export function locationVisualKey(location: GeoLocation): string {
  return (location.imageFile || location.panoramaUrl).normalize("NFC").trim().toLocaleLowerCase();
}

/**
 * Raises reviewed Commons images gently instead of hiding the legacy catalog.
 * A reviewed image occupies roughly every third slot while both groups retain
 * their previously shuffled order.
 */
export function prioritizeCatalogImages(locations: GeoLocation[]): GeoLocation[] {
  const reviewed = locations.filter((location) =>
    location.imageReviewStatus === "approved" && Number.isFinite(location.imageQualityScore)
  ).sort((first, second) => {
    const priority = (location: GeoLocation) => {
      const assessment = location.commonsQualityAssessment === "featured"
        ? 3
        : location.commonsQualityAssessment === "quality"
          ? 2
          : location.commonsQualityAssessment === "valued"
            ? 1
            : 0;
      const capturedYear = location.imageCapturedAt ? new Date(location.imageCapturedAt).getUTCFullYear() : 0;
      const recency = capturedYear >= new Date().getUTCFullYear() - 5 ? 1 : 0;
      const megapixels = ((location.imageWidth ?? 0) * (location.imageHeight ?? 0)) / 1_000_000;
      const resolution = megapixels >= 8 ? 1 : 0;
      return assessment * 10 + recency * 2 + resolution + (location.imageQualityScore ?? 0) / 100;
    };
    return priority(second) - priority(first);
  });
  if (reviewed.length === 0) return locations;
  const legacy = locations.filter((location) =>
    location.imageReviewStatus !== "approved" || !Number.isFinite(location.imageQualityScore)
  );
  const prioritized: GeoLocation[] = [];
  let reviewedIndex = 0;
  let legacyIndex = 0;
  while (reviewedIndex < reviewed.length || legacyIndex < legacy.length) {
    if (reviewedIndex < reviewed.length) prioritized.push(reviewed[reviewedIndex++]);
    for (let count = 0; count < 2 && legacyIndex < legacy.length; count += 1) {
      prioritized.push(legacy[legacyIndex++]);
    }
  }
  return prioritized;
}

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function shuffledLocationIds(
  locations: readonly GeoLocation[],
  category: GameSettings["category"],
  difficulty: GameSettings["difficulty"],
  requiredCount: number,
  recentLocationIds: string[],
  previousLocationId?: string | null
): string[] {
  if (locations.length === 0) return [];
  const pool = category === "mixed" ? locations : locations.filter((location) => location.category === category);
  const categoryPool = pool.length > 0 ? pool : locations;
  const uniqueVisuals = categoryPool.filter((location, index, candidates) =>
    candidates.findIndex((candidate) => locationVisualKey(candidate) === locationVisualKey(location)) === index
  );
  const preferred = difficulty === "mixed" ? uniqueVisuals : filterLocationsByDifficulty(uniqueVisuals, difficulty);
  const preferredIds = new Set(preferred.map((location) => location.id));
  const fallback = preferred.length >= requiredCount
    ? []
    : uniqueVisuals.filter((location) => !preferredIds.has(location.id));
  const recentVisuals = new Set(recentLocationIds
    .map((id) => locations.find((location) => location.id === id))
    .filter((location): location is GeoLocation => Boolean(location))
    .map(locationVisualKey));

  const shuffled = (items: readonly GeoLocation[]) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  };
  const orderGroup = (items: readonly GeoLocation[]) => [
    ...prioritizeCatalogImages(shuffled(items.filter((location) => !recentVisuals.has(locationVisualKey(location))))),
    ...prioritizeCatalogImages(shuffled(items.filter((location) => recentVisuals.has(locationVisualKey(location)))))
  ];
  const ordered = [...orderGroup(preferred), ...orderGroup(fallback)];
  const previous = previousLocationId
    ? locations.find((location) => location.id === previousLocationId)
    : null;

  if (previous && ordered.length > 1 && locationVisualKey(ordered[0]) === locationVisualKey(previous)) {
    const swapIndex = ordered.findIndex((location, index) => index > 0 && locationVisualKey(location) !== locationVisualKey(previous));
    if (swapIndex > 0) [ordered[0], ordered[swapIndex]] = [ordered[swapIndex], ordered[0]];
  }

  return uniqueIds(ordered.map((location) => location.id));
}
