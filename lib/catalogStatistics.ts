import { locationVisualKey } from "@/data/locations";
import type { GeoLocation, LocationCategory, LocationDifficulty } from "@/types/game";

export type CatalogCategory = Exclude<LocationCategory, "mixed" | "streetview">;

export const catalogCategoryOrder: CatalogCategory[] = [
  "cities",
  "capitals",
  "landmarks",
  "landscapes",
  "flags"
];

export const catalogCategoryLabels: Record<CatalogCategory, string> = {
  cities: "Städte",
  capitals: "Hauptstädte",
  landmarks: "Wahrzeichen",
  landscapes: "Landschaften",
  flags: "Flaggen"
};

export const catalogDifficultyOrder: LocationDifficulty[] = ["easy", "medium", "hard"];

export const catalogDifficultyLabels: Record<LocationDifficulty, string> = {
  easy: "Leicht",
  medium: "Mittel",
  hard: "Schwer"
};

export type CatalogCategoryStatistics = {
  category: CatalogCategory;
  total: number;
  easy: number;
  medium: number;
  hard: number;
};

export type CatalogStatistics = {
  totalTasks: number;
  uniqueVisuals: number;
  countriesAndTerritories: number;
  reviewedImages: number;
  featuredOrQualityImages: number;
  recentlyCapturedImages: number;
  averageImageQualityScore: number | null;
  categories: CatalogCategoryStatistics[];
};

export function buildCatalogStatistics(locations: GeoLocation[]): CatalogStatistics {
  const categories = catalogCategoryOrder.map((category) => {
    const entries = locations.filter((location) => location.category === category);
    return {
      category,
      total: entries.length,
      easy: entries.filter((location) => location.difficulty === "easy").length,
      medium: entries.filter((location) => location.difficulty === "medium").length,
      hard: entries.filter((location) => location.difficulty === "hard").length
    };
  });

  const qualityScores = locations
    .map((location) => location.imageQualityScore)
    .filter((score): score is number => Number.isFinite(score));
  const recentCutoff = Date.UTC(new Date().getUTCFullYear() - 5, 0, 1);

  return {
    totalTasks: locations.length,
    uniqueVisuals: new Set(locations.map(locationVisualKey)).size,
    countriesAndTerritories: new Set(locations.map((location) => location.countryCode).filter(Boolean)).size,
    reviewedImages: locations.filter((location) => location.imageReviewStatus === "approved").length,
    featuredOrQualityImages: locations.filter((location) =>
      location.commonsQualityAssessment === "featured" || location.commonsQualityAssessment === "quality"
    ).length,
    recentlyCapturedImages: locations.filter((location) => {
      const capturedAt = location.imageCapturedAt ? Date.parse(location.imageCapturedAt) : Number.NaN;
      return Number.isFinite(capturedAt) && capturedAt >= recentCutoff;
    }).length,
    averageImageQualityScore: qualityScores.length
      ? Math.round((qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length) * 100) / 100
      : null,
    categories
  };
}
