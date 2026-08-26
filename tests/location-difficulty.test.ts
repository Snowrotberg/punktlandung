import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInitialCatalogDifficultyBands,
  applyLocationDifficultyOverrides,
  buildLocationDifficultyMetrics,
  classifyLocationDifficulty,
  playableLocationsForDifficulty,
  summarizeLocationDifficultyMovements
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
    { locationId: "alpha", category: "cities", points: 4000, distanceKm: 100, countryCorrect: false, responseTimeMs: 5_000, timeLimitSec: 15 },
    { locationId: "alpha", category: "cities", points: 2000, distanceKm: 800, countryCorrect: true, responseTimeMs: 15_000, timeLimitSec: 30 },
    { locationId: "beta", category: "flags", points: 5000, distanceKm: 2_000, countryCorrect: true, responseTimeMs: 12_000, timeLimitSec: 60 }
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
    { locationId: "alpha", category: "cities", points: 5001, distanceKm: 10, countryCorrect: false, responseTimeMs: 1000, timeLimitSec: 15 }
  ]));
});

test("solved rounds use exact countries for flags and distance for map motifs", () => {
  const metrics = buildLocationDifficultyMetrics([
    { locationId: "flag", category: "flags", points: 4900, distanceKm: 10, countryCorrect: false, responseTimeMs: 1000, timeLimitSec: 15 },
    { locationId: "flag", category: "flags", points: 1000, distanceKm: 2_000, countryCorrect: true, responseTimeMs: 1000, timeLimitSec: 15 },
    { locationId: "city", category: "cities", points: 3000, distanceKm: 749.9, countryCorrect: false, responseTimeMs: 1000, timeLimitSec: 15 },
    { locationId: "city", category: "cities", points: 3000, distanceKm: 750, countryCorrect: true, responseTimeMs: 1000, timeLimitSec: 15 }
  ]);

  assert.equal(metrics.get("flag")?.successRate, 0.5);
  assert.equal(metrics.get("city")?.successRate, 0.5);
});

test("location difficulty keeps the fallback with insufficient verified data", () => {
  assert.deepEqual(classifyLocationDifficulty({
    verifiedRounds: 9,
    averagePoints: 100,
    successRate: 0,
    medianResponseRatio: 1
  }), { difficulty: "medium", confidence: "insufficient", sampleSize: 9 });
});

test("location difficulty becomes provisional at 10 and stable at 25 verified rounds", () => {
  const metrics = {
    averagePoints: 4400,
    successRate: 0.9,
    medianResponseRatio: 0.25
  };

  assert.equal(classifyLocationDifficulty({ ...metrics, verifiedRounds: 10 }).confidence, "provisional");
  assert.equal(classifyLocationDifficulty({ ...metrics, verifiedRounds: 24 }).confidence, "provisional");
  assert.equal(classifyLocationDifficulty({ ...metrics, verifiedRounds: 25 }).confidence, "stable");
});

test("difficulty movement summary compares data-based results with catalog starting bands", () => {
  const locations = [
    { id: "easy-to-medium", difficulty: "easy" },
    { id: "medium-to-easy", difficulty: "medium" },
    { id: "hard-unchanged", difficulty: "hard" },
    { id: "insufficient", difficulty: "easy" }
  ] as unknown as import("../types/game").GeoLocation[];

  assert.deepEqual(summarizeLocationDifficultyMovements(locations, [
    { locationId: "easy-to-medium", suggestedDifficulty: "medium", confidence: "provisional" },
    { locationId: "medium-to-easy", suggestedDifficulty: "easy", confidence: "stable" },
    { locationId: "hard-unchanged", suggestedDifficulty: "hard", confidence: "stable" },
    { locationId: "insufficient", suggestedDifficulty: "hard", confidence: "insufficient" },
    { locationId: "not-in-catalog", suggestedDifficulty: "easy", confidence: "stable" }
  ]), {
    dataBasedTotal: 3,
    byDifficulty: { easy: 1, medium: 1, hard: 1 },
    movement: { easier: 1, unchanged: 1, harder: 1 }
  });
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

  assert.equal(classifyLocationDifficulty({
    verifiedRounds: 25,
    averagePoints: 3000,
    successRate: 0.65,
    medianResponseRatio: 0.55
  }).difficulty, "medium");
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
