import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInitialCatalogDifficultyBands,
  applyLocationDifficultyOverrides,
  buildLocationDifficultyMetrics,
  classifyLocationDifficulty,
  playableLocationsForDifficulty
} from "../lib/locationDifficulty";

test("initial catalog bands keep every category playable at every difficulty", () => {
  const categories = ["landmarks", "cities", "landscapes", "flags", "capitals"] as const;
  const locations = categories.flatMap((category) => Array.from({ length: 20 }, (_, index) => ({
    id: `${category}-${index}`,
    title: `${category} ${index}`,
    category,
    popularity: 100 - index
  } as unknown as import("../types/game").GeoLocation)));
  const balanced = applyInitialCatalogDifficultyBands(locations);

  for (const category of categories) {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      assert.ok(balanced.filter((location) => location.category === category && location.difficulty === difficulty).length > 0);
    }
  }
});

test("location difficulty metrics aggregate verified rounds per location", () => {
  const metrics = buildLocationDifficultyMetrics([
    { locationId: "alpha", points: 4000, responseTimeMs: 5_000, timeLimitSec: 15, successful: true },
    { locationId: "alpha", points: 2000, responseTimeMs: 15_000, timeLimitSec: 30, successful: false },
    { locationId: "beta", points: 5000, responseTimeMs: 12_000, timeLimitSec: 60, successful: true }
  ]);

  assert.deepEqual(metrics.get("alpha"), {
    verifiedRounds: 2,
    averagePoints: 3000,
    successRate: 0.5,
    medianResponseRatio: 0.41666666666666663
  });
  assert.deepEqual(metrics.get("beta"), {
    verifiedRounds: 1,
    averagePoints: 5000,
    successRate: 1,
    medianResponseRatio: 0.2
  });
});

test("location difficulty metrics reject untrusted observations", () => {
  assert.throws(() => buildLocationDifficultyMetrics([
    { locationId: "alpha", points: 5001, responseTimeMs: 1000, timeLimitSec: 15, successful: true }
  ]));
});

test("location difficulty keeps the fallback with insufficient verified data", () => {
  assert.deepEqual(classifyLocationDifficulty({
    verifiedRounds: 14,
    averagePoints: 100,
    successRate: 0,
    medianResponseRatio: 1
  }), { difficulty: "medium", confidence: "insufficient", sampleSize: 14 });
});

test("location difficulty becomes provisional at 15 and stable at 50 verified rounds", () => {
  const metrics = {
    averagePoints: 4400,
    successRate: 0.9,
    medianResponseRatio: 0.25
  };

  assert.equal(classifyLocationDifficulty({ ...metrics, verifiedRounds: 15 }).confidence, "provisional");
  assert.equal(classifyLocationDifficulty({ ...metrics, verifiedRounds: 49 }).confidence, "provisional");
  assert.equal(classifyLocationDifficulty({ ...metrics, verifiedRounds: 50 }).confidence, "stable");
});

test("location difficulty uses normalized verified metrics", () => {
  assert.equal(classifyLocationDifficulty({
    verifiedRounds: 120,
    averagePoints: 4400,
    successRate: 0.9,
    medianResponseRatio: 0.25
  }).difficulty, "easy");

  assert.equal(classifyLocationDifficulty({
    verifiedRounds: 120,
    averagePoints: 1300,
    successRate: 0.2,
    medianResponseRatio: 0.9
  }).difficulty, "hard");
});

test("location difficulty rejects invalid metrics", () => {
  assert.throws(() => classifyLocationDifficulty({
    verifiedRounds: 30,
    averagePoints: 5001,
    successRate: 0.5,
    medianResponseRatio: 0.5
  }));
});

test("persisted difficulty overrides affect ranked catalog copies only", () => {
  const locations = [
    { id: "alpha", difficulty: "easy" } as unknown as import("../types/game").GeoLocation,
    { id: "beta", difficulty: "hard" } as unknown as import("../types/game").GeoLocation
  ];

  const result = applyLocationDifficultyOverrides(locations, [
    { locationId: "alpha", suggestedDifficulty: "hard", confidence: "stable" },
    { locationId: "beta", suggestedDifficulty: "easy", confidence: "insufficient" }
  ]);

  assert.equal(result[0].difficulty, "hard");
  assert.equal(result[1].difficulty, "hard");
  assert.equal(locations[0].difficulty, "easy");
});

test("difficulty selection fills a short category pool without duplicating locations", () => {
  const locations = [
    { id: "easy-1", difficulty: "easy" } as unknown as import("../types/game").GeoLocation,
    { id: "medium-1", difficulty: "medium" } as unknown as import("../types/game").GeoLocation,
    { id: "hard-1", difficulty: "hard" } as unknown as import("../types/game").GeoLocation
  ];

  assert.deepEqual(
    playableLocationsForDifficulty(locations, "easy", 2).map((location) => location.id),
    ["easy-1", "medium-1", "hard-1"]
  );
});
