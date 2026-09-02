import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { accountRoundMapMounts, buildAccountRoundReplayMap } from "../lib/accountRoundReplayMap";
import { resultWorldMinimumZoom } from "../lib/resultMapViewport";
import type { GeoLocation, RoundResult } from "../types/game";

const location: GeoLocation = {
  id: "flag-rwanda",
  title: "Flagge von Ruanda",
  countryCode: "RW",
  countryName: "Ruanda",
  continent: "Afrika",
  category: "flags",
  difficulty: "medium",
  lat: -1.9525,
  lng: 30.115,
  panoramaUrl: "https://example.com/rwanda.png",
  attribution: "Test",
  source: "wikimedia"
};

function result(guess: RoundResult["guess"]): RoundResult {
  return {
    playerId: "player-1",
    distanceKm: guess ? 8_420 : 0,
    points: guess ? 820 : 0,
    badge: "",
    eliminated: false,
    guess,
    countryCorrect: false
  };
}

test("account replay preserves stored guess and target coordinates for the result-map callsite", () => {
  const replay = buildAccountRoundReplayMap({
    location,
    result: result({ playerId: "player-1", lat: 13.146, lng: -59.642, createdAt: 1 }),
    resolvedAt: 42,
    playerName: "Tim"
  });

  assert.equal(replay.kind, "guess-and-target");
  if (replay.kind !== "guess-and-target") return;
  assert.deepEqual(replay.summary.results[0]?.guess, { playerId: "player-1", lat: 13.146, lng: -59.642, createdAt: 1 });
  assert.equal(replay.summary.location.lat, -1.9525);
  assert.equal(replay.summary.location.lng, 30.115);
  assert.equal(replay.summary.location.title, "Flagge von Ruanda");
});

test("a round without a guess is an explicit target-only result without a synthetic player point", () => {
  const replay = buildAccountRoundReplayMap({
    location,
    result: result(null),
    resolvedAt: 42,
    playerName: "Tim"
  });

  assert.equal(replay.kind, "target-only");
  if (replay.kind !== "target-only") return;
  assert.equal(replay.summary.results[0]?.guess, null);
  assert.deepEqual(replay.summary.location, location);
  assert.equal(replay.summary.crewGuess, null);
});

test("lazy replay mounts follow delayed scrolling and keep only the modal map while maximized", () => {
  assert.deepEqual(accountRoundMapMounts({ nearViewport: false, maximized: false }), { embedded: false, modal: false });
  assert.deepEqual(accountRoundMapMounts({ nearViewport: true, maximized: false }), { embedded: true, modal: false });
  assert.deepEqual(accountRoundMapMounts({ nearViewport: true, maximized: true }), { embedded: false, modal: true });
  assert.deepEqual(accountRoundMapMounts({ nearViewport: false, maximized: true }), { embedded: false, modal: true });
  assert.deepEqual(accountRoundMapMounts({ nearViewport: false, maximized: false }), { embedded: false, modal: false });
  assert.deepEqual(accountRoundMapMounts({ nearViewport: true, maximized: false }), { embedded: true, modal: false });
});

test("compact account replays may zoom out fractionally without changing normal result-map limits", () => {
  assert.ok(resultWorldMinimumZoom(319, true) > 0);
  assert.ok(resultWorldMinimumZoom(319, true) < 1);
  assert.equal(resultWorldMinimumZoom(319, false), 1);
});

test("account replay maps allow panning and expose the shared north reset", async () => {
  const source = await readFile(new URL("../components/AccountRoundMap.tsx", import.meta.url), "utf8");
  assert.match(source, /noPan=\{false\}/);
  assert.match(source, /aria-label="Karte nach Norden ausrichten und Ergebnis einpassen"/);
  assert.match(source, /onClick=\{\(\) => setMapReadyVersion/);
});
