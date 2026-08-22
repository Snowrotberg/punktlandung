import { locationVisualKey } from "@/data/locations";
import type { GeoLocation, LocationCategory, LocationDifficulty } from "@/types/game";
import {
  catalogImageCaptureYear,
  catalogImageDisplayTier,
  catalogImageIssues,
  catalogMinimumCaptureYear,
  isStrictCatalogImage,
  type CatalogImageIssue
} from "@/lib/catalogImageQuality";

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
  sourceTasks: number;
  excludedByQuality: number;
  uniqueVisuals: number;
  countriesAndTerritories: number;
  sourceCountriesAndTerritories: number;
  reviewedImages: number;
  featuredOrQualityImages: number;
  recentlyCapturedImages: number;
  captureMetadataImages: number;
  currentImages: number;
  desktopReadyImages: number;
  tvReadyImages: number;
  fourKReadyImages: number;
  strictQualifiedImages: number;
  exclusionReasons: Record<CatalogImageIssue, number>;
  averageImageQualityScore: number | null;
  categories: CatalogCategoryStatistics[];
};

export function buildCatalogStatistics(locations: GeoLocation[], inventory: GeoLocation[] = locations): CatalogStatistics {
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
  const exclusionReasons: Record<CatalogImageIssue, number> = {
    quarantined: 0,
    "category-unverified": 0,
    "quality-score-low": 0,
    "capture-date-missing": 0,
    "captured-before-2010": 0,
    "dimensions-missing": 0,
    "resolution-below-tv": 0,
    "aspect-ratio-unsuitable": 0
  };
  inventory.forEach((location) => {
    catalogImageIssues(location).forEach((issue) => {
      exclusionReasons[issue] += 1;
    });
  });

  return {
    totalTasks: locations.length,
    sourceTasks: inventory.length,
    excludedByQuality: Math.max(0, inventory.length - locations.length),
    uniqueVisuals: new Set(locations.map(locationVisualKey)).size,
    countriesAndTerritories: new Set(locations.map((location) => location.countryCode).filter(Boolean)).size,
    sourceCountriesAndTerritories: new Set(inventory.map((location) => location.countryCode).filter(Boolean)).size,
    reviewedImages: locations.filter((location) => location.imageReviewStatus === "approved").length,
    featuredOrQualityImages: locations.filter((location) =>
      location.commonsQualityAssessment === "featured" || location.commonsQualityAssessment === "quality"
    ).length,
    recentlyCapturedImages: locations.filter((location) => {
      const capturedAt = location.imageCapturedAt ? Date.parse(location.imageCapturedAt) : Number.NaN;
      return Number.isFinite(capturedAt) && capturedAt >= recentCutoff;
    }).length,
    captureMetadataImages: inventory.filter((location) => location.category === "flags" || catalogImageCaptureYear(location) !== null).length,
    currentImages: inventory.filter((location) => location.category === "flags" || (catalogImageCaptureYear(location) ?? 0) >= catalogMinimumCaptureYear).length,
    desktopReadyImages: inventory.filter((location) => ["desktop", "tv", "tv-4k"].includes(catalogImageDisplayTier(location))).length,
    tvReadyImages: inventory.filter((location) => ["tv", "tv-4k"].includes(catalogImageDisplayTier(location))).length,
    fourKReadyImages: inventory.filter((location) => catalogImageDisplayTier(location) === "tv-4k").length,
    strictQualifiedImages: inventory.filter(isStrictCatalogImage).length,
    exclusionReasons,
    averageImageQualityScore: qualityScores.length
      ? Math.round((qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length) * 100) / 100
      : null,
    categories
  };
}
