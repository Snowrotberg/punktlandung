import test from "node:test";
import assert from "node:assert/strict";
import { builtInLocations, catalogInventoryLocations, prioritizeCatalogImages } from "../data/locations";
import licenseCatalog from "../data/generated/image-licenses.generated.json";
import { locationVisualKey } from "../data/locations";
import { shuffledLocationIds } from "../lib/locationSelection";
import { buildCatalogStatistics } from "../lib/catalogStatistics";
import { catalogImageIssues, catalogMinimumCaptureYear } from "../lib/catalogImageQuality";
import {
  imageFileNameForLicense,
  imageLicenseEntryMatchesFile,
  normalizeImageLicenseFileName
} from "../lib/imageLicenseLink";

test("historically played admin images retain exact license entries", () => {
  const historicalFiles = [
    "Brandenburger_Tor_abends.jpg",
    "Palácio Nacional da Pena por Rodrigo Tetsuo Argenton (15).jpg",
    "Waldenburg-Schloss-Fürstenstein-Schlosspark-IMG 5610-5×5B-360×180G-PanoS-05-08-2024.jpg"
  ];

  assert.ok(historicalFiles.every((fileName) =>
    licenseCatalog.entries.some((entry) => imageLicenseEntryMatchesFile(entry, fileName))
  ));
  const palaceEntry = licenseCatalog.entries.find((entry) =>
    imageLicenseEntryMatchesFile(entry, historicalFiles[1])
  );
  assert.match(palaceEntry?.artist ?? "", /Rodrigo Tetsuo Argenton/);
});

test("license catalogue deduplicates raw aliases and resolves every available entry completely", () => {
  assert.equal(licenseCatalog.rawCatalogFileCount, 3566);
  assert.equal(licenseCatalog.imageCount, 3561);
  assert.equal(licenseCatalog.entries.length, 3561);
  assert.equal(licenseCatalog.unavailableImageCount, 2);
  assert.equal(licenseCatalog.entries.reduce((count, entry) => count + Math.max(0, (entry.catalogFileNames?.length ?? 1) - 1), 0), 5);
  assert.equal(licenseCatalog.entries.filter((entry) =>
    normalizeImageLicenseFileName(entry.catalogFileName) !== normalizeImageLicenseFileName(entry.fileName)
  ).length, 2);
  assert.equal(licenseCatalog.entries.filter((entry) =>
    entry.availability !== "unavailable" && (!entry.artist || !entry.license || entry.artist === "Nicht angegeben" || entry.license === "Nicht angegeben")
  ).length, 0);
});

test("every currently playable Wikimedia image resolves to a complete license entry", () => {
  const activeFiles = builtInLocations
    .filter((location) => location.source === "wikimedia")
    .map(imageFileNameForLicense)
    .filter((fileName): fileName is string => Boolean(fileName));

  for (const fileName of activeFiles) {
    const entry = licenseCatalog.entries.find((candidate) => imageLicenseEntryMatchesFile(candidate, fileName));
    assert.ok(entry, `missing license entry for active file: ${fileName}`);
    assert.notEqual(entry.availability, "unavailable", `active file is unavailable: ${fileName}`);
    assert.ok(entry.artist && entry.license && entry.sourceUrl, `incomplete active entry: ${fileName}`);
  }
});

test("active catalog has enough unique tasks for every category and difficulty", () => {
  const statistics = buildCatalogStatistics(builtInLocations, catalogInventoryLocations);

  assert.ok(statistics.totalTasks >= 1600);
  assert.ok(statistics.countriesAndTerritories >= 190);
  assert.ok(statistics.sourceTasks >= 2800);
  assert.ok(statistics.sourceCountriesAndTerritories >= 204);
  assert.equal(statistics.categories.length, 5);
  assert.ok(statistics.uniqueVisuals >= 1750);
  assert.equal(statistics.missingLicenseImages, 0);
  assert.ok(statistics.licensedImages >= 1750);
  assert.equal(statistics.missingInventoryLicenseImages, 0);
  assert.equal(statistics.inventoryLicensedImages, 3559);
  assert.equal(statistics.unavailableInventoryImages, 2);

  for (const category of statistics.categories) {
    if (category.category === "flags") {
      assert.ok(category.total >= 190 && category.total <= 210, `flags should follow the real country and territory count`);
    } else {
      assert.ok(category.total >= 320, `${category.category} needs a strict catalog close to 400 playable tasks`);
    }
    assert.ok(category.easy >= 20, `${category.category}/easy needs at least 20 tasks`);
    assert.ok(category.medium >= 20, `${category.category}/medium needs at least 20 tasks`);
    assert.ok(category.hard >= 20, `${category.category}/hard needs at least 20 tasks`);
  }
});

test("manually quarantined conflict and weapon imagery is never playable", () => {
  const excludedIds = [
    "capitals-mogadischu-q2449",
    "capitals-manila-q1461-curated-9766taytay-rizal-roads-landmarks-buildings-11-jp",
    "capitals-manila-q1461-curated-south-view-from-lrt-1-doroteo-jose-station-manil",
    "capitals-quito-q2900-curated-under-a-roof-in-quito-jpg",
    "capitals-sarajevo-q11194-curated-sarajevo-debelo-brdo-7-jpg",
    "cities-bachmut-q706857",
    "cities-slowjansk-q33581",
    "landscapes-kreta-q34374-curated-a-repose-agios-nikolaos-beach-and-kassos-island-"
  ];
  assert.ok(excludedIds.every((id) => !builtInLocations.some((location) => location.id === id)));
});

test("all category and difficulty combinations draw 20 fresh matching images", () => {
  const categories = ["landmarks", "cities", "landscapes", "flags", "capitals"] as const;
  const difficulties = ["easy", "medium", "hard"] as const;

  for (const category of categories) {
    for (const difficulty of difficulties) {
      const ids = shuffledLocationIds(builtInLocations, category, difficulty, 20, [], null).slice(0, 20);
      const locations = ids.map((id) => builtInLocations.find((location) => location.id === id));
      assert.equal(locations.length, 20);
      assert.ok(locations.every((location) => location?.category === category));
      assert.ok(locations.every((location) => location?.difficulty === difficulty));
      assert.equal(new Set(locations.filter(Boolean).map((location) => locationVisualKey(location!))).size, 20);
    }
  }
});

test("recent images are not repeated in the next ten-round package", () => {
  const firstIds = shuffledLocationIds(builtInLocations, "landmarks", "easy", 10, [], null).slice(0, 10);
  const secondIds = shuffledLocationIds(builtInLocations, "landmarks", "easy", 10, firstIds, firstIds.at(-1)).slice(0, 10);
  const firstVisuals = new Set(firstIds.map((id) => locationVisualKey(builtInLocations.find((location) => location.id === id)!)));
  const secondVisuals = secondIds.map((id) => locationVisualKey(builtInLocations.find((location) => location.id === id)!));

  assert.ok(secondVisuals.every((visual) => !firstVisuals.has(visual)));
});

test("the smallest pool supports four consecutive ten-round games without repeats", () => {
  const recentIds: string[] = [];
  const seenVisuals = new Set<string>();

  for (let game = 0; game < 4; game += 1) {
    const ids = shuffledLocationIds(builtInLocations, "landscapes", "easy", 10, recentIds, recentIds.at(-1) ?? null).slice(0, 10);
    assert.equal(ids.length, 10);
    for (const id of ids) {
      const location = builtInLocations.find((entry) => entry.id === id);
      assert.ok(location);
      const visual = locationVisualKey(location);
      assert.ok(!seenVisuals.has(visual), `visual repeated too early: ${visual}`);
      seenVisuals.add(visual);
    }
    recentIds.push(...ids);
  }
});

test("reviewed images are raised gently without removing legacy images", () => {
  const legacy = builtInLocations.filter((location) => location.imageReviewStatus !== "approved").slice(0, 6);
  const reviewed = builtInLocations.filter((location) => location.imageReviewStatus === "approved").slice(0, 3);
  const prioritized = prioritizeCatalogImages([...legacy, ...reviewed]);

  assert.equal(prioritized.length, 9);
  assert.equal(new Set(prioritized.map((location) => location.id)).size, 9);
  assert.deepEqual(prioritized.slice(0, 3).map((location) => location.imageReviewStatus), ["approved", undefined, undefined]);
});

test("quality prioritization keeps the shuffled order inside each cohort", () => {
  const reviewed = builtInLocations.filter((location) => location.imageReviewStatus === "approved").slice(0, 4).reverse();
  const primary = builtInLocations.filter((location) => location.imageReviewStatus !== "approved").slice(0, 8).reverse();
  const input = [primary[0], reviewed[0], primary[1], reviewed[1], ...primary.slice(2), ...reviewed.slice(2)];
  const output = prioritizeCatalogImages(input);

  assert.deepEqual(
    output.filter((location) => location.imageReviewStatus === "approved").map((location) => location.id),
    input.filter((location) => location.imageReviewStatus === "approved").map((location) => location.id)
  );
});

test("every active image satisfies the strict 2010 TV profile", () => {
  assert.ok(builtInLocations.every((location) => catalogImageIssues(location).length === 0));
  const statistics = buildCatalogStatistics(builtInLocations, catalogInventoryLocations);
  assert.equal(statistics.strictQualifiedImages, statistics.totalTasks);
  assert.equal(statistics.sourceTasks, catalogInventoryLocations.length);
  assert.equal(statistics.excludedByQuality, statistics.sourceTasks - statistics.totalTasks);
  assert.ok(statistics.exclusionReasons["captured-before-2010"] > 0);
  assert.ok(statistics.exclusionReasons["resolution-below-tv"] > 0);
  assert.ok(catalogMinimumCaptureYear >= 2010);
});

test("fresh independent shuffles do not have a deterministic first image", () => {
  const firstImages = new Set<string>();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [firstId] = shuffledLocationIds(builtInLocations, "mixed", "medium", 15, [], null);
    assert.ok(firstId);
    firstImages.add(firstId);
  }
  assert.ok(firstImages.size >= 4, `only ${firstImages.size} different first images were selected`);
});
