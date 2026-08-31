import landscapeContextExclusionsJson from "@/data/landscape-context-exclusions.json";
import landscapeContextVisualReviewsJson from "@/data/landscape-context-visual-reviews.json";
import type { GeoLocation } from "@/types/game";

export const mobileLandscapeFrameAspectRatio = 655 / 427;
export const minimumMobileContextRetention = 0.65;

export type LandscapeContextRisk =
  | "context-excluded"
  | "foreground-subject"
  | "generic-natural-detail"
  | "mobile-extreme-crop";

export type LandscapeContextAssessment = {
  locationId: string;
  title: string;
  countryName: string;
  imageFile: string;
  imageWidth: number | null;
  imageHeight: number | null;
  mobileVisibleFraction: number | null;
  automaticReviewRequired: boolean;
  visualDecision: "approved" | "excluded" | null;
  status: "pass" | "review" | "excluded";
  reasons: LandscapeContextRisk[];
};

type LandscapeContextExclusion = {
  locationId: string;
  reason: string;
  sourceFile: string;
  evidence: string;
};

export type LandscapeContextVisualReview = LandscapeContextExclusion & {
  decision: "approved" | "excluded";
};

export const landscapeContextExclusions = landscapeContextExclusionsJson as LandscapeContextExclusion[];
export const landscapeContextVisualReviews = landscapeContextVisualReviewsJson as LandscapeContextVisualReview[];
const excludedLocationIds = new Set(landscapeContextExclusions.map((entry) => entry.locationId));
const visualReviewByLocationId = new Map(landscapeContextVisualReviews.map((entry) => [entry.locationId, entry]));

const foregroundSubjectPattern = /\b(?:animals?|birds?|camels?|deer|drivers?|gulls?|herons?|hikers?|horses?|lizards?|people|persons?|tourists?)\b/i;
const genericNaturalDetailPattern = /\b(?:boulders?|close[ _-]?ups?|details?|flowers?|forest|gravel|leaves|macro|moss|pebbles?|rocks?|stones?|stream|texture|vegetation)\b/i;

function imageFileName(location: GeoLocation): string {
  if (location.imageFile) return location.imageFile;
  try {
    return decodeURIComponent(new URL(location.panoramaUrl).pathname.split("/").at(-1) ?? "");
  } catch {
    return location.panoramaUrl;
  }
}

export function isLandscapeContextExcluded(locationId: string): boolean {
  return excludedLocationIds.has(locationId);
}

export function mobileLandscapeVisibleFraction(location: GeoLocation): number | null {
  const width = location.imageWidth ?? 0;
  const height = location.imageHeight ?? 0;
  if (width <= 0 || height <= 0) return null;
  const sourceAspectRatio = width / height;
  return sourceAspectRatio >= mobileLandscapeFrameAspectRatio
    ? mobileLandscapeFrameAspectRatio / sourceAspectRatio
    : sourceAspectRatio / mobileLandscapeFrameAspectRatio;
}

export function assessLandscapeContext(location: GeoLocation): LandscapeContextAssessment | null {
  if (location.category !== "landscapes") return null;
  const fileName = imageFileName(location);
  const automaticReasons: LandscapeContextRisk[] = [];
  const excluded = isLandscapeContextExcluded(location.id);
  if (foregroundSubjectPattern.test(fileName)) automaticReasons.push("foreground-subject");
  if (genericNaturalDetailPattern.test(fileName)) automaticReasons.push("generic-natural-detail");
  const visibleFraction = mobileLandscapeVisibleFraction(location);
  if (visibleFraction !== null && visibleFraction < minimumMobileContextRetention) automaticReasons.push("mobile-extreme-crop");
  const visualReview = visualReviewByLocationId.get(location.id);
  const reasons = excluded ? ["context-excluded" as const, ...automaticReasons] : automaticReasons;

  return {
    locationId: location.id,
    title: location.title,
    countryName: location.countryName,
    imageFile: fileName,
    imageWidth: location.imageWidth ?? null,
    imageHeight: location.imageHeight ?? null,
    mobileVisibleFraction: visibleFraction === null ? null : Math.round(visibleFraction * 1000) / 1000,
    automaticReviewRequired: automaticReasons.length > 0,
    visualDecision: visualReview?.decision ?? null,
    status: excluded ? "excluded" : automaticReasons.length > 0 && !visualReview ? "review" : "pass",
    reasons
  };
}

export function landscapeContextCatalogFingerprint(assessments: readonly LandscapeContextAssessment[]): string {
  const stableRows = assessments
    .map((entry) => [
      entry.locationId,
      entry.imageFile,
      entry.imageWidth,
      entry.imageHeight,
      entry.automaticReviewRequired,
      entry.visualDecision,
      entry.status,
      ...entry.reasons
    ].join("|"))
    .sort()
    .join("\n");
  let hash = 0x811c9dc5;
  for (let index = 0; index < stableRows.length; index += 1) {
    hash ^= stableRows.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
