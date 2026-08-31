import assert from "node:assert/strict";
import test from "node:test";
import { builtInLocations, catalogInventoryLocations } from "../data/locations";
import landscapeReviewJson from "../data/generated/landscape-context-review.generated.json";
import { catalogImageIssues } from "../lib/catalogImageQuality";
import {
  assessLandscapeContext,
  landscapeContextCatalogFingerprint,
  mobileLandscapeVisibleFraction
} from "../lib/landscapeImageQuality";
import imageLicensesJson from "../data/generated/image-licenses.generated.json";

const ruapehuId = "landscapes-ruapehu-q207284-curated-northern-slope-of-mount-ruapehu-09-jpg";

test("the context-free Ruapehu close-up is quarantined without losing its source record", () => {
  const inventoryLocation = catalogInventoryLocations.find((location) => location.id === ruapehuId);
  assert.ok(inventoryLocation);
  assert.ok(catalogImageIssues(inventoryLocation).includes("context-unusable"));
  assert.ok(!builtInLocations.some((location) => location.id === ruapehuId));
  assert.ok(Math.abs((mobileLandscapeVisibleFraction(inventoryLocation) ?? 0) - 0.978) < 0.001);
  assert.ok(imageLicensesJson.entries.some((entry) => entry.catalogFileName === "Northern slope of Mount Ruapehu 09.jpg"));
});

test("the generated landscape review covers every technically qualified candidate", () => {
  const assessments = catalogInventoryLocations
    .filter((location) => location.category === "landscapes" && catalogImageIssues(location).every((issue) => issue === "context-unusable"))
    .map(assessLandscapeContext)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  assert.equal(landscapeReviewJson.checkedImageCount, assessments.length);
  assert.equal(landscapeReviewJson.activeImageCount, builtInLocations.filter((location) => location.category === "landscapes").length);
  assert.equal(landscapeReviewJson.catalogFingerprint, landscapeContextCatalogFingerprint(assessments));
  assert.equal(
    landscapeReviewJson.reviewEntries.length,
    landscapeReviewJson.reviewCandidateCount + landscapeReviewJson.excludedImageCount
  );
  assert.ok(landscapeReviewJson.reviewEntries.every((entry) => entry.reasons.length > 0));
});
