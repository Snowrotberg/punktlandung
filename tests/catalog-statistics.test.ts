import test from "node:test";
import assert from "node:assert/strict";
import { builtInLocations, prioritizeCatalogImages } from "../data/locations";
import { locationVisualKey } from "../data/locations";
import { shuffledLocationIds } from "../lib/locationSelection";
import { buildCatalogStatistics } from "../lib/catalogStatistics";

test("active catalog has enough unique tasks for every category and difficulty", () => {
  const statistics = buildCatalogStatistics(builtInLocations);

  assert.ok(statistics.totalTasks >= 1200);
  assert.equal(statistics.countriesAndTerritories, 204);
  assert.equal(statistics.categories.length, 5);
  assert.ok(statistics.uniqueVisuals >= 1200);

  for (const category of statistics.categories) {
    assert.ok(category.total >= 20, `${category.category} needs at least 20 tasks`);
    assert.ok(category.easy >= 20, `${category.category}/easy needs at least 20 tasks`);
    assert.ok(category.medium >= 20, `${category.category}/medium needs at least 20 tasks`);
    assert.ok(category.hard >= 20, `${category.category}/hard needs at least 20 tasks`);
  }
});

test("manually quarantined conflict and weapon imagery is never playable", () => {
  const excludedIds = [
    "capitals-mogadischu-q2449",
    "cities-bachmut-q706857",
    "cities-slowjansk-q33581"
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
