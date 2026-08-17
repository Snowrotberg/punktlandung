import assert from "node:assert/strict";
import test from "node:test";
import { bestAveragePointsByCategory, calculateFlagAccuracy } from "../lib/accountStatistics";

test("flag accuracy uses resolved flag rounds only", () => {
  assert.deepEqual(calculateFlagAccuracy([
      { status: "resolved", location: { category: "flags" }, result: { countryCorrect: true } },
      { status: "resolved", location: { category: "flags" }, result: { countryCorrect: false } },
      { status: "resolved", location: { category: "cities" }, result: { countryCorrect: false } },
      { status: "pending", location: { category: "flags" }, result: { countryCorrect: true } }
    ]), { hits: 1, total: 2, percentage: 50 });
});

test("flag accuracy does not report a false zero without flag rounds", () => {
  assert.deepEqual(calculateFlagAccuracy([
      { status: "resolved", location: { category: "landscapes" }, result: { countryCorrect: false } }
    ]), { hits: 0, total: 0, percentage: null });
});

test("category results are compared by points per completed round", () => {
  assert.deepEqual(bestAveragePointsByCategory([
      { category: "mixed", score: 30_000, completed_rounds: 20, planned_rounds: 20 },
      { category: "mixed", score: 20_000, completed_rounds: 10, planned_rounds: 10 },
      { category: "cities", score: 18_000, completed_rounds: null, planned_rounds: 10 }
    ]), [["mixed", 2_000], ["cities", 1_800]]);
});
