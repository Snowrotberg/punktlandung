import type { GeoLocation } from "@/types/game";
import { isLandscapeContextExcluded } from "@/lib/landscapeImageQuality";

export const catalogMinimumCaptureYear = 2010;
export const catalogMinimumTvWidth = 2560;
export const catalogMinimumTvHeight = 1440;
export const catalogMinimumAspectRatio = 1.25;
export const catalogMaximumAspectRatio = 3;
export const catalogMinimumCuratedScore = 8;

export type CatalogDisplayTier = "insufficient" | "mobile" | "desktop" | "tv" | "tv-4k";
export type CatalogImageIssue =
  | "quarantined"
  | "category-unverified"
  | "quality-score-low"
  | "context-unusable"
  | "capture-date-missing"
  | "captured-before-2010"
  | "dimensions-missing"
  | "resolution-below-tv"
  | "aspect-ratio-unsuitable";

export function catalogImageCaptureYear(location: GeoLocation): number | null {
  if (!location.imageCapturedAt) return null;
  const year = new Date(location.imageCapturedAt).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

export function catalogImageDisplayTier(location: GeoLocation): CatalogDisplayTier {
  if (location.category === "flags") return "tv-4k";
  const width = location.imageWidth ?? 0;
  const height = location.imageHeight ?? 0;
  if (width >= 3840 && height >= 2160) return "tv-4k";
  if (width >= catalogMinimumTvWidth && height >= catalogMinimumTvHeight) return "tv";
  if (width >= 1600 && height >= 900) return "desktop";
  if (width >= 1000 && height >= 600) return "mobile";
  return "insufficient";
}

function hasVerifiedCategoryFit(location: GeoLocation): boolean {
  if (location.category === "flags") return true;
  if (location.catalogVariant === "curated-image") {
    return location.imageReviewStatus === "approved"
      && (location.imageCategoryFitScore ?? 0) >= catalogMinimumCuratedScore;
  }
  // Primary P18 images belong directly to the typed Wikidata item that was
  // used to create the category. Hand-written legacy URLs without that link
  // remain in the inventory, but no longer enter the strict live catalog.
  return Boolean(
    location.wikidataId
    && location.imageFile
    && (location.imageCategoryFitScore ?? 0) >= catalogMinimumCuratedScore
  );
}

export function catalogImageIssues(location: GeoLocation): CatalogImageIssue[] {
  if (location.category === "flags") {
    return location.imageReviewStatus === "quarantined" ? ["quarantined"] : [];
  }

  const issues: CatalogImageIssue[] = [];
  if (location.imageReviewStatus === "quarantined") issues.push("quarantined");
  if (isLandscapeContextExcluded(location.id)) issues.push("context-unusable");
  if (!hasVerifiedCategoryFit(location)) issues.push("category-unverified");
  if (location.catalogVariant === "curated-image" && (location.imageQualityScore ?? 0) < catalogMinimumCuratedScore) {
    issues.push("quality-score-low");
  }

  const captureYear = catalogImageCaptureYear(location);
  if (captureYear === null) issues.push("capture-date-missing");
  else if (captureYear < catalogMinimumCaptureYear) issues.push("captured-before-2010");

  const width = location.imageWidth ?? 0;
  const height = location.imageHeight ?? 0;
  if (!width || !height) {
    issues.push("dimensions-missing");
  } else {
    if (width < catalogMinimumTvWidth || height < catalogMinimumTvHeight) issues.push("resolution-below-tv");
    const aspectRatio = width / height;
    if (aspectRatio < catalogMinimumAspectRatio || aspectRatio > catalogMaximumAspectRatio) {
      issues.push("aspect-ratio-unsuitable");
    }
  }
  return issues;
}

export function isStrictCatalogImage(location: GeoLocation): boolean {
  return catalogImageIssues(location).length === 0;
}
