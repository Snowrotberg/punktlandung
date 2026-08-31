import { writeFile } from "node:fs/promises";
import path from "node:path";
import { builtInLocations, catalogInventoryLocations } from "../data/locations";
import { catalogImageIssues } from "../lib/catalogImageQuality";
import {
  assessLandscapeContext,
  landscapeContextCatalogFingerprint,
  landscapeContextExclusions,
  landscapeContextVisualReviews
} from "../lib/landscapeImageQuality";

async function main() {
  const technicalCandidates = catalogInventoryLocations.filter((location) =>
    location.category === "landscapes"
    && catalogImageIssues(location).every((issue) => issue === "context-unusable")
  );
  const assessments = technicalCandidates
    .map(assessLandscapeContext)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const activeIds = new Set(builtInLocations.filter((location) => location.category === "landscapes").map((location) => location.id));
  const automaticallyFlagged = assessments.filter((entry) => entry.automaticReviewRequired);
  const pendingVisualReviews = automaticallyFlagged.filter((entry) => entry.visualDecision === null);
  const reviewEntries = assessments.filter((entry) => entry.automaticReviewRequired || entry.status === "excluded");
  const output = {
    catalogFingerprint: landscapeContextCatalogFingerprint(assessments),
    checkedImageCount: assessments.length,
    activeImageCount: assessments.filter((entry) => activeIds.has(entry.locationId)).length,
    passedImageCount: assessments.filter((entry) => entry.status === "pass").length,
    automaticallyFlaggedImageCount: automaticallyFlagged.length,
    visuallyReviewedImageCount: assessments.filter((entry) => entry.visualDecision !== null).length,
    visuallyApprovedImageCount: assessments.filter((entry) => entry.visualDecision === "approved").length,
    visuallyExcludedImageCount: assessments.filter((entry) => entry.visualDecision === "excluded").length,
    pendingVisualReviewCount: pendingVisualReviews.length,
    excludedImageCount: assessments.filter((entry) => entry.status === "excluded").length,
    exclusions: landscapeContextExclusions,
    visualReviews: landscapeContextVisualReviews,
    reviewEntries
  };

  const outputPath = path.join(process.cwd(), "data", "generated", "landscape-context-review.generated.json");
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Landschaftskontext geprüft: ${output.checkedImageCount} technisch geeignete Motive, `
    + `${output.automaticallyFlaggedImageCount} automatisch markiert, ${output.visuallyReviewedImageCount} visuell entschieden, `
    + `${output.pendingVisualReviewCount} offen, ${output.excludedImageCount} quarantänisiert, ${output.activeImageCount} aktiv.`
  );
}

void main();
