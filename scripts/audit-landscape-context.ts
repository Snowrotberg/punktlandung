import { writeFile } from "node:fs/promises";
import path from "node:path";
import { builtInLocations, catalogInventoryLocations } from "../data/locations";
import { catalogImageIssues } from "../lib/catalogImageQuality";
import {
  assessLandscapeContext,
  landscapeContextCatalogFingerprint,
  landscapeContextExclusions
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
  const reviewEntries = assessments.filter((entry) => entry.status !== "pass");
  const output = {
    catalogFingerprint: landscapeContextCatalogFingerprint(assessments),
    checkedImageCount: assessments.length,
    activeImageCount: assessments.filter((entry) => activeIds.has(entry.locationId)).length,
    passedImageCount: assessments.filter((entry) => entry.status === "pass").length,
    reviewCandidateCount: assessments.filter((entry) => entry.status === "review").length,
    excludedImageCount: assessments.filter((entry) => entry.status === "excluded").length,
    exclusions: landscapeContextExclusions,
    reviewEntries
  };

  const outputPath = path.join(process.cwd(), "data", "generated", "landscape-context-review.generated.json");
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Landschaftskontext geprüft: ${output.checkedImageCount} technisch geeignete Motive, `
    + `${output.activeImageCount} aktiv, ${output.reviewCandidateCount} zur Sichtprüfung, ${output.excludedImageCount} quarantänisiert.`
  );
}

void main();
