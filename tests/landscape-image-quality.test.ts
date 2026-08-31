import assert from "node:assert/strict";
import test from "node:test";
import { builtInLocations, catalogInventoryLocations } from "../data/locations";
import landscapeReviewJson from "../data/generated/landscape-context-review.generated.json";
import { catalogImageIssues } from "../lib/catalogImageQuality";
import {
  assessLandscapeContext,
  landscapeContextCatalogFingerprint,
  landscapeContextVisualReviews,
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
  assert.equal(landscapeReviewJson.automaticallyFlaggedImageCount, 18);
  assert.equal(landscapeReviewJson.visuallyReviewedImageCount, 19);
  assert.equal(landscapeReviewJson.visuallyApprovedImageCount, 10);
  assert.equal(landscapeReviewJson.visuallyExcludedImageCount, 9);
  assert.equal(landscapeReviewJson.pendingVisualReviewCount, 0);
  assert.equal(landscapeReviewJson.excludedImageCount, 9);
  assert.equal(landscapeReviewJson.reviewEntries.length, 19);
  assert.ok(landscapeReviewJson.reviewEntries.every((entry) => entry.reasons.length > 0));
  assert.ok(assessments.filter((entry) => entry.automaticReviewRequired).every((entry) => entry.visualDecision !== null));
  assert.ok(assessments.filter((entry) => entry.status === "excluded").every((entry) =>
    !builtInLocations.some((location) => location.id === entry.locationId)
  ));
});

test("visual review records stay bound to exact catalog files and decisions", () => {
  assert.equal(new Set(landscapeContextVisualReviews.map((entry) => entry.locationId)).size, landscapeContextVisualReviews.length);
  for (const review of landscapeContextVisualReviews) {
    const location = catalogInventoryLocations.find((entry) => entry.id === review.locationId);
    assert.ok(location, review.locationId);
    assert.equal(location.imageFile, review.sourceFile);
    assert.ok(review.reason.length >= 40);
    assert.ok(review.evidence.length > 0);
    assert.equal(catalogImageIssues(location).includes("context-unusable"), review.decision === "excluded");
  }
});
